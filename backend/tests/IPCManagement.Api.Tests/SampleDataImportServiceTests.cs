using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.SampleData;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class SampleDataImportServiceTests
{
    [Theory]
    [InlineData("Kg", "KG")]
    [InlineData("Ký", "KG")]
    [InlineData("Thùng", "THUNG")]
    [InlineData("Bịch", "BICH")]
    public void NormalizeUnitCode_Should_Handle_CommonVietnameseUnits(string input, string expected)
    {
        var result = InvokePrivateStatic<string>("NormalizeUnitCode", input);

        result.Should().Be(expected);
    }

    [Fact]
    public void ParseDate_Should_Handle_ExcelSerial_AndVietnameseDateText()
    {
        var serialResult = InvokePrivateStatic<DateOnly?>("ParseDate", "45823");
        var textResult = InvokePrivateStatic<DateOnly?>("ParseDate", "Từ ngày 15/06/2026 đến ngày 20/06/2026");

        serialResult.Should().Be(new DateOnly(2025, 6, 15));
        textResult.Should().Be(new DateOnly(2026, 6, 15));
    }

    [Fact]
    public void EnsureBomLine_Should_KeepPresetPriceTiersSeparate()
    {
        var service = new SampleDataImportService(null!, null!);
        var method = typeof(SampleDataImportService).GetMethod(
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
        var bomLines = new List<Dishbom>();
        var counts = new IPCManagement.Api.Models.DTOs.SampleData.SampleDataImportCountsDto();

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
        var stableCode = InvokePrivateStatic<string>("StableCode", "DISH", sourceName);
        var existing = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = stableCode,
            DishName = "Tên đã sửa thủ công",
            IsActive = false
        };
        var dishes = new List<Dish> { existing };
        var counts = new IPCManagement.Api.Models.DTOs.SampleData.SampleDataImportCountsDto();
        var service = new SampleDataImportService(null!, null!);
        var method = typeof(SampleDataImportService).GetMethod(
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
        var stableCode = InvokePrivateStatic<string>("StableCode", "ING", sourceName);
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
        var counts = new IPCManagement.Api.Models.DTOs.SampleData.SampleDataImportCountsDto();
        var service = new SampleDataImportService(null!, null!);
        var method = typeof(SampleDataImportService).GetMethod(
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
        var service = new SampleDataImportService(context, null!);
        var request = new IPCManagement.Api.Models.DTOs.SampleData.SampleDataImportRequestDto
        {
            SourceDirectory = FindDocsDirectory(),
            DryRun = false,
            MaxRows = 25
        };

        await service.ImportAsync(request);

        var dish = await context.Dishes
            .Include(item => item.Menuitems)
            .FirstAsync(item => item.Menuitems.Count > 0);
        var ingredient = await context.Ingredients
            .Include(item => item.Inventoryreceiptlines)
            .FirstAsync(item => item.Inventoryreceiptlines.Count > 0);
        var originalDishName = dish.DishName;
        var originalIngredientName = ingredient.IngredientName;
        var dishId = dish.DishId.ToArray();
        var ingredientId = ingredient.IngredientId.ToArray();
        var dishCode = dish.DishCode;
        var ingredientCode = ingredient.IngredientCode;
        var menuItemId = dish.Menuitems.First().MenuItemId.ToArray();
        var bomId = GuidHelper.NewId();

        dish.DishName = "Tên món đã sửa thủ công";
        ingredient.IngredientName = "Tên nguyên liệu đã sửa thủ công";
        context.Dishboms.Add(new Dishbom
        {
            BomId = bomId,
            DishId = dishId,
            IngredientId = ingredientId,
            UnitId = ingredient.UnitId,
            GrossQtyPerServing = 1,
            WasteRatePercent = 0,
            BomStatus = "PUBLISHED",
            EffectiveFrom = new DateOnly(2026, 1, 1)
        });
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
        (await context.Menuitems.SingleAsync(item => item.MenuItemId == menuItemId)).DishId.Should().Equal(dishId);
        var persistedBom = await context.Dishboms.SingleAsync(item => item.BomId == bomId);
        persistedBom.DishId.Should().Equal(dishId);
        persistedBom.IngredientId.Should().Equal(ingredientId);
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

        InvokePrivateStatic<decimal>("CalculateWeightedGrossQty", bananaRows).Should().Be(1.02446m);
        InvokePrivateStatic<decimal>("CalculateWeightedGrossQty", fishRows).Should().Be(0.117914m);
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

        InvokePrivateStatic<decimal>("ParsePresetGrossQtyPerServing", row).Should().Be(0.035m);
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

        InvokePrivateStatic<decimal>("ParsePresetGrossQtyPerServing", row).Should().Be(0.015m);
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

        var unit = InvokePrivateStatic<Unit>("ResolvePresetBomUnit", ingredientName, kgUnit, presetUnits);

        unit.UnitCode.Should().Be(expectedCode);
    }

    [Theory]
    [InlineData("MENU MẶN - CA SÁNG", "Mặn", "MORNING")]
    [InlineData("MENU CHAY- CA CHIỀU", "Chay", "AFTERNOON")]
    public void TryParseMenuSection_Should_Detect_VariantAndShift(string label, string variant, string shift)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            "TryParseMenuSection",
            BindingFlags.NonPublic | BindingFlags.Static);
        var args = new object?[] { label, null, null };

        var parsed = (bool)method!.Invoke(null, args)!;

        parsed.Should().BeTrue();
        args[1].Should().Be(variant);
        args[2].Should().Be(shift);
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_UseActiveContractForImportSchedule()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();
        context.Customercontracts.Add(new Customercontract
        {
            ContractId = GuidHelper.NewId(),
            CustomerId = customerId,
            EffectiveFrom = new DateOnly(2026, 6, 15),
            ActiveWeekDays = "t2,t3",
            ShiftNames = "MORNING",
            DefaultMenuPrice = 43000,
            DefaultBomRatePercent = 125,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            new DateOnly(2026, 6, 15),
            "MORNING"
        ])!;

        GetProperty<decimal>(result, "MenuPrice").Should().Be(43000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(result, "UsedFallback").Should().BeFalse();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_Fallback_WhenNoActiveContractMatches()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        var result = method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            new DateOnly(2026, 6, 15),
            "MORNING"
        ])!;

        GetProperty<decimal>(result, "MenuPrice").Should().Be(25000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(result, "UsedFallback").Should().BeTrue();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_IgnoreInactiveAndExpiredContracts()
    {
        var setup = await CreateContractPolicyContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var customerId = GuidHelper.NewId();
        context.Customercontracts.AddRange(
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 1),
                ActiveWeekDays = "t2",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 48000,
                DefaultBomRatePercent = 120,
                Status = "INACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 1),
                EffectiveTo = new DateOnly(2026, 6, 14),
                ActiveWeekDays = "t2",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 49000,
                DefaultBomRatePercent = 130,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var result = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 15), "MORNING");

        GetProperty<decimal>(result, "MenuPrice").Should().Be(25000);
        GetProperty<decimal>(result, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(result, "UsedFallback").Should().BeTrue();
    }

    [Fact]
    public async Task ResolveCustomerContractPolicy_Should_ApplyNewEffectiveContractMidWeek()
    {
        var setup = await CreateContractPolicyContextAsync();
        await using var connection = setup.Connection;
        await using var context = setup.Context;
        var customerId = GuidHelper.NewId();
        context.Customercontracts.AddRange(
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 15),
                EffectiveTo = new DateOnly(2026, 6, 16),
                ActiveWeekDays = "t2,t3",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 40000,
                DefaultBomRatePercent = 110,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = customerId,
                EffectiveFrom = new DateOnly(2026, 6, 17),
                ActiveWeekDays = "t4,t5,t6",
                ShiftNames = "MORNING",
                DefaultMenuPrice = 52000,
                DefaultBomRatePercent = 145,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var mondayPolicy = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 15), "MORNING");
        var wednesdayPolicy = InvokeContractPolicy(context, customerId, new DateOnly(2026, 6, 17), "MORNING");

        GetProperty<decimal>(mondayPolicy, "MenuPrice").Should().Be(40000);
        GetProperty<decimal>(mondayPolicy, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(mondayPolicy, "UsedFallback").Should().BeFalse();
        GetProperty<decimal>(wednesdayPolicy, "MenuPrice").Should().Be(52000);
        GetProperty<decimal>(wednesdayPolicy, "BomRatePercent").Should().Be(100);
        GetProperty<bool>(wednesdayPolicy, "UsedFallback").Should().BeFalse();
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
        var service = new SampleDataImportService(context, null!);
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
        var service = new SampleDataImportService(context, null!);
        await using var stream = new MemoryStream([1, 2, 3, 4]);

        var result = await service.PreviewWeeklyMenuImportAsync(
            stream,
            "broken.xlsx",
            setup.CustomerIdString,
            new DateOnly(2026, 6, 15),
            null);

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
        var service = new SampleDataImportService(context, null!);
        await using var stream = new MemoryStream([1, 2, 3, 4]);

        var act = async () => await service.CommitWeeklyMenuImportAsync(
            stream,
            "broken.xlsx",
            setup.CustomerIdString,
            new DateOnly(2026, 6, 15),
            null,
            setup.UserIdString);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.");
        (await context.Menuversions.CountAsync()).Should().Be(1);
        (await context.Menuschedules.CountAsync()).Should().Be(1);
        (await context.Menuversions.Select(item => item.SourceImportBatch).SingleAsync()).Should().Be("MENU-CUS-20260615-V01");
        (await context.Menuschedules.Select(item => item.Status).SingleAsync()).Should().Be("ACTIVE");
    }

    private static T InvokePrivateStatic<T>(string methodName, params object?[] args)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();
        return (T)method!.Invoke(null, args)!;
    }

    private static string FindDocsDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var docs = Path.Combine(current.FullName, ".docs");
            if (Directory.Exists(docs))
            {
                return docs;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Không tìm thấy thư mục .docs cho persisted sample-import test.");
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

    private static object InvokeContractPolicy(
        IpcManagementContext context,
        byte[] customerId,
        DateOnly serviceDate,
        string shiftName)
    {
        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ResolveCustomerContractPolicy",
            BindingFlags.NonPublic | BindingFlags.Instance);

        return method!.Invoke(service, [
            new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            },
            serviceDate,
            shiftName
        ])!;
    }

    private static async Task<(SqliteConnection Connection, IpcManagementContext Context)> CreateContractPolicyContextAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customercontracts (
                contractId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL,
                activeWeekDays TEXT NOT NULL,
                shiftNames TEXT NOT NULL,
                defaultMenuPrice TEXT NOT NULL,
                defaultBomRatePercent TEXT NOT NULL,
                status TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        return (connection, new IpcManagementContext(options));
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
        context.Menuversions.Add(new Menuversion
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
        context.Menuschedules.Add(new Menuschedule
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
}
