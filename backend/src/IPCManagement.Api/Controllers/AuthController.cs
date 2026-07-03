using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;


namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string RefreshTokenCookieName = "refreshToken";

    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ITokenService _tokenService;

    public AuthController(
        IAuthService authService,
        ICurrentUserService currentUserService,
        ITokenService tokenService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _tokenService = tokenService;
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
            return Unauthorized(ApiResponse.FailResult("Tên đăng nhập hoặc mật khẩu không đúng."));

        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(WithoutExposedRefreshToken(result), "Đăng nhập thành công."));
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
            return Unauthorized(ApiResponse.FailResult("Refresh token không hợp lệ hoặc đã hết hạn."));
        }

        SetRefreshTokenCookie(result.RefreshToken);
        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(WithoutExposedRefreshToken(result), "Làm mới token thành công."));
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
            return BadRequest(ApiResponse.FailResult("Thiếu refresh token."));

        var success = await _authService.RevokeTokenAsync(request);
        ClearRefreshTokenCookie();

        if (!success)
            return Ok(ApiResponse.SuccessResult("Đăng xuất thành công."));

        return Ok(ApiResponse.SuccessResult("Đăng xuất thành công."));
    }

    /// <summary>Alias tương thích ngược cho luồng thu hồi token.</summary>
    [HttpPost("revoke")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
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
        => await GetProfileInternal();

    /// <summary>Lấy profile đầy đủ cho route/action guard của Frontend.</summary>
    [HttpGet("me")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse<UserProfileResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                     StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse),                     StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMe()
        => await GetMeInternal();

    private async Task<IActionResult> GetProfileInternal()
    {
        var userId = _currentUserService.GetUserId(User);

        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse.FailResult("Token không hợp lệ hoặc thiếu thông tin người dùng."));

        var profile = await _authService.GetProfileAsync(userId);
        if (profile is null)
            return NotFound(ApiResponse.FailResult("Người dùng không tồn tại hoặc tài khoản đã bị khoá."));

        return Ok(ApiResponse<UserInfoDto>.SuccessResult(profile, "Lấy thông tin người dùng thành công."));
    }

    private async Task<IActionResult> GetMeInternal()
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
