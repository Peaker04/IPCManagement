using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
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
    public async Task CommitAsync_Should_ProjectOnlyContributorLinkedBomAdjustmentIntoSourceHistory()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using var context = new BomSourceHistoryTestContext(options);
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
        var actorId = GuidHelper.NewId();
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var linkedBomId = GuidHelper.NewId();
        var unrelatedBomId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var linkedDishId = GuidHelper.NewId();
        var unrelatedDishId = GuidHelper.NewId();
        var linkedIngredientId = GuidHelper.NewId();
        var unrelatedIngredientId = GuidHelper.NewId();
        context.Units.Add(new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH-SOURCE", WarehouseName = "Kho nguồn", WarehouseType = "DRY" });
        context.Dishes.AddRange(
            new Dish { DishId = linkedDishId, DishCode = "DISH-LINKED", DishName = "Món liên quan", IsActive = true },
            new Dish { DishId = unrelatedDishId, DishCode = "DISH-OTHER", DishName = "Món không liên quan", IsActive = true });
        context.Ingredients.AddRange(
            new Ingredient { IngredientId = linkedIngredientId, IngredientCode = "ING-LINKED", IngredientName = "Nguyên liệu liên quan", UnitId = unitId, WarehouseId = warehouseId, ReferencePrice = 1, IsActive = true },
            new Ingredient { IngredientId = unrelatedIngredientId, IngredientCode = "ING-OTHER", IngredientName = "Nguyên liệu không liên quan", UnitId = unitId, WarehouseId = warehouseId, ReferencePrice = 1, IsActive = true });
        context.Dishboms.AddRange(
            new DishBom { BomId = linkedBomId, DishId = linkedDishId, IngredientId = linkedIngredientId, UnitId = unitId, PriceTierAmount = 25000, GrossQtyPerServing = 0.1m, WasteRatePercent = 1, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 7, 1) },
            new DishBom { BomId = unrelatedBomId, DishId = unrelatedDishId, IngredientId = unrelatedIngredientId, UnitId = unitId, PriceTierAmount = 25000, GrossQtyPerServing = 0.3m, WasteRatePercent = 3, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 7, 1) });
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2,
            CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
            Lines = [new ReconciliationBatchLine
            {
                BatchLineId = lineId, IngredientId = linkedIngredientId, CanonicalUnitId = unitId, RequiredQuantity = 2,
                FrozenTolerance = 0.1m, ToleranceSourceKind = "TEST", ToleranceSourceVersion = "1", Version = 1,
                Contributors = [new ReconciliationBatchContributor
                {
                    ContributorId = GuidHelper.NewId(), MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(),
                    DishBomId = linkedBomId, SourceQuantity = 2
                }]
            }]
        });
        await context.SaveChangesAsync();

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var importer = new DishBomImportService(context, cache, new EfTransactionRunner(context), CreateOperationalWarehouseResolver(context));
        var csv = """
            DishCode,DishName,PriceTier,CustomerCode,IngredientCode,IngredientName,UnitCode,GrossQtyPerServing,WasteRatePercent,EffectiveFrom,EffectiveTo,BomStatus,Note
            DISH-LINKED,Món liên quan,25000,,,Nguyên liệu liên quan,KG,0.2,2,2026-07-01,,PUBLISHED,Điều chỉnh BOM liên quan
            DISH-OTHER,Món không liên quan,25000,,,Nguyên liệu không liên quan,KG,0.4,4,2026-07-01,,PUBLISHED,Điều chỉnh BOM khác
            """;
        var bytes = Encoding.UTF8.GetBytes(csv);
        var request = new BomImportCommitRequestDto { PriceTier = 25000 };
        var preview = await importer.PreviewAsync(new MemoryStream(bytes), request);
        preview.CanCommit.Should().BeTrue(string.Join("; ", preview.Rows.SelectMany(row => row.Errors)));
        await importer.CommitAsync(new MemoryStream(bytes), request, GuidHelper.ToGuidString(actorId));
        context.Auditlogs.AddRange(
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-3), ChangedBy = actorId, BusinessArea = "BOM", EntityName = nameof(DishBom), EntityId = linkedBomId, FieldName = "QuantityAndWaste", OldValue = "0.1 / hao hụt 1%", NewValue = "0.2 / hao hụt 2%", Reason = "Điều chỉnh BOM liên quan" },
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-2), ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(ReconciliationBatch), EntityId = batchId, FieldName = "Status", NewValue = "IN_PROGRESS" },
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-1), ChangedBy = actorId, BusinessArea = "Issue", EntityName = nameof(InventoryIssue), EntityId = GuidHelper.NewId(), FieldName = "Status", NewValue = "ISSUED" },
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "MenuVersion", EntityName = nameof(MenuSchedule), EntityId = linkedBomId, FieldName = "Status", NewValue = "identity collision" });
        await context.SaveChangesAsync();

        var changes = await new ReconciliationBatchService(context, new EfTransactionRunner(context), new SystemOperationRequestContext())
            .ListSourceChangesAsync(GuidHelper.ToGuidString(batchId));

        var change = Assert.Single(changes);
        Assert.Equal(GuidHelper.ToGuidString(actorId), change.Actor);
        Assert.Equal("BOM", change.BusinessArea);
        Assert.Equal(nameof(BomAdjustment), change.EntityName);
        Assert.Equal(GuidHelper.ToGuidString(linkedBomId), change.EntityId);
        Assert.Equal("QuantityAndWaste", change.FieldName);
        Assert.Equal("0.1 / hao hụt 1%", change.OldValue);
        Assert.Equal("0.2 / hao hụt 2%", change.NewValue);
        Assert.Equal("Điều chỉnh BOM liên quan", change.Reason);
        Assert.DoesNotContain(changes, item => item.EntityName is nameof(ReconciliationBatch) or nameof(InventoryIssue) or nameof(MenuSchedule));
        Assert.DoesNotContain(changes, item => item.FieldName == "BulkImport");
        Assert.DoesNotContain(changes, item => item.EntityId == GuidHelper.ToGuidString(unrelatedBomId));
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

    private sealed class BomSourceHistoryTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var included = new HashSet<Type>
            {
                typeof(Unit), typeof(Warehouse), typeof(Dish), typeof(Ingredient), typeof(DishBom), typeof(BomAdjustment),
                typeof(ReconciliationBatch), typeof(ReconciliationBatchLine), typeof(ReconciliationBatchContributor),
                typeof(MealQuantityPlanLine), typeof(AuditLog)
            };
            foreach (var entityType in typeof(AuditLog).Assembly.GetTypes().Where(type => type.Namespace == typeof(AuditLog).Namespace && type.IsClass && !included.Contains(type)))
                modelBuilder.Ignore(entityType);

            modelBuilder.Entity<Unit>().HasKey(item => item.UnitId);
            modelBuilder.Entity<Warehouse>().HasKey(item => item.WarehouseId);
            modelBuilder.Entity<Dish>().HasKey(item => item.DishId);
            modelBuilder.Entity<Ingredient>().HasKey(item => item.IngredientId);
            modelBuilder.Entity<Ingredient>().Ignore(item => item.Warehouse);
            modelBuilder.Entity<Ingredient>().HasOne(item => item.Unit).WithMany(item => item.Ingredients).HasForeignKey(item => item.UnitId);
            modelBuilder.Entity<DishBom>().HasKey(item => item.BomId);
            modelBuilder.Entity<DishBom>().Ignore(item => item.Customer);
            modelBuilder.Entity<DishBom>().HasOne(item => item.Dish).WithMany(item => item.Dishboms).HasForeignKey(item => item.DishId);
            modelBuilder.Entity<DishBom>().HasOne(item => item.Ingredient).WithMany(item => item.Dishboms).HasForeignKey(item => item.IngredientId);
            modelBuilder.Entity<DishBom>().HasOne(item => item.Unit).WithMany(item => item.Dishboms).HasForeignKey(item => item.UnitId);
            modelBuilder.Entity<BomAdjustment>().HasKey(item => item.BomAdjustmentId);
            modelBuilder.Entity<BomAdjustment>().Ignore(item => item.AdjustedByNavigation);
            modelBuilder.Entity<BomAdjustment>().HasOne(item => item.Bom).WithMany(item => item.Bomadjustments).HasForeignKey(item => item.BomId);
            modelBuilder.Entity<ReconciliationBatch>().HasKey(item => item.BatchId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasKey(item => item.BatchLineId);
            modelBuilder.Entity<ReconciliationBatchLine>().Ignore(item => item.Ingredient);
            modelBuilder.Entity<ReconciliationBatchLine>().Ignore(item => item.CanonicalUnit);
            modelBuilder.Entity<ReconciliationBatchLine>().HasOne(item => item.Batch).WithMany(item => item.Lines).HasForeignKey(item => item.BatchId);
            modelBuilder.Entity<ReconciliationBatchContributor>().HasKey(item => item.ContributorId);
            modelBuilder.Entity<ReconciliationBatchContributor>().HasOne(item => item.BatchLine).WithMany(item => item.Contributors).HasForeignKey(item => item.BatchLineId);
            modelBuilder.Entity<MealQuantityPlanLine>().HasKey(item => item.QuantityPlanLineId);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.QuantityPlan);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.MenuSchedule);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.Customer);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.Menu);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.Productionplanlines);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(item => item.Quantityadjustments);
            modelBuilder.Entity<AuditLog>().HasKey(item => item.AuditId);
            modelBuilder.Entity<AuditLog>().Ignore(item => item.ChangedByNavigation);
        }
    }

    private static IOperationalWarehouseResolver CreateOperationalWarehouseResolver(IpcManagementContext context)
    {
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            context.Warehouses.Local.Select(item => item.WarehouseId).First());
        return resolver;
    }
}
