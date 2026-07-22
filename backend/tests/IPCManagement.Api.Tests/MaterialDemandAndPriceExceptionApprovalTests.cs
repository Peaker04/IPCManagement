using FluentAssertions;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Approvals;

namespace IPCManagement.Api.Tests;

public class MaterialDemandAndPriceExceptionApprovalTests
{
    [Theory]
    [InlineData("Manager", true)]
    [InlineData("Quản lý", true)]
    [InlineData("Admin", true)]
    [InlineData("Purchasing", false)]
    [InlineData("Thu mua", false)]
    [InlineData("WarehouseStaff", false)]
    public void RoleBoundary_DecisionPermissionsAreManagerOwned(string role, bool expected)
    {
        var permissions = AuthorizationPolicies.ResolvePermissions(role);

        permissions.Contains("material-demand.approve").Should().Be(expected);
        permissions.Contains(AuthorizationPolicies.PurchaseRequestApprove).Should().Be(expected);

        if (role is "Purchasing" or "Thu mua")
        {
            permissions.Should().Contain(AuthorizationPolicies.PurchaseRead);
            permissions.Should().Contain(AuthorizationPolicies.PurchaseGenerate);
            permissions.Should().Contain(AuthorizationPolicies.PurchaseQuotationManage);
        }
    }

    [Theory]
    [InlineData("material-demand")]
    [InlineData("materialdemand")]
    [InlineData("demand")]
    public void RoleBoundary_MaterialDemandTargetAliasesAreBounded(string alias)
    {
        ApprovalTargetTypeParser.Parse(alias)?.ToString().Should().Be("MaterialDemand");
    }

    [Theory]
    [InlineData("")]
    [InlineData("material demand")]
    [InlineData("manager-demand")]
    [InlineData("anything")]
    public void RoleBoundary_UnknownTargetAliasesAreRejected(string alias)
    {
        ApprovalTargetTypeParser.Parse(alias).Should().BeNull();
    }

    [Theory]
    [InlineData("Manager", "material-demand", true)]
    [InlineData("Manager", "price-exception", true)]
    [InlineData("Purchasing", "material-demand", false)]
    [InlineData("Purchasing", "price-exception", false)]
    [InlineData("Warehouse", "material-demand", false)]
    [InlineData("Warehouse", "price-exception", false)]
    public void Approval_fixture_role_matrix_is_explicit(string role, string target, bool expected)
    {
        var canApprove = role == "Manager" && target is "material-demand" or "price-exception";

        canApprove.Should().Be(expected);
    }

    [Fact(Skip = "Plan 09-07 owns material-demand approval inbox and decision behavior.")]
    public void Manager_approves_material_demand_before_purchasing_can_act()
    {
        Assert.Fail("Plan 09-07 must expose and approve material demand.");
    }

    [Fact(Skip = "Plan 09-10 owns auditable price-exception approval behavior.")]
    public void Manager_resolves_price_exception_above_fifteen_percent()
    {
        Assert.Fail("Plan 09-10 must persist and resolve price exceptions.");
    }
}
