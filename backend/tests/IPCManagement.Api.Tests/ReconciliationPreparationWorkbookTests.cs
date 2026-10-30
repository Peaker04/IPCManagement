using System.IO.Compression;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationPreparationWorkbookTests
{
    private static async Task<(byte[] CustomerAId, byte[] CustomerBId, byte[] BatchAId, byte[] BatchBId, byte[] IngSingleSupplier, byte[] IngNoSupplier, byte[] IngAmbiguousSupplier, DateOnly ServiceDate)> SetupWorkbookFixtureAsync(WorkflowGenerationTests.WorkflowFixture fixture, IpcManagementContext context)
    {
        await EnsureSchemaAsync(context);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        var serviceDate = new DateOnly(2026, 6, 15);
        var customerAId = fixture.CustomerId;
        var customerBId = GuidHelper.NewId();
        context.Customers.Add(new Customer { CustomerId = customerBId, CustomerCode = "CUST-B", CustomerName = "Khách hàng B", IsActive = true });

        var versionA = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerAId, WeekStartDate = serviceDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var versionB = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerBId, WeekStartDate = serviceDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.AddRange(versionA, versionB);

        var supplier1 = new Supplier { SupplierId = GuidHelper.NewId(), SupplierCode = "SUP-01", SupplierName = "Nhà cung cấp Rau Sạch", IsActive = true };
        var supplier2 = new Supplier { SupplierId = GuidHelper.NewId(), SupplierCode = "SUP-02", SupplierName = "Nhà cung cấp Thịt Tươi", IsActive = true };
        context.Suppliers.AddRange(supplier1, supplier2);

        // 3 Ingredients:
        // 1. Single supplier
        var ingSingle = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-SINGLE", IngredientName = "Rau Muống", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
        // 2. No supplier
        var ingNone = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-NONE", IngredientName = "Gia Vị Hiếm", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
        // 3. Ambiguous suppliers (supplier 1 & supplier 2)
        var ingAmbiguous = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-AMBIGUOUS", IngredientName = "Dầu Ăn Đa Nguồn", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
        context.Ingredients.AddRange(ingSingle, ingNone, ingAmbiguous);

        // Quotations
        context.Supplierquotations.AddRange(
            new SupplierQuotation { QuotationId = GuidHelper.NewId(), SupplierId = supplier1.SupplierId, IngredientId = ingSingle.IngredientId, EffectiveFrom = serviceDate.AddDays(-10), EffectiveTo = serviceDate.AddDays(10), IsActive = true, UnitPrice = 15000m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new SupplierQuotation { QuotationId = GuidHelper.NewId(), SupplierId = supplier1.SupplierId, IngredientId = ingAmbiguous.IngredientId, EffectiveFrom = serviceDate.AddDays(-10), EffectiveTo = serviceDate.AddDays(10), IsActive = true, UnitPrice = 30000m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new SupplierQuotation { QuotationId = GuidHelper.NewId(), SupplierId = supplier2.SupplierId, IngredientId = ingAmbiguous.IngredientId, EffectiveFrom = serviceDate.AddDays(-10), EffectiveTo = serviceDate.AddDays(10), IsActive = true, UnitPrice = 32000m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
        );

        var batchAId = GuidHelper.NewId();
        var batchBId = GuidHelper.NewId();

        var batchA = new ReconciliationBatch
        {
            BatchId = batchAId, MenuVersionId = versionA.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                CreateBatchLine(batchAId, ingSingle.IngredientId, fixture.UnitId, serviceDate, 4m),
                CreateBatchLine(batchAId, ingNone.IngredientId, fixture.UnitId, serviceDate, 1m),
                CreateBatchLine(batchAId, ingAmbiguous.IngredientId, fixture.UnitId, serviceDate, 2m),
            ]
        };

        var batchB = new ReconciliationBatch
        {
            BatchId = batchBId, MenuVersionId = versionB.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                CreateBatchLine(batchBId, ingSingle.IngredientId, fixture.UnitId, serviceDate, 6m),
                CreateBatchLine(batchBId, ingAmbiguous.IngredientId, fixture.UnitId, serviceDate, 3m),
            ]
        };

        context.Reconciliationbatches.AddRange(batchA, batchB);
        context.Systemoperationmodes.Add(new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.MaterialReconciliation, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = fixture.UserId });
        await context.SaveChangesAsync();

        return (customerAId, customerBId, batchAId, batchBId, ingSingle.IngredientId, ingNone.IngredientId, ingAmbiguous.IngredientId, serviceDate);
    }

    private static ReconciliationBatchLine CreateBatchLine(byte[] batchId, byte[] ingredientId, byte[] unitId, DateOnly serviceDate, decimal qty)
    {
        var lineId = GuidHelper.NewId();
        return new ReconciliationBatchLine
        {
            BatchLineId = lineId, BatchId = batchId, IngredientId = ingredientId, CanonicalUnitId = unitId,
            RequiredQuantity = qty, FrozenTolerance = 0.5m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
            DailyLines =
            [
                new ReconciliationBatchDailyLine
                {
                    DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId,
                    IngredientId = ingredientId, CanonicalUnitId = unitId, ServiceDate = serviceDate,
                    RequiredQuantity = qty, Version = 1
                }
            ]
        };
    }

    [Fact]
    public async Task GetWorkbookAsync_Deterministically_Classifies_Single_Missing_And_Ambiguous_Suppliers()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, _, _, ingSingle, ingNone, ingAmbiguous, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, ledger, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var result = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate });

        result.Should().NotBeNull();
        result.CustomerColumns.Should().Equal(["Customer", "Khách hàng B"]);

        // 1. Single supplier ingredient
        var singleSummary = result.SummaryRows.Single(r => r.IngredientId == GuidHelper.ToGuidString(ingSingle));
        singleSummary.SupplierName.Should().Be("Nhà cung cấp Rau Sạch");
        singleSummary.TotalQuantity.Should().Be(10m); // 4 + 6

        // 2. Missing supplier ingredient -> "Chưa xác định nhà cung cấp"
        var noneSummary = result.SummaryRows.Single(r => r.IngredientId == GuidHelper.ToGuidString(ingNone));
        noneSummary.SupplierName.Should().Be("Chưa xác định nhà cung cấp");
        noneSummary.TotalQuantity.Should().Be(1m);

        // 3. Ambiguous suppliers ingredient -> "Chưa xác định nhà cung cấp"
        var ambSummary = result.SummaryRows.Single(r => r.IngredientId == GuidHelper.ToGuidString(ingAmbiguous));
        ambSummary.SupplierName.Should().Be("Chưa xác định nhà cung cấp");
        ambSummary.TotalQuantity.Should().Be(5m); // 2 + 3

        // Parity
        result.SummaryTotalQuantity.Should().Be(16m);
        result.DetailTotalQuantity.Should().Be(16m);
        result.SummaryTotalQuantity.Should().Be(result.DetailTotalQuantity);
    }

    [Fact]
    public async Task GetWorkbookAsync_Filters_By_Supplier_Name_Maintaining_Parity()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, _, _, _, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, ledger, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var result = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            SupplierName = "Nhà cung cấp Rau Sạch"
        });

        result.SummaryRows.Should().OnlyContain(r => r.SupplierName == "Nhà cung cấp Rau Sạch");
        result.DetailRows.Should().OnlyContain(r => r.SupplierName == "Nhà cung cấp Rau Sạch");
        result.SummaryTotalQuantity.Should().Be(10m);
        result.DetailTotalQuantity.Should().Be(10m);
    }

    [Fact]
    public async Task ExportWorkbookXlsxAsync_Generates_Valid_OpenXml_Zip_Containing_Two_Named_Sheets()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, _, _, _, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, ledger, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var xlsxBytes = await service.ExportWorkbookXlsxAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate });

        xlsxBytes.Should().NotBeNullOrEmpty();
        using var stream = new MemoryStream(xlsxBytes);
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);

        zip.GetEntry("xl/worksheets/sheet1.xml").Should().NotBeNull();
        zip.GetEntry("xl/worksheets/sheet2.xml").Should().NotBeNull();
        zip.GetEntry("xl/workbook.xml").Should().NotBeNull();

        using var workbookReader = new StreamReader(zip.GetEntry("xl/workbook.xml")!.Open(), Encoding.UTF8);
        var workbookXml = await workbookReader.ReadToEndAsync();
        workbookXml.Should().Contain("Tổng hợp chuẩn bị");
        workbookXml.Should().Contain("Chi tiết phân bổ");

        // Confidentiality check: Prices and secrets must not be in the XML!
        using var sheet1Reader = new StreamReader(zip.GetEntry("xl/worksheets/sheet1.xml")!.Open(), Encoding.UTF8);
        var sheet1Xml = await sheet1Reader.ReadToEndAsync();
        sheet1Xml.Should().NotContain("15000"); // Unit price of quotation
        sheet1Xml.Should().NotContain("30000"); // Unit price of quotation
    }

    [Fact]
    public async Task GetWorkbookAsync_Supplemental_Filter_Returns_Only_Supplemental_Deltas_With_Parity()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, ingSingle, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var dailyLineA = await context.Reconciliationbatchdailylines.FirstAsync(d => d.BatchId == batchAId && d.IngredientId == ingSingle);

        context.Reconciliationsourcedeltas.Add(new ReconciliationSourceDelta
        {
            SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = GuidHelper.NewId(), BatchId = batchAId,
            DailyLineId = dailyLineA.DailyLineId, ServiceDate = serviceDate,
            IngredientId = ingSingle, CanonicalUnitId = fixture.UnitId,
            PreviousRequiredQuantity = 4m, NewRequiredQuantity = 5.5m, DeltaQuantity = 1.5m,
            WorkKind = "SUPPLEMENTAL_ISSUE", Status = "PENDING", Version = 1, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, ledger, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        // 1. Initial only:
        var initialOnly = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate, IsSupplemental = false });
        initialOnly.DetailRows.Should().OnlyContain(r => r.Classification == "Xuất ban đầu");
        initialOnly.SummaryTotalQuantity.Should().Be(16m);
        initialOnly.DetailTotalQuantity.Should().Be(16m);

        // 2. Supplemental only:
        var supplementalOnly = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate, IsSupplemental = true });
        supplementalOnly.DetailRows.Should().OnlyContain(r => r.Classification == "Xuất bổ sung");
        supplementalOnly.SummaryTotalQuantity.Should().Be(1.5m);
        supplementalOnly.DetailTotalQuantity.Should().Be(1.5m);

        // 3. Both (null filter):
        var both = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate });
        both.DetailRows.Should().Contain(r => r.Classification == "Xuất ban đầu");
        both.DetailRows.Should().Contain(r => r.Classification == "Xuất bổ sung");
        both.SummaryTotalQuantity.Should().Be(17.5m);
        both.DetailTotalQuantity.Should().Be(17.5m);
    }

    private static Task EnsureSchemaAsync(IpcManagementContext context) => context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcedeltas (SourceDeltaId BLOB PRIMARY KEY, SourceRevisionId BLOB NOT NULL, BatchId BLOB NOT NULL, DailyLineId BLOB NULL, ServiceDate TEXT NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL, PreviousRequiredQuantity TEXT NOT NULL, NewRequiredQuantity TEXT NOT NULL, DeltaQuantity TEXT NOT NULL, WorkKind TEXT NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ResolvedAt TEXT NULL, ResolvedBy BLOB NULL, ResolutionEntity TEXT NULL, ResolutionId BLOB NULL, ResolutionCommandId TEXT NULL);
        """);
}
