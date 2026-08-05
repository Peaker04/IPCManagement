using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using IPCManagement.Api.Features.Auth.Contracts;
using IPCManagement.Api.Features.Auth.Services;

namespace IPCManagement.Api.Features.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string RefreshTokenCookieName = "refreshToken";

    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        ICurrentUserService currentUserService,
        ITokenService tokenService,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _tokenService = tokenService;
        _logger = logger;
    }

    /// <summary>Đăng nhập — trả về access token + refresh token.</summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth-strict")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                   StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> LoginAsync([FromBody] LoginRequest request)
    {
        // Lấy device info từ User-Agent header
        var deviceInfo = Request.Headers.UserAgent.ToString();

        var result = await _authService.LoginAsync(request, deviceInfo);
        if (result is null)
        {
            _logger.LogWarning(
                "Login failed for username {Username} from IP {IpAddress} with device {DeviceInfo}",
                request.Username,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                deviceInfo);
            return Unauthorized(ApiResponse.FailResult("Tên đăng nhập hoặc mật khẩu không đúng."));
        }

        SetRefreshTokenCookie(result.RefreshToken);
        _logger.LogInformation(
            "Login succeeded for user {UserId} ({Username}) from IP {IpAddress}",
            result.User.UserId,
            result.User.Username,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(WithoutExposedRefreshToken(result), "Đăng nhập thành công."));
    }

    /// <summary>Làm mới access token bằng refresh token.</summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("auth-strict")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                   StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshAsync([FromBody] RefreshTokenRequest? request)
    {
        request ??= new RefreshTokenRequest();
        request.RefreshToken = ResolveRefreshToken(request.RefreshToken);

        if (string.IsNullOrWhiteSpace(request.AccessToken) ||
            string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(ApiResponse.FailResult("Thiếu access token hoặc refresh token."));
        }

        var result = await _authService.RefreshTokenAsync(request);
        if (result is null)
        {
            ClearRefreshTokenCookie();
            _logger.LogWarning(
                "Refresh token rejected from IP {IpAddress}",
                HttpContext.Connection.RemoteIpAddress?.ToString());
            return Unauthorized(ApiResponse.FailResult("Refresh token không hợp lệ hoặc đã hết hạn."));
        }

        SetRefreshTokenCookie(result.RefreshToken);
        _logger.LogInformation(
            "Token refreshed for user {UserId} ({Username}) from IP {IpAddress}",
            result.User.UserId,
            result.User.Username,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(WithoutExposedRefreshToken(result), "Làm mới token thành công."));
    }

    /// <summary>Đăng xuất — vô hiệu hoá refresh token.</summary>
    [HttpPost("logout")]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LogoutAsync([FromBody] RevokeTokenRequest? request)
    {
        request ??= new RevokeTokenRequest();
        request.RefreshToken = ResolveRefreshToken(request.RefreshToken);

        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            _logger.LogWarning(
                "Logout attempted without refresh token from IP {IpAddress}",
                HttpContext.Connection.RemoteIpAddress?.ToString());
            return BadRequest(ApiResponse.FailResult("Thiếu refresh token."));
        }

        var success = await _authService.RevokeTokenAsync(request);

        ClearRefreshTokenCookie();
        if (!success)
        {
            _logger.LogInformation(
                "Logout completed with missing or already revoked token from IP {IpAddress}",
                HttpContext.Connection.RemoteIpAddress?.ToString());
            return Ok(ApiResponse.SuccessResult("Đăng xuất thành công."));
        }

        _logger.LogInformation(
            "Logout succeeded from IP {IpAddress}",
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return Ok(ApiResponse.SuccessResult("Đăng xuất thành công."));
    }

    /// <summary>Alias tương thích ngược cho luồng thu hồi token.</summary>
    [HttpPost("revoke")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public Task<IActionResult> RevokeAsync([FromBody] RevokeTokenRequest? request)
        => LogoutAsync(request);

    /// <summary>Lấy thông tin cá nhân của người dùng hiện tại.</summary>
    [HttpGet("profile")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse<UserInfoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfileAsync()
        => await GetProfileInternalAsync();

    /// <summary>Lấy profile đầy đủ cho route/action guard của Frontend.</summary>
    [HttpGet("me")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                     StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse),                     StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMeAsync()
        => await GetMeInternalAsync();

    private async Task<IActionResult> GetProfileInternalAsync()
    {
        var userId = _currentUserService.GetUserId(User);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse.FailResult("Token không hợp lệ hoặc thiếu thông tin người dùng."));

        var profile = await _authService.GetProfileAsync(userId);
        if (profile is null)
            return NotFound(ApiResponse.FailResult("Người dùng không tồn tại hoặc tài khoản đã bị khoá."));

        return Ok(ApiResponse<UserInfoDto>.SuccessResult(profile, "Lấy thông tin người dùng thành công."));
    }

    private async Task<IActionResult> GetMeInternalAsync()
    {
        var userId = _currentUserService.GetUserId(User);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse.FailResult("Token không hợp lệ hoặc thiếu thông tin người dùng."));

        var profile = await _authService.GetMeAsync(userId);
        if (profile is null)
            return NotFound(ApiResponse.FailResult("Người dùng không tồn tại hoặc tài khoản đã bị khoá."));

        return Ok(ApiResponse<UserProfileResponseDto>.SuccessResult(profile, "Lấy profile người dùng thành công."));
    }
    private string ResolveRefreshToken(string? refreshToken)
        => !string.IsNullOrWhiteSpace(refreshToken)
            ? refreshToken.Trim()
            : Request.Cookies[RefreshTokenCookieName] ?? string.Empty;

    private static LoginResponseDto WithoutExposedRefreshToken(LoginResponseDto result)
        => new()
        {
            AccessToken = result.AccessToken,
            RefreshToken = string.Empty,
            TokenType = result.TokenType,
            ExpiresIn = result.ExpiresIn,
            User = result.User
        };
    private void SetRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(_tokenService.GetRefreshTokenExpiryDays())
        };

        Response.Cookies.Append(RefreshTokenCookieName, refreshToken, cookieOptions);
    }

    private void ClearRefreshTokenCookie()
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        Response.Cookies.Append(RefreshTokenCookieName, string.Empty, cookieOptions);
    }
}
