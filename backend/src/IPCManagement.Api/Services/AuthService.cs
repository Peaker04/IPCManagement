using System.IdentityModel.Tokens.Jwt;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository   _userRepository;
    private readonly ITokenService     _tokenService;
    private readonly IRefreshTokenRepository _refreshTokenRepository;

    public AuthService(
        IUserRepository       userRepository,
        ITokenService         tokenService,
        IRefreshTokenRepository refreshTokenRepository)
    {
        _userRepository = userRepository;
        _tokenService   = tokenService;
        _refreshTokenRepository = refreshTokenRepository;
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto request, string deviceInfo = "")
    {
        var user = await _userRepository.FindByUsernameAsync(request.Username);
        if (user is null || user.IsActive == false) return null;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)) return null;

        var userId   = GuidHelper.ToGuidString(user.UserId);
        var roleName = user.Role?.RoleName ?? "Unknown";
        var roleCode = user.Role?.RoleCode ?? string.Empty;

        return await BuildLoginResponseAsync(user.UserId, userId, user.Username, user.FullName, roleCode, roleName, deviceInfo);
    }

    // ── Refresh Token ─────────────────────────────────────────────────────────

    public async Task<LoginResponseDto?> RefreshTokenAsync(RefreshTokenRequestDto request)
    {
        // 1. Validate chữ ký + claims của access token (bỏ qua expired)
        var principal = _tokenService.GetPrincipalFromExpiredToken(request.AccessToken);
        if (principal is null) return null;

        var userIdStr = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (userIdStr is null) return null;

        var userId = GuidHelper.ParseGuidString(userIdStr);
        if (userId is null) return null;


        // 2. Tìm refresh token trong DB theo hash
        var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);
        var stored    = await _refreshTokenRepository.FindValidByHashAsync(tokenHash, userId);

        if (stored is null || stored.IsRevoked || stored.IsUsed || stored.ExpiresAt < DateTime.UtcNow)
            return null;

        // 3. Đánh dấu token cũ đã dùng (Token Rotation)
        stored.IsUsed   = true;
        stored.RevokedAt = DateTime.UtcNow;

        var user     = stored.User;
        var roleName = user.Role?.RoleName ?? "Unknown";
        var roleCode = user.Role?.RoleCode ?? string.Empty;
        var newResponse = await BuildLoginResponseAsync(
            user.UserId, userIdStr, user.Username, user.FullName, roleCode, roleName);

        // Ghi hash của token mới vào trường replacedByToken để audit
        stored.ReplacedByToken = _tokenService.HashRefreshToken(newResponse.RefreshToken);

        await _refreshTokenRepository.SaveChangesAsync();
        return newResponse;
    }

    // ── Revoke (Logout) ────────────────────────────────────────────────────────

    public async Task<bool> RevokeTokenAsync(RevokeTokenRequestDto request)
    {
        var tokenHash = _tokenService.HashRefreshToken(request.RefreshToken);
        var stored    = await _refreshTokenRepository.FindByHashAsync(tokenHash);

        if (stored is null || stored.IsRevoked) return false;

        stored.IsRevoked  = true;
        stored.RevokedAt  = DateTime.UtcNow;
        await _refreshTokenRepository.SaveChangesAsync();
        return true;
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

    private async Task<LoginResponseDto> BuildLoginResponseAsync(
        byte[] userIdBytes, string userId,
        string username,    string fullName,
        string roleCode,    string roleName,
        string deviceInfo = "")
    {
        var rawRefreshToken = _tokenService.GenerateRefreshToken();
        var tokenHash       = _tokenService.HashRefreshToken(rawRefreshToken);

        // Xoá token cũ đã hết hạn của cùng device (giữ DB gọn)
        await _refreshTokenRepository.CleanupExpiredForUserAsync(userIdBytes);

        // Tạo refresh token mới
        _refreshTokenRepository.Add(new Refreshtoken
        {
            TokenId    = GuidHelper.NewId(),
            UserId     = userIdBytes,
            TokenHash  = tokenHash,
            DeviceInfo = deviceInfo,
            CreatedAt  = DateTime.UtcNow,
            ExpiresAt  = DateTime.UtcNow.AddDays(_tokenService.GetRefreshTokenExpiryDays()),
            IsUsed     = false,
            IsRevoked  = false
        });

        await _refreshTokenRepository.SaveChangesAsync();

        var permissions = BuildPermissionsForRole(roleCode, roleName);

        return new LoginResponseDto
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
    }

    private static bool IsAdminRole(string? roleCode, string? roleName)
        => MatchesAny(roleCode, roleName, ["Admin", "ADMIN", "Quản trị"]);

    private static List<string> BuildPermissionsForRole(string? roleCode, string? roleName)
    {
        if (IsAdminRole(roleCode, roleName))
        {
            return ["*"];
        }

        var permissions = new List<string>();
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CatalogRead, roleCode, roleName, AuthorizationPolicies.CatalogRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CatalogWrite, roleCode, roleName, AuthorizationPolicies.CatalogRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CoordinationRead, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CoordinationOrderLock, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CoordinationOrderAdjust, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.CoordinationOrderSignoff, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.DemandGenerate, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.InventoryRead, roleCode, roleName, AuthorizationPolicies.InventoryRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.ProductionRead, roleCode, roleName, AuthorizationPolicies.ProductionRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.PurchaseRead, roleCode, roleName, AuthorizationPolicies.PurchaseRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.PurchaseGenerate, roleCode, roleName, AuthorizationPolicies.PurchaseRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.WarehouseRead, roleCode, roleName, AuthorizationPolicies.WarehouseRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.ReportRead, roleCode, roleName, AuthorizationPolicies.CoordinationRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.ReportRead, roleCode, roleName, AuthorizationPolicies.PurchaseRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.ReportRead, roleCode, roleName, AuthorizationPolicies.WarehouseRoles);
        AddPermissionIfMatches(permissions, AuthorizationPolicies.ReportRead, roleCode, roleName, AuthorizationPolicies.ProductionRoles);
        return permissions;
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
