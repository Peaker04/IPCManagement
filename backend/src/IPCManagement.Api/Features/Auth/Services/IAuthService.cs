
using IPCManagement.Api.Features.Auth.Contracts;

namespace IPCManagement.Api.Features.Auth.Services;

public interface IAuthService
{
    Task<LoginResponseDto?> LoginAsync(LoginRequest request, string deviceInfo = "");
    Task<LoginResponseDto?> RefreshTokenAsync(RefreshTokenRequest request);
    Task<bool>              RevokeTokenAsync(RevokeTokenRequest request);
    Task<UserInfoDto?>      GetProfileAsync(string userId);
    Task<UserProfileResponseDto?> GetMeAsync(string userId);
}
