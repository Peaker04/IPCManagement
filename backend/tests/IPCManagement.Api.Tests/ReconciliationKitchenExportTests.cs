using System.Text;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationKitchenExportTests
{
    [Fact]
    public void Export_controller_is_reconciliation_only_read_authority_with_preview_and_csv_routes()
    {
        var controller = typeof(ReconciliationKitchenCookingController);
        Assert.Contains(controller.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(), attribute => attribute.Policy == AuthorizationPolicies.ReconciliationKitchenAccess);
        var operation = Assert.Single(controller.GetCustomAttributes(typeof(SystemOperationAttribute), true).Cast<SystemOperationAttribute>());
        Assert.Equal(OperationDisposition.ReconciliationOnly, operation.Disposition);
        Assert.NotNull(controller.GetMethod(nameof(ReconciliationKitchenCookingController.Get))!.GetCustomAttributes(typeof(HttpGetAttribute), true).Single());
        Assert.Equal("csv", Assert.IsType<HttpGetAttribute>(controller.GetMethod(nameof(ReconciliationKitchenCookingController.Csv))!.GetCustomAttributes(typeof(HttpGetAttribute), true).Single()).Template);
        Assert.Equal("xlsx", Assert.IsType<HttpGetAttribute>(controller.GetMethod(nameof(ReconciliationKitchenCookingController.Xlsx))!.GetCustomAttributes(typeof(HttpGetAttribute), true).Single()).Template);
    }

    [Fact]
    public async Task Supplemental_dish_projection_uses_frozen_daily_identity_and_ignores_mutable_bom()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), new IPCManagement.Api.Data.Transactions.SystemOperationRequestContext());

        var dishes = await service.ListDishesAsync(GuidHelper.ToGuidString(fixture.BatchId));
        var riceDish = Assert.Single(dishes, dish => dish.DishName == "Cơm rang");
        var mondayRice = Assert.Single(riceDish.Materials, material => material.ServiceDate == fixture.Monday.ToString("yyyy-MM-dd") && material.IngredientName == "Gạo");
        Assert.NotNull(mondayRice.DailyLineId);
        Assert.Equal(0.08m, mondayRice.GrossQtyPerServing);

        fixture.MutableBom.GrossQtyPerServing = 999m;
        fixture.MutableDish.DishName = "Tên món mutable";
        await context.SaveChangesAsync();
        var afterEdit = await service.ListDishesAsync(GuidHelper.ToGuidString(fixture.BatchId));
        Assert.Contains(afterEdit, dish => dish.DishName == "Cơm rang" && dish.Materials.Any(material => material.GrossQtyPerServing == 0.08m));
    }

    [Fact]
    public async Task Supplemental_dish_projection_rejects_ambiguous_frozen_rate_for_same_daily_line()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        var source = fixture.Contributors[0];
        source.BatchLine.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = source.BatchLineId, BatchLine = source.BatchLine,
            DailyLineId = source.DailyLineId, DailyLine = source.DailyLine, DishBomId = source.DishBomId, DishId = source.DishId,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), FrozenShiftName = source.FrozenShiftName,
            FrozenDishCode = source.FrozenDishCode, FrozenDishName = source.FrozenDishName, FrozenServings = source.FrozenServings,
            FrozenBomQuantityPerServing = 0.09m, FrozenWasteRatePercent = source.FrozenWasteRatePercent, SourceQuantity = 1m
        });
        await context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => new ReconciliationBatchService(
            context, new ImmediateTransactionRunner(), new IPCManagement.Api.Data.Transactions.SystemOperationRequestContext())
            .ListDishesAsync(GuidHelper.ToGuidString(fixture.BatchId)));
        Assert.Contains("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS", error.Message);
    }

    [Fact]
    public async Task Projection_uses_frozen_contributors_at_date_shift_dish_ingredient_grain()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        await context.SaveChangesAsync();
        var service = new ReconciliationKitchenExportService(context);

        fixture.Contributors[0].BatchLine.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = fixture.Contributors[0].BatchLineId,
            DailyLineId = fixture.Contributors[0].DailyLineId, DishBomId = fixture.Contributors[0].DishBomId,
            DishId = fixture.Contributors[0].DishId, MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(),
            FrozenShiftName = fixture.Contributors[0].FrozenShiftName, FrozenDishCode = fixture.Contributors[0].FrozenDishCode,
            FrozenDishName = fixture.Contributors[0].FrozenDishName, FrozenServings = fixture.Contributors[0].FrozenServings,
            FrozenBomQuantityPerServing = fixture.Contributors[0].FrozenBomQuantityPerServing,
            FrozenWasteRatePercent = fixture.Contributors[0].FrozenWasteRatePercent, SourceQuantity = 2m
        });
        await context.SaveChangesAsync();
        var result = await service.GetAsync(GuidHelper.ToGuidString(fixture.BatchId));

        Assert.NotNull(result);
        Assert.Equal(3, result.Rows.Count);
        Assert.Collection(result.Rows,
            row => AssertRow(row, fixture.Monday, "Ca sáng", "Cơm rang", "Gạo", 100, 0.08m, 10m),
            row => AssertRow(row, fixture.Monday, "Ca sáng", "Cơm rang", "Trứng", 100, 0.05m, 5m),
            row => AssertRow(row, fixture.Tuesday, "Ca chiều", "Cháo gà", "Gạo", 60, 0.07m, 4.2m));

        fixture.MutableBom.GrossQtyPerServing = 999m;
        fixture.MutableDish.DishName = "Tên món đã sửa sau READY";
        await context.SaveChangesAsync();
        var afterMutableEdit = await service.GetAsync(GuidHelper.ToGuidString(fixture.BatchId));
        Assert.Equal("Cơm rang", afterMutableEdit!.Rows[0].DishName);
        Assert.Equal(0.08m, afterMutableEdit.Rows[0].BomQuantityPerServing);
    }

    [Fact]
    public async Task Conflicting_frozen_facts_at_the_same_export_grain_fail_closed()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        var source = fixture.Contributors[0];
        source.BatchLine.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = source.BatchLineId, DailyLineId = source.DailyLineId,
            DishBomId = source.DishBomId, DishId = source.DishId, MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(),
            FrozenShiftName = source.FrozenShiftName, FrozenDishCode = source.FrozenDishCode, FrozenDishName = source.FrozenDishName,
            FrozenServings = source.FrozenServings, FrozenBomQuantityPerServing = 0.09m,
            FrozenWasteRatePercent = source.FrozenWasteRatePercent, SourceQuantity = 1m
        });
        await context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId)));

        Assert.Contains("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS", error.Message);
    }

    [Fact]
    public async Task Legacy_or_incomplete_frozen_contributors_fail_closed_instead_of_exporting_mutable_data()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        fixture.Contributors[0].FrozenDishName = null;
        await context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId)));

        Assert.Contains("KITCHEN_FROZEN_LINEAGE_MISSING", error.Message);
    }

    [Fact]
    public void Csv_has_utf8_bom_vietnamese_headers_stable_precision_and_no_technical_or_price_fields()
    {
        var bytes = ReconciliationKitchenExportService.BuildCsv([
            new(new DateOnly(2026, 9, 14), "Thứ 2", "MORNING", "D-01", "Cơm \"đặc biệt\"", 100,
                "I-01", "Gạo, thơm", "kg", 0.08m, 5m, 8m)
        ]);

        Assert.Equal(Encoding.UTF8.GetPreamble(), bytes.Take(3));
        var csv = Encoding.UTF8.GetString(bytes);
        Assert.Contains("Ngày,Thứ,Ca,Món,Số suất,Nguyên liệu,Đơn vị,Định lượng BOM / suất,Hao hụt (%),Tổng lượng cần cho món", csv);
        Assert.Contains("14/09/2026", csv);
        Assert.Contains("\"Cơm \"\"đặc biệt\"\"\"", csv);
        Assert.Contains("\"Gạo, thơm\"", csv);
        Assert.Contains(",0.08,5,8", csv);
        Assert.DoesNotContain("BatchId", csv, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("fingerprint", csv, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("version", csv, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("price", csv, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("supplier", csv, StringComparison.OrdinalIgnoreCase);
    }

    private static void AssertRow(IPCManagement.Api.Features.Reconciliation.Contracts.ReconciliationKitchenCookingRowDto row,
        DateOnly date, string shift, string dish, string ingredient, int servings, decimal bom, decimal total)
    {
        Assert.Equal(date, row.ServiceDate);
        Assert.Equal(shift, row.ShiftName);
        Assert.Equal(dish, row.DishName);
        Assert.Equal(ingredient, row.IngredientName);
        Assert.Equal(servings, row.Servings);
        Assert.Equal(bom, row.BomQuantityPerServing);
        Assert.Equal(total, row.TotalRequiredQuantity);
    }

    private static Fixture Seed(IpcManagementContext context)
    {
        var monday = new DateOnly(2026, 9, 14);
        var tuesday = monday.AddDays(1);
        var batchId = GuidHelper.NewId();
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var rice = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "RICE", IngredientName = "Gạo", UnitId = unit.UnitId, Unit = unit, WarehouseId = GuidHelper.NewId(), IsActive = true };
        var egg = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "EGG", IngredientName = "Trứng", UnitId = unit.UnitId, Unit = unit, WarehouseId = GuidHelper.NewId(), IsActive = true };
        var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = "D-01", DishName = "Cơm rang", IsActive = true };
        var bom = new DishBom { BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish, IngredientId = rice.IngredientId, Ingredient = rice, UnitId = unit.UnitId, Unit = unit, GrossQtyPerServing = 0.08m, WasteRatePercent = 5m, EffectiveFrom = monday };
        var batch = new ReconciliationBatch { BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2, CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow };
        var riceWeekly = Weekly(batch, rice, unit, 12.2m);
        var eggWeekly = Weekly(batch, egg, unit, 5m);
        var mondayRice = Daily(riceWeekly, monday, 8m);
        var tuesdayRice = Daily(riceWeekly, tuesday, 4.2m);
        var mondayEgg = Daily(eggWeekly, monday, 5m);
        var contributors = new[]
        {
            Contributor(riceWeekly, mondayRice, dish, bom, "MORNING", 100, 0.08m, 5m, 8m),
            Contributor(eggWeekly, mondayEgg, dish, bom, "MORNING", 100, 0.05m, 0m, 5m),
            Contributor(riceWeekly, tuesdayRice, dish, bom, "AFTERNOON", 60, 0.07m, 5m, 4.2m, "D-02", "Cháo gà"),
        };
        batch.Lines.Add(riceWeekly); batch.Lines.Add(eggWeekly);
        context.AddRange(unit, rice, egg, dish, bom, batch);
        return new(batchId, monday, tuesday, dish, bom, contributors);
    }

    private static ReconciliationBatchLine Weekly(ReconciliationBatch batch, Ingredient ingredient, Unit unit, decimal quantity) => new()
    {
        BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = ingredient.IngredientId, Ingredient = ingredient,
        CanonicalUnitId = unit.UnitId, CanonicalUnit = unit, RequiredQuantity = quantity, FrozenTolerance = 0.1m,
        ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
    };

    private static ReconciliationBatchDailyLine Daily(ReconciliationBatchLine weekly, DateOnly date, decimal quantity)
    {
        var daily = new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = weekly.BatchLineId, BatchId = weekly.BatchId, IngredientId = weekly.IngredientId, CanonicalUnitId = weekly.CanonicalUnitId, ServiceDate = date, RequiredQuantity = quantity, Version = 1, BatchLine = weekly };
        weekly.DailyLines.Add(daily);
        return daily;
    }

    private static ReconciliationBatchContributor Contributor(ReconciliationBatchLine weekly, ReconciliationBatchDailyLine daily, Dish dish, DishBom bom,
        string shift, int servings, decimal rate, decimal waste, decimal total, string? dishCode = null, string? dishName = null)
    {
        var contributor = new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = weekly.BatchLineId, BatchLine = weekly, DailyLineId = daily.DailyLineId, DailyLine = daily,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = bom.BomId, DishId = dish.DishId,
            FrozenShiftName = shift, FrozenDishCode = dishCode ?? dish.DishCode, FrozenDishName = dishName ?? dish.DishName,
            FrozenServings = servings, FrozenBomQuantityPerServing = rate, FrozenWasteRatePercent = waste, SourceQuantity = total
        };
        weekly.Contributors.Add(contributor);
        return contributor;
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseInMemoryDatabase($"kitchen-export-{Guid.NewGuid()}").Options;
        return new KitchenExportTestContext(options);
    }

    private sealed class KitchenExportTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<ReconciliationBatchLine>().Property(item => item.BatchLineId).ValueGeneratedNever();
            modelBuilder.Entity<ReconciliationBatchDailyLine>().Property(item => item.DailyLineId).ValueGeneratedNever();
            modelBuilder.Entity<ReconciliationBatchContributor>().Property(item => item.ContributorId).ValueGeneratedNever();
        }
    }

    private sealed record Fixture(byte[] BatchId, DateOnly Monday, DateOnly Tuesday, Dish MutableDish, DishBom MutableBom, ReconciliationBatchContributor[] Contributors);
}
