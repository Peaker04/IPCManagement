using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Tests;

public sealed class OperationalApprovalRegistryTests
{
    private static ClaimsPrincipal Actor(string role) => new(new ClaimsIdentity([new Claim(ClaimTypes.Role, role)], "test"));

    [Fact]
    public void Published_targets_are_mode_scoped_and_keep_receipt_manager_authority()
    {
        var manager = OperationalApprovalRegistry.ForActor(Actor("Manager"), SystemOperationEligibility.Default);
        Assert.Equal(8, manager.Count);
        Assert.Contains(manager, target => target.TargetType == "legacy-lineage-disposition");
        Assert.Contains(manager, target => target.TargetType == "stocktake");
        Assert.Contains(manager, target => target.TargetType == "purchase-request");
        Assert.DoesNotContain(manager, target => target.TargetType == "purchase-order");
        Assert.Contains(OperationalApprovalRegistry.ForActor(Actor("Admin"), SystemOperationEligibility.Default),
            target => target.TargetType == "inventory-receipt");
        var mrx = OperationalApprovalRegistry.ForActor(Actor("Manager"), SystemOperationEligibility.MaterialReconciliation);
        Assert.Equal(new[] { "mrx-batch-review", "mrx-source-change", "mrx-supplemental-demand" }, mrx.Select(x => x.TargetType).ToArray());
        Assert.Empty(OperationalApprovalRegistry.ForActor(Actor("WarehouseStaff"), SystemOperationEligibility.MaterialReconciliation));
        Assert.Empty(OperationalApprovalRegistry.ForActor(Actor("Chef"), SystemOperationEligibility.Default));
    }

    [Fact]
    public void Approval_navigation_available_in_both_modes_without_opening_legacy_default_commands()
    {
        Assert.Contains("approvals", SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation).Navigation);
        Assert.False(SystemOperationEligibility.IsAllowed(SystemOperationEligibility.MaterialReconciliation,
            SystemOperationEligibility.Classify("Approvals", "ExecuteAsync")));
        Assert.Contains("queue", SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation).PageTabs["approvals"]);
    }
}
