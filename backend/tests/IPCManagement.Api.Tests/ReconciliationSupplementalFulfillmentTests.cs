using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSupplementalFulfillmentTests
{
    [Fact]
    public void Extra_fulfillment_cannot_cover_original_shortage_even_when_total_quantity_looks_sufficient()
    {
        var f = new Facts();
        f.AddIssue(8m, "BASELINE_SHORTAGE");
        f.AddIssue(3m, "APPROVED_EXTRA_DEMAND");
        f.AddIssue(2m, "UNPLANNED_EXTRA");
        var balance = f.Read();
        Assert.Equal(13m, balance.NetIssuedQuantity);
        Assert.Equal(2m, balance.BaselineRemainingQuantity);
        Assert.Equal(0m, Assert.Single(balance.ExtraDemands).RemainingQuantity);
        Assert.False(balance.IsDemandFulfilled);
        f.AddIssue(2m, "BASELINE_SHORTAGE");
        Assert.True(f.Read().IsDemandFulfilled);
    }

    [Fact]
    public void Received_return_on_single_purpose_reopens_only_that_exact_shortage()
    {
        var f = new Facts();
        f.AddIssue(10m, "BASELINE_SHORTAGE");
        var extraIssue = f.AddIssue(3m, "APPROVED_EXTRA_DEMAND");
        f.Returns.Add((extraIssue.IssueLineId, 1m));
        var balance = f.Read();
        Assert.Equal(0m, balance.BaselineRemainingQuantity);
        Assert.Equal(1m, Assert.Single(balance.ExtraDemands).RemainingQuantity);
        Assert.Equal(12m, balance.NetIssuedQuantity);
        Assert.False(balance.IsDemandFulfilled);
    }

    [Theory]
    [InlineData("legacy")]
    [InlineData("partial-allocation")]
    [InlineData("mixed-return")]
    public void Missing_allocation_evidence_is_explicit_and_cannot_be_guessed_from_net_or_notes(string kind)
    {
        var f = new Facts();
        var issue = f.AddIssue(13m, "BASELINE_SHORTAGE");
        if (kind == "legacy") f.Allocations.Clear();
        if (kind == "partial-allocation") f.Allocations[0].Quantity = 10m;
        if (kind == "mixed-return")
        {
            f.Allocations[0].Quantity = 10m;
            f.Allocations.Add(new() { AllocationId = GuidHelper.NewId(), IssueLineId = issue.IssueLineId,
                DailyLineId = f.Line.DailyLineId, Purpose = "APPROVED_EXTRA_DEMAND", DemandMaterialId = f.Material.DemandMaterialId, Quantity = 3m });
            f.Returns.Add((issue.IssueLineId, 1m));
        }
        var balance = f.Read();
        Assert.False(balance.IsDemandFulfilled);
        Assert.Null(balance.BaselineRemainingQuantity);
        Assert.True(balance.HasIncompleteAllocation || balance.HasAmbiguousReturn);
        Assert.Equal(kind == "mixed-return" ? 12m : 13m, balance.NetIssuedQuantity);
    }

    [Fact]
    public void Separate_approved_demands_using_same_ingredient_never_fulfill_each_other()
    {
        var f = new Facts();
        var other = new ReconciliationSupplementalDemandMaterial { DemandMaterialId = GuidHelper.NewId(),
            DemandId = GuidHelper.NewId(), DailyLineId = f.Line.DailyLineId, RequiredQuantity = 2m };
        f.AddIssue(10m, "BASELINE_SHORTAGE");
        f.AddIssue(3m, "APPROVED_EXTRA_DEMAND");
        var balance = ReconciliationSupplementalFulfillmentQuery.Project(f.Line, [f.Material, other], f.Issues, f.Allocations, f.Returns);
        Assert.Equal(2m, balance.ExtraDemands.Single(x => x.DemandMaterialId == GuidHelper.ToGuidString(other.DemandMaterialId)).RemainingQuantity);
        Assert.False(balance.IsDemandFulfilled);
    }

    private sealed class Facts
    {
        public readonly ReconciliationBatchDailyLine Line = new() { DailyLineId = GuidHelper.NewId(), IngredientId = GuidHelper.NewId(),
            CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 10m };
        public readonly ReconciliationSupplementalDemandMaterial Material;
        public readonly List<InventoryIssueLine> Issues = [];
        public readonly List<ReconciliationIssueAllocation> Allocations = [];
        public readonly List<(byte[] SourceIssueLineId, decimal Quantity)> Returns = [];
        public Facts() => Material = new() { DemandMaterialId = GuidHelper.NewId(), DemandId = GuidHelper.NewId(),
            DailyLineId = Line.DailyLineId, RequiredQuantity = 3m };
        public InventoryIssueLine AddIssue(decimal quantity, string purpose)
        {
            var issue = new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), ReconciliationBatchDailyLineId = Line.DailyLineId,
                IssuedQty = quantity, IngredientId = Line.IngredientId, UnitId = Line.CanonicalUnitId };
            Issues.Add(issue);
            Allocations.Add(new() { AllocationId = GuidHelper.NewId(), IssueLineId = issue.IssueLineId, DailyLineId = Line.DailyLineId,
                Purpose = purpose, DemandMaterialId = purpose == "APPROVED_EXTRA_DEMAND" ? Material.DemandMaterialId : null, Quantity = quantity });
            return issue;
        }
        public IPCManagement.Api.Features.Inventory.Contracts.ReconciliationSupplementalFulfillmentLineDto Read() =>
            ReconciliationSupplementalFulfillmentQuery.Project(Line, [Material], Issues, Allocations, Returns);
    }
}
