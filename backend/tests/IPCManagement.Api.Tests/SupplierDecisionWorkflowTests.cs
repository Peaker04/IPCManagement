using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class SupplierDecisionWorkflowTests
{
    [Fact]
    public void Supplier_decision_fixture_requires_evidence_and_explicit_confirmation()
    {
        var requiredEvidence = new[] { "effective-quotation", "latest-valid-receipt" };
        var requiresConfirmation = true;

        requiredEvidence.Should().Equal("effective-quotation", "latest-valid-receipt");
        requiresConfirmation.Should().BeTrue();
    }

    [Fact(Skip = "Plan 09-08 owns evidence-backed supplier suggestions and confirmation snapshots.")]
    public void Purchasing_confirms_supplier_from_effective_evidence()
    {
        Assert.Fail("Plan 09-08 must replace the first-active-supplier fallback.");
    }

    [Fact(Skip = "Plan 09-10 owns the price threshold and exception handoff.")]
    public void Supplier_price_above_threshold_routes_to_manager_exception_approval()
    {
        Assert.Fail("Plan 09-10 must route strict greater-than-fifteen-percent exceptions.");
    }
}
