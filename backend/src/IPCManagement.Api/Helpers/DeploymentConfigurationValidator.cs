using IPCManagement.Api.Security;

namespace IPCManagement.Api.Helpers;

public static class DeploymentConfigurationValidator
{
    private const string DevelopmentJwtSecret = "SJ0sKATrwiXa!8lfV7ygOW$bqYMLPRnE4xc2GIe@#t3uFDvm";
    private static readonly string[] PlaceholderFragments =
    [
        "CHANGE_ME",
        "GENERATE_A_STRONG_SECRET",
        "GENERATE_A_UNIQUE_PRODUCTION_SECRET",
        "REPLACE_ME",
        "YOUR_API_DOMAIN",
        "YOUR_DB_HOST",
        "YOUR_FRONTEND_DOMAIN",
        "YOUR_PASSWORD",
        "YOUR_STRONG_DB_PASSWORD"
    ];

    public static void Validate(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment())
        {
            return;
        }

        var errors = new List<string>();
        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            errors.Add("ConnectionStrings:DefaultConnection is required.");
        }
        else
        {
            var normalizedConnection = connectionString.ToLowerInvariant();
            if (normalizedConnection.Contains("password=123456789", StringComparison.Ordinal) ||
                normalizedConnection.Contains("your_password", StringComparison.Ordinal))
            {
                errors.Add("ConnectionStrings:DefaultConnection must not use demo/local passwords.");
            }

            if (ContainsPlaceholder(connectionString))
            {
                errors.Add("ConnectionStrings:DefaultConnection placeholders must be replaced.");
            }
        }

        var secretKey = configuration[$"{JwtSettings.SectionName}:SecretKey"] ?? string.Empty;
        if (secretKey == DevelopmentJwtSecret ||
            ContainsPlaceholder(secretKey))
        {
            errors.Add("JwtSettings:SecretKey must be replaced for non-development environments.");
        }

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (allowedOrigins.Length == 0)
        {
            errors.Add("Cors:AllowedOrigins must list the deployed frontend origin.");
        }
        else if (allowedOrigins.Any(origin =>
            origin.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
            origin.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase)))
        {
            errors.Add("Cors:AllowedOrigins must not contain localhost origins outside development.");
        }
        else if (allowedOrigins.Any(ContainsPlaceholder))
        {
            errors.Add("Cors:AllowedOrigins placeholders must be replaced.");
        }

        var allowedHosts = configuration["AllowedHosts"] ?? string.Empty;
        if (string.IsNullOrWhiteSpace(allowedHosts) || allowedHosts.Trim() == "*")
        {
            errors.Add("AllowedHosts must be restricted outside development.");
        }
        else if (ContainsPlaceholder(allowedHosts))
        {
            errors.Add("AllowedHosts placeholders must be replaced.");
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                "Deployment configuration is not ready: " + string.Join(" ", errors));
        }
    }

    private static bool ContainsPlaceholder(string value)
        => PlaceholderFragments.Any(fragment =>
            value.Contains(fragment, StringComparison.OrdinalIgnoreCase));
}
