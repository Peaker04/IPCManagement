using System.IO.Compression;
using System.Xml.Linq;
using Microsoft.VisualBasic.FileIO;
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
        Assert.Equal(0.08m, mondayRice.CanonicalQtyPerServing);

        fixture.MutableBom.GrossQtyPerServing = 999m;
        fixture.MutableDish.DishName = "Tên món mutable";
        await context.SaveChangesAsync();
        var afterEdit = await service.ListDishesAsync(GuidHelper.ToGuidString(fixture.BatchId));
        Assert.Contains(afterEdit, dish => dish.DishName == "Cơm rang" && dish.Materials.Any(material => material.CanonicalQtyPerServing == 0.08m));
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
            FrozenDishCode = source.FrozenDishCode, FrozenDishName = source.FrozenDishName, FrozenMenuVariant = source.FrozenMenuVariant,
            FrozenServings = source.FrozenServings, FrozenBomQuantityPerServing = 0.09m, FrozenWasteRatePercent = source.FrozenWasteRatePercent, SourceQuantity = 1m
        });
        source.DailyLine!.RequiredQuantity += 1m;
        source.BatchLine.RequiredQuantity += 1m;
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
            FrozenDishName = fixture.Contributors[0].FrozenDishName, FrozenMenuVariant = fixture.Contributors[0].FrozenMenuVariant,
            FrozenServings = fixture.Contributors[0].FrozenServings, FrozenBomQuantityPerServing = fixture.Contributors[0].FrozenBomQuantityPerServing,
            FrozenBomUnitToBaseRate = fixture.Contributors[0].FrozenBomUnitToBaseRate,
            FrozenCanonicalUnitToBaseRate = fixture.Contributors[0].FrozenCanonicalUnitToBaseRate,
            FrozenWasteRatePercent = fixture.Contributors[0].FrozenWasteRatePercent, SourceQuantity = 2m
        });
        fixture.Contributors[0].DailyLine!.RequiredQuantity += 2m;
        fixture.Contributors[0].BatchLine.RequiredQuantity += 2m;
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
    public async Task Kitchen_export_includes_menu_variant_and_variant_servings()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        fixture.Contributors[0].FrozenMenuVariant = "savory";
        fixture.Contributors[1].FrozenMenuVariant = "savory";
        fixture.Contributors[2].FrozenMenuVariant = "vegetarian";
        fixture.Contributors[2].FrozenServings = 20;
        fixture.Contributors[2].SourceQuantity = 1.4m;
        fixture.Contributors[2].DailyLine!.RequiredQuantity = 1.4m;
        fixture.Contributors[2].BatchLine.RequiredQuantity = 9.4m;
        await context.SaveChangesAsync();

        var result = await new ReconciliationKitchenExportService(context)
            .GetAsync(GuidHelper.ToGuidString(fixture.BatchId));

        var vegetarian = Assert.Single(result!.Rows, row => row.ServiceDate == fixture.Tuesday);
        Assert.Equal("Chay", vegetarian.MenuVariant);
        Assert.Equal(20, vegetarian.Servings);
        Assert.Equal(1.4m, vegetarian.TotalRequiredQuantity);
        var csv = Encoding.UTF8.GetString(ReconciliationKitchenExportService.BuildCsv(result.Rows, "ANV - AMANN", fixture.Monday));
        Assert.Contains("Ngày,Thứ,Ca,Thực đơn,Món,Số suất", csv);
        Assert.Contains("\"Chay\"", csv);
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
            FrozenMenuVariant = source.FrozenMenuVariant, FrozenServings = source.FrozenServings, FrozenBomQuantityPerServing = 0.09m,
            FrozenWasteRatePercent = source.FrozenWasteRatePercent, SourceQuantity = 1m
        });
        source.DailyLine!.RequiredQuantity += 1m;
        source.BatchLine.RequiredQuantity += 1m;
        await context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId)));

        Assert.Contains("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS", error.Message);
    }

    [Theory]
    [InlineData("missing-name")]
    [InlineData("missing-contributor")]
    [InlineData("invalidated-contributor")]
    [InlineData("partial-quantity")]
    public async Task Legacy_or_incomplete_frozen_contributors_fail_closed_instead_of_exporting_mutable_data(string defect)
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        if (defect == "missing-name") fixture.Contributors[0].FrozenDishName = null;
        else if (defect == "missing-contributor") context.Reconciliationbatchcontributors.Remove(fixture.Contributors[0]);
        else if (defect == "partial-quantity") fixture.Contributors[0].SourceQuantity -= 0.1m;
        else fixture.Contributors[0].InvalidatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId)));

        Assert.Contains("KITCHEN_FROZEN_LINEAGE_MISSING", error.Message);
        var catalogError = await Assert.ThrowsAsync<BusinessRuleException>(() => new ReconciliationBatchService(
            context, new ImmediateTransactionRunner(), new IPCManagement.Api.Data.Transactions.SystemOperationRequestContext())
            .ListDishesAsync(GuidHelper.ToGuidString(fixture.BatchId)));
        Assert.Contains("KITCHEN_FROZEN_LINEAGE_MISSING", catalogError.Message);
    }

    [Fact]
    public async Task Missing_frozen_conversion_keeps_kitchen_totals_but_exports_no_guessed_rate()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        foreach (var contributor in fixture.Contributors)
        {
            contributor.FrozenBomUnitToBaseRate = null;
            contributor.FrozenCanonicalUnitToBaseRate = null;
        }
        await context.SaveChangesAsync();
        var document = await new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId));
        Assert.All(document!.Rows, row =>
        {
            Assert.Null(row.BomQuantityPerServing);
            Assert.Equal("FROZEN_UNIT_CONVERSION_MISSING", row.QuantityUnavailableReasonCode);
        });
        Assert.Equal(17.2m, document.Rows.Sum(row => row.TotalRequiredQuantity));
        using var parser = new TextFieldParser(new MemoryStream(ReconciliationKitchenExportService.BuildCsv(document.Rows, "Khách", fixture.Monday)), Encoding.UTF8)
            { TextFieldType = FieldType.Delimited, HasFieldsEnclosedInQuotes = true };
        parser.SetDelimiters(",");
        parser.ReadFields();
        var cells = parser.ReadFields()!;
        Assert.Equal(string.Empty, cells[8]);
        Assert.Equal("8", cells[10]);
        using var zip = new ZipArchive(new MemoryStream(ReconciliationKitchenExportService.BuildXlsx(document.Rows, "Khách", fixture.Monday)));
        using var sheet = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var xml = XDocument.Load(sheet);
        Assert.Empty(Assert.Single(xml.Descendants(ns + "c"), cell => (string?)cell.Attribute("r") == "I2").Value);
        Assert.Equal("8", Assert.Single(xml.Descendants(ns + "c"), cell => (string?)cell.Attribute("r") == "K2").Value);
    }

    [Fact]
    public void Csv_has_utf8_bom_vietnamese_headers_stable_precision_and_no_technical_or_price_fields()
    {
        var bytes = ReconciliationKitchenExportService.BuildCsv([
            new(new DateOnly(2026, 9, 14), "Thứ 2", "MORNING", "D-01", "Cơm \"đặc biệt\"", 100,
                "I-01", "Gạo, thơm", "kg", 0.08m, 5m, 8m) { MenuVariant = "Mặn" }
        ], "ANV - AMANN", new DateOnly(2026, 9, 14));

        Assert.Equal(Encoding.UTF8.GetPreamble(), bytes.Take(3));
        var csv = Encoding.UTF8.GetString(bytes);
        Assert.Contains("Ngày,Thứ,Ca,Thực đơn,Món,Số suất,Nguyên liệu,Đơn vị,Định lượng BOM / suất,Hao hụt (%),Tổng lượng cần cho món", csv);
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

    [Fact]
    public async Task Sub_six_decimal_canonical_per_serving_rate_is_preserved_in_csv_and_xlsx_while_totals_keep_six_decimals()
    {
        await using var context = CreateContext();
        var fixture = Seed(context);
        var target = fixture.Contributors[0];
        target.FrozenServings = 1000;
        target.FrozenBomQuantityPerServing = 0.0004m;
        target.FrozenBomUnitToBaseRate = 1m;
        target.FrozenCanonicalUnitToBaseRate = 1000m;
        target.SourceQuantity = 0.0004m;
        target.DailyLine!.RequiredQuantity = 0.0004m;
        target.BatchLine.RequiredQuantity = 0.0004m + fixture.Contributors[2].SourceQuantity;
        await context.SaveChangesAsync();

        var document = await new ReconciliationKitchenExportService(context).GetAsync(GuidHelper.ToGuidString(fixture.BatchId));
        var row = Assert.Single(document!.Rows, item => item.ServiceDate == fixture.Monday && item.IngredientCode == "RICE");
        Assert.Equal(0.0000004m, row.BomQuantityPerServing);
        Assert.Equal(0.0004m, row.TotalRequiredQuantity);

        using var parser = new TextFieldParser(new MemoryStream(ReconciliationKitchenExportService.BuildCsv([row], "Khách", fixture.Monday)), Encoding.UTF8)
        {
            TextFieldType = FieldType.Delimited, HasFieldsEnclosedInQuotes = true
        };
        parser.SetDelimiters(",");
        parser.ReadFields();
        var cells = parser.ReadFields()!;
        Assert.Equal("0.0000004", cells[8]);
        Assert.Equal("0.0004", cells[10]);

        using var zip = new ZipArchive(new MemoryStream(ReconciliationKitchenExportService.BuildXlsx([row], "Khách", fixture.Monday)));
        using var sheet = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var xml = XDocument.Load(sheet);
        var rateCell = Assert.Single(xml.Descendants(ns + "c"), cell => (string?)cell.Attribute("r") == "I2");
        var totalCell = Assert.Single(xml.Descendants(ns + "c"), cell => (string?)cell.Attribute("r") == "K2");
        Assert.Equal("n", (string?)rateCell.Attribute("t"));
        Assert.Equal("0.0000004", rateCell.Element(ns + "v")!.Value);
        Assert.Equal("n", (string?)totalCell.Attribute("t"));
        Assert.Equal("0.0004", totalCell.Element(ns + "v")!.Value);
    }

    [Theory]
    [InlineData("=1+1 - 1")]
    [InlineData("+SUM(1,2)")]
    [InlineData("-1+2")]
    [InlineData("@SUM(A1:A2)")]
    [InlineData(" \t=1+1")]
    [InlineData("\r\n+1")]
    public void Export_treats_formula_leading_labels_as_text_without_changing_numeric_cells(string label)
    {
        IPCManagement.Api.Features.Reconciliation.Contracts.ReconciliationKitchenCookingRowDto[] rows = [
            new(new DateOnly(2026, 9, 14), "Thứ 2", label, "D-01", label, 100,
                "I-01", label, label, 0.123456m, 5m, 12.3456m) { MenuVariant = label }
        ];
        var bytes = ReconciliationKitchenExportService.BuildCsv(rows, label, new DateOnly(2026, 9, 14));
        using var stream = new MemoryStream(bytes);
        using var parser = new TextFieldParser(stream, Encoding.UTF8, detectEncoding: true)
        {
            TextFieldType = FieldType.Delimited, HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false
        };
        parser.SetDelimiters(",");
        Assert.Equal(14, parser.ReadFields()!.Length);
        var cells = parser.ReadFields()!;
        Assert.Equal(14, cells.Length);
        foreach (var index in new[] { 2, 3, 4, 6, 7, 11 }) Assert.Equal("'" + label, cells[index]);
        Assert.Equal("100", cells[5]);
        Assert.Equal("0.123456", cells[8]);
        Assert.Equal("5", cells[9]);
        Assert.Equal("12.3456", cells[10]);
        Assert.True(parser.EndOfData);

        using var workbook = new ZipArchive(new MemoryStream(ReconciliationKitchenExportService.BuildXlsx(rows, label, new DateOnly(2026, 9, 14))));
        using var sheet = workbook.GetEntry("xl/worksheets/sheet1.xml")!.Open();
        var xml = XDocument.Load(sheet);
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        Assert.Empty(xml.Descendants(ns + "f"));
        foreach (var reference in new[] { "F2", "I2", "J2", "K2" })
            Assert.Equal("n", (string?)Assert.Single(xml.Descendants(ns + "c"), item => (string?)item.Attribute("r") == reference).Attribute("t"));
        foreach (var reference in new[] { "C2", "D2", "E2", "G2", "H2", "L2" })
        {
            var cell = Assert.Single(xml.Descendants(ns + "c"), item => (string?)item.Attribute("r") == reference);
            Assert.Equal("inlineStr", (string?)cell.Attribute("t"));
            Assert.Equal(label.Replace("\r\n", "\n"), cell.Descendants(ns + "t").Single().Value);
        }
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
            FrozenMenuVariant = "savory", FrozenServings = servings, FrozenBomQuantityPerServing = rate,
            FrozenBomUnitToBaseRate = 1m, FrozenCanonicalUnitToBaseRate = 1m,
            FrozenWasteRatePercent = waste, SourceQuantity = total
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
