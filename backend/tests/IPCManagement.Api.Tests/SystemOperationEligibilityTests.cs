using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.Reports.Controllers;
using IPCManagement.Api.Features.SystemOperation.Services;
using Xunit;

namespace IPCManagement.Api.Tests;
public sealed class SystemOperationEligibilityTests
{
    [Theory]
    [InlineData("Approvals", false)]
    [InlineData("Coordination", false)]
    [InlineData("ReconciliationBatches", true)]
    [InlineData("Reports", true)]
    public void Material_reconciliation_has_explicit_controller_matrix(string controller, bool allowed)
    {
        var disposition = SystemOperationEligibility.Classify(controller, "Get");
        Assert.Equal(allowed, SystemOperationEligibility.IsAllowed(SystemOperationEligibility.MaterialReconciliation, disposition));
        Assert.True(SystemOperationEligibility.IsAllowed(SystemOperationEligibility.Default, disposition));
    }

    [Theory]
    [InlineData(typeof(ReconciliationBatchesController), "reconciliation.batches.read")]
    [InlineData(typeof(ReconciliationReportsController), "reconciliation.reports.read")]
    public void Reconciliation_read_surfaces_are_explicitly_reconciliation_only(Type controller, string operationKey)
    {
        var metadata = Assert.Single(controller
            .GetCustomAttributes(typeof(SystemOperationAttribute), inherit: true)
            .Cast<SystemOperationAttribute>());

        Assert.Equal(operationKey, metadata.OperationKey);
        Assert.Equal(OperationDisposition.ReconciliationOnly, metadata.Disposition);
        Assert.False(SystemOperationEligibility.IsAllowed(SystemOperationEligibility.Default, metadata.Disposition));
        Assert.True(SystemOperationEligibility.IsAllowed(SystemOperationEligibility.MaterialReconciliation, metadata.Disposition));
    }

    [Fact]
    public void Admin_audit_read_surface_is_explicitly_retained_without_enabling_reports_navigation()
    {
        var metadata = Assert.Single(typeof(AuditReportsController)
            .GetCustomAttributes(typeof(SystemOperationAttribute), inherit: true)
            .Cast<SystemOperationAttribute>());

        Assert.Equal("admin-data.audit", metadata.OperationKey);
        Assert.Equal(OperationDisposition.Retained, metadata.Disposition);
        Assert.DoesNotContain("reports", SystemOperationEligibility
            .CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation).Navigation);
        Assert.Contains("audit", SystemOperationEligibility
            .CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation).PageTabs["admin-data"]);
    }

    [Fact] public void Stable_tokens_are_the_only_valid_modes() { Assert.True(SystemOperationEligibility.IsValidMode("DEFAULT")); Assert.True(SystemOperationEligibility.IsValidMode("MATERIAL_RECONCILIATION")); Assert.False(SystemOperationEligibility.IsValidMode("default")); }
}
