namespace IPCManagement.Application.DTOs.User;

public class UserDto
{
    public string   UserId    { get; set; } = string.Empty;
    public string   FullName  { get; set; } = string.Empty;
    public string   Username  { get; set; } = string.Empty;
    public string   RoleId    { get; set; } = string.Empty;
    public string?  RoleName  { get; set; }
    public bool     IsActive  { get; set; }
    public DateTime CreatedAt { get; set; }
}
