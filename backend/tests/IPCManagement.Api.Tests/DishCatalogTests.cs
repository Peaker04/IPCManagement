using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using System.Text;
using Xunit;

namespace IPCManagement.Api.Tests;

public class DishCatalogTests
{
    [Fact]
    public async Task DishService_GetCatalogAsync_Should_Map_MenuSlots_And_BomDetails()
    {
        var repository = Substitute.For<IDishRepository>();
        var dishId = Guid.NewGuid();
        var bomId = Guid.NewGuid();
        var ingredientId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        repository.GetCatalogAsync().Returns(new List<Dish>
        {
            new()
            {
                DishId = GuidHelper.ToBytes(dishId),
                DishCode = "DISH-001",
                DishName = "Cơm gà",
                DishType = "MORNING",
                DishGroup = "Mặn",
                IsActive = true,
                Menuitems =
                [
                    new Menuitem { DishSlot = "Món mặn", DisplayOrder = 2 },
                    new Menuitem { DishSlot = "Món mặn", DisplayOrder = 1 },
                    new Menuitem { DishSlot = "Canh", DisplayOrder = 3 }
                ],
                Dishboms =
                [
                    new Dishbom
                    {
                        BomId = GuidHelper.ToBytes(bomId),
                        DishId = GuidHelper.ToBytes(dishId),
                        IngredientId = GuidHelper.ToBytes(ingredientId),
                        UnitId = GuidHelper.ToBytes(unitId),
                        GrossQtyPerServing = 0.12m,
                        WasteRatePercent = 5,
                        EffectiveFrom = new DateOnly(2026, 6, 15),
                        Ingredient = new Ingredient
                        {
                            IngredientId = GuidHelper.ToBytes(ingredientId),
                            IngredientCode = "ING-001",
                            IngredientName = "Thịt gà",
                            UnitId = GuidHelper.ToBytes(unitId),
                            WarehouseId = GuidHelper.NewId(),
                            ReferencePrice = 65000,
                            IsFreshDaily = true
                        },
                        Unit = new IPCManagement.Api.Models.Entities.Unit
                        {
                            UnitId = GuidHelper.ToBytes(unitId),
                            UnitCode = "KG",
                            UnitName = "Kilogram",
                            ConvertRateToBase = 1
                        }
                    }
                ]
            }
        });
        var service = new DishService(repository, null!, new MemoryCache(new MemoryCacheOptions()));

        var result = await service.GetCatalogAsync();

        result.Should().ContainSingle();
        var catalogDish = result[0];
        catalogDish.DishId.Should().Be(dishId.ToString());
        catalogDish.MenuSlots.Should().Equal("Món mặn", "Canh");
        catalogDish.BomLines.Should().ContainSingle();
        catalogDish.BomLines[0].BomId.Should().Be(bomId.ToString());
        catalogDish.BomLines[0].IngredientName.Should().Be("Thịt gà");
        catalogDish.BomLines[0].UnitCode.Should().Be("KG");
        catalogDish.BomLines[0].GrossQtyPerServing.Should().Be(0.12m);
        catalogDish.BomLines[0].ReferencePrice.Should().Be(65000);
    }

    [Fact]
    public async Task DishesController_GetCatalog_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetCatalogAsync().Returns(new List<DishCatalogDto>
        {
            new()
            {
                DishId = Guid.NewGuid().ToString(),
                DishCode = "DISH-001",
                DishName = "Cơm gà",
                IsActive = true
            }
        });
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new DishesController(service, currentUserService);

