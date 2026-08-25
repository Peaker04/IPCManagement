using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationBomSelectionTests
{
    private static readonly DateOnly ServiceDate = new(2026, 8, 25);

    [Fact]
    public void Resolver_filters_published_effective_normalized_price_tier()
    {
        var customer = Guid.NewGuid().ToByteArray();
        var selected = BomSelectionResolver.Resolve([
            Bom(25000m),
            Bom(30000m),
            Bom(25000m, status: "DRAFT"),
            Bom(25000m, effectiveFrom: ServiceDate.AddDays(1))
        ], customer, 25000.49m, ServiceDate);

        Assert.Single(selected);
        Assert.Equal(25000m, selected[0].PriceTierAmount);
        Assert.Equal("PUBLISHED", selected[0].BomStatus);
    }

    [Fact]
    public void Resolver_uses_customer_override_instead_of_global_and_falls_back_when_absent()
    {
        var customer = Guid.NewGuid().ToByteArray();
        var otherCustomer = Guid.NewGuid().ToByteArray();
        var global = Bom(30000m);
        var customerOverride = Bom(30000m, customer);

        Assert.Equal([customerOverride], BomSelectionResolver.Resolve([global, customerOverride], customer, 30000m, ServiceDate));
        Assert.Equal([global], BomSelectionResolver.Resolve([global, customerOverride], otherCustomer, 30000m, ServiceDate));
    }

    [Fact]
    public void Duplicate_menu_dishes_can_be_distinct_and_contributor_totals_use_exact_conversion()
    {
        var dishId = Guid.NewGuid().ToByteArray();
        var duplicateItems = new[]
        {
            new MenuItem { DishId = dishId, DisplayOrder = 1 },
            new MenuItem { DishId = dishId, DisplayOrder = 2 }
        };
        Assert.Single(duplicateItems.OrderBy(x => x.DisplayOrder).DistinctBy(x => Convert.ToBase64String(x.DishId)));

        var grams = new Unit { UnitId = Guid.NewGuid().ToByteArray(), BaseUnitCode = "KG", ConvertRateToBase = 0.001m };
        var kilograms = new Unit { UnitId = Guid.NewGuid().ToByteArray(), BaseUnitCode = "KG", ConvertRateToBase = 1m };
        var contributorA = ReconciliationBatchService.ConvertToCanonical(1250m * 2m, grams, kilograms);
        var contributorB = ReconciliationBatchService.ConvertToCanonical(500m * 3m, grams, kilograms);

        Assert.Equal(2.5m, contributorA);
        Assert.Equal(1.5m, contributorB);
        Assert.Equal(4m, contributorA + contributorB);
    }

    private static DishBom Bom(decimal tier, byte[]? customer = null, string status = "PUBLISHED", DateOnly? effectiveFrom = null) => new()
    {
        BomId = Guid.NewGuid().ToByteArray(),
        DishId = Guid.NewGuid().ToByteArray(),
        IngredientId = Guid.NewGuid().ToByteArray(),
        UnitId = Guid.NewGuid().ToByteArray(),
        CustomerId = customer,
        PriceTierAmount = tier,
        BomStatus = status,
        EffectiveFrom = effectiveFrom ?? ServiceDate.AddDays(-1)
    };
}
