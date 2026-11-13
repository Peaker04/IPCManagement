using System.Data;
using System.Data.Common;
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
using Microsoft.EntityFrameworkCore.Diagnostics;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationPreparationWorkbookTests
{
    [Fact]
    public async Task Source_delta_history_filters_customer_code_before_paging()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (customerAId, _, batchAId, batchBId, ingredientId, _, _, date) = await SetupWorkbookFixtureAsync(fixture, context);
        var customerCode = (await context.Customers.SingleAsync(item => item.CustomerId == customerAId)).CustomerCode;
        context.Reconciliationsourcedeltas.AddRange(
            new ReconciliationSourceDelta { SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = GuidHelper.NewId(), BatchId = batchAId,
                IngredientId = ingredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = date,
                PreviousRequiredQuantity = 1, NewRequiredQuantity = 2, DeltaQuantity = 1, WorkKind = "SOURCE_CHANGE", Status = "APPLIED", Version = 1, CreatedAt = DateTime.UtcNow },
            new ReconciliationSourceDelta { SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = GuidHelper.NewId(), BatchId = batchBId,
                IngredientId = ingredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = date,
                PreviousRequiredQuantity = 1, NewRequiredQuantity = 3, DeltaQuantity = 2, WorkKind = "SOURCE_CHANGE", Status = "APPLIED", Version = 1, CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var result = await new ReconciliationSourceRevisionService(context).GetPageAsync(new ReconciliationSourceDeltaPageQuery
            { CustomerCode = customerCode, Status = "ALL", PageSize = 1 });
        result.TotalCount.Should().Be(1);
        result.Items.Single().BatchId.Should().Be(GuidHelper.ToGuidString(batchAId));
    }

    private sealed class WorkbookSnapshotReads : DbCommandInterceptor
    {
        public bool Enabled { get; set; }
        public List<DbTransaction?> Transactions { get; } = [];
        public List<IsolationLevel?> IsolationLevels { get; } = [];

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (Enabled && command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                Transactions.Add(command.Transaction);
                IsolationLevels.Add(command.Transaction?.IsolationLevel);
            }
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static async Task<(byte[] CustomerAId, byte[] CustomerBId, byte[] BatchAId, byte[] BatchBId, byte[] IngSingleSupplier, byte[] IngNoSupplier, byte[] IngAmbiguousSupplier, DateOnly ServiceDate)> SetupWorkbookFixtureAsync(WorkflowGenerationTests.WorkflowFixture fixture, IpcManagementContext context, bool variedUnits = false)
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

        var noSupplierUnitId = fixture.UnitId;
        if (variedUnits)
        {
            var litre = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "L", UnitName = "Lít", ConvertRateToBase = 1m };
            context.Units.Add(litre);
            noSupplierUnitId = litre.UnitId;
        }
        // 3 Ingredients:
        // 1. Single supplier
        var ingSingle = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-SINGLE", IngredientName = "Rau Muống", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
        // 2. No supplier
        var ingNone = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-NONE", IngredientName = "Gia Vị Hiếm", UnitId = noSupplierUnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
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
                CreateBatchLine(batchAId, ingNone.IngredientId, noSupplierUnitId, serviceDate, variedUnits ? 0.123456m : 1m),
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

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Workbook_keeps_same_name_customers_distinct_and_sums_same_customer_batches(bool includeMenus)
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (customerAId, customerBId, batchAId, batchBId, ingredientId, _, _, date) = await SetupWorkbookFixtureAsync(fixture, context);
        var customerA = await context.Customers.SingleAsync(item => item.CustomerId == customerAId);
        var customerB = await context.Customers.SingleAsync(item => item.CustomerId == customerBId);
        customerA.CustomerName = customerB.CustomerName = "Trùng tên";
        customerA.CustomerCode = "AA";
        customerB.CustomerCode = "BB";
        var selectedLines = await context.Reconciliationbatchlines.Include(item => item.DailyLines)
            .Where(item => item.IngredientId == ingredientId).ToListAsync();
        foreach (var line in selectedLines)
        {
            line.RequiredQuantity = line.BatchId.SequenceEqual(batchAId) ? 2m : 3m;
            line.DailyLines.Single().RequiredQuantity = line.RequiredQuantity;
        }
        var batchA = await context.Reconciliationbatches.SingleAsync(item => item.BatchId == batchAId);
        var extraId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = extraId, MenuVersionId = batchA.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines = [CreateBatchLine(extraId, ingredientId, fixture.UnitId, date, 0.5m)]
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ReconciliationPreparationWorkbookExporter(context);
        var workbook = await service.GetWorkbookAsync(new() { ServiceDate = date, SupplierName = "Nhà cung cấp Rau Sạch", IsSupplemental = false });
        Assert.Equal(2, workbook.CustomerColumns.Count);
        Assert.Equal(new[] { "AA · Trùng tên", "BB · Trùng tên" }, workbook.CustomerColumns);
        var material = Assert.Single(workbook.SummaryRows);
        Assert.Equal(5.5m, material.TotalQuantity);
        if (includeMenus)
        {
            // Exercise the menu sheet while keeping the same customer identity checks on the summary sheet.
            workbook = workbook with { MenuRows = [new(GuidHelper.ToGuidString(customerAId), "Trùng tên", GuidHelper.ToGuidString(batchAId), date, "Sáng", "Mặn", "D-1", "Món", 10)] };
        }
        Assert.Throws<InvalidOperationException>(() => PreparationWorkbookBuilder.BuildXlsx(workbook with { CustomerColumnDefinitions = [] }));
        Assert.Throws<InvalidOperationException>(() => PreparationWorkbookBuilder.BuildXlsx(workbook with
            { CustomerColumnDefinitions = [workbook.CustomerColumnDefinitions[0], workbook.CustomerColumnDefinitions[0]] }));
        using var zip = new ZipArchive(new MemoryStream(PreparationWorkbookBuilder.BuildXlsx(workbook)));
        using var sheet = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
        System.Xml.Linq.XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var xml = System.Xml.Linq.XDocument.Load(sheet);
        Assert.Contains(xml.Descendants(ns + "t"), cell => cell.Value == "AA · Trùng tên");
        Assert.Contains(xml.Descendants(ns + "t"), cell => cell.Value == "BB · Trùng tên");
        var row = Assert.Single(xml.Descendants(ns + "row"), item => item.Elements(ns + "c").Any(cell => cell.Value == "ING-SINGLE"));
        var quantities = row.Elements(ns + "c").Skip(4).ToArray();
        Assert.Equal(new[] { "2.5", "3", "5.5" }, quantities.Select(cell => cell.Element(ns + "v")!.Value));
        Assert.All(quantities, cell => Assert.Equal("n", (string?)cell.Attribute("t")));
    }

    [Fact]
    public async Task GetWorkbookAsync_Deterministically_Classifies_Single_Missing_And_Ambiguous_Suppliers()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, _, _, ingSingle, ingNone, ingAmbiguous, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var result = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = serviceDate });

        result.Should().NotBeNull();
        result.CustomerColumns.Should().Equal(["CUS · Customer", "CUST-B · Khách hàng B"]);

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
        var (customerAId, customerBId, batchAId, batchBId, ingSingle, _, ingAmbiguous, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var result = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            SupplierName = "Nhà cung cấp Rau Sạch"
        });

        result.SummaryRows.Should().OnlyContain(r => r.SupplierName == "Nhà cung cấp Rau Sạch");
        result.DetailRows.Should().OnlyContain(r => r.SupplierName == "Nhà cung cấp Rau Sạch");
        result.SummaryTotalQuantity.Should().Be(10m);
        result.DetailTotalQuantity.Should().Be(10m);

        var lineA = await context.Reconciliationbatchlines.Include(l => l.DailyLines)
            .SingleAsync(l => l.BatchId == batchAId && l.IngredientId == ingSingle);
        lineA.RequiredQuantity = 2.5m;
        lineA.DailyLines.Single().RequiredQuantity = 2.5m;

        var lineBSingle = await context.Reconciliationbatchlines.Include(l => l.DailyLines)
            .SingleAsync(l => l.BatchId == batchBId && l.IngredientId == ingSingle);
        context.Reconciliationbatchdailylines.RemoveRange(lineBSingle.DailyLines);
        context.Reconciliationbatchlines.Remove(lineBSingle);

        var lineBAmb = await context.Reconciliationbatchlines.Include(l => l.DailyLines)
            .SingleAsync(l => l.BatchId == batchBId && l.IngredientId == ingAmbiguous);
        lineBAmb.RequiredQuantity = 3m;
        lineBAmb.DailyLines.Single().RequiredQuantity = 3m;
        await context.SaveChangesAsync();

        var dish = await context.Dishes.FirstAsync();
        var linesA = await context.Reconciliationbatchdailylines.AsNoTracking().Where(l => l.BatchId == batchAId).ToListAsync();
        foreach (var dl in linesA)
        {
            context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
            {
                ContributorId = GuidHelper.NewId(), BatchLineId = dl.BatchLineId, DailyLineId = dl.DailyLineId,
                MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(),
                DishId = dish.DishId, FrozenDishCode = "DISH-A", FrozenDishName = "Món Khách A",
                FrozenMenuVariant = "savory", FrozenShiftName = "MORNING", FrozenServings = 100,
                FrozenBomQuantityPerServing = dl.RequiredQuantity / 100m, SourceQuantity = dl.RequiredQuantity
            });
        }
        var linesB = await context.Reconciliationbatchdailylines.AsNoTracking().Where(l => l.BatchId == batchBId).ToListAsync();
        foreach (var dl in linesB)
        {
            context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
            {
                ContributorId = GuidHelper.NewId(), BatchLineId = dl.BatchLineId, DailyLineId = dl.DailyLineId,
                MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(),
                DishId = dish.DishId, FrozenDishCode = "DISH-B", FrozenDishName = "Món Khách B",
                FrozenMenuVariant = "savory", FrozenShiftName = "MORNING", FrozenServings = 150,
                FrozenBomQuantityPerServing = dl.RequiredQuantity / 150m, SourceQuantity = dl.RequiredQuantity
            });
        }
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var materialOnlyFiltered = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            SupplierName = "Nhà cung cấp Rau Sạch",
            IncludeMenus = false
        });
        materialOnlyFiltered.CustomerColumnDefinitions.Select(c => c.CustomerId).Should().Equal(GuidHelper.ToGuidString(customerAId));
        materialOnlyFiltered.SummaryTotalQuantity.Should().Be(2.5m);

        var combinedQuery = new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            SupplierName = "Nhà cung cấp Rau Sạch",
            IncludeMenus = true
        };
        var combined = await service.GetWorkbookAsync(combinedQuery);
        combined.CustomerColumnDefinitions.Select(c => c.CustomerId).Should().Equal(
            GuidHelper.ToGuidString(customerAId),
            GuidHelper.ToGuidString(customerBId));
        combined.CustomerColumns.Should().Equal("CUS · Customer", "CUST-B · Khách hàng B");
        combined.MenuRows.Select(m => m.DishName).Should().Equal("Món Khách A", "Món Khách B");
        var summaryRow = Assert.Single(combined.SummaryRows);
        summaryRow.CustomerQuantities[GuidHelper.ToGuidString(customerAId)].Should().Be(2.5m);
        summaryRow.CustomerQuantities[GuidHelper.ToGuidString(customerBId)].Should().Be(0m);
        summaryRow.TotalQuantity.Should().Be(2.5m);
        combined.SummaryTotalQuantity.Should().Be(2.5m);
        combined.DetailTotalQuantity.Should().Be(2.5m);

        var combinedXlsx = await service.ExportWorkbookXlsxAsync(combinedQuery);
        using (var zip = new ZipArchive(new MemoryStream(combinedXlsx), ZipArchiveMode.Read))
        {
            using var sheetStream = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
            System.Xml.Linq.XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var xml = System.Xml.Linq.XDocument.Load(sheetStream);
            xml.Descendants(ns + "t").Select(t => t.Value).Should().Contain(["CUS · Customer", "CUST-B · Khách hàng B"]);
            using var menuStream = zip.GetEntry("xl/worksheets/sheet3.xml")!.Open();
            var menuXml = System.Xml.Linq.XDocument.Load(menuStream);
            menuXml.Descendants(ns + "t").Select(t => t.Value).Should().Contain(["Món Khách A", "Món Khách B"]);
            var matRow = Assert.Single(xml.Descendants(ns + "row"), r => r.Elements(ns + "c").Any(c => c.Value == "ING-SINGLE"));
            var numericCells = matRow.Elements(ns + "c").Skip(4).ToArray();
            numericCells.Select(c => c.Element(ns + "v")!.Value).Should().Equal("2.5", "0", "2.5");
        }

        var unmatchedSupplierQuery = new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            SupplierName = "Nhà cung cấp Không Khớp",
            IncludeMenus = true
        };
        var unmatchedWorkbook = await service.GetWorkbookAsync(unmatchedSupplierQuery);
        unmatchedWorkbook.MenuRows.Should().HaveCount(2);
        unmatchedWorkbook.SummaryRows.Should().BeEmpty();
        unmatchedWorkbook.DetailRows.Should().BeEmpty();
        unmatchedWorkbook.SummaryTotalQuantity.Should().Be(0m);
        unmatchedWorkbook.DetailTotalQuantity.Should().Be(0m);
        var unmatchedXlsx = await service.ExportWorkbookXlsxAsync(unmatchedSupplierQuery);
        using (var zip = new ZipArchive(new MemoryStream(unmatchedXlsx), ZipArchiveMode.Read))
        {
            zip.GetEntry("xl/worksheets/sheet1.xml").Should().NotBeNull();
        }
    }

    [Fact]
    public async Task ExportWorkbookXlsxAsync_Generates_Valid_OpenXml_Zip_Containing_Two_Named_Sheets()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, _, _, _, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context, variedUnits: true);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

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
        System.Xml.Linq.XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var summary = System.Xml.Linq.XDocument.Parse(sheet1Xml);
        var summaryData = summary.Descendants(ns + "row").Skip(1).ToArray();
        summaryData.Should().NotBeEmpty();
        var unknown = summaryData.Single(row => row.Value.Contains("Gia Vị Hiếm", StringComparison.Ordinal));
        unknown.Value.Should().Contain("Chưa xác định nhà cung cấp").And.Contain("Lít");
        unknown.Elements(ns + "c").Last().Element(ns + "v")!.Value.Should().Be("0.123456");
        var shared = summaryData.Single(row => row.Value.Contains("Rau Muống", StringComparison.Ordinal));
        shared.Elements(ns + "c").Skip(4).Select(cell => cell.Element(ns + "v")!.Value).Should().Equal("4", "6", "10");
        foreach (var row in summaryData)
        {
            foreach (var cell in row.Elements(ns + "c").Skip(4))
            {
                ((string?)cell.Attribute("t")).Should().Be("n");
                decimal.Parse(cell.Element(ns + "v")!.Value, System.Globalization.CultureInfo.InvariantCulture).Should().BeGreaterThanOrEqualTo(0);
            }
        }
        using var detailReader = new StreamReader(zip.GetEntry("xl/worksheets/sheet2.xml")!.Open(), Encoding.UTF8);
        var detail = System.Xml.Linq.XDocument.Parse(await detailReader.ReadToEndAsync());
        foreach (var row in detail.Descendants(ns + "row").Skip(1))
            ((string?)row.Elements(ns + "c").ElementAt(7).Attribute("t")).Should().Be("n");
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

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

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

    [Fact]
    public async Task Full_week_workbook_contains_frozen_menu_once_per_dish_and_supplier_materials_without_writes()
    {
        var reads = new WorkbookSnapshotReads();
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync(reads);
        await using var context = fixture.CreateContext();
        var (_, _, batchId, _, ingredientId, _, _, monday) = await SetupWorkbookFixtureAsync(fixture, context);
        var lines = await context.Reconciliationbatchdailylines.Where(line => line.BatchId == batchId).ToListAsync();
        var dish = await context.Dishes.FirstAsync();
        foreach (var line in lines)
            context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
            {
                ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, DailyLineId = line.DailyLineId,
                MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(),
                DishId = dish.DishId, FrozenDishCode = dish.DishCode, FrozenDishName = "Món đóng băng",
                FrozenMenuVariant = "savory", FrozenShiftName = "MORNING", FrozenServings = 100,
                FrozenBomQuantityPerServing = line.RequiredQuantity / 100m, SourceQuantity = line.RequiredQuantity
            });
        var first = lines.Single(line => line.IngredientId.SequenceEqual(ingredientId));
        var saturday = new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = first.BatchLineId, BatchId = batchId,
            IngredientId = ingredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = monday.AddDays(5), RequiredQuantity = 1.123456m, Version = 1
        };
        context.Reconciliationbatchdailylines.Add(saturday);
        context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = first.BatchLineId, DailyLineId = saturday.DailyLineId,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(),
            DishId = dish.DishId, FrozenDishCode = dish.DishCode, FrozenDishName = "Món Thứ Bảy",
            FrozenMenuVariant = "savory", FrozenShiftName = "AFTERNOON", FrozenServings = 50,
            FrozenBomQuantityPerServing = 0.02246912m, SourceQuantity = 1.123456m
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = new ReconciliationPreparationWorkbookExporter(context,
            new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation });
        var query = new ReconciliationPreparationWorkbookQuery { WeekStartDate = monday, BatchIds = [GuidHelper.ToGuidString(batchId)], IncludeMenus = true, IsSupplemental = false };
        reads.Enabled = true;
        var workbook = await service.GetWorkbookAsync(query);
        reads.Enabled = false;
        reads.Transactions.Should().HaveCountGreaterThan(1);
        var transaction = reads.Transactions[0];
        transaction.Should().NotBeNull("a workbook must not combine separately committed revisions");
        reads.Transactions.Should().OnlyContain(item => ReferenceEquals(item, transaction));
        reads.IsolationLevels.Should().OnlyContain(level => level == IsolationLevel.Serializable || level == IsolationLevel.RepeatableRead);
        context.Database.CurrentTransaction.Should().BeNull("the complete read, including nested cooking projections, must release its transaction before rendering");
        workbook.MenuRows.Should().HaveCount(2);
        workbook.MenuRows.Select(row => row.Servings).Should().Equal(100, 50);
        workbook.MenuRows.Last().ServiceDate.Should().Be(monday.AddDays(5));
        workbook.ScopeEndDate.Should().Be(monday.AddDays(5));
        workbook.SummaryRows.Single(row => row.IngredientId == GuidHelper.ToGuidString(ingredientId)).TotalQuantity.Should().Be(5.123456m);
        using var stream = new MemoryStream(await service.ExportWorkbookXlsxAsync(query));
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        zip.GetEntry("xl/worksheets/sheet2.xml").Should().NotBeNull("allocation detail must remain inspectable when a menu is included");
        zip.GetEntry("xl/worksheets/sheet3.xml").Should().NotBeNull("menu evidence must have its own sheet");
        using var summaryReader = new StreamReader(zip.GetEntry("xl/worksheets/sheet1.xml")!.Open());
        var summaryXml = await summaryReader.ReadToEndAsync();
        using var detailReader = new StreamReader(zip.GetEntry("xl/worksheets/sheet2.xml")!.Open());
        var detailXml = await detailReader.ReadToEndAsync();
        using var menuReader = new StreamReader(zip.GetEntry("xl/worksheets/sheet3.xml")!.Open());
        var xml = await menuReader.ReadToEndAsync();
        xml.Should().Contain("Món đóng băng").And.Contain("Món Thứ Bảy").And.Contain("Chiều");
        summaryXml.Should().Contain("ING-SINGLE").And.Contain("5.123456");
        detailXml.Should().Contain("ING-SINGLE").And.Contain("Chiều");
        summaryXml.Should().Contain("<autoFilter");
        detailXml.Should().Contain("<autoFilter");
        xml.Should().Contain("<autoFilter");
        System.Xml.Linq.XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var rows = System.Xml.Linq.XDocument.Parse(xml).Descendants(ns + "row").ToArray();
        var menuRows = rows.Where(row => row.Value.Contains("Món đóng băng") || row.Value.Contains("Món Thứ Bảy")).ToArray();
        menuRows.Should().HaveCount(2);
        menuRows.Select(row => row.Elements(ns + "c").Last().Element(ns + "v")!.Value).Should().Equal("100", "50");
        var materialRow = System.Xml.Linq.XDocument.Parse(summaryXml).Descendants(ns + "row").Single(row => row.Elements(ns + "c").Any(cell => cell.Value == "ING-SINGLE"));
        materialRow.Elements(ns + "c").Last().Element(ns + "v")!.Value.Should().Be("5.123456");
        var dailyQuery = new ReconciliationPreparationWorkbookQuery { ServiceDate = monday, BatchIds = query.BatchIds, IncludeMenus = true, IsSupplemental = false };
        var dayWorkbook = await service.GetWorkbookAsync(dailyQuery);
        dayWorkbook.MenuRows.Should().ContainSingle().Which.DishName.Should().Be("Món đóng băng");
        dayWorkbook.SummaryRows.Single(row => row.IngredientId == GuidHelper.ToGuidString(ingredientId)).TotalQuantity.Should().Be(4m);
        context.ChangeTracker.HasChanges().Should().BeFalse();
        (await context.Inventoryissues.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        var invalid = () => service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { ServiceDate = monday, WeekStartDate = monday });
        await invalid.Should().ThrowAsync<ArgumentException>();
        var contributor = await context.Reconciliationbatchcontributors.FirstAsync(item => item.DailyLineId == saturday.DailyLineId);
        contributor.FrozenDishName = null;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var missingMenu = () => service.GetWorkbookAsync(query);
        await missingMenu.Should().ThrowAsync<InvalidOperationException>().WithMessage("KITCHEN_FROZEN_LINEAGE_MISSING:*");
        var materialsOnly = await service.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery { WeekStartDate = monday, BatchIds = query.BatchIds, IsSupplemental = false });
        materialsOnly.MenuRows.Should().BeEmpty();
        materialsOnly.SummaryRows.Single(row => row.IngredientId == GuidHelper.ToGuidString(ingredientId)).TotalQuantity.Should().Be(5.123456m);
        context.ChangeTracker.HasChanges().Should().BeFalse();
    }

    [Fact]
    public async Task GetWorkbookAsync_Subtracts_Confirmed_Returns_When_Resolving_IssueStatus()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, ingSingle, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var dailyLineA = await context.Reconciliationbatchdailylines.FirstAsync(d => d.BatchId == batchAId && d.IngredientId == ingSingle);
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-WB-NET",
            IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId,
            ReconciliationBatchId = batchAId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        };
        var issueLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = issue.IssueId,
            IngredientId = ingSingle,
            UnitId = fixture.UnitId,
            RequestedQty = dailyLineA.RequiredQuantity,
            IssuedQty = dailyLineA.RequiredQuantity + 2m,
            ReconciliationBatchLineId = dailyLineA.BatchLineId,
            ReconciliationBatchDailyLineId = dailyLineA.DailyLineId,
            ReconciliationServiceDate = serviceDate
        };
        issue.Inventoryissuelines.Add(issueLine);
        var confirmedReturn = new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(),
            ReturnCode = "RET-WB-NET",
            ReturnDate = serviceDate,
            ReturnType = "RETURN",
            WarehouseId = fixture.WarehouseId,
            IssueId = issue.IssueId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            ReceivedBy = fixture.UserId,
            ReceivedAt = DateTime.UtcNow
        };
        confirmedReturn.Inventoryreturnlines.Add(new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(),
            ReturnId = confirmedReturn.ReturnId,
            SourceIssueLineId = issueLine.IssueLineId,
            IngredientId = ingSingle,
            UnitId = fixture.UnitId,
            Quantity = 2m
        });
        context.Inventoryissues.Add(issue);
        context.Inventoryreturns.Add(confirmedReturn);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var exporter = new ReconciliationPreparationWorkbookExporter(
            context,
            new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation });
        var workbook = await exporter.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = serviceDate,
            BatchIds = [GuidHelper.ToGuidString(batchAId)],
            IsSupplemental = false
        });

        var row = workbook.DetailRows.Single(r => r.IngredientId == GuidHelper.ToGuidString(ingSingle));
        row.IssueStatus.Should().Be("EXACT");
    }

    [Fact]
    public async Task MrxReportWorkbookExporter_Streams_10500_Rows_Under_2000ms_With_Valid_OpenXml_And_MultiLetter_Columns()
    {
        MrxReportWorkbookExporter.GetColumnName(0).Should().Be("A");
        MrxReportWorkbookExporter.GetColumnName(25).Should().Be("Z");
        MrxReportWorkbookExporter.GetColumnName(26).Should().Be("AA");

        var rows = Enumerable.Range(1, 10_500).Select(index => new MrxTransactionHistoryRowDto(
            index % 2 == 0 ? "INITIAL_ISSUE" : "SUPPLEMENTAL_ISSUE",
            $"DOC-{index:D6}",
            new DateOnly(2026, 10, 26),
            "00000000-0000-0000-0000-000000000001",
            "CÔNG TY CỔ PHẦN ĐẠI TÍN",
            $"ING-{index:D4}",
            $"Nguyên liệu kiểm thử hiệu năng dòng {index}",
            "kg",
            12.345678m,
            "Thủ kho kiểm thử",
            new DateTime(2026, 10, 26, 8, 30, 0, DateTimeKind.Utc),
            "Xuất kho phục vụ sản xuất"));

        var sw = System.Diagnostics.Stopwatch.StartNew();
        await using var stream = await MrxReportWorkbookExporter.TransactionsAsync(
            MrxReportWorkbookExporter.Enumerate(rows));
        sw.Stop();

        sw.ElapsedMilliseconds.Should().BeLessThan(2_000);
        stream.Length.Should().BeGreaterThan(100_000);

        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml");
        sheetEntry.Should().NotBeNull();
        using var reader = new StreamReader(sheetEntry!.Open());
        var xml = await reader.ReadToEndAsync();
        xml.Should().Contain("<row r=\"1\">");
        xml.Should().Contain("<row r=\"10501\">");
        xml.Should().Contain("<autoFilter ref=\"A1:L10501\"/>");
    }

    [Fact]
    public async Task GetWarehouseDailyManyAsync_WithoutMetadata_Matches_Status_Counts_And_Supports_OperationalSummary()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, _, _, _, _) = await SetupWorkbookFixtureAsync(fixture, context);

        var batchRow = await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchAId);
        batchRow.Status = "IN_PROGRESS";
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var reqCtx = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var runner = Substitute.For<IEfTransactionRunner>();
        var batchService = new ReconciliationBatchService(context, runner, reqCtx);
        var batchIdStr = GuidHelper.ToGuidString(batchAId);

        var withMeta = await batchService.GetWarehouseDailyManyAsync([batchIdStr], includeMetadata: true);
        var withoutMeta = await batchService.GetWarehouseDailyManyAsync([batchIdStr], includeMetadata: false);

        withoutMeta[batchIdStr].WeeklyStatus.Should().Be(withMeta[batchIdStr].WeeklyStatus);
        withoutMeta[batchIdStr].Dates.Select(d => d.Status).Should().Equal(withMeta[batchIdStr].Dates.Select(d => d.Status));

        var reportsService = new ReconciliationReportsService(context, batchService, reqCtx);
        var summary = await reportsService.GetOperationalSummaryAsync(
            new MrxOperationalSummaryQuery(),
            ["MANAGER"]);
        summary.UnresolvedVariancesCount.Should().Be(0);
    }

    [Theory]
    [InlineData(false, "Ca trưa")]
    [InlineData(true, "Cả ngày")]
    public async Task GetVarianceRegisterAsync_Projects_Contributor_FrozenShiftName_Without_Cartesian_Explosion(bool multipleShifts, string expectedShift)
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, ingSingle, _, _, serviceDate) = await SetupWorkbookFixtureAsync(fixture, context);

        var dailyLineA = await context.Reconciliationbatchdailylines.FirstAsync(d => d.BatchId == batchAId && d.IngredientId == ingSingle);
        var dish = await context.Dishes.FirstAsync();
        context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(),
            BatchLineId = dailyLineA.BatchLineId,
            DailyLineId = dailyLineA.DailyLineId,
            MenuScheduleId = GuidHelper.NewId(),
            MealQuantityPlanLineId = GuidHelper.NewId(),
            DishBomId = GuidHelper.NewId(),
            DishId = dish.DishId,
            FrozenDishCode = "DISH-VAR",
            FrozenDishName = "Món kiểm thử chênh lệch",
            FrozenMenuVariant = "savory",
            FrozenShiftName = "Ca trưa",
            FrozenServings = 100,
            FrozenBomQuantityPerServing = dailyLineA.RequiredQuantity / 100m,
            SourceQuantity = dailyLineA.RequiredQuantity / (multipleShifts ? 2m : 1m)
        });
        if (multipleShifts)
        {
            context.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor
            {
                ContributorId = GuidHelper.NewId(), BatchLineId = dailyLineA.BatchLineId,
                DailyLineId = dailyLineA.DailyLineId, MenuScheduleId = GuidHelper.NewId(),
                MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(), DishId = dish.DishId,
                FrozenDishCode = "DISH-VAR", FrozenDishName = "Món kiểm thử chênh lệch",
                FrozenMenuVariant = "savory", FrozenShiftName = "AFTERNOON", FrozenServings = 100,
                FrozenBomQuantityPerServing = dailyLineA.RequiredQuantity / 200m,
                SourceQuantity = dailyLineA.RequiredQuantity / 2m
            });
        }
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-VAR-1",
            IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId,
            ReconciliationBatchId = batchAId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        };
        issue.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = issue.IssueId,
            IngredientId = ingSingle,
            UnitId = fixture.UnitId,
            RequestedQty = dailyLineA.RequiredQuantity,
            IssuedQty = dailyLineA.RequiredQuantity + 1.5m,
            ReconciliationBatchLineId = dailyLineA.BatchLineId,
            ReconciliationBatchDailyLineId = dailyLineA.DailyLineId,
            ReconciliationServiceDate = serviceDate
        });
        context.Inventoryissues.Add(issue);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var reqCtx = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var runner = Substitute.For<IEfTransactionRunner>();
        var batchService = new ReconciliationBatchService(context, runner, reqCtx);
        var reportsService = new ReconciliationReportsService(context, batchService, reqCtx);

        var varianceReport = await reportsService.GetVarianceRegisterAsync(
            GuidHelper.ToGuidString(batchAId),
            null);

        varianceReport.TotalCount.Should().Be(1);
        varianceReport.Rows.Single().ShiftName.Should().Be(expectedShift);
        varianceReport.Rows.Single().Difference.Should().Be(1.5m);
    }

    [Fact]
    public async Task MrxInitializers_And_WarehouseRepository_Use_Deterministic_Ordering_On_Candidate_Queries()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);
        var runner = Substitute.For<IEfTransactionRunner>();
        runner.ExecuteAsync(Arg.Any<Func<CancellationToken, Task<InitializationResult>>>(), Arg.Any<Func<CancellationToken, Task<bool>>>(), Arg.Any<System.Data.IsolationLevel>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<Func<CancellationToken, Task<InitializationResult>>>(0)(CancellationToken.None));
        var actorId = Guid.NewGuid().ToString();
        var modeInit = new SystemOperationModeInitializer(context, runner);
        var modeRes = await modeInit.InitializeAsync(actorId);
        modeRes.Mode.Should().NotBeNullOrWhiteSpace();
        var warehouseRepo = new IPCManagement.Api.Data.Repositories.WarehouseRepository(context);
        var candidates = await warehouseRepo.GetOperationalCandidatesAsync(2);
        candidates.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAsync_Skips_WarehouseRevisionMetadata_Queries_While_Returning_Full_DailyReview()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, _, _, _, _) = await SetupWorkbookFixtureAsync(fixture, context);

        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS reconciliationactuals (ActualId BLOB PRIMARY KEY, BatchLineId BLOB NOT NULL, Side TEXT NOT NULL, Quantity TEXT NOT NULL, Version INTEGER NOT NULL, EnteredBy BLOB NOT NULL, EnteredAt TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS reconciliationdispositions (DispositionId BLOB PRIMARY KEY, BatchLineId BLOB NOT NULL, Category TEXT NOT NULL, Reason TEXT NOT NULL, Version INTEGER NOT NULL, DisposedBy BLOB NOT NULL, DisposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL, ActiveOwnerKey BLOB NULL);
            DROP TABLE IF EXISTS reconciliationsourcerevisions;
            CREATE TABLE reconciliationsourcerevisions (stub INTEGER);
            """);

        var reqCtx = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var runner = Substitute.For<IEfTransactionRunner>();
        var batchService = new ReconciliationBatchService(context, runner, reqCtx);

        var dto = await batchService.GetAsync(GuidHelper.ToGuidString(batchAId));

        dto.Should().NotBeNull();
        dto!.DailyReview.Should().NotBeNull();
        dto.DailyReview!.Lines.Should().NotBeEmpty();
    }

    private static Task EnsureSchemaAsync(IpcManagementContext context) => context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, FrozenBomUnitToBaseRate TEXT NULL, FrozenCanonicalUnitToBaseRate TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL, InvalidatedAt TEXT NULL, InvalidatedBySourceRevisionId BLOB NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcedeltas (SourceDeltaId BLOB PRIMARY KEY, SourceRevisionId BLOB NOT NULL, BatchId BLOB NOT NULL, DailyLineId BLOB NULL, ServiceDate TEXT NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL, PreviousRequiredQuantity TEXT NOT NULL, NewRequiredQuantity TEXT NOT NULL, DeltaQuantity TEXT NOT NULL, WorkKind TEXT NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ResolvedAt TEXT NULL, ResolvedBy BLOB NULL, ResolutionEntity TEXT NULL, ResolutionId BLOB NULL, ResolutionCommandId TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdailydispositions (DispositionId BLOB PRIMARY KEY, DailyLineId BLOB NOT NULL, Category TEXT NOT NULL, Reason TEXT NOT NULL, Version INTEGER NOT NULL, DisposedBy BLOB NOT NULL, DisposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL, ActiveOwnerKey BLOB NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcerevisions (SourceRevisionId BLOB PRIMARY KEY, MenuAmendmentId BLOB NULL, BatchId BLOB NOT NULL, PreviousMenuVersionId BLOB NOT NULL, AppliedMenuVersionId BLOB NOT NULL, RevisionNumber INTEGER NOT NULL, Status TEXT NOT NULL, Reason TEXT NOT NULL, AppliedBy BLOB NOT NULL, AppliedAt TEXT NOT NULL, AppliedByRole TEXT NULL, ApplyMode TEXT NULL);
        """);
}
