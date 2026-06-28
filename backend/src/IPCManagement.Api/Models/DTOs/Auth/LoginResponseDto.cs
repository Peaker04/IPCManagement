namespace IPCManagement.Api.Models.DTOs.Auth;

public class LoginResponseDto
{
    public string AccessToken  { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string TokenType    { get; set; } = "Bearer";
    public int    ExpiresIn    { get; set; } // giây (access token)
    public UserInfoDto User    { get; set; } = null!;
}

public class UserInfoDto
{
    public string UserId   { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string RoleCode { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public bool   IsActive { get; set; }
    public bool   IsAdminFullAccess { get; set; }
    public List<string> Permissions { get; set; } = new();
}

public class UserProfileResponseDto
{
    public UserInfoDto User { get; set; } = null!;
    public IReadOnlyList<string> Permissions { get; set; } = [];
    public bool IsAdmin { get; set; }
}

public class RefreshTokenRequestDto
{
    public string AccessToken  { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
}

public class RevokeTokenRequestDto
{
    public string RefreshToken { get; set; } = string.Empty;
}
