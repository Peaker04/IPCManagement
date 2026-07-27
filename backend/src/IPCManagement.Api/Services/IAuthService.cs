using IPCManagement.Api.Models.DTOs.Auth;

namespace IPCManagement.Api.Services;

public interface IAuthService
{
    Task<LoginResponseDto?> LoginAsync(LoginRequest request, string deviceInfo = "");
    Task<LoginResponseDto?> RefreshTokenAsync(RefreshTokenRequest request);
    Task<bool>              RevokeTokenAsync(RevokeTokenRequest request);
    Task<UserInfoDto?>      GetProfileAsync(string userId);
    Task<UserProfileResponseDto?> GetMeAsync(string userId);
}
