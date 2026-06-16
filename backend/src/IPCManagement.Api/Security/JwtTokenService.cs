using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Services;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace IPCManagement.Api.Security;

public class JwtTokenService : ITokenService
{
    private readonly JwtSettings _settings;

    public JwtTokenService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
    }

    // ── Access Token ──────────────────────────────────────────────────────────

    public string GenerateAccessToken(string userId, string username, string fullName, string roleName)
    {
        var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,        userId),
            new Claim(ClaimTypes.NameIdentifier,          userId),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim("fullName",                          fullName),
            new Claim(ClaimTypes.Role,                     roleName),
            new Claim(JwtRegisteredClaimNames.Jti,         Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer:            _settings.Issuer,
            audience:          _settings.Audience,
            claims:            claims,
            expires:           DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public int GetAccessTokenExpirySeconds()
        => _settings.ExpiryMinutes * 60;

    // ── Refresh Token ─────────────────────────────────────────────────────────

    public string GenerateRefreshToken()
    {
        // 128-bit random → URL-safe base64 (22 chars)
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    public string HashRefreshToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes).ToLowerInvariant(); // 64 hex chars
    }

    public int GetRefreshTokenExpiryDays()
        => _settings.RefreshExpiryDays;

    // ── Validate expired JWT (for refresh flow) ────────────────────────────────

    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var validationParams = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey  = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey)),
            ValidateIssuer    = true,
            ValidIssuer       = _settings.Issuer,
            ValidateAudience  = true,
            ValidAudience     = _settings.Audience,
            ValidateLifetime  = false   // ← hết hạn vẫn ok
        };

        try
        {
            var handler   = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var principal = handler.ValidateToken(token, validationParams, out var secToken);
            if (secToken is not JwtSecurityToken jwtToken ||
                !jwtToken.Header.Alg.Equals(
                    SecurityAlgorithms.HmacSha256,
                    StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return principal;
        }
        catch
        {
            return null;
        }
    }
}
