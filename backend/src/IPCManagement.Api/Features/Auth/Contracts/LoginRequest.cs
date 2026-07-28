using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Features.Auth.Contracts;

public class LoginRequest
{
    [Required(ErrorMessage = "Username không được để trống")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password không được để trống")]
    public string Password { get; set; } = string.Empty;
}
