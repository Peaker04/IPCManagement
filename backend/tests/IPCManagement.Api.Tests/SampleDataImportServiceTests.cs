using NSubstitute;
using IPCManagement.Api.Features.Inventory.Services;

using System.IO.Compression;
using System.Reflection;
using System.Security;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public class SampleDataImportServiceTests
{
    [Fact]
    public void EnsureBomLine_Should_KeepPresetPriceTiersSeparate()
    {
        var service = new SampleBomImportService(null!, null!, CreateOperationalWarehouseResolver(null!));
        var method = typeof(SampleBomImportService).GetMethod(
            "EnsureBomLine",
            BindingFlags.NonPublic | BindingFlags.Instance);
        var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = "DISH-01", DishName = "Món thử" };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = "ING-01",
            IngredientName = "Nguyên liệu thử"
        };
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var bomLines = new List<DishBom>();
        var counts = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportCountsDto();

        method!.Invoke(service, [dish, ingredient, unit, 0.10m, 25000m, bomLines, true, counts]);
        method.Invoke(service, [dish, ingredient, unit, 0.12m, 30000m, bomLines, true, counts]);
        method.Invoke(service, [dish, ingredient, unit, 0.11m, 25000m, bomLines, true, counts]);

        bomLines.Should().HaveCount(2);
        bomLines.Single(line => line.PriceTierAmount == 25000m).GrossQtyPerServing.Should().Be(0.11m);
        bomLines.Single(line => line.PriceTierAmount == 30000m).GrossQtyPerServing.Should().Be(0.12m);
        bomLines.Should().OnlyContain(line => line.CustomerId == null && line.BomStatus == "PUBLISHED");
        counts.BomLinesCreated.Should().Be(2);
        counts.BomLinesUpdated.Should().Be(1);
    }

    [Fact]
    public void EnsureDish_Should_ReuseStableCode_WhenExistingDishWasRenamed()
    {
        const string sourceName = "Cá kho tộ";
        var stableCode = InvokePrivateStatic<string>(typeof(SampleBomImportService), "StableCode", "DISH", sourceName);
        var existing = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = stableCode,
            DishName = "Tên đã sửa thủ công",
            IsActive = false
        };
        var dishes = new List<Dish> { existing };
        var counts = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportCountsDto();
        var service = new SampleBomImportService(null!, null!, CreateOperationalWarehouseResolver(null!));
        var method = typeof(SampleBomImportService).GetMethod(
            "EnsureDish",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = (Dish)method!.Invoke(service, [sourceName, "Món mặn", "MAIN", dishes, true, counts])!;

        result.Should().BeSameAs(existing);
        result.DishName.Should().Be(sourceName);
        result.IsActive.Should().BeTrue();
        dishes.Should().ContainSingle();
        counts.DishesCreated.Should().Be(0);
        counts.DishesUpdated.Should().Be(1);
    }

    [Fact]
    public void EnsureIngredient_Should_ReuseStableCode_WhenExistingIngredientWasRenamed()
    {
        const string sourceName = "Sườn heo";
        var stableCode = InvokePrivateStatic<string>(typeof(SampleBomImportService), "StableCode", "ING", sourceName);
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var warehouse = new Warehouse { WarehouseId = GuidHelper.NewId(), WarehouseCode = "WH", WarehouseName = "Kho" };
        var existing = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = stableCode,
            IngredientName = "Tên đã sửa thủ công",
            UnitId = unit.UnitId,
            WarehouseId = warehouse.WarehouseId,
            ReferencePrice = 0,
            IsActive = false
        };
        var ingredients = new List<Ingredient> { existing };
        var counts = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportCountsDto();
        var service = new SampleBomImportService(null!, null!, CreateOperationalWarehouseResolver(null!));
        var method = typeof(SampleBomImportService).GetMethod(
            "EnsureIngredient",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = (Ingredient)method!.Invoke(
            service,
            [sourceName, unit, warehouse, 125000m, ingredients, true, counts, false])!;

        result.Should().BeSameAs(existing);
        result.IngredientName.Should().Be(sourceName);
        result.ReferencePrice.Should().Be(125000m);
        result.IsActive.Should().BeTrue();
        ingredients.Should().ContainSingle();
        counts.IngredientsCreated.Should().Be(0);
        counts.IngredientsUpdated.Should().Be(1);
    }

    [Fact]
    public async Task ImportAsync_Should_PersistStableIdsAndReferences_WhenRenamedRowsAreImportedAgain()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new SqliteSampleImportContext(options);
        await context.Database.EnsureCreatedAsync();
        var service = new SampleBomImportService(context, null!, CreateOperationalWarehouseResolver(context));
        using var fixture = CreateSampleImportFixture();
        var request = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportRequest
        {
            SourceDirectory = fixture.SourceDirectory,
            DryRun = false,
            MaxRows = 25
        };

        await service.ImportAsync(request);

        var bom = await context.Dishboms.OrderBy(item => item.BomId).FirstAsync();
        var dish = await context.Dishes.SingleAsync(item => item.DishId == bom.DishId);
        var ingredient = await context.Ingredients.SingleAsync(item => item.IngredientId == bom.IngredientId);
        var originalDishName = dish.DishName;
        var originalIngredientName = ingredient.IngredientName;
        var dishId = dish.DishId.ToArray();
        var ingredientId = ingredient.IngredientId.ToArray();
        var dishCode = dish.DishCode;
        var ingredientCode = ingredient.IngredientCode;
        var bomId = bom.BomId.ToArray();

        dish.DishName = "Tên món đã sửa thủ công";
        ingredient.IngredientName = "Tên nguyên liệu đã sửa thủ công";
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        await service.ImportAsync(request);
        context.ChangeTracker.Clear();

        var persistedDish = await context.Dishes.SingleAsync(item => item.DishCode == dishCode);
        var persistedIngredient = await context.Ingredients.SingleAsync(item => item.IngredientCode == ingredientCode);
        persistedDish.DishId.Should().Equal(dishId);
        persistedDish.DishName.Should().Be(originalDishName);
        persistedIngredient.IngredientId.Should().Equal(ingredientId);
        persistedIngredient.IngredientName.Should().Be(originalIngredientName);
        (await context.Dishes.CountAsync(item => item.DishCode == dishCode)).Should().Be(1);
        (await context.Ingredients.CountAsync(item => item.IngredientCode == ingredientCode)).Should().Be(1);
        var persistedBom = await context.Dishboms.SingleAsync(item => item.BomId == bomId);
        persistedBom.DishId.Should().Equal(dishId);
        persistedBom.IngredientId.Should().Equal(ingredientId);
    }

    [Fact]
    public void EnsureIngredient_ForBomImport_Should_NotOverwriteWarehouseUnit()
    {
        var kgUnit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var fruitUnit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "QUA", UnitName = "Quả" };
        var warehouse = new Warehouse { WarehouseId = GuidHelper.NewId(), WarehouseCode = "WH", WarehouseName = "Kho" };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = InvokePrivateStatic<string>(typeof(SampleBomImportService), "StableCode", "ING", "Chuối"),
            IngredientName = "Chuối",
            UnitId = kgUnit.UnitId,
            WarehouseId = warehouse.WarehouseId,
            IsActive = true
        };
        var ingredients = new List<Ingredient> { ingredient };
        var counts = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportCountsDto();
        var service = new SampleBomImportService(null!, null!, CreateOperationalWarehouseResolver(null!));
        var method = typeof(SampleBomImportService).GetMethod(
            "EnsureIngredient",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = (Ingredient)method!.Invoke(
            service,
            ["Chuối", fruitUnit, warehouse, 1500m, ingredients, true, counts, false])!;

        result.UnitId.Should().Equal(kgUnit.UnitId);
        result.UnitId.Should().NotEqual(fruitUnit.UnitId);
        result.ReferencePrice.Should().Be(1500m);
    }

    [Fact]
    public async Task ImportAsync_Should_NotCreateDuplicateSupplier_WhenSameFilesAreImportedTwice()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new SqliteSampleImportContext(options);
        await context.Database.EnsureCreatedAsync();
        var service = new SampleBomImportService(context, null!, CreateOperationalWarehouseResolver(context));
        using var fixture = CreateSampleImportFixture();
        var request = new IPCManagement.Api.Features.SampleData.Contracts.SampleDataImportRequest
        {
            SourceDirectory = fixture.SourceDirectory,
            DryRun = false,
            MaxRows = 25
        };

        await service.ImportAsync(request);
        var firstSupplierIds = await context.Suppliers
            .AsNoTracking()
            .OrderBy(item => item.SupplierCode)
            .Select(item => item.SupplierId)
            .ToListAsync();

        context.ChangeTracker.Clear();
        await service.ImportAsync(request);
        context.ChangeTracker.Clear();

        var suppliers = await context.Suppliers.AsNoTracking().ToListAsync();
        suppliers.Should().HaveCount(firstSupplierIds.Count);
        suppliers.Select(item => Convert.ToBase64String(item.SupplierId))
            .Should().BeEquivalentTo(firstSupplierIds.Select(Convert.ToBase64String));
        suppliers.Should().NotContain(item => item.SupplierCode.EndsWith("-2", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task ImportAsync_Should_NotPersistAnyRows_WhenDryRunIsEnabled()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new SqliteSampleImportContext(options);
        await context.Database.EnsureCreatedAsync();
        var service = new SampleBomImportService(context, null!, CreateOperationalWarehouseResolver(context));
        using var fixture = CreateSampleImportFixture();

        var result = await service.ImportAsync(new SampleDataImportRequest
        {
            SourceDirectory = fixture.SourceDirectory,
            DryRun = true,
            MaxRows = 25
        });

        result.DryRun.Should().BeTrue();
        result.Counts.BomLinesCreated.Should().BeGreaterThan(0);
        (await context.Warehouses.CountAsync()).Should().Be(1);
        (await context.Units.CountAsync()).Should().Be(0);
        (await context.Suppliers.CountAsync()).Should().Be(0);
        (await context.Ingredients.CountAsync()).Should().Be(0);
        (await context.Dishes.CountAsync()).Should().Be(0);
        (await context.Dishboms.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ImportAsync_Should_ReplaceEveryExistingBom_WhenReplaceCatalogIsEnabled()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new SqliteSampleImportContext(options);
        await context.Database.EnsureCreatedAsync();
        var service = new SampleBomImportService(context, null!, CreateOperationalWarehouseResolver(context));
        using var fixture = CreateSampleImportFixture();
        var request = new SampleDataImportRequest
        {
            SourceDirectory = fixture.SourceDirectory,
            DryRun = false,
            MaxRows = 25
        };

        await service.ImportAsync(request);
        var originalBomIds = await context.Dishboms
            .AsNoTracking()
            .Select(item => item.BomId)
            .ToListAsync();
        originalBomIds.Should().NotBeEmpty();

        context.ChangeTracker.Clear();
        request.ReplaceBomCatalog = true;
        var result = await service.ImportAsync(request);
        context.ChangeTracker.Clear();

        result.Warnings.Should().Contain(message => message.StartsWith("Thay catalog BOM:", StringComparison.Ordinal));
        var replacementBomIds = await context.Dishboms
            .AsNoTracking()
            .Select(item => item.BomId)
            .ToListAsync();
        replacementBomIds.Should().NotBeEmpty();
        replacementBomIds.Should().NotContain(id => originalBomIds.Any(original => original.SequenceEqual(id)));
    }

    [Fact]
    public void CalculateWeightedGrossQty_Should_MergeRepeatedWorkbookBatches()
    {
        var bananaRows = new List<IReadOnlyDictionary<string, string>>
        {
            new Dictionary<string, string> { ["Định lượng (gram) / khay"] = "1.03926096997691", ["Số lượng suất ăn"] = "433" },
            new Dictionary<string, string> { ["Định lượng (gram) / khay"] = "1", ["Số lượng suất ăn"] = "262" }
        };
        var fishRows = new List<IReadOnlyDictionary<string, string>>
        {
            new Dictionary<string, string> { ["Định lượng (gram) / khay"] = "0.123076923076923", ["Số lượng suất ăn"] = "325" },
            new Dictionary<string, string> { ["Định lượng (gram) / khay"] = "0.103448275862069", ["Số lượng suất ăn"] = "116" }
        };

        PresetBomImportPolicy.CalculateWeightedGrossQty(bananaRows).Should().Be(1.02446m);
        PresetBomImportPolicy.CalculateWeightedGrossQty(fishRows).Should().Be(0.117914m);
    }

    [Fact]
    public void ValidateAndDeduplicate_Should_MergeSameTierDishIngredientAndReportWarning()
    {
        var rows = new List<PresetBomSourceRow>
        {
            new("định lượng suất 25k", 25000m, new Dictionary<string, string>
            {
                ["Món"] = "Cơm gà",
                ["Nguyên liệu chính"] = "Thịt gà",
                ["Định lượng (gram) / khay"] = "0.1",
                ["Số lượng suất ăn"] = "100"
            }),
            new("định lượng suất 25k", 25000m, new Dictionary<string, string>
            {
                ["Món"] = "Cơm gà",
                ["Nguyên liệu chính"] = "Thịt gà",
                ["Định lượng (gram) / khay"] = "0.2",
                ["Số lượng suất ăn"] = "100"
            })
        };

        var result = PresetBomImportPolicy.ValidateAndDeduplicate(rows);

        result.Rows.Should().ContainSingle();
        result.Rows[0].Row["Định lượng (gram) / khay"].Should().Be("0.15");
        result.Warnings.Should().ContainSingle().Which.Should().Contain("gộp 2 dòng");
    }

    [Fact]
    public void ParsePresetGrossQtyPerServing_Should_FallbackToWeightDividedByServings()
    {
        IReadOnlyDictionary<string, string> row = new Dictionary<string, string>
        {
            ["Định lượng (gram) / khay"] = "",
            ["Khối lượng ( kg)"] = "3.5",
            ["Số lượng suất ăn"] = "100"
        };

        PresetBomImportPolicy.ParseGrossQtyPerServing(row).Should().Be(0.035m);
    }

    [Fact]
    public void ParsePresetGrossQtyPerServing_Should_ReadScientificNotationFromXlsxCache()
    {
        IReadOnlyDictionary<string, string> row = new Dictionary<string, string>
        {
            ["Định lượng (gram) / khay"] = "1.4999999999999999E-2",
            ["Khối lượng ( kg)"] = "",
            ["Số lượng suất ăn"] = "1"
        };

        PresetBomImportPolicy.ParseGrossQtyPerServing(row).Should().Be(0.015m);
    }

    [Theory]
    [InlineData("Trứng gà", "CAI")]
    [InlineData("trứng cút lọt sẵn", "CAI")]
    [InlineData("Sữa chua", "HOP")]
    [InlineData("Chuối", "QUA")]
    [InlineData("Bánh mì", "O")]
    [InlineData("Chả cá", "MIENG")]
    [InlineData("Căn cuộn", "CAY")]
    [InlineData("Đậu khuôn chiên lát nhỏ", "LAT")]
    [InlineData("Cá lóc", "KG")]
    public void ResolvePresetBomUnit_Should_UseTechnicalUnitForCountedIngredients(string ingredientName, string expectedCode)
    {
        var kgUnit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var presetUnits = new[] { "CAI", "HOP", "QUA", "O", "MIENG", "CAY", "LAT" }
            .ToDictionary(
                code => code,
                code => new Unit { UnitId = GuidHelper.NewId(), UnitCode = code, UnitName = code },
                StringComparer.OrdinalIgnoreCase);

        var unit = InvokePrivateStatic<Unit>(
            typeof(SampleBomImportService),
            "ResolvePresetBomUnit",
            ingredientName,
            kgUnit,
            presetUnits);

        unit.UnitCode.Should().Be(expectedCode);
    }

    [Fact]
    public async Task PreviewWeeklyMenuImport_Should_ReturnValidationDto_WhenCustomerIsUnknown()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customers (
                customerId BLOB PRIMARY KEY,
                customerCode TEXT NOT NULL,
                customerName TEXT NOT NULL,
                note TEXT NULL,
                isActive INTEGER NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var service = CreateWeeklyMenuImportService(context);
        await using var stream = new MemoryStream([1, 2, 3]);

        var result = await service.PreviewWeeklyMenuImportAsync(
            stream,
            "menu.xlsx",
            Guid.NewGuid().ToString(),
            new DateOnly(2026, 6, 15),
            null);

        result.Validation.HasCriticalErrors.Should().BeTrue();
        result.Validation.IsValid.Should().BeFalse();
        result.Validation.ErrorCount.Should().Be(1);
        result.Validation.Issues.Should().ContainSingle(issue =>
            issue.Code == "UNKNOWN_CUSTOMER" &&
            issue.Field == "customerId" &&
            issue.Severity == "error");
    }

    [Fact]
    public async Task PreviewWeeklyMenuImport_Should_ReturnReadableValidation_WhenWorkbookCannotBeRead()
    {
        var setup = await CreateWeeklyMenuImportContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var service = CreateWeeklyMenuImportService(context);
        await using var stream = new MemoryStream([1, 2, 3, 4]);

        var result = await service.PreviewWeeklyMenuImportAsync(
            stream,
            "broken.xlsx",
            setup.CustomerIdString,
            new DateOnly(2026, 6, 15),
            25000m);

        result.Validation.HasCriticalErrors.Should().BeTrue();
        result.Validation.Issues.Should().ContainSingle(issue =>
            issue.Code == "FILE_READ_ERROR" &&
            issue.Field == "file" &&
            issue.Message == "File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.");
    }

    [Fact]
    public async Task CommitWeeklyMenuImport_Should_NotChangeExistingMenu_WhenWorkbookCannotBeRead()
    {
        var setup = await CreateWeeklyMenuImportContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var service = CreateWeeklyMenuImportService(context);
        await using var stream = new MemoryStream([1, 2, 3, 4]);

        var act = async () => await service.CommitWeeklyMenuImportAsync(
            stream,
            "broken.xlsx",
            setup.CustomerIdString,
            new DateOnly(2026, 6, 15),
            25000m,
            null,
            setup.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.");
        (await context.Menuversions.CountAsync()).Should().Be(1);
        (await context.Menuschedules.CountAsync()).Should().Be(1);
        (await context.Menuversions.Select(item => item.SourceImportBatch).SingleAsync()).Should().Be("MENU-CUS-20260615-V01");
        (await context.Menuschedules.Select(item => item.Status).SingleAsync()).Should().Be("ACTIVE");
    }

    private static T InvokePrivateStatic<T>(Type serviceType, string methodName, params object?[] args)
    {
        var method = serviceType.GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();
        return (T)method!.Invoke(null, args)!;
    }

    private static SampleImportFixture CreateSampleImportFixture()
    {
        var sourceDirectory = Path.Combine(Path.GetTempPath(), $"ipc-sample-import-{Guid.NewGuid():N}");
        Directory.CreateDirectory(sourceDirectory);

        try
        {
            File.Copy(
                Path.Combine(AppContext.BaseDirectory, "Fixtures", "IPC. Định lượng 07.2026.xlsx"),
                Path.Combine(sourceDirectory, "IPC. Định lượng 07.2026.xlsx"));

            return new SampleImportFixture(sourceDirectory);
        }
        catch
        {
            Directory.Delete(sourceDirectory, recursive: true);
            throw;
        }
    }

    private static void CreateWorkbook(
        string path,
        IReadOnlyList<(string SheetName, IReadOnlyList<IReadOnlyList<string>> Rows)> sheets)
    {
        using var archive = ZipFile.Open(path, ZipArchiveMode.Create);
        var sheetParts = sheets
            .Select((sheet, index) => new { sheet.SheetName, sheet.Rows, PartIndex = index + 1 })
            .ToList();

        AddEntry(archive, "[Content_Types].xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              {string.Concat(sheetParts.Select(part => $"""<Override PartName="/xl/worksheets/sheet{part.PartIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>"""))}
            </Types>
            """);
        AddEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/workbook.xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                {string.Concat(sheetParts.Select(part => $"""<sheet name="{SecurityElement.Escape(part.SheetName)}" sheetId="{part.PartIndex}" r:id="rId{part.PartIndex}"/>"""))}
              </sheets>
            </workbook>
            """);
        AddEntry(archive, "xl/_rels/workbook.xml.rels", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              {string.Concat(sheetParts.Select(part => $"""<Relationship Id="rId{part.PartIndex}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{part.PartIndex}.xml"/>"""))}
            </Relationships>
            """);

        foreach (var part in sheetParts)
        {
            AddEntry(archive, $"xl/worksheets/sheet{part.PartIndex}.xml", BuildSheet(part.Rows));
        }
    }

    private static string BuildSheet(IReadOnlyList<IReadOnlyList<string>> rows)
    {
        var xmlRows = rows.Select((row, rowIndex) =>
        {
            var cells = row.Select((value, columnIndex) =>
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    return string.Empty;
                }

                var reference = $"{ColumnLetter(columnIndex + 1)}{rowIndex + 1}";
                return $"""<c r="{reference}" t="inlineStr"><is><t>{SecurityElement.Escape(value)}</t></is></c>""";
            });

            return $"""<row r="{rowIndex + 1}">{string.Concat(cells)}</row>""";
        });

        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                {string.Concat(xmlRows)}
              </sheetData>
            </worksheet>
            """;
    }

    private static string ColumnLetter(int column)
    {
        var result = string.Empty;
        while (column > 0)
        {
            column--;
            result = (char)('A' + column % 26) + result;
            column /= 26;
        }

        return result;
    }

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        entry.LastWriteTime = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);
        using var writer = new StreamWriter(entry.Open());
        writer.Write(content);
    }

    private sealed class SampleImportFixture(string sourceDirectory) : IDisposable
    {
        public string SourceDirectory { get; } = sourceDirectory;

        public void Dispose()
        {
            if (Directory.Exists(SourceDirectory))
            {
                Directory.Delete(SourceDirectory, recursive: true);
            }
        }
    }

    private sealed class SqliteSampleImportContext(DbContextOptions<IpcManagementContext> options)
        : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.UseCollation(null);

            foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
            {
                property.SetCollation(null);
                if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true)
                {
                    property.SetColumnType("TEXT");
                }

                if (string.Equals(property.GetDefaultValueSql(), "CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase))
                {
                    property.SetDefaultValueSql("CURRENT_TIMESTAMP");
                }
            }

            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                var tableName = entity.GetTableName() ?? entity.Name;
                foreach (var index in entity.GetIndexes())
                {
                    index.SetDatabaseName($"{tableName}_{index.GetDatabaseName()}");
                }
            }
        }
    }

    private static WeeklyMenuImportService CreateWeeklyMenuImportService(IpcManagementContext context)
    {
        var customerResolver = new WeeklyMenuCustomerResolver(context);
        var resultBuilder = new WeeklyMenuImportResultBuilder(context);
        var actorResolver = new WeeklyMenuAuditActorResolver(context);
        var persistence = new WeeklyMenuImportPersistence(context, resultBuilder, actorResolver);
        var cache = new MemoryCache(new MemoryCacheOptions());
        return new WeeklyMenuImportService(
            context,
            customerResolver,
            resultBuilder,
            persistence,
            new WeeklyMenuImportPreviewTicketStore(cache),
            new EfTransactionRunner(context),
            cache);
    }

    private static async Task<WeeklyMenuImportContext> CreateWeeklyMenuImportContextAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customers (
                customerId BLOB PRIMARY KEY,
                customerCode TEXT NOT NULL,
                customerName TEXT NOT NULL,
                note TEXT NULL,
                isActive INTEGER NULL
            );
            CREATE TABLE customerimportmappings (
                mappingId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                sheetNameHint TEXT NULL,
                labelColumn TEXT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            CREATE TABLE users (
                userId BLOB PRIMARY KEY,
                username TEXT NOT NULL,
                fullName TEXT NOT NULL,
                passwordHash TEXT NOT NULL,
                roleId BLOB NOT NULL,
                isActive INTEGER NULL,
                createdAt TEXT NOT NULL
            );
            CREATE TABLE roles (
                roleId BLOB PRIMARY KEY,
                roleCode TEXT NOT NULL,
                roleName TEXT NOT NULL
            );
            CREATE TABLE menus (
                menuId BLOB PRIMARY KEY,
                menuCode TEXT NOT NULL,
                menuName TEXT NOT NULL,
                fromDate TEXT NULL,
                toDate TEXT NULL,
                isActive INTEGER NULL
            );
            CREATE TABLE menuversions (
                menuVersionId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                weekStartDate TEXT NOT NULL,
                versionNo INTEGER NOT NULL,
                status TEXT NOT NULL,
                sourceFileName TEXT NULL,
                sourceChecksum TEXT NULL,
                sourceImportBatch TEXT NULL,
                createdBy BLOB NULL,
                createdAt TEXT NOT NULL,
                publishedBy BLOB NULL,
                publishedAt TEXT NULL,
                updatedAt TEXT NOT NULL,
                successRowCount INTEGER NOT NULL DEFAULT 0,
                errorRowCount INTEGER NOT NULL DEFAULT 0,
                warningRowCount INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE menuschedules (
                menuScheduleId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                menuId BLOB NOT NULL,
                serviceDate TEXT NOT NULL,
                weekStartDate TEXT NOT NULL,
                shiftName TEXT NOT NULL,
                menuPrice TEXT NOT NULL,
                bomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                menuVersionId BLOB NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();
        var roleId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();
        var menuId = GuidHelper.NewId();
        context.Customers.Add(new Customer
        {
            CustomerId = customerId,
            CustomerCode = "CUS",
            CustomerName = "Customer",
            IsActive = true
        });
        context.Roles.Add(new Role
        {
            RoleId = roleId,
            RoleCode = "ADMIN",
            RoleName = "Admin"
        });
        context.Users.Add(new User
        {
            UserId = userId,
            Username = "importer",
            FullName = "Importer",
            PasswordHash = "hash",
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        context.Menus.Add(new Menu
        {
            MenuId = menuId,
            MenuCode = "MENU-OLD",
            MenuName = "Existing menu",
            IsActive = true
        });
        context.Menuversions.Add(new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customerId,
            WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 1,
            Status = "DRAFT",
            SourceFileName = "old.xlsx",
            SourceImportBatch = "MENU-CUS-20260615-V01",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        });
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = customerId,
            MenuId = menuId,
            ServiceDate = new DateOnly(2026, 6, 15),
            WeekStartDate = new DateOnly(2026, 6, 15),
            ShiftName = "MORNING",
            MenuPrice = 25000,
            BomRatePercent = 100,
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        return new WeeklyMenuImportContext(
            connection,
            context,
            GuidHelper.ToGuidString(customerId),
            GuidHelper.ToGuidString(userId));
    }

    private static T GetProperty<T>(object instance, string propertyName)
    {
        var property = instance.GetType().GetProperty(propertyName);
        property.Should().NotBeNull();
        return (T)property!.GetValue(instance)!;
    }

    private sealed record WeeklyMenuImportContext(
        SqliteConnection Connection,
        IpcManagementContext Context,
        string CustomerIdString,
        string UserIdString);
    private static IOperationalWarehouseResolver CreateOperationalWarehouseResolver(IpcManagementContext? context)
    {
        var warehouseId = GuidHelper.NewId();
        if (context is not null)
        {
            context.Warehouses.Add(new Warehouse
            {
                WarehouseId = warehouseId,
                WarehouseCode = "WH-TEST-OP",
                WarehouseName = "Kho vận hành test",
                WarehouseType = "KHAC",
            });
            context.SaveChanges();
        }
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        return resolver;
    }

}
