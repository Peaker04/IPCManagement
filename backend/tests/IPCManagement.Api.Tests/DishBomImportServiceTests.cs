using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using System.Text;

namespace IPCManagement.Api.Tests;

public class DishBomImportServiceTests
{
    [Fact]
    public async Task DishService_BomImportMethods_Should_DelegateToFocusedService()
    {
        var repository = Substitute.For<IDishRepository>();
        var catalogService = Substitute.For<IDishCatalogService>();
        var diagnosticsService = Substitute.For<IDishCatalogDiagnosticsService>();
        var templateService = Substitute.For<IDishBomTemplateService>();
        var importService = Substitute.For<IDishBomImportService>();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishService(
            repository,
            null!,
            cache,
            catalogService,
            diagnosticsService,
            templateService,
            importService);
        await using var previewStream = new MemoryStream([1, 2, 3]);
        await using var commitStream = new MemoryStream([4, 5, 6]);
        var request = new BomImportCommitRequestDto { PriceTier = 25000m };
        var expectedPreview = new BomImportPreviewDto { CanCommit = true };
        var expectedCommit = new BomImportCommitResultDto { CanCommit = true, CreatedRows = 2 };
        importService.PreviewAsync(previewStream, request, Arg.Any<CancellationToken>())
            .Returns(expectedPreview);
        importService.CommitAsync(commitStream, request, "actor", Arg.Any<CancellationToken>())
            .Returns(expectedCommit);

        var preview = await service.PreviewBomImportAsync(previewStream, request);
        var commit = await service.CommitBomImportAsync(commitStream, request, "actor");

        preview.Should().BeSameAs(expectedPreview);
        commit.Should().BeSameAs(expectedCommit);
        await importService.Received(1).PreviewAsync(previewStream, request, Arg.Any<CancellationToken>());
        await importService.Received(1).CommitAsync(commitStream, request, "actor", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CommitAsync_Should_PersistRowsAndClearBothCatalogCaches()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-bom-import-{Guid.NewGuid():N}")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        await using var context = new IpcManagementContext(options);
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var dishId = GuidHelper.NewId();
        context.Units.Add(new Unit
        {
            UnitId = unitId,
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = warehouseId,
            WarehouseCode = "WH-IMPORT",
            WarehouseName = "Kho import",
            WarehouseType = "DRY"
        });
        context.Dishes.Add(new Dish
        {
            DishId = dishId,
            DishCode = "DISH-IMPORT",
            DishName = "Món import",
            IsActive = true
        });
        await context.SaveChangesAsync();

        using var cache = new MemoryCache(new MemoryCacheOptions());
        cache.Set("DishCatalog", new object());
        cache.Set("DishCatalog:all", new object());
        var service = new DishBomImportService(context, cache);
        var csv = """
            DishCode,DishName,PriceTier,CustomerCode,IngredientCode,IngredientName,UnitCode,GrossQtyPerServing,WasteRatePercent,EffectiveFrom,EffectiveTo,BomStatus,Note
            DISH-IMPORT,Món import,25000,,,Nguyên liệu mới,KG,0.12,5,2026-07-01,,PUBLISHED,Import
            """;

        var request = new BomImportCommitRequestDto { PriceTier = 25000m };
        var bytes = Encoding.UTF8.GetBytes(csv);
        var preview = await service.PreviewAsync(new MemoryStream(bytes), request);
        preview.CanCommit.Should().BeTrue(string.Join("; ", preview.Rows.SelectMany(row => row.Errors)));

        var result = await service.CommitAsync(
            new MemoryStream(bytes),
            request,
            userId: null);

        result.CreatedRows.Should().Be(1);
        context.Dishboms.Should().ContainSingle();
        cache.TryGetValue("DishCatalog", out _).Should().BeFalse();
        cache.TryGetValue("DishCatalog:all", out _).Should().BeFalse();
    }
}
