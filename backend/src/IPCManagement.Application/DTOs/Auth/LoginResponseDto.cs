namespace IPCManagement.Application.DTOs.Auth;

public class LoginResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public string TokenType   { get; set; } = "Bearer";
    public int    ExpiresIn   { get; set; } // giây
    public UserInfoDto User   { get; set; } = null!;
}

public class UserInfoDto
{
    public string UserId   { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public bool   IsActive { get; set; }
}
