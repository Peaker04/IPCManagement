using System.IdentityModel.Tokens.Jwt;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using IPCManagement.Api.Features.Auth.Contracts;

namespace IPCManagement.Api.Features.Auth.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository   _userRepository;
    private readonly ITokenService     _tokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly ILogger<AuthService> _logger;
    private readonly JwtSettings _settings;

    public AuthService(
        IUserRepository       userRepository,
        ITokenService         tokenService,
        IRefreshTokenRepository refreshTokenRepository,
        IEfTransactionRunner transactionRunner,
        ILogger<AuthService> logger,
        IOptions<JwtSettings> settings)
    {
        _userRepository = userRepository;
        _tokenService   = tokenService;
        _refreshTokenRepository = refreshTokenRepository;
        _transactionRunner = transactionRunner;
        _logger = logger;
        _settings = settings.Value;
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public async Task<LoginResponseDto?> LoginAsync(LoginRequest request, string deviceInfo = "")
    {
        var user = await _userRepository.FindByUsernameAsync(request.Username);
        if (user is null || user.IsActive == false)
        {
            _logger.LogWarning("Login rejected for unknown or inactive account.");
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Login rejected for user {UserId} due to invalid password", GuidHelper.ToGuidString(user.UserId));
            return null;
        }

        var userId   = GuidHelper.ToGuidString(user.UserId);
        var roleName = user.Role?.RoleName ?? "Unknown";
        var roleCode = user.Role?.RoleCode ?? string.Empty;

        var issued = BuildLoginResponse(
            user.UserId,
            userId,
            user.Username,
            user.FullName,
            roleCode,
            roleName,
            deviceInfo);
        var issuedSession = await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                if (!await _userRepository.LockActiveUserForSessionMutationAsync(user.UserId, cancellationToken))
                {
                    return false;
                }

                await _refreshTokenRepository.PrepareForLoginAsync(
                    user.UserId,
                    deviceInfo,
                    _settings.MaxActiveRefreshTokens - 1);
                _refreshTokenRepository.Add(issued.RefreshToken);
                await _refreshTokenRepository.SaveChangesAsync();
                return true;
            },
            async _ => await _refreshTokenRepository.FindByHashAsync(issued.RefreshToken.TokenHash) is not null);

        if (!issuedSession)
        {
            _logger.LogWarning("Login rejected because the user became inactive before session issuance.");
            return null;
        }

        _logger.LogInformation("Issued tokens for user {UserId}", userId);

        return issued.Response;
    }

    // ── Refresh Token ─────────────────────────────────────────────────────────

    public async Task<LoginResponseDto?> RefreshTokenAsync(RefreshTokenRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.AccessToken) ||
                string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return null;
            }

            // 1. Validate chữ ký + claims của access token (bỏ qua expired)
            var principal = _tokenService.GetPrincipalFromExpiredToken(request.AccessToken);
            if (principal is null)
            {
                _logger.LogWarning("Refresh rejected because access token is invalid or tampered.");
                return null;
            }

            var userIdStr = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (userIdStr is null)
            {
                _logger.LogWarning("Refresh rejected because subject claim is missing.");
                return null;
            }

            var userId = GuidHelper.ParseGuidString(userIdStr);
            if (userId is null)
            {
                _logger.LogWarning("Refresh rejected because subject claim is not a valid user id.");
                return null;
            }


            // 2. Tìm refresh token trong DB theo hash
            var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);
            var stored    = await _refreshTokenRepository.FindValidByHashAsync(tokenHash, userId);

            if (stored is null || stored.User.IsActive == false || stored.IsRevoked || stored.IsUsed || stored.ExpiresAt < DateTime.UtcNow)
            {
                _logger.LogWarning(
                    "Refresh rejected for user {UserId}",
                    GuidHelper.ToGuidString(userId));
                return null;
            }

            var user     = stored.User;
            var roleName = user.Role?.RoleName ?? "Unknown";
            var roleCode = user.Role?.RoleCode ?? string.Empty;
            var issued = BuildLoginResponse(
                user.UserId, userIdStr, user.Username, user.FullName, roleCode, roleName, stored.DeviceInfo);
            issued.RefreshToken.ExpiresAt = stored.ExpiresAt;

            var rotated = await _transactionRunner.ExecuteAsync(
                async cancellationToken =>
                {
                    // Serialize login, refresh and deactivation on the same user row before
                    // inspecting token state or creating a successor.
                    if (!await _userRepository.LockActiveUserForSessionMutationAsync(userId, cancellationToken))
                    {
                        return false;
                    }

                    // Reload inside the retryable transaction: EfTransactionRunner clears tracked
                    // state between attempts, so mutable entities cannot be captured from outside.
                    var tokenToRotate = await _refreshTokenRepository.FindValidByHashAsync(tokenHash, userId);
                    if (tokenToRotate is null || tokenToRotate.User.IsActive == false ||
                        tokenToRotate.IsRevoked || tokenToRotate.IsUsed || tokenToRotate.ExpiresAt < DateTime.UtcNow)
                    {
                        return false;
                    }

                    tokenToRotate.IsUsed = true;
                    tokenToRotate.IsRevoked = true;
                    tokenToRotate.RevokedAt = DateTime.UtcNow;
                    tokenToRotate.ReplacedByToken = issued.RefreshToken.TokenHash;
                    _refreshTokenRepository.Add(issued.RefreshToken);
                    await _refreshTokenRepository.SaveChangesAsync();
                    return true;
                },
                async _ => await _refreshTokenRepository.FindByHashAsync(issued.RefreshToken.TokenHash) is not null);

            if (!rotated)
            {
                _logger.LogWarning("Refresh rejected because the user or token changed before rotation.");
                return null;
            }

            _logger.LogInformation("Refresh succeeded for user {UserId}", userIdStr);

            return issued.Response;
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Database error during refresh token rotation.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during refresh token flow.");
            throw;
        }
    }

    // ── Revoke (Logout) ────────────────────────────────────────────────────────

    public async Task<bool> RevokeTokenAsync(RevokeTokenRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return false;
            }

            var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);
            var stored    = await _refreshTokenRepository.FindByHashAsync(tokenHash);

            if (stored is null)
            {
                _logger.LogWarning("Logout/revoke requested for unknown refresh token.");
                return false;
            }

            if (stored.IsRevoked)
            {
                _logger.LogInformation(
                    "Logout/revoke requested for already revoked token owned by user {UserId}",
                    GuidHelper.ToGuidString(stored.UserId));
                return true;
            }

            stored.IsRevoked  = true;
            stored.RevokedAt  = DateTime.UtcNow;
            await _refreshTokenRepository.SaveChangesAsync();

            _logger.LogInformation(
                "Refresh token revoked for user {UserId}",
                GuidHelper.ToGuidString(stored.UserId));
            return true;
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Database error during refresh token revocation.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during revoke token flow.");
            throw;
        }
    }

    // ── Profile ─────────────────────────────────────────────────────────────────

    public async Task<UserInfoDto?> GetProfileAsync(string userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var user = await _userRepository.GetWithRoleAsync(userIdBytes);
        if (user is null || user.IsActive == false) return null;

        var roleCode = user.Role?.RoleCode ?? string.Empty;
        var roleName = user.Role?.RoleName ?? "Unknown";
        var permissions = BuildPermissionsForRole(roleCode, roleName);

        return new UserInfoDto
        {
            UserId   = GuidHelper.ToGuidString(user.UserId),
            FullName = user.FullName,
            Username = user.Username,
            RoleCode = roleCode,
            RoleName = roleName,
            IsActive = true,
            IsAdminFullAccess = IsAdminRole(roleCode, roleName),
            Permissions = permissions
        };
    }

    public async Task<UserProfileResponseDto?> GetMeAsync(string userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var user = await _userRepository.GetWithRoleAsync(userIdBytes);
        if (user is null || user.IsActive == false) return null;

        var roleName = user.Role?.RoleName ?? "Unknown";
        var permissions = AuthorizationPolicies.ResolvePermissions(roleName);

        return new UserProfileResponseDto
        {
            User = new UserInfoDto
            {
                UserId = GuidHelper.ToGuidString(user.UserId),
                FullName = user.FullName,
                Username = user.Username,
                RoleName = roleName,
                IsActive = true
            },
            Permissions = permissions,
            IsAdmin = AuthorizationPolicies.IsAdminRole(roleName)
        };
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private IssuedLogin BuildLoginResponse(
        byte[] userIdBytes, string userId,
        string username,    string fullName,
        string roleCode,    string roleName,
        string deviceInfo = "")
    {
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var tokenHash       = _tokenService.HashRefreshToken(rawRefreshToken);

        var refreshToken = new RefreshToken
        {
            TokenId    = GuidHelper.NewId(),
            UserId     = userIdBytes,
            TokenHash  = tokenHash,
            DeviceInfo = deviceInfo,
            CreatedAt  = DateTime.UtcNow,
            ExpiresAt  = DateTime.UtcNow.AddDays(_tokenService.GetRefreshTokenExpiryDays()),
            IsUsed     = false,
            IsRevoked  = false
        };

        var permissions = BuildPermissionsForRole(roleCode, roleName);

        var response = new LoginResponseDto
        {
            AccessToken  = _tokenService.GenerateAccessToken(userId, username, fullName, roleName),
            RefreshToken = rawRefreshToken,
            ExpiresIn    = _tokenService.GetAccessTokenExpirySeconds(),
            User = new UserInfoDto
            {
                UserId   = userId,
                FullName = fullName,
                Username = username,
                RoleCode = roleCode,
                RoleName = roleName,
                IsActive = true,
                IsAdminFullAccess = IsAdminRole(roleCode, roleName),
                Permissions = permissions
            }
        };

        return new IssuedLogin(response, refreshToken);
    }

    private sealed record IssuedLogin(LoginResponseDto Response, RefreshToken RefreshToken);

    private static bool IsAdminRole(string? roleCode, string? roleName)
        => MatchesAny(roleCode, roleName, ["Admin", "ADMIN", "Quản trị"]);

    private static List<string> BuildPermissionsForRole(string? roleCode, string? roleName)
    {
        if (IsAdminRole(roleCode, roleName))
        {
            return ["*"];
        }

        var permissions = AuthorizationPolicies.ResolvePermissions(roleCode);
        return (permissions.Count > 0 ? permissions : AuthorizationPolicies.ResolvePermissions(roleName)).ToList();
    }

    private static void AddPermissionIfMatches(
        ICollection<string> permissions,
        string permission,
        string? roleCode,
        string? roleName,
        string[] allowedRoles)
    {
        if (MatchesAny(roleCode, roleName, allowedRoles))
        {
            if (!permissions.Contains(permission))
            {
                permissions.Add(permission);
            }
        }
    }

    private static bool MatchesAny(string? roleCode, string? roleName, string[] allowedRoles)
        => allowedRoles.Any(allowed =>
            string.Equals(allowed, roleCode, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(allowed, roleName, StringComparison.OrdinalIgnoreCase));
}
