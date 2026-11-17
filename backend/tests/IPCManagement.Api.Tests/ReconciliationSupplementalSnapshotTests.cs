using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSupplementalSnapshotTests
{
    [Fact]
    public void Snapshot_keeps_shift_variant_and_shared_ingredient_lineage_and_does_not_reapply_waste()
    {
        var f = new Fixture();
        var secondDish = GuidHelper.NewId();
        var otherShift = f.Contributor(f.Dish, "AFTERNOON", "savory", 5m);
        var vegetarian = f.Contributor(f.Dish, "MORNING", "vegetarian", 7m);
        var second = f.Contributor(secondDish, "MORNING", "savory", 0.3m);
        f.Facts.AddRange([otherShift, vegetarian, second]);
        var result = f.Build([f.Selection(10), new(GuidHelper.ToGuidString(secondDish), "MORNING", "savory", 5)]);
        Assert.Equal(2, result.Dishes.Count);
        Assert.Equal(3.5m, Assert.Single(result.Materials).RequiredQuantity);
        Assert.Equal(new[] { 1.5m, 2m }, result.Materials.Single().Contributions.Select(x => x.RequiredQuantity).Order().ToArray());
        Assert.All(result.Materials.Single().Contributions, x => Assert.Equal(20m, x.WasteRatePercent));
        Assert.DoesNotContain(result.Materials.Single().Contributions, x => x.FrozenContributorId.SequenceEqual(otherShift.ContributorId));
    }

    [Fact]
    public void Identical_duplicate_facts_are_not_multiplied_and_order_does_not_change_fingerprint()
    {
        var f = new Fixture();
        var duplicate = f.Contributor(f.Dish, "MORNING", "savory", 0.2m);
        f.Facts.Add(duplicate);
        var first = f.Build([f.Selection(10)]);
        f.Facts.Reverse();
        var second = f.Build([f.Selection(10)]);
        Assert.Equal(2m, Assert.Single(first.Materials).RequiredQuantity);
        Assert.Equal(first.Fingerprint, second.Fingerprint);
        Assert.Single(first.Materials.Single().Contributions);
    }

    [Fact]
    public void Rate_is_not_rounded_before_servings_and_shared_material_sum()
    {
        var f = new Fixture();
        f.Facts[0].FrozenBomQuantityPerServing = 0.000004m;
        f.Facts[0].FrozenCanonicalUnitToBaseRate = 10m;
        var result = f.Build([f.Selection(10)]);
        Assert.Equal(0.000004m, Assert.Single(result.Materials).RequiredQuantity);
        Assert.Equal(0.0000004m, Assert.Single(result.Materials.Single().Contributions).CanonicalQuantityPerServing);
        var otherDish = GuidHelper.NewId();
        f.Facts[0].FrozenBomQuantityPerServing = 0.000003m;
        var other = f.Contributor(otherDish, "MORNING", "savory", 0.000003m);
        other.FrozenCanonicalUnitToBaseRate = 10m;
        f.Facts.Add(other);
        var combined = f.Build([f.Selection(1), new(GuidHelper.ToGuidString(otherDish), "MORNING", "savory", 1)]);
        Assert.Equal(0.000001m, Assert.Single(combined.Materials).RequiredQuantity);
    }

    [Theory]
    [InlineData("missing-rate")]
    [InlineData("conflict")]
    [InlineData("wrong-day")]
    [InlineData("wrong-batch")]
    [InlineData("invalidated")]
    [InlineData("duplicate-selection")]
    [InlineData("zero-servings")]
    [InlineData("overflow")]
    public void Unsafe_frozen_snapshot_is_rejected_without_mutating_baseline(string scenario)
    {
        var f = new Fixture();
        var selections = new List<ReconciliationSupplementalDishSelection> { f.Selection(10) };
        switch (scenario)
        {
            case "missing-rate": f.Facts[0].FrozenBomUnitToBaseRate = null; break;
            case "conflict": f.Facts.Add(f.Contributor(f.Dish, "MORNING", "savory", 0.4m)); break;
            case "wrong-day": f.Line.ServiceDate = f.Day.AddDays(1); break;
            case "wrong-batch": f.Line.BatchId = GuidHelper.NewId(); break;
            case "invalidated": f.Facts[0].InvalidatedAt = DateTime.UtcNow; break;
            case "duplicate-selection": selections.Add(f.Selection(10)); break;
            case "zero-servings": selections[0] = f.Selection(0); break;
            case "overflow": f.Facts[0].FrozenBomQuantityPerServing = decimal.MaxValue; break;
        }
        Assert.Throws<BusinessRuleException>(() => f.Build(selections));
        Assert.Equal(12m, f.Line.RequiredQuantity);
        Assert.Equal(2, f.Batch.Version);
    }

    private sealed class Fixture
    {
        public readonly DateOnly Day = new(2026, 11, 30);
        public readonly byte[] Dish = GuidHelper.NewId();
        public readonly ReconciliationBatch Batch = new() { BatchId = GuidHelper.NewId(), Version = 2, Status = "IN_PROGRESS" };
        public readonly ReconciliationBatchDailyLine Line;
        public readonly List<ReconciliationBatchContributor> Facts = [];
        public Fixture()
        {
            Line = new() { DailyLineId = GuidHelper.NewId(), BatchLineId = GuidHelper.NewId(), BatchId = Batch.BatchId,
                ServiceDate = Day, IngredientId = GuidHelper.NewId(), CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 12m };
            Facts.Add(Contributor(Dish, "MORNING", "savory", 0.2m));
        }
        public ReconciliationBatchContributor Contributor(byte[] dish, string shift, string variant, decimal quantity) => new()
        {
            ContributorId = GuidHelper.NewId(), DailyLineId = Line.DailyLineId, BatchLineId = Line.BatchLineId,
            DishId = dish, FrozenDishCode = "DISH-1", FrozenDishName = "Món đã đóng băng", FrozenShiftName = shift,
            FrozenMenuVariant = variant, FrozenBomQuantityPerServing = quantity, FrozenBomUnitToBaseRate = 1,
            FrozenCanonicalUnitToBaseRate = 1, FrozenWasteRatePercent = 20, FrozenServings = 60
        };
        public ReconciliationSupplementalDishSelection Selection(int count) => new(GuidHelper.ToGuidString(Dish), "MORNING", "savory", count);
        public ReconciliationSupplementalSnapshot Build(IReadOnlyList<ReconciliationSupplementalDishSelection> selections)
            => ReconciliationSupplementalSnapshotBuilder.Build(Batch, Day, selections, [Line], Facts);
    }
}
