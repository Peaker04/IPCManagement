using IPCManagement.Application.DTOs.Auth;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Mvc;

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

    /// <summary>Đăng nhập và nhận JWT access token.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        var result = await _authService.LoginAsync(request);

        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Tên đăng nhập hoặc mật khẩu không đúng."));

        return Ok(ApiResponse<LoginResponseDto>.SuccessResult(result, "Đăng nhập thành công."));
    }
}
