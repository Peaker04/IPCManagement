using IPCManagement.Api.Models.DTOs.Auth;

namespace IPCManagement.Api.Services;

public interface IAuthService
{
    Task<LoginResponseDto?> LoginAsync(LoginRequestDto request, string deviceInfo = "");
    Task<LoginResponseDto?> RefreshTokenAsync(RefreshTokenRequestDto request);
    Task<bool>              RevokeTokenAsync(RevokeTokenRequestDto request);
    Task<UserInfoDto?>      GetProfileAsync(string userId);
}
