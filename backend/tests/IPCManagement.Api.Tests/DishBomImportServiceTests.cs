using IPCManagement.Api.Features.Inventory.Services;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
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
    public async Task PreviewAsync_Should_ReturnFriendlyDomainError_WhenWorkbookZipIsUnreadable()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-bom-broken-{Guid.NewGuid():N}")
            .Options;
        await using var context = new IpcManagementContext(options);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishBomImportService(context, cache, new EfTransactionRunner(context), CreateOperationalWarehouseResolver(context));
        await using var stream = new MemoryStream("PK-not-a-valid-xlsx"u8.ToArray());

        var act = () => service.PreviewAsync(stream, new BomImportPreviewRequestDto { PriceTier = 25000m });

        await act.Should().ThrowAsync<IPCManagement.Api.Exceptions.BusinessRuleException>()
            .WithMessage("File BOM không đọc được. Vui lòng chọn đúng file Excel/CSV theo mẫu BOM rồi thử lại.");
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
        var service = new DishBomImportService(context, cache, new EfTransactionRunner(context), CreateOperationalWarehouseResolver(context));
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

    [Fact]
    public async Task PreviewAsync_Should_AutoFillWasteRateZero_And_ResolveDishCodeByName()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-bom-autofill-{Guid.NewGuid():N}")
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        await using var context = new IpcManagementContext(options);
        context.Units.Add(new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = GuidHelper.NewId(),
            WarehouseCode = "WH-AF",
            WarehouseName = "Kho AF",
            WarehouseType = "DRY"
        });
        context.Dishes.Add(new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = "DISH-PHO",
            DishName = "Phở Bò Đặc Biệt",
            IsActive = true
        });
        await context.SaveChangesAsync();

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishBomImportService(context, cache, new EfTransactionRunner(context), CreateOperationalWarehouseResolver(context));

        // DishCode is EMPTY (only DishName provided), WasteRatePercent is EMPTY, PriceTier is EMPTY
        var csv = """
            DishCode,DishName,PriceTier,CustomerCode,IngredientCode,IngredientName,UnitCode,GrossQtyPerServing,WasteRatePercent,EffectiveFrom,EffectiveTo,BomStatus,Note
            ,Phở Bò Đặc Biệt,,,,Bò Tái,Kilogram,0.20,,,,PUBLISHED,Auto-fill test
            """;

        var request = new BomImportCommitRequestDto { PriceTier = 30000m };
        var bytes = Encoding.UTF8.GetBytes(csv);
        var preview = await service.PreviewAsync(new MemoryStream(bytes), request);

        preview.CanCommit.Should().BeTrue(string.Join("; ", preview.Rows.SelectMany(row => row.Errors)));
        preview.Rows.Should().HaveCount(1);
        preview.Rows[0].DishCode.Should().Be("DISH-PHO");
        preview.Rows[0].WasteRatePercent.Should().Be(0m);
        preview.Rows[0].UnitCode.Should().Be("KG");
    }

    [Theory]
    [InlineData("KG", "Kilogram", "Kilôgam")]
    [InlineData("G", "Gram", "Gam")]
    [InlineData("L", "Liter", "Lít")]
    [InlineData("ML", "Milliliter", "Mililít")]
    [InlineData("HOP", "hộp", "Hộp")]
    [InlineData("QUA", "quả", "Quả")]
    public void BomUnitDisplayPolicy_Should_UseVietnameseLabels(string code, string name, string expected)
    {
        BomUnitDisplayPolicy.Format(code, name).Should().Be(expected);
    }

    [Fact]
    public void BomTemplateWorkbookBuilder_Should_IncludeGuidanceWorksheet()
    {
        var bytes = BomTemplateWorkbookBuilder.Build(
            25000,
            "Global",
            new DateOnly(2026, 9, 4),
            [],
            ["Thịt nạc heo"],
            ["Kilôgam", "Quả", "Lít"]);
        using var archive = new System.IO.Compression.ZipArchive(new MemoryStream(bytes));

        archive.GetEntry("xl/worksheets/sheet1.xml").Should().NotBeNull();
        archive.GetEntry("xl/worksheets/sheet2.xml").Should().NotBeNull();

        var workbookEntry = archive.GetEntry("xl/workbook.xml");
        workbookEntry.Should().NotBeNull();
        using var reader = new StreamReader(workbookEntry!.Open());
        var xml = reader.ReadToEnd();
        xml.Should().Contain("BOM");
        xml.Should().Contain("HUONG_DAN");

        using var sheetReader = new StreamReader(archive.GetEntry("xl/worksheets/sheet1.xml")!.Open());
        var sheetXml = sheetReader.ReadToEnd();
        sheetXml.Should().Contain("Nguyên liệu chính");
        sheetXml.Should().Contain("Định lượng/suất");
        sheetXml.Should().Contain("sheetProtection");
        sheetXml.Should().Contain("autoFilter ref=\"A4:F5\"");
        sheetXml.Should().Contain("type=\"list\"");
        sheetXml.Should().Contain("Định lượng phải lớn hơn 0");
        sheetXml.Should().Contain("Hao hụt phải từ 0 đến 100%");
        sheetXml.Should().Contain("hidden=\"1\"");
        sheetXml.Should().NotContain("Cột BẮT BUỘC: IngredientName");

        using var catalogReader = new StreamReader(archive.GetEntry("xl/worksheets/sheet3.xml")!.Open());
        catalogReader.ReadToEnd().Should()
            .Contain("Nguyên liệu").And
            .Contain("Đơn vị").And
            .Contain("Kilôgam").And
            .Contain("Quả").And
            .NotContain(">KG<");
    }

    private static IOperationalWarehouseResolver CreateOperationalWarehouseResolver(IpcManagementContext context)
    {
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            context.Warehouses.Local.Select(item => item.WarehouseId).First());
        return resolver;
    }
}
