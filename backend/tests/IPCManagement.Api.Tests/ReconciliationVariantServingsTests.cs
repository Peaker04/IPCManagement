using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

/// <summary>
/// BR-MRX-SERV-1: món ở slot <c>vegetarian-*</c> nhân với số suất chay, mọi slot khác nhân với số suất mặn.
/// </summary>
public sealed class ReconciliationVariantServingsTests
{
    private const decimal SavoryBomPerServing = 2m;
    private const decimal VegetarianBomPerServing = 3m;

    [Fact]
    public async Task Vegetarian_slot_multiplies_vegetarian_servings()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        var seed = await SeedVariantSourceAsync(fixture, savory: 280, vegetarian: 20, sameDishInBothMenus: false);
        await using var context = fixture.CreateContext();

        var projected = ReconciliationMaterialProjection.Project(await LoadSourceLinesAsync(context));

        var dishes = Assert.Single(projected).Dishes;
        var savoryDish = Assert.Single(dishes, dish => dish.MenuItem.DishId.SequenceEqual(fixture.DishWithBomId));
        Assert.Equal("savory", savoryDish.MenuVariant);
        Assert.Equal(280, savoryDish.Servings);
        Assert.Equal(SavoryBomPerServing * 280, Assert.Single(savoryDish.Materials).RequiredQuantity);
        var vegetarianDish = Assert.Single(dishes, dish => dish.MenuItem.DishId.SequenceEqual(seed.VegetarianDishId));
        Assert.Equal("vegetarian", vegetarianDish.MenuVariant);
        Assert.Equal(20, vegetarianDish.Servings);
        Assert.Equal(VegetarianBomPerServing * 20, Assert.Single(vegetarianDish.Materials).RequiredQuantity);
    }

    [Fact]
    public async Task Same_dish_in_both_menus_counts_twice()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await SeedVariantSourceAsync(fixture, savory: 280, vegetarian: 20, sameDishInBothMenus: true);
        await using var context = fixture.CreateContext();

        var projected = ReconciliationMaterialProjection.Project(await LoadSourceLinesAsync(context));

        var sameDish = Assert.Single(projected).Dishes
            .Where(dish => dish.MenuItem.DishId.SequenceEqual(fixture.DishWithBomId))
            .OrderBy(dish => dish.MenuVariant, StringComparer.Ordinal)
            .ToList();
        Assert.Equal(2, sameDish.Count);
        Assert.Equal(("savory", 280, SavoryBomPerServing * 280),
            (sameDish[0].MenuVariant, sameDish[0].Servings, Assert.Single(sameDish[0].Materials).RequiredQuantity));
        Assert.Equal(("vegetarian", 20, SavoryBomPerServing * 20),
            (sameDish[1].MenuVariant, sameDish[1].Servings, Assert.Single(sameDish[1].Materials).RequiredQuantity));
    }

    [Fact]
    public async Task Zero_vegetarian_servings_contribute_nothing()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        var seed = await SeedVariantSourceAsync(fixture, savory: 300, vegetarian: 0, sameDishInBothMenus: false);
        await using var context = fixture.CreateContext();

        var result = ReconciliationMaterialProjection.Inspect(await LoadSourceLinesAsync(context));

        Assert.Empty(result.Diagnostics);
        var dishes = Assert.Single(result.Lines).Dishes;
        var vegetarianDish = Assert.Single(dishes, dish => dish.MenuItem.DishId.SequenceEqual(seed.VegetarianDishId));
        Assert.Equal("vegetarian", vegetarianDish.MenuVariant);
        Assert.Equal(0, vegetarianDish.Servings);
        Assert.Equal(0m, vegetarianDish.Materials.Sum(material => material.RequiredQuantity));
        var savoryDish = Assert.Single(dishes, dish => dish.MenuItem.DishId.SequenceEqual(fixture.DishWithBomId));
        Assert.Equal(SavoryBomPerServing * 300, Assert.Single(savoryDish.Materials).RequiredQuantity);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData(280, null)]
    [InlineData(null, 20)]
    public async Task Missing_split_throws_servings_split_required(int? savory, int? vegetarian)
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await SeedVariantSourceAsync(fixture, savory, vegetarian, sameDishInBothMenus: false);
        await using var context = fixture.CreateContext();
        var sourceLines = await LoadSourceLinesAsync(context);

        var error = Assert.Throws<MrxSourceChangeException>(() => ReconciliationMaterialProjection.Project(sourceLines));

        Assert.Equal("MRX_SERVINGS_SPLIT_REQUIRED", error.Code);
        Assert.Equal(422, error.StatusCode);
    }

    [Fact]
    public async Task Split_not_matching_final_servings_throws_servings_split_required()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await SeedVariantSourceAsync(fixture, savory: 280, vegetarian: 20, sameDishInBothMenus: false);
        await using (var write = fixture.CreateContext())
        {
            // Đổi tổng như luồng NewServings cũ mà không tách lại Mặn/Chay.
            var line = await write.Mealquantityplanlines.SingleAsync();
            line.FinalServings = 310;
            await write.SaveChangesAsync();
        }
        await using var context = fixture.CreateContext();
        var sourceLines = await LoadSourceLinesAsync(context);

        var projectError = Assert.Throws<MrxSourceChangeException>(() => ReconciliationMaterialProjection.Project(sourceLines));
        var inspectError = Assert.Throws<MrxSourceChangeException>(() => ReconciliationMaterialProjection.Inspect(sourceLines));

        Assert.Equal("MRX_SERVINGS_SPLIT_REQUIRED", projectError.Code);
        Assert.Equal(422, projectError.StatusCode);
        Assert.Equal("MRX_SERVINGS_SPLIT_REQUIRED", inspectError.Code);
    }

    [Fact]
    public async Task Materialized_contributor_records_variant_and_variant_servings()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        var seed = await SeedVariantSourceAsync(fixture, savory: 280, vegetarian: 20, sameDishInBothMenus: false);
        await using var context = fixture.CreateContext();
        await PublishSourceAsync(context, fixture);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = CreateImportService(context, cache);

        var preview = await service.PreviewAsync(new(GuidHelper.ToGuidString(seed.MenuVersionId), "Nguồn Mặn/Chay"));
        var commit = await service.CommitAsync(new(preview.Token, preview.ContentFingerprint, "Nguồn Mặn/Chay"), fixture.UserIdString);

        Assert.False(commit.IdempotentReplay);
        var contributors = await context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync();
        Assert.Equal(2, contributors.Count);
        var vegetarian = Assert.Single(contributors, item => item.DishId!.SequenceEqual(seed.VegetarianDishId));
        Assert.Equal("vegetarian", vegetarian.FrozenMenuVariant);
        Assert.Equal(20, vegetarian.FrozenServings);
        Assert.Equal(VegetarianBomPerServing * 20, vegetarian.SourceQuantity);
        var savory = Assert.Single(contributors, item => item.DishId!.SequenceEqual(fixture.DishWithBomId));
        Assert.Equal("savory", savory.FrozenMenuVariant);
        Assert.Equal(280, savory.FrozenServings);
        Assert.Equal(SavoryBomPerServing * 280, savory.SourceQuantity);
    }

    [Fact]
    public async Task Fingerprint_changes_when_split_changes_with_same_total()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        var seed = await SeedVariantSourceAsync(fixture, savory: 280, vegetarian: 20, sameDishInBothMenus: false);
        await using var context = fixture.CreateContext();
        await PublishSourceAsync(context, fixture);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = CreateImportService(context, cache);
        var request = new PreviewQuantityImportRequest(GuidHelper.ToGuidString(seed.MenuVersionId), "Nguồn Mặn/Chay");

        var first = await service.PreviewAsync(request);
        var line = await context.Mealquantityplanlines.SingleAsync();
        line.SavoryServings = 270;
        line.VegetarianServings = 30;
        await context.SaveChangesAsync();
        Assert.Equal(300, line.FinalServings);
        var second = await service.PreviewAsync(request);

        Assert.Equal(3, first.FingerprintFormatVersion);
        Assert.Equal(3, second.FingerprintFormatVersion);
        Assert.NotEqual(first.ContentFingerprint, second.ContentFingerprint);
    }

    private sealed record VariantSeed(byte[] VegetarianDishId, byte[] MenuVersionId);

    private static async Task<VariantSeed> SeedVariantSourceAsync(
        WorkflowGenerationTests.WorkflowFixture fixture, int? savory, int? vegetarian, bool sameDishInBothMenus)
    {
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var schedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).SingleAsync();
        var savoryItem = schedule.Menu.Menuitems.Single();
        savoryItem.DishSlot = "savory-main";

        var vegetarianDishId = fixture.DishWithBomId;
        if (!sameDishInBothMenus)
        {
            vegetarianDishId = GuidHelper.NewId();
            var vegetarianIngredientId = GuidHelper.NewId();
            context.Ingredients.Add(new Ingredient
            {
                IngredientId = vegetarianIngredientId, IngredientCode = "ING-CHAY", IngredientName = "Đậu hũ",
                UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 1000, IsFreshDaily = true, IsActive = true
            });
            context.Dishes.Add(new Dish { DishId = vegetarianDishId, DishCode = "DISH-CHAY", DishName = "Đậu hũ sốt cà", IsActive = true });
            context.Dishboms.Add(new DishBom
            {
                BomId = GuidHelper.NewId(), DishId = vegetarianDishId, IngredientId = vegetarianIngredientId, UnitId = fixture.UnitId,
                GrossQtyPerServing = VegetarianBomPerServing, WasteRatePercent = 0, PriceTierAmount = 25000m,
                BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 1, 1)
            });
        }
        context.Menuitems.Add(new MenuItem
        {
            MenuItemId = GuidHelper.NewId(), MenuId = schedule.MenuId, DishId = vegetarianDishId,
            DishSlot = "vegetarian-main", DisplayOrder = 2
        });

        var menuVersionId = GuidHelper.NewId();
        context.Menuversions.Add(new MenuVersion
        {
            MenuVersionId = menuVersionId, CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate,
            VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        schedule.MenuVersionId = menuVersionId;

        var line = await context.Mealquantityplanlines.SingleAsync();
        line.SavoryServings = savory;
        line.VegetarianServings = vegetarian;
        if (savory is not null && vegetarian is not null)
        {
            line.ForecastServings = line.ConfirmedServings = line.FinalServings = savory.Value + vegetarian.Value;
        }
        await context.SaveChangesAsync();
        return new(vegetarianDishId, menuVersionId);
    }

    private static Task<List<MealQuantityPlanLine>> LoadSourceLinesAsync(IpcManagementContext context) =>
        context.Mealquantityplanlines
            .Include(line => line.QuantityPlan)
            .Include(line => line.MenuSchedule)
            .Include(line => line.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Unit)
            .Include(line => line.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
            .AsSplitQuery()
            .ToListAsync();

    private static ReconciliationQuantityImportService CreateImportService(IpcManagementContext context, IMemoryCache cache)
    {
        var requestContext = new SystemOperationRequestContext
        {
            OperationKey = "reconciliation.quantity-import.commit",
            ExpectedModeVersion = 1,
            Disposition = OperationDisposition.Retained
        };
        var runner = new ImmediateTransactionRunner();
        var batchService = new ReconciliationBatchService(context, runner, requestContext);
        return new ReconciliationQuantityImportService(context, runner, requestContext, cache, batchService);
    }

    private static async Task PublishSourceAsync(IpcManagementContext context, WorkflowGenerationTests.WorkflowFixture fixture)
    {
        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
            CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
            CREATE TABLE IF NOT EXISTS reconciliationtolerances (toleranceId BLOB PRIMARY KEY, scopeKind TEXT NOT NULL, scopeId BLOB NULL, value TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, systemDefaultKey INTEGER NULL);
            """);
        context.Reconciliationtolerances.Add(new ReconciliationTolerance
        {
            ToleranceId = GuidHelper.NewId(), ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope,
            Value = ReconciliationToleranceAuthority.SystemDefaultValue, Version = ReconciliationToleranceAuthority.SystemDefaultVersion,
            CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
    }
}
