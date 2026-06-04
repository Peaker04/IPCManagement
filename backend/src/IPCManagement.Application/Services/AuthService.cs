using IPCManagement.Application.DTOs.Auth;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;

namespace IPCManagement.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService   _tokenService;

    public AuthService(
        IUserRepository userRepository,
        ITokenService tokenService)
    {
        _userRepository = userRepository;
        _tokenService   = tokenService;
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto request)
    {
        // 1. Tìm user theo username
        var user = await _userRepository.FindByUsernameAsync(request.Username);
        if (user is null) return null;

        // 2. Kiểm tra tài khoản còn active không
        if (user.IsActive == false) return null;

        // 3. Verify BCrypt password
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        // 4. Tạo JWT token
        var userId   = GuidHelper.ToGuidString(user.UserId);
        var roleName = user.Role?.RoleName ?? "Unknown";
        var token    = _tokenService.GenerateToken(userId, user.Username, user.FullName, roleName);

        return new LoginResponseDto
        {
            AccessToken = token,
            ExpiresIn   = _tokenService.GetExpirySeconds(),
            User = new UserInfoDto
            {
                UserId   = userId,
                FullName = user.FullName,
                Username = user.Username,
                RoleName = roleName,
                IsActive = user.IsActive ?? true
            }
        };
    }
}
