using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using IPCManagement.Api.Models.DTOs.Auth;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;


namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
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

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(result, "Đăng nhập thành công."));
    }

    /// <summary>Làm mới access token bằng refresh token.</summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("auth-strict")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),                   StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.AccessToken) ||
            string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(ApiResponse.FailResult("Thiếu access token hoặc refresh token."));
        }

        var result = await _authService.RefreshTokenAsync(request);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Refresh token không hợp lệ hoặc đã hết hạn."));

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(result, "Làm mới token thành công."));
    }

    /// <summary>Đăng xuất — vô hiệu hoá refresh token.</summary>
    [HttpPost("revoke")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Revoke([FromBody] RevokeTokenRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(ApiResponse.FailResult("Thiếu refresh token."));

        var success = await _authService.RevokeTokenAsync(request);
        if (!success)
            return BadRequest(ApiResponse.FailResult("Refresh token không tồn tại hoặc đã bị thu hồi."));

        return Ok(ApiResponse.SuccessResult("Đăng xuất thành công."));
    }

    /// <summary>Lấy thông tin cá nhân của người dùng hiện tại.</summary>
    [HttpGet("profile")]
    [Authorize]
    [EnableRateLimiting("api-general")]
    [ProducesResponseType(typeof(ApiResponse<UserInfoDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse),             StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse.FailResult("Token không hợp lệ hoặc thiếu thông tin người dùng."));

        var profile = await _authService.GetProfileAsync(userId);
        if (profile is null)
            return NotFound(ApiResponse.FailResult("Người dùng không tồn tại hoặc tài khoản đã bị khoá."));

        return Ok(ApiResponse<UserInfoDto>.SuccessResult(profile, "Lấy thông tin người dùng thành công."));
    }
}
