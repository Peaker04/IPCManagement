using IPCManagement.Application.DTOs.Auth;

namespace IPCManagement.Application.Interfaces.Services;

public interface IAuthService
{
    Task<LoginResponseDto?> LoginAsync(LoginRequestDto request);
}
