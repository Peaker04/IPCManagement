using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Security;

public sealed class JwtSettings
{
    public const string SectionName = "JwtSettings";

    [Required]
    [MinLength(32)]
    public string SecretKey { get; init; } = string.Empty;

    [Required]
    public string Issuer { get; init; } = string.Empty;

    [Required]
    public string Audience { get; init; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int ExpiryMinutes { get; init; } = 30;

    [Range(1, int.MaxValue)]
    public int RefreshExpiryDays { get; init; } = 30;
}
