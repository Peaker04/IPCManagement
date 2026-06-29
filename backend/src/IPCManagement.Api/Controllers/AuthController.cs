using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;


namespace IPCManagement.Api.Controllers;

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
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
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

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(result, "Đăng nhập thành công."));
    }

    /// <summary>Làm mới access token bằng refresh token.</summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("auth-strict")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                   StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequestDto? request)
    {
        request ??= new RefreshTokenRequestDto();
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

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(result, "Làm mới token thành công."));
    }

    /// <summary>Đăng xuất — vô hiệu hoá refresh token.</summary>
    [HttpPost("logout")]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Logout([FromBody] RevokeTokenRequestDto? request)
    {
        request ??= new RevokeTokenRequestDto();
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
    [EnableRateLimiting("api-general")]
    public Task<IActionResult> Revoke([FromBody] RevokeTokenRequestDto? request)
        => Logout(request);

    /// <summary>Lấy thông tin cá nhân của người dùng hiện tại.</summary>
    [HttpGet("profile")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse<UserInfoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile()
    {
        var userId = _currentUserService.GetUserId(User);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse.FailResult("Token không hợp lệ hoặc thiếu thông tin người dùng."));

        var profile = await _authService.GetProfileAsync(userId);
        if (profile is null)
            return NotFound(ApiResponse.FailResult("Người dùng không tồn tại hoặc tài khoản đã bị khoá."));

        return Ok(ApiResponse<UserInfoDto>.SuccessResult(profile, "Lấy thông tin người dùng thành công."));
    }

    private string ResolveRefreshToken(string? refreshToken)
        => !string.IsNullOrWhiteSpace(refreshToken)
            ? refreshToken.Trim()
            : Request.Cookies[RefreshTokenCookieName] ?? string.Empty;

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
