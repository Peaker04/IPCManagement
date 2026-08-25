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

    [Fact] public void Stable_tokens_are_the_only_valid_modes() { Assert.True(SystemOperationEligibility.IsValidMode("DEFAULT")); Assert.True(SystemOperationEligibility.IsValidMode("MATERIAL_RECONCILIATION")); Assert.False(SystemOperationEligibility.IsValidMode("default")); }
}
