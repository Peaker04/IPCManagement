using FluentAssertions;
using IPCManagement.Api.Security;
using Xunit;

namespace IPCManagement.Api.Tests;

public class AuthorizationPoliciesTests
{
    [Fact]
    public void ResolvePermissions_Should_AllowCoordinatorToGenerateDemandOnly()
    {
        var permissions = AuthorizationPolicies.ResolvePermissions("Điều phối");

        permissions.Should().Contain(AuthorizationPolicies.DemandGenerate);
        permissions.Should().NotContain(AuthorizationPolicies.PurchaseGenerate);
    }

    [Fact]
    public void ResolvePermissions_Should_AllowPurchasingToGeneratePurchaseOnly()
    {
        var permissions = AuthorizationPolicies.ResolvePermissions("Thu mua");

        permissions.Should().Contain(AuthorizationPolicies.PurchaseRead);
        permissions.Should().Contain(AuthorizationPolicies.PurchaseGenerate);
        permissions.Should().NotContain(AuthorizationPolicies.DemandGenerate);
    }

    [Fact]
    public void ResolvePermissions_Should_TreatVietnameseAdminRoleAsFullAccess()
    {
        AuthorizationPolicies.IsAdminRole("Quản trị").Should().BeTrue();
        AuthorizationPolicies.ResolvePermissions("Quản trị").Should().BeEquivalentTo(AuthorizationPolicies.AllPermissions);
    }
}
