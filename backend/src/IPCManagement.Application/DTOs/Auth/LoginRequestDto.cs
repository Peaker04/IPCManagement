using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Application.DTOs.Auth;

public class LoginRequestDto
{
    [Required(ErrorMessage = "Username không được để trống")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password không được để trống")]
    public string Password { get; set; } = string.Empty;
}