        var actionResult = await controller.GetCatalog();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should()
            .BeAssignableTo<ApiResponse<IReadOnlyList<DishCatalogDto>>>()
            .Subject;
        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle();
        response.Data![0].DishCode.Should().Be("DISH-001");
    }

    [Fact]
    public async Task DishesController_GetBomCoverage_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetBomCoverageAsync().Returns(new BomCoverageReportDto
        {
            TotalDishes = 2,
            CompleteDishes = 1,
            MissingBomDishes = 1,
            Dishes =
            [
                new()
                {
                    DishId = Guid.NewGuid().ToString(),
                    DishCode = "DISH-001",
                    DishName = "Cơm gà",
                    BomLineCount = 3,
                    HasBom = true,
                    Status = "complete",
                    StatusLabel = "Đủ BOM"
                }
            ]
        });
        var controller = new DishesController(service, Substitute.For<ICurrentUserService>());

        var actionResult = await controller.GetBomCoverage();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<BomCoverageReportDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.CompleteDishes.Should().Be(1);
        response.Data.MissingBomDishes.Should().Be(1);
    }

    [Fact]
    public async Task DishesController_GetBomValidation_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetBomValidationAsync().Returns(new BomValidationReportDto
        {
            TotalIssues = 1,
            MissingReferencePriceLines = 1,
            Issues =
            [
                new()
                {
                    DishId = Guid.NewGuid().ToString(),
                    DishCode = "DISH-001",
                    DishName = "Cơm gà",
                    IssueCode = "missing_reference_price",
                    Severity = "warning",
                    Message = "Nguyên liệu chưa có giá tham chiếu hợp lệ."
                }
            ]
        });
        var controller = new DishesController(service, Substitute.For<ICurrentUserService>());

        var actionResult = await controller.GetBomValidation();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<BomValidationReportDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.Issues.Should().ContainSingle();
        response.Data.Issues[0].IssueCode.Should().Be("missing_reference_price");
    }

    [Fact]
    public async Task DishesController_GetMenuImportHistory_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetMenuImportHistoryAsync().Returns(new MenuImportHistoryDto
        {
            LastImportSource = "excel",
            LastImportFileOrBatch = "BATCH-001",
            DishCount = 10,
            BomLineCount = 25,
            BomCreatedOrUpdatedCount = 25,
            Warnings = ["Chưa có lịch sử cập nhật BOM; số BOM tạo/cập nhật đang là snapshot dòng hiện tại."]
        });
        var controller = new DishesController(service, Substitute.For<ICurrentUserService>());

        var actionResult = await controller.GetMenuImportHistory();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<MenuImportHistoryDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.LastImportFileOrBatch.Should().Be("BATCH-001");
        response.Data.Warnings.Should().ContainSingle();
    }

    [Fact]
    public async Task DishesController_GetSampleImportStatus_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetSampleImportStatusAsync().Returns(new SampleImportStatusDto
        {
            OverallStatus = "incomplete",
            Domains =
            [
                new()
                {
                    Domain = "bom",
                    DisplayName = "BOM/định lượng",
                    RowCount = 0,
                    IsReady = false,
                    Status = "missing",
                    Notes = "Chưa có dữ liệu hoặc dữ liệu chưa được import/seed."
                }
            ]
        });
        var controller = new DishesController(service, Substitute.For<ICurrentUserService>());

        var actionResult = await controller.GetSampleImportStatus();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should().BeAssignableTo<ApiResponse<SampleImportStatusDto>>().Subject;
        response.Success.Should().BeTrue();
        response.Data!.OverallStatus.Should().Be("incomplete");
        response.Data.Domains.Should().ContainSingle(item => item.Domain == "bom");
    }

    [Fact]
    public async Task DishService_AddBomLineAsync_Should_Block_Overlapping_EffectiveDates_ForSameScope()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);

        fixture.Context.Dishboms.Add(new Dishbom
        {
            BomId = GuidHelper.NewId(),
            DishId = fixture.DishId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            GrossQtyPerServing = 0.12m,
            WasteRatePercent = 5,
            EffectiveFrom = new DateOnly(2026, 7, 1),
            EffectiveTo = new DateOnly(2026, 7, 31)
        });
        await fixture.Context.SaveChangesAsync();

        var overlappingRequest = new CreateDishBomLineDto
        {
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
            GrossQtyPerServing = 0.14m,
            WasteRatePercent = 4,
            EffectiveFrom = new DateOnly(2026, 7, 15),
            EffectiveTo = new DateOnly(2026, 8, 15)
        };

        var act = () => service.AddBomLineAsync(GuidHelper.ToGuidString(fixture.DishId), overlappingRequest);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*trùng nguyên liệu, đơn vị và khoảng hiệu lực*");
    }

    [Fact]
    public async Task DishService_AddBomLineAsync_Should_Allow_Next_NonOverlapping_EffectivePeriod()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);

        fixture.Context.Dishboms.Add(new Dishbom
        {
            BomId = GuidHelper.NewId(),
            DishId = fixture.DishId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            GrossQtyPerServing = 0.12m,
            WasteRatePercent = 5,
            EffectiveFrom = new DateOnly(2026, 7, 1),
            EffectiveTo = new DateOnly(2026, 7, 31)
        });
        await fixture.Context.SaveChangesAsync();

        var result = await service.AddBomLineAsync(GuidHelper.ToGuidString(fixture.DishId), new CreateDishBomLineDto
        {
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
            GrossQtyPerServing = 0.14m,
            WasteRatePercent = 4,
            EffectiveFrom = new DateOnly(2026, 8, 1)
        });

        result.Should().NotBeNull();
        result!.EffectiveFrom.Should().Be(new DateOnly(2026, 8, 1));
        fixture.Context.Dishboms.Should().HaveCount(2);
    }

    [Fact]
    public async Task DishService_AddBomLineAsync_Should_Allow_Draft_Overlap()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);

        fixture.Context.Dishboms.Add(new Dishbom
        {
            BomId = GuidHelper.NewId(),
            DishId = fixture.DishId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            GrossQtyPerServing = 0.12m,
            WasteRatePercent = 5,
            BomStatus = "PUBLISHED",
            EffectiveFrom = new DateOnly(2026, 7, 1),
            EffectiveTo = new DateOnly(2026, 7, 31)
        });
        await fixture.Context.SaveChangesAsync();

        var result = await service.AddBomLineAsync(GuidHelper.ToGuidString(fixture.DishId), new CreateDishBomLineDto
        {
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
            GrossQtyPerServing = 0.14m,
            WasteRatePercent = 4,
            BomStatus = "DRAFT",
            EffectiveFrom = new DateOnly(2026, 7, 15)
        });

        result.Should().NotBeNull();
        result!.BomStatus.Should().Be("DRAFT");
        fixture.Context.Dishboms.Should().HaveCount(2);
    }

    [Fact]
    public async Task DishService_UpdateBomLineAsync_Should_Create_New_Version_For_Published_QuantityChange()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);
        var originalBomId = GuidHelper.NewId();

        fixture.Context.Dishboms.Add(new Dishbom
        {
            BomId = originalBomId,
            DishId = fixture.DishId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            GrossQtyPerServing = 0.12m,
            WasteRatePercent = 5,
            BomStatus = "PUBLISHED",
            EffectiveFrom = new DateOnly(2026, 7, 1)
        });
        await fixture.Context.SaveChangesAsync();

        var result = await service.UpdateBomLineAsync(
            GuidHelper.ToGuidString(fixture.DishId),
            GuidHelper.ToGuidString(originalBomId),
            new UpdateDishBomLineDto
            {
                IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                GrossQtyPerServing = 0.16m,
                WasteRatePercent = 4,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2026, 8, 1)
            },
            userId: null);

        result.Should().NotBeNull();
        result!.BomId.Should().NotBe(GuidHelper.ToGuidString(originalBomId));
        result.GrossQtyPerServing.Should().Be(0.16m);

        var original = await fixture.Context.Dishboms.SingleAsync(line => line.BomId == originalBomId);
        original.GrossQtyPerServing.Should().Be(0.12m);
        original.EffectiveTo.Should().Be(new DateOnly(2026, 7, 31));

        fixture.Context.Dishboms.Should().HaveCount(2);
    }

    [Fact]
    public async Task DishService_BomImport_Should_CreateCustomerTierBom_ForMultipleDishes()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);
        var customerId = GuidHelper.NewId();
        var secondDishId = GuidHelper.NewId();
        var secondIngredientId = GuidHelper.NewId();

        fixture.Context.Customers.Add(new Customer
        {
            CustomerId = customerId,
            CustomerCode = "CUS-BOM",
            CustomerName = "Customer BOM",
            IsActive = true
        });
        fixture.Context.Dishes.Add(new Dish
        {
            DishId = secondDishId,
            DishCode = "DISH-BOM-2",
            DishName = "Món BOM 2",
            IsActive = true
        });
        fixture.Context.Ingredients.Add(new Ingredient
        {
            IngredientId = secondIngredientId,
            IngredientCode = "ING-BOM-2",
            IngredientName = "Nguyên liệu BOM 2",
            UnitId = fixture.UnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 70000,
            IsFreshDaily = true,
            IsActive = true
        });
        await fixture.Context.SaveChangesAsync();

        var csv = BomImportCsv(
            ["DISH-BOM", "Món BOM", "30000", "CUS-BOM", "ING-BOM", "Nguyên liệu BOM", "KG", "0.12", "5", "2026-07-01", "", "PUBLISHED", "Món 1"],
            ["DISH-BOM-2", "Món BOM 2", "30000", "CUS-BOM", "ING-BOM-2", "Nguyên liệu BOM 2", "KG", "0.08", "3", "2026-07-01", "", "PUBLISHED", "Món 2"]);
        var request = new BomImportCommitRequestDto
        {
            PriceTier = 30000,
            CustomerId = GuidHelper.ToGuidString(customerId)
        };

        var preview = await service.PreviewBomImportAsync(ToStream(csv), request);
        var committed = await service.CommitBomImportAsync(ToStream(csv), request, userId: null);

        preview.CanCommit.Should().BeTrue();
        preview.TotalRows.Should().Be(2);
        preview.BomScope.Should().Be("customer");
        committed.CreatedRows.Should().Be(2);
        committed.UpdatedRows.Should().Be(0);
        committed.ArchivedRows.Should().Be(0);

        var rows = (await fixture.Context.Dishboms.AsNoTracking().ToListAsync())
            .OrderBy(row => row.GrossQtyPerServing)
            .ToList();
        rows.Should().HaveCount(2);
        rows.Should().OnlyContain(row => row.PriceTierAmount == 30000m);
        rows.Should().OnlyContain(row => row.CustomerId != null && row.CustomerId.SequenceEqual(customerId));
        rows.Select(row => row.GrossQtyPerServing).Should().Equal(0.08m, 0.12m);
    }

    [Fact]
    public async Task DishService_BomImport_Should_BlockErrorsAndKeepCommitAllOrNothing()
    {
        await using var fixture = await CreateCatalogFixtureAsync();
        var service = CreateDishService(fixture.Context);
        fixture.Context.Dishboms.Add(new Dishbom
        {
            BomId = GuidHelper.NewId(),
            DishId = fixture.DishId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            PriceTierAmount = 25000,
            GrossQtyPerServing = 0.10m,
            WasteRatePercent = 2,
            BomStatus = "PUBLISHED",
            EffectiveFrom = new DateOnly(2026, 6, 1)
        });
        await fixture.Context.SaveChangesAsync();

        var csv = BomImportCsv(
            ["DISH-BOM", "Món BOM", "25000", "", "ING-BOM", "Nguyên liệu BOM", "KG", "0.12", "5", "2026-07-01", "2026-07-31", "PUBLISHED", "Valid but duplicate"],
            ["DISH-BOM", "Món BOM", "25000", "", "ING-BOM", "Nguyên liệu BOM", "KG", "0.13", "5", "2026-07-01", "", "PUBLISHED", "Duplicate effective date"],
            ["DISH-BOM", "Món BOM", "25000", "", "ING-BOM", "Nguyên liệu BOM", "KG", "0.14", "5", "2026-07-15", "", "PUBLISHED", "Overlap range"],
            ["DISH-UNKNOWN", "Món sai", "25000", "", "ING-UNKNOWN", "NL sai", "BOX", "0.10", "1", "2026-08-01", "", "PUBLISHED", "Unknown refs"]);
        var request = new BomImportCommitRequestDto { PriceTier = 25000 };

        var preview = await service.PreviewBomImportAsync(ToStream(csv), request);
        var act = async () => await service.CommitBomImportAsync(ToStream(csv), request, userId: null);

        preview.CanCommit.Should().BeFalse();
        preview.TotalRows.Should().Be(4);
        preview.ErrorRows.Should().Be(4);
        preview.Rows.Should().Contain(row => row.Errors.Any(error => error.Contains("Trùng dish/ingredient/unit/effective date")));
        preview.Rows.Should().Contain(row => row.Errors.Any(error => error.Contains("Khoảng hiệu lực BOM bị overlap trong file")));
        preview.Rows.Should().Contain(row => row.Errors.Any(error => error.Contains("DishCode không tồn tại")));
        preview.Rows.Should().Contain(row => row.Errors.Any(error => error.Contains("IngredientCode không tồn tại")));
        preview.Rows.Should().Contain(row => row.Errors.Any(error => error.Contains("UnitCode không tồn tại")));
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*File BOM còn lỗi*");

        var persistedRows = await fixture.Context.Dishboms.AsNoTracking().ToListAsync();
        persistedRows.Should().ContainSingle();
        persistedRows.Single().GrossQtyPerServing.Should().Be(0.10m);
    }

    [Fact]
    public async Task SampleDataProductionGuard_Should_Return404_Before_NextMiddleware_InProduction()
    {
        var environment = Substitute.For<IWebHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Production);
        var nextCalled = false;
        var middleware = new SampleDataProductionGuardMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            environment);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/sample-data/import";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        nextCalled.Should().BeFalse();
    }

    private static DishService CreateDishService(IpcManagementContext context)
        => new(Substitute.For<IDishRepository>(), context, new MemoryCache(new MemoryCacheOptions()));

    private static MemoryStream ToStream(string content)
        => new(Encoding.UTF8.GetBytes(content));

    private static string BomImportCsv(params string[][] rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine("DishCode,DishName,PriceTier,CustomerCode,IngredientCode,IngredientName,UnitCode,GrossQtyPerServing,WasteRatePercent,EffectiveFrom,EffectiveTo,BomStatus,Note");
        foreach (var row in rows)
        {
            builder.AppendLine(string.Join(",", row.Select(cell => $"\"{cell.Replace("\"", "\"\"")}\"")));
        }

        return builder.ToString();
    }

    private static async Task<CatalogFixture> CreateCatalogFixtureAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        var context = new IpcManagementContext(options);
        await CreateMinimalCatalogSchemaAsync(connection);

        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var dishId = GuidHelper.NewId();

        context.Units.Add(new IPCManagement.Api.Models.Entities.Unit
        {
            UnitId = unitId,
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = warehouseId,
            WarehouseCode = "WH-BOM",
            WarehouseName = "Kho BOM",
            WarehouseType = "DRY"
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = ingredientId,
            IngredientCode = "ING-BOM",
            IngredientName = "Nguyên liệu BOM",
            UnitId = unitId,
            WarehouseId = warehouseId,
            ReferencePrice = 50000,
            IsFreshDaily = false,
            IsActive = true
        });
        context.Dishes.Add(new Dish
        {
            DishId = dishId,
            DishCode = "DISH-BOM",
            DishName = "Món BOM",
            DishType = "Mặn",
            DishGroup = "Trưa",
            IsActive = true
        });
        await context.SaveChangesAsync();

        return new CatalogFixture(connection, context, dishId, ingredientId, unitId, warehouseId);
    }

    private static async Task CreateMinimalCatalogSchemaAsync(SqliteConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE units (
                unitId BLOB PRIMARY KEY,
                unitCode TEXT NOT NULL,
                unitName TEXT NOT NULL,
                baseUnitCode TEXT NULL,
                convertRateToBase TEXT NOT NULL
            );

            CREATE TABLE warehouses (
                warehouseId BLOB PRIMARY KEY,
                warehouseCode TEXT NOT NULL,
                warehouseName TEXT NOT NULL,
                warehouseType TEXT NOT NULL,
                note TEXT NULL
            );

            CREATE TABLE ingredients (
                ingredientId BLOB PRIMARY KEY,
                ingredientCode TEXT NOT NULL,
                ingredientName TEXT NOT NULL,
                unitId BLOB NOT NULL,
                warehouseId BLOB NOT NULL,
                referencePrice TEXT NOT NULL,
                isFreshDaily INTEGER NOT NULL,
                isActive INTEGER NULL
            );

            CREATE TABLE dishes (
                dishId BLOB PRIMARY KEY,
                dishCode TEXT NOT NULL,
                dishName TEXT NOT NULL,
                dishType TEXT NULL,
                dishGroup TEXT NULL,
                isActive INTEGER NULL
            );

            CREATE TABLE customers (
                customerId BLOB PRIMARY KEY,
                customerCode TEXT NOT NULL,
                customerName TEXT NOT NULL,
                note TEXT NULL,
                isActive INTEGER NULL
            );

            CREATE TABLE dishbom (
                bomId BLOB PRIMARY KEY,
                dishId BLOB NOT NULL,
                customerId BLOB NULL,
                ingredientId BLOB NOT NULL,
                unitId BLOB NOT NULL,
                priceTierAmount TEXT NOT NULL DEFAULT '25000.00',
                grossQtyPerServing TEXT NOT NULL,
                wasteRatePercent TEXT NOT NULL,
                bomStatus TEXT NOT NULL DEFAULT 'PUBLISHED',
                effectiveFrom TEXT NOT NULL,
                effectiveTo TEXT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
    }

    private sealed class CatalogFixture(
        SqliteConnection connection,
        IpcManagementContext context,
        byte[] dishId,
        byte[] ingredientId,
        byte[] unitId,
        byte[] warehouseId) : IAsyncDisposable
    {
        public SqliteConnection Connection { get; } = connection;
        public IpcManagementContext Context { get; } = context;
        public byte[] DishId { get; } = dishId;
        public byte[] IngredientId { get; } = ingredientId;
        public byte[] UnitId { get; } = unitId;
        public byte[] WarehouseId { get; } = warehouseId;

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await Connection.DisposeAsync();
        }
    }
}
