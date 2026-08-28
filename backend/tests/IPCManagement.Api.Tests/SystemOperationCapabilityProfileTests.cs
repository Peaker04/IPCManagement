using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class SystemOperationCapabilityProfileTests
{
    private static readonly string[] ExpectedDefaultNavigation =
    [
        "dashboard", "weekly-menu", "meal-orders", "approvals", "purchasing",
        "warehouse", "chef-dashboard", "reports", "admin-data", "approval-rules"
    ];

    private static readonly IReadOnlyDictionary<string, string[]> ExpectedDefaultPageTabs =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["weekly-menu"] = ["schedule", "demand", "production-plan", "purchase-summary", "cost", "dish-materials"],
            ["warehouse"] = ["movement", "demand", "exceptions"],
            ["approvals"] = ["queue", "history"],
            ["purchasing"] = ["workflow", "supplemental", "quotations"],
            ["chef"] = ["production", "documents"],
            ["reports"] = ["price", "demand", "purchase", "stock", "movement", "kitchen", "usage", "audit", "data-quality"],
            ["admin-data"] = ["bom-import", "contracts", "cleanup", "inventory", "statistics", "audit", "employees"]
        };

    [Fact]
    public void Default_profile_exposes_exact_complete_legacy_inventory()
    {
        var profile = SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.Default);

        Assert.Equal(ExpectedDefaultNavigation, profile.Navigation);
        Assert.Equal(32, profile.PageTabs.Sum(group => group.Value.Count));
        Assert.Equal(ExpectedDefaultPageTabs.Keys, profile.PageTabs.Keys);
        foreach (var expectedGroup in ExpectedDefaultPageTabs)
            Assert.Equal(expectedGroup.Value, profile.PageTabs[expectedGroup.Key]);
    }

    [Fact]
    public void Material_reconciliation_profile_exposes_only_retained_navigation_and_zero_legacy_tabs()
    {
        var profile = SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation);

        Assert.Equal(
            ["dashboard", "weekly-menu", "purchasing", "warehouse", "reports", "admin-data"],
            profile.Navigation);
        Assert.Empty(profile.PageTabs);
    }

    [Fact]
    public void Returned_profiles_cannot_mutate_canonical_policy()
    {
        var first = SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.Default);

        Assert.False(first.Navigation is IList<string> navigation && !navigation.IsReadOnly);
        Assert.False(first.PageTabs is IDictionary<string, IReadOnlyList<string>> pageTabs && !pageTabs.IsReadOnly);
        Assert.All(first.PageTabs.Values, tabs =>
            Assert.False(tabs is IList<string> mutableTabs && !mutableTabs.IsReadOnly));

        var second = SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.Default);
        Assert.Equal(ExpectedDefaultNavigation, second.Navigation);
        Assert.Equal(32, second.PageTabs.Sum(group => group.Value.Count));
    }

    [Fact]
    public async Task Get_and_successful_change_return_capabilities_for_resulting_mode()
    {
        await using var context = CreateContext();
        var updatedAt = DateTime.UtcNow.AddMinutes(-5);
        context.Systemoperationmodes.Add(new SystemOperationMode
        {
            Id = 1,
            Mode = SystemOperationEligibility.Default,
            Version = 1,
            UpdatedAt = updatedAt,
            UpdatedBy = Guid.NewGuid().ToByteArray()
        });
        await context.SaveChangesAsync();
        var service = new SystemOperationModeService(
            context,
            new SystemOperationModeGuard(context),
            new ImmediateTransactionRunner());

        var before = await service.GetAsync();
        var after = await service.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.MaterialReconciliation,
                ExpectedVersion: 1,
                Confirmed: true,
                Reason: null),
            Guid.NewGuid().ToString());

        Assert.Equal(ExpectedDefaultNavigation, before.Capabilities.Navigation);
        Assert.Equal(32, before.Capabilities.PageTabs.Sum(group => group.Value.Count));
        Assert.Equal(SystemOperationEligibility.MaterialReconciliation, after.Mode);
        Assert.Equal(
            ["dashboard", "weekly-menu", "purchasing", "warehouse", "reports", "admin-data"],
            after.Capabilities.Navigation);
        Assert.Empty(after.Capabilities.PageTabs);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"system-operation-capabilities-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }
}
