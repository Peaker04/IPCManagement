using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using IPCManagement.Api.Security;
using Microsoft.Extensions.Options;
using Xunit;

namespace IPCManagement.Api.Tests;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService(
        string issuer = "IPCManagementAPI",
        string audience = "IPCManagementClient")
        => new(Options.Create(new JwtSettings
        {
            SecretKey = "test-secret-key-with-at-least-32-characters",
            Issuer = issuer,
            Audience = audience,
            ExpiryMinutes = 30,
            RefreshExpiryDays = 30
        }));

    [Fact]
    public void GenerateAccessToken_Should_Include_Subject_And_NameIdentifier()
    {
        // Arrange
        var service = CreateService();
        var userId = Guid.NewGuid().ToString();

        // Act
        var token = service.GenerateAccessToken(userId, "admin", "Admin User", "Admin");
        var principal = service.GetPrincipalFromExpiredToken(token);

        // Assert
        principal.Should().NotBeNull();
        principal!.FindFirstValue(JwtRegisteredClaimNames.Sub).Should().Be(userId);
        principal.FindFirstValue(ClaimTypes.NameIdentifier).Should().Be(userId);
        principal.FindFirstValue(ClaimTypes.Role).Should().Be("Admin");
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_Should_Reject_UnexpectedIssuer()
    {
        // Arrange
        var issuingService = CreateService(issuer: "TrustedIssuer");
        var validatingService = CreateService(issuer: "OtherIssuer");
        var token = issuingService.GenerateAccessToken(Guid.NewGuid().ToString(), "admin", "Admin User", "Admin");

        // Act
        var principal = validatingService.GetPrincipalFromExpiredToken(token);

        // Assert
        principal.Should().BeNull();
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_Should_Reject_UnexpectedAudience()
    {
        // Arrange
        var issuingService = CreateService(audience: "TrustedAudience");
        var validatingService = CreateService(audience: "OtherAudience");
        var token = issuingService.GenerateAccessToken(Guid.NewGuid().ToString(), "admin", "Admin User", "Admin");

        // Act
        var principal = validatingService.GetPrincipalFromExpiredToken(token);

        // Assert
        principal.Should().BeNull();
    }
}
