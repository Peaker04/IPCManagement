using Xunit.Abstractions;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed partial class ReconciliationDashboardAndReportsTests(ITestOutputHelper output)
{
    private static async Task EnsureSchemaAsync(IpcManagementContext context) => await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, FrozenBomUnitToBaseRate TEXT NULL, FrozenCanonicalUnitToBaseRate TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL, InvalidatedAt TEXT NULL, InvalidatedBySourceRevisionId BLOB NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcedeltas (SourceDeltaId BLOB PRIMARY KEY, SourceRevisionId BLOB NOT NULL, BatchId BLOB NOT NULL, DailyLineId BLOB NULL, ServiceDate TEXT NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL, PreviousRequiredQuantity TEXT NOT NULL, NewRequiredQuantity TEXT NOT NULL, DeltaQuantity TEXT NOT NULL, WorkKind TEXT NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ResolvedAt TEXT NULL, ResolvedBy BLOB NULL, ResolutionEntity TEXT NULL, ResolutionId BLOB NULL, ResolutionCommandId TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdailydispositions (dispositionId BLOB PRIMARY KEY, dailyLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL, ActiveOwnerKey BLOB GENERATED ALWAYS AS (CASE WHEN InvalidatedAt IS NULL THEN dailyLineId ELSE NULL END) VIRTUAL);
        CREATE TABLE IF NOT EXISTS reconciliationactuals (actualId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, side TEXT NOT NULL, quantity TEXT NOT NULL, version INTEGER NOT NULL, enteredBy BLOB NOT NULL, enteredAt TEXT NOT NULL, notes TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdispositions (dispositionId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL, ActiveOwnerKey BLOB GENERATED ALWAYS AS (CASE WHEN InvalidatedAt IS NULL THEN batchLineId ELSE NULL END) VIRTUAL);
        CREATE TABLE IF NOT EXISTS reconciliationtolerances (toleranceId BLOB PRIMARY KEY, scopeKind TEXT NOT NULL, scopeId BLOB NULL, value TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, systemDefaultKey INTEGER NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcerevisions (sourceRevisionId BLOB PRIMARY KEY, menuAmendmentId BLOB NULL, batchId BLOB NOT NULL, previousMenuVersionId BLOB NOT NULL, appliedMenuVersionId BLOB NOT NULL, revisionNumber INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, appliedBy BLOB NOT NULL, appliedAt TEXT NOT NULL, AppliedByRole TEXT NULL, ApplyMode TEXT NULL, UNIQUE (menuAmendmentId, batchId), UNIQUE (batchId, revisionNumber));
        """);

    private static async Task<List<T>> CollectAsync<T>(IAsyncEnumerable<T> rows)
    {
        var result = new List<T>();
        await foreach (var row in rows) result.Add(row);
        return result;
    }

    private sealed class SelectCounter : DbCommandInterceptor
    {
        public int Count { get; set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase)) Count++;
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task OperationalSummary_loads_one_hundred_batches_without_per_batch_queries_or_page_truncated_counts()
    {
        var counter = new SelectCounter();
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync(counter);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);
        var versionId = GuidHelper.NewId();
        var date = new DateOnly(2026, 6, 15);
        context.Menuversions.Add(new MenuVersion { MenuVersionId = versionId, CustomerId = fixture.CustomerId, WeekStartDate = date,
            VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        void AddBatch(int index)
        {
            var batchId = GuidHelper.NewId();
            var weeklyId = GuidHelper.NewId();
            var dailyId = GuidHelper.NewId();
            context.Reconciliationbatches.Add(new ReconciliationBatch
            {
                BatchId = batchId, MenuVersionId = versionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "IN_PROGRESS",
                Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
                Lines = [new ReconciliationBatchLine { BatchLineId = weeklyId, BatchId = batchId,
                    IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId, RequiredQuantity = 1m,
                    FrozenTolerance = 0.5m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines = [new ReconciliationBatchDailyLine { DailyLineId = dailyId, BatchLineId = weeklyId, BatchId = batchId,
                        IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = date, RequiredQuantity = 1m, Version = 1 }] }]
            });
            context.Inventoryissues.Add(new InventoryIssue
            {
                IssueId = GuidHelper.NewId(), IssueCode = $"QUERY-{index}", IssueDate = date, WarehouseId = fixture.WarehouseId,
                ReconciliationBatchId = batchId, IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
                Inventoryissuelines = [new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId, ReconciliationBatchLineId = weeklyId, ReconciliationBatchDailyLineId = dailyId,
                    ReconciliationServiceDate = date, RequestedQty = 1m, IssuedQty = index % 2 == 0 ? 2m : 1m }]
            });
        }
        AddBatch(0);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var request = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation };
        var service = new ReconciliationReportsService(context, new ReconciliationBatchService(context, new ImmediateTransactionRunner(), request), request);
        counter.Count = 0;
        var one = await service.GetOperationalSummaryAsync(new(), ["Admin"]);
        Assert.Equal(1, one.UnresolvedVariancesCount);
        var singleQueries = counter.Count;
        for (var index = 1; index < 100; index++) AddBatch(index);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        counter.Count = 0;
        var many = await service.GetOperationalSummaryAsync(new(), ["Admin"]);
        var manyQueries = counter.Count;
        Assert.Equal(50, many.UnresolvedVariancesCount);
        Assert.Equal(50, many.CompletionReadyBatchesCount);
        Assert.Equal(10, many.Items.Count(item => item.QueueType == "UNRESOLVED_VARIANCE"));
        Assert.Equal(10, many.Items.Count(item => item.QueueType == "COMPLETION_READY"));
        output.WriteLine($"SELECT count: one batch = {singleQueries}; 100 batches = {manyQueries}");
        Assert.True(manyQueries <= singleQueries, $"SELECT count grew from {singleQueries} for one batch to {manyQueries} for 100 batches.");
    }

    [Fact]
    public async Task OperationalSummary_Returns_Exact_Counts_And_Links_To_Real_Work_Objects()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var menuVersionId = GuidHelper.NewId();
        context.Menuversions.Add(new MenuVersion
        {
            MenuVersionId = menuVersionId, CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        });
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
        });
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = menuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "READY", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
        });

        context.Customers.Add(new Customer { CustomerId = fixture.CustomerId, CustomerCode = "CUS", CustomerName = "Customer", IsActive = true });
        var amendmentId = GuidHelper.NewId();
        context.Menuamendments.Add(new MenuAmendment
        {
            MenuAmendmentId = amendmentId, CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
            Status = "PENDING_REVIEW", Reason = "Điều chỉnh số suất", CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            ImpactSnapshotJson = "{}"
        });

        context.Menuamendments.Add(new MenuAmendment
        {
            MenuAmendmentId = GuidHelper.NewId(), CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
            Status = "RECONCILIATION_REQUIRED", Reason = "Đề nghị cần xem xét", CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            ImpactSnapshotJson = "{}"
        });

        var deltaId = GuidHelper.NewId();
        context.Reconciliationsourcedeltas.Add(new ReconciliationSourceDelta
        {
            SourceDeltaId = deltaId, SourceRevisionId = GuidHelper.NewId(), BatchId = batchId,
            ServiceDate = new DateOnly(2026, 6, 15), IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
            PreviousRequiredQuantity = 2m, NewRequiredQuantity = 3m, DeltaQuantity = 1m,
            WorkKind = "SUPPLEMENTAL_ISSUE", Status = "PENDING", Version = 1, CreatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var summary = await service.GetOperationalSummaryAsync(new(), ["Admin"]);

        summary.PendingSourceChangesCount.Should().Be(2);
        summary.AwaitingWarehouseBatchesCount.Should().Be(1);
        summary.PendingDeltasCount.Should().Be(1);

        summary.Items.Should().Contain(i => i.QueueType == "PENDING_SOURCE_CHANGE" && i.TargetUrl != null && i.TargetUrl.Contains(GuidHelper.ToGuidString(amendmentId)));
        summary.Items.Should().Contain(i => i.QueueType == "AWAITING_WAREHOUSE" && i.TargetUrl != null && i.TargetUrl.Contains(GuidHelper.ToGuidString(batchId)));
        summary.Items.Should().Contain(i => i.QueueType == "PENDING_DELTA" && i.ActionKind == "READ_ONLY");

        var manager = await service.GetOperationalSummaryAsync(new(), ["Quản lý"]);
        manager.Items.Where(i => i.OwnerRole == "WAREHOUSE").Should().OnlyContain(i => i.TargetUrl == null);
        var chef = await service.GetOperationalSummaryAsync(new(), ["Bếp trưởng"]);
        chef.UnresolvedVariancesCount.Should().BeNull();
        chef.CustomerOptions.Should().ContainSingle().Which.CustomerId.Should().Be(GuidHelper.ToGuidString(fixture.CustomerId));
        chef.AwaitingWarehouseBatchesCount.Should().BeNull();
        chef.Items.Should().BeEmpty();

        var excluded = await service.GetOperationalSummaryAsync(new() { WeekFrom = new DateOnly(2026, 6, 22) }, ["Admin"]);
        excluded.PendingSourceChangesCount.Should().Be(0);
        excluded.AwaitingWarehouseBatchesCount.Should().Be(0);
        excluded.PendingDeltasCount.Should().Be(0);
        var exact = await service.GetOperationalSummaryAsync(new() { CustomerId = GuidHelper.ToGuidString(fixture.CustomerId), WeekFrom = new DateOnly(2026, 6, 15), WeekTo = new DateOnly(2026, 6, 15) }, ["Admin"]);
        exact.PendingSourceChangesCount.Should().Be(2);
        exact.AwaitingWarehouseBatchesCount.Should().Be(1);
        var reversed = () => service.GetOperationalSummaryAsync(new() { WeekFrom = new DateOnly(2026, 6, 22), WeekTo = new DateOnly(2026, 6, 15) }, ["Admin"]);
        await reversed.Should().ThrowAsync<IPCManagement.Api.Exceptions.BusinessRuleException>();
        for (var index = 0; index < 21; index++)
            context.Menuamendments.Add(new MenuAmendment
            {
                MenuAmendmentId = GuidHelper.NewId(), CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
                Status = "PENDING_REVIEW", Reason = $"Yêu cầu {index}", CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow, ImpactSnapshotJson = "{}"
            });
        await context.SaveChangesAsync();
        var boundedQueue = await service.GetOperationalSummaryAsync(new(), ["Admin"]);
        boundedQueue.PendingSourceChangesCount.Should().Be(23);
        boundedQueue.Items.Count(item => item.QueueType == "PENDING_SOURCE_CHANGE").Should().Be(10);
        boundedQueue.QueueCounts["PENDING_SOURCE_CHANGE"].Should().Be(23);
        boundedQueue.QueueTotalPages.Should().Be(3);
        var secondQueue = await service.GetOperationalSummaryAsync(new() { QueuePage = 2 }, ["Admin"]);
        secondQueue.Items.Where(item => item.QueueType == "PENDING_SOURCE_CHANGE").Should().HaveCount(10)
            .And.NotContain(item => boundedQueue.Items.Any(first => first.WorkObjectId == item.WorkObjectId));
        var thirdQueue = await service.GetOperationalSummaryAsync(new() { QueuePage = 3 }, ["Admin"]);
        thirdQueue.Items.Count(item => item.QueueType == "PENDING_SOURCE_CHANGE").Should().Be(3);
    }

    [Fact]
    public async Task TransactionsHistory_Returns_Issues_And_Returns_With_Zero_Fabricated_Prices()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();

        var menuVersion = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(menuVersion);
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
        });

        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = issueId, IssueCode = "PX-MRX-HIST", IssueDate = new DateOnly(2025, 12, 31),
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batchId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = issueLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    RequestedQty = 10m, IssuedQty = 10m,
                }
            ]
        });

        context.Inventoryreturns.Add(new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-MRX-HIST", ReturnDate = new DateOnly(2026, 1, 1),
            ReturnType = "RETURN", WarehouseId = fixture.WarehouseId, IssueId = issueId,
            Reason = "Thừa nguyên liệu", CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryreturnlines =
            [
                new InventoryReturnLine
                {
                    ReturnLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    SourceIssueLineId = issueLineId, Quantity = 2m
                }
            ]
        });

        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = fixture.UserId,
            BusinessArea = "Inventory", EntityName = nameof(InventoryIssueLine), EntityId = issueLineId,
            FieldName = nameof(InventoryIssueLine.IssuedQty), OldValue = "8", NewValue = "10", Reason = "Xuất bù hao hụt sơ chế"
        });

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var report = await service.GetTransactionsHistoryAsync(
            GuidHelper.ToGuidString(batchId), new DateOnly(2025, 12, 31), new DateOnly(2026, 1, 1),
            new PagedRequestDto { PageNumber = 1, PageSize = 1 });

        report.TotalCount.Should().Be(2);
        report.Items.Should().HaveCount(1);
        var exportRows = await CollectAsync(service.StreamTransactionsHistoryExportAsync(
            GuidHelper.ToGuidString(batchId), new DateOnly(2025, 12, 31), new DateOnly(2026, 1, 1)));
        exportRows.Should().Contain(r => r.TransactionType == "INITIAL_ISSUE" && r.DocumentCode == "PX-MRX-HIST" && r.Quantity == 10m && r.CustomerName == "Customer" && r.Reason == "Xuất bù hao hụt sơ chế");
        exportRows.Should().Contain(r => r.TransactionType == "PHYSICAL_RETURN" && r.DocumentCode == "RET-MRX-HIST" && r.Quantity == 2m && r.CustomerName == "Customer" && r.Reason == "Thừa nguyên liệu");

        await using var csv = new MemoryStream();
        await MrxReportCsvStreamWriter.WriteTransactionsAsync(
            csv,
            service.StreamTransactionsHistoryExportAsync(
                GuidHelper.ToGuidString(batchId), new DateOnly(2025, 12, 31), new DateOnly(2026, 1, 1)));
        var csvStr = Encoding.UTF8.GetString(csv.ToArray());
        csvStr.Should().Contain("PX-MRX-HIST");
        csvStr.Should().Contain("RET-MRX-HIST");
        csvStr.Should().Contain("Xuất ban đầu");
        csvStr.Should().Contain("Nhập trả kho");
        csvStr.Should().NotContain("UnitPrice");
        csvStr.Should().NotContain("PriceTier");
        var controller = new IPCManagement.Api.Features.Reconciliation.Controllers.ReconciliationReportWorkbooksController(batches, service);
        var download = Assert.IsType<Microsoft.AspNetCore.Mvc.FileStreamResult>(await controller.ExportTransactionsHistoryXlsx(GuidHelper.ToGuidString(batchId), new DateOnly(2025, 12, 31), new DateOnly(2026, 1, 1), default));
        await using (download.FileStream)
        using (var zip = new System.IO.Compression.ZipArchive(download.FileStream, System.IO.Compression.ZipArchiveMode.Read))
        using (var sheet = new StreamReader(zip.GetEntry("xl/worksheets/sheet1.xml")!.Open()))
        {
            var content = await sheet.ReadToEndAsync();
            content.Should().Contain("PX-MRX-HIST").And.Contain("RET-MRX-HIST");
        }

        var reversed = () => service.GetTransactionsHistoryAsync(
            GuidHelper.ToGuidString(batchId), new DateOnly(2026, 1, 2), new DateOnly(2026, 1, 1),
            new PagedRequestDto());
        await reversed.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task VarianceRegister_subtracts_received_returns_and_ignores_invalidated_disposition()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var dailyLineId = GuidHelper.NewId();
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var serviceDate = new DateOnly(2026, 6, 15);

        var menuVersionVar = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId, WeekStartDate = serviceDate,
            VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(menuVersionVar);

        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersionVar.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 10m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines =
                    [
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = dailyLineId, BatchLineId = lineId, BatchId = batchId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate, RequiredQuantity = 10m, Version = 1
                        }
                    ]
                }
            ]
        });

        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = issueId, IssueCode = "PX-VAR", IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batchId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = issueLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    ReconciliationBatchLineId = lineId, ReconciliationBatchDailyLineId = dailyLineId,
                    ReconciliationServiceDate = serviceDate, RequestedQty = 10m, IssuedQty = 12m
                }
            ]
        });

        context.Inventoryreturns.Add(new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-VAR", ReturnDate = serviceDate,
            ReturnType = "RETURN", WarehouseId = fixture.WarehouseId, IssueId = issueId,
            CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            ReceivedBy = fixture.UserId, ReceivedAt = DateTime.UtcNow,
            Inventoryreturnlines =
            [
                new InventoryReturnLine
                {
                    ReturnLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId, SourceIssueLineId = issueLineId, Quantity = 1m
                }
            ]
        });

        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = dailyLineId, Category = "ACCEPTED_VARIANCE",
            Reason = "Bao bì đóng gói lẻ", Version = 1, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow,
            InvalidatedAt = DateTime.UtcNow, InvalidatedBy = fixture.UserId, InvalidationReason = "Đã nhận trả kho"
        });

        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = fixture.UserId,
            BusinessArea = "Inventory", EntityName = nameof(InventoryIssueLine), EntityId = dailyLineId,
            FieldName = nameof(InventoryIssueLine.IssuedQty), OldValue = "10", NewValue = "12", Reason = "Xuất nguyên bao"
        });

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var report = await service.GetVarianceRegisterAsync(GuidHelper.ToGuidString(batchId), null);

        report.TotalCount.Should().Be(1);
        var row = report.Rows.Single();
        row.CustomerName.Should().Be("Customer");
        row.Difference.Should().Be(1m);
        row.VarianceType.Should().Be("OVER_ISSUED");
        row.DispositionCategory.Should().BeNull();
        row.DispositionReason.Should().BeNull();
        row.IssueNotes.Should().Contain("Xuất nguyên bao");

        var csvBytes = ReconciliationReportsService.BuildVarianceRegisterCsv(report.Rows);
        csvBytes.Take(3).Should().Equal(0xEF, 0xBB, 0xBF);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().NotContain("ACCEPTED_VARIANCE");
        csvStr.Should().NotContain("Bao bì đóng gói lẻ");
        csvStr.Should().Contain("Xuất nguyên bao");

        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = dailyLineId, Category = "ACCEPTED_VARIANCE",
            Reason = "Chấp nhận mới", Version = 2, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var activeDispReport = await service.GetVarianceRegisterAsync(GuidHelper.ToGuidString(batchId), null);
        activeDispReport.Rows.Single().DisposedBy.Should().NotBe(GuidHelper.ToGuidString(fixture.UserId)).And.NotBeNullOrWhiteSpace();
        var activeCsvStr = Encoding.UTF8.GetString(ReconciliationReportsService.BuildVarianceRegisterCsv(activeDispReport.Rows));
        activeCsvStr.Should().Contain("Xuất thừa");
        activeCsvStr.Should().Contain("Chấp nhận chênh lệch");

        var batchDto = await batches.GetAsync(GuidHelper.ToGuidString(batchId));
        batchDto.Should().NotBeNull();
        batchDto!.WeekStartDate.Should().Be(serviceDate);
        batchDto.WeekEndDate.Should().Be(serviceDate.AddDays(5));
        await using (var batchWorkbook = await MrxReportWorkbookExporter.BatchAsync(MrxReportWorkbookExporter.Enumerate(batchDto.Lines)))
        using (var batchZip = new System.IO.Compression.ZipArchive(batchWorkbook, System.IO.Compression.ZipArchiveMode.Read))
        using (var batchSheet = new StreamReader(batchZip.GetEntry("xl/worksheets/sheet1.xml")!.Open()))
        {
            var batchSheetXml = await batchSheet.ReadToEndAsync();
            batchSheetXml.Should().NotContain("Đã mua");
            batchSheetXml.Should().NotContain("Mua - nhu cầu");
            batchSheetXml.Should().NotContain("Mua - xuất");
        }

        var managerRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "Manager", RoleName = "Quản lý" };
        var managerUser = new User
        {
            UserId = GuidHelper.NewId(), Username = "mgr-actor", FullName = "Manager Actor", PasswordHash = "hash",
            RoleId = managerRole.RoleId, Role = managerRole, IsActive = true, CreatedAt = DateTime.UtcNow
        };
        var weekStart = new DateOnly(2026, 6, 15);
        var nextVersionId = GuidHelper.NewId();
        context.Roles.Add(managerRole);
        context.Users.Add(managerUser);
        context.Reconciliationtolerances.Add(new ReconciliationTolerance { ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        await new ReconciliationSourceRevisionService(context).StageAffectedBatchesAsync(
            GuidHelper.ToGuidString(GuidHelper.NewId()), menuVersionVar.MenuVersionId, nextVersionId,
            GuidHelper.ToGuidString(managerUser.UserId), "Quản lý duyệt sửa nguồn",
            [new MenuSchedule { MenuScheduleId = GuidHelper.NewId(), CustomerId = fixture.CustomerId, WeekStartDate = weekStart, ServiceDate = weekStart, ShiftName = "MORNING", MenuId = GuidHelper.NewId() }]);
        (await context.Reconciliationsourcerevisions.SingleAsync(r => r.BatchId == batchId)).AppliedByRole.Should().Be("MANAGER");

        context.Reconciliationbatchdailylines.Add(new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId,
            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
            ServiceDate = serviceDate.AddDays(1), RequiredQuantity = 1m, Version = 1
        });
        await context.SaveChangesAsync();
        var boundedExport = () => service.GetVarianceRegisterAsync(GuidHelper.ToGuidString(batchId), null, maximumDailyLines: 1);
        await boundedExport.Should().ThrowAsync<IPCManagement.Api.Exceptions.BusinessRuleException>().WithMessage("*vượt giới hạn 1 dòng nguồn*");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task CompletedRegister_requires_positive_evidence_but_not_retained_zero_evidence(bool hasPositiveEvidence)
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var dailyLineId = GuidHelper.NewId();
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var serviceDate = new DateOnly(2026, 6, 15);
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "COMPLETED", Version = 5, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            CompletedBy = fixture.UserId, CompletedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 10m, FrozenTolerance = 0m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines =
                    [
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = dailyLineId, BatchLineId = lineId, BatchId = batchId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate, RequiredQuantity = 10m, Version = 1
                        },
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate.AddDays(1), RequiredQuantity = 0m, Version = 2
                        }
                    ]
                }
            ]
        });
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = issueId, IssueCode = "PX-COMPLETED", IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batchId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = issueLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    ReconciliationBatchLineId = lineId, ReconciliationBatchDailyLineId = dailyLineId,
                    ReconciliationServiceDate = serviceDate, RequestedQty = 10m, IssuedQty = 12m
                }
            ]
        });
        context.Inventoryreturns.Add(new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-COMPLETED", ReturnDate = serviceDate,
            ReturnType = "RETURN", WarehouseId = fixture.WarehouseId, IssueId = issueId,
            CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            ReceivedBy = fixture.UserId, ReceivedAt = DateTime.UtcNow,
            Inventoryreturnlines =
            [
                new InventoryReturnLine
                {
                    ReturnLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId, SourceIssueLineId = issueLineId, Quantity = 1m
                }
            ]
        });
        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = dailyLineId, Category = "ACCEPTED_VARIANCE",
            Reason = "Chấp nhận lệch", Version = 1, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationReportsService(
            context,
            new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext),
            requestContext);

        if (!hasPositiveEvidence)
        {
            var issueLine = await context.Inventoryissuelines.SingleAsync(line => line.IssueLineId == issueLineId);
            issueLine.ReconciliationBatchDailyLineId = null;
            await context.SaveChangesAsync();
        }
        var row = (await service.GetCompletedRegisterAsync(new PagedRequestDto { PageNumber = 1, PageSize = 50 })).Rows.Single();

        row.WeekEndDate.Should().Be(row.WeekStartDate.AddDays(5));
        row.TotalRequired.Should().Be(10m);
        row.QuantityUnitName.Should().Be("kg");
        if (hasPositiveEvidence)
        {
            row.TotalIssued.Should().Be(11m);
            row.TotalVariance.Should().Be(1m);
        }
        else
        {
            row.TotalIssued.Should().BeNull();
            row.TotalVariance.Should().BeNull();
        }
        (await context.Reconciliationbatchdailylines.CountAsync()).Should().Be(2);
        if (hasPositiveEvidence)
        {
            var litre = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "L", UnitName = "Lít", ConvertRateToBase = 1m };
            var oil = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "OIL-L", IngredientName = "Dầu", UnitId = litre.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true };
            context.Units.Add(litre);
            context.Ingredients.Add(oil);
            context.Reconciliationbatchlines.Add(new ReconciliationBatchLine
            {
                BatchLineId = GuidHelper.NewId(), BatchId = batchId, IngredientId = oil.IngredientId,
                CanonicalUnitId = litre.UnitId, RequiredQuantity = 2m, FrozenTolerance = 0,
                ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
            });
            await context.SaveChangesAsync();
            var mixed = (await service.GetCompletedRegisterAsync(new PagedRequestDto { PageNumber = 1, PageSize = 50 })).Rows.Single();
            mixed.QuantityUnitName.Should().BeNull();
            await using var workbook = await MrxReportWorkbookExporter.CompletedAsync(MrxReportWorkbookExporter.Enumerate(new[] { mixed }));
            using var archive = new System.IO.Compression.ZipArchive(workbook, System.IO.Compression.ZipArchiveMode.Read);
            using var sheet = archive.GetEntry("xl/worksheets/sheet1.xml")!.Open();
            var xml = System.Xml.Linq.XDocument.Load(sheet);
            System.Xml.Linq.XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            var cells = xml.Descendants(ns + "row").Last().Elements(ns + "c").ToArray();
            cells.Skip(8).Take(3).Should().OnlyContain(cell => !cell.Elements(ns + "v").Any());
            cells[11].Value.Should().Be("Xem chi tiết theo đơn vị");
        }
    }

    [Fact]
    public async Task CompletedRegister_does_not_fabricate_totals_for_missing_daily_lineage()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var completedBatchId = GuidHelper.NewId();
        var transferredBatchId = GuidHelper.NewId();

        context.Reconciliationbatches.AddRange(
            new ReconciliationBatch { BatchId = completedBatchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "COMPLETED", Version = 5, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow, CompletedBy = fixture.UserId, CompletedAt = DateTime.UtcNow },
            new ReconciliationBatch { BatchId = transferredBatchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "TRANSFERRED", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow }
        );

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var report = await service.GetCompletedRegisterAsync(new PagedRequestDto { PageNumber = -1, PageSize = 1000 });

        report.TotalCount.Should().Be(1);
        var row = report.Rows.Single();
        row.BatchId.Should().Be(GuidHelper.ToGuidString(completedBatchId));
        ((object?)row.TotalIssued).Should().BeNull();
        ((object?)row.TotalVariance).Should().BeNull();

        var csvBytes = ReconciliationReportsService.BuildCompletedRegisterCsv(report.Rows);
        csvBytes.Take(3).Should().Equal(0xEF, 0xBB, 0xBF);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().Contain(GuidHelper.ToGuidString(completedBatchId));
        csvStr.Should().Contain(",0,0,,");
        csvStr.Should().NotContain(GuidHelper.ToGuidString(transferredBatchId));
        var completedAt = DateTime.UtcNow.AddMinutes(-1);
        for (var index = 0; index < 101; index++)
            context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "COMPLETED", Version = 1, CreatedBy = fixture.UserId, CreatedAt = completedAt, CompletedAt = completedAt, CompletedBy = fixture.UserId });
        await context.SaveChangesAsync();
        var full = await CollectAsync(service.StreamCompletedRegisterExportAsync());
        full.Should().HaveCount(102);
        full.Select(item => item.BatchId).Distinct().Should().HaveCount(102);
        full.Should().NotContain(item => item.BatchId == GuidHelper.ToGuidString(transferredBatchId));
        full.Should().OnlyContain(item => item.TotalIssued == null && item.TotalVariance == null);
    }

    [Fact]
    public async Task Audit_table_is_paged_while_csv_contains_full_typed_batch_scope()
    {
        await using var context = new IpcManagementContext(
            new DbContextOptionsBuilder<IpcManagementContext>()
                .UseInMemoryDatabase($"mrx-audit-report-{Guid.NewGuid():N}")
                .Options);
        var actorId = GuidHelper.NewId();
        var role = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
        context.Roles.Add(role);
        context.Users.Add(new User
        {
            UserId = actorId, Username = "audit-actor", FullName = "Audit Actor", PasswordHash = "hash",
            RoleId = role.RoleId, Role = role, IsActive = true, CreatedAt = DateTime.UtcNow
        });

        var batchId = GuidHelper.NewId();
        var previousMenuVersionId = GuidHelper.NewId();
        var menuVersionId = GuidHelper.NewId();
        var amendmentId = GuidHelper.NewId();
        var revisionId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 2, CreatedBy = actorId, CreatedAt = DateTime.UtcNow
        });
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = scheduleId, MenuVersionId = menuVersionId, CustomerId = GuidHelper.NewId(),
            WeekStartDate = new DateOnly(2026, 6, 15), ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", MenuId = GuidHelper.NewId(), Status = "PUBLISHED"
        });
        context.Menuamendments.Add(new MenuAmendment
        {
            MenuAmendmentId = amendmentId, CustomerId = GuidHelper.NewId(), WeekStartDate = new DateOnly(2026, 6, 15),
            Reason = "Đổi món nguồn", Status = "EXECUTED", ImpactSnapshotJson = "{}", CreatedBy = actorId, CreatedAt = DateTime.UtcNow
        });
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision
        {
            SourceRevisionId = revisionId, BatchId = batchId, RevisionNumber = 1,
            PreviousMenuVersionId = previousMenuVersionId, AppliedMenuVersionId = menuVersionId, MenuAmendmentId = amendmentId,
            ApplyMode = "DECISION", AppliedBy = actorId, AppliedByRole = "ADMIN", AppliedAt = DateTime.UtcNow, Reason = "Đổi món nguồn"
        });
        var defaultIssueId = GuidHelper.NewId();
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = defaultIssueId, IssueCode = "DEFAULT-AUDIT", IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = GuidHelper.NewId(), IssuedBy = actorId, CreatedAt = DateTime.UtcNow
        });

        context.Auditlogs.AddRange(
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-1), ChangedBy = actorId,
                BusinessArea = "Reconciliation", EntityName = nameof(ReconciliationBatch), EntityId = batchId,
                FieldName = "Status", OldValue = "DRAFT", NewValue = "READY", Reason = "Coordinator chuyển trạng thái"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId,
                BusinessArea = "RECONCILIATION", EntityName = nameof(ReconciliationBatch), EntityId = batchId,
                FieldName = "Status", OldValue = "READY", NewValue = "IN_PROGRESS", Reason = "Kho bắt đầu xuất"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-2), ChangedBy = actorId,
                BusinessArea = "Coordination", EntityName = nameof(MenuVersion), EntityId = previousMenuVersionId,
                FieldName = "Status", OldValue = "DRAFT", NewValue = "PUBLISHED", Reason = "Phát hành thực đơn"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-1), ChangedBy = actorId,
                BusinessArea = "RECONCILIATION", EntityName = nameof(MenuAmendment), EntityId = amendmentId,
                FieldName = "Status", OldValue = "PENDING_REVIEW", NewValue = "EXECUTED", Reason = "Đổi món nguồn"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-1), ChangedBy = actorId,
                BusinessArea = "RECONCILIATION", EntityName = nameof(MenuSchedule), EntityId = scheduleId,
                FieldName = "DishId", OldValue = "Món cũ", NewValue = "Món mới", Reason = "Đổi món nguồn"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId,
                BusinessArea = "Inventory", EntityName = nameof(InventoryIssue), EntityId = defaultIssueId,
                FieldName = "Status", NewValue = "ISSUED", Reason = "DEFAULT không thuộc MRX"
            });

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var sourceChanges = await batches.ListSourceChangesAsync(GuidHelper.ToGuidString(batchId));
        sourceChanges.Should().Contain(c => c.EntityName == nameof(MenuVersion) && c.Actor == "Audit Actor");
        sourceChanges.Should().Contain(c => c.EntityName == nameof(MenuAmendment) && c.Reason == "Đổi món nguồn");
        sourceChanges.Should().Contain(c => c.EntityName == nameof(MenuSchedule) && c.FieldName == "DishId" && c.NewValue == "Món mới");

        var report = await service.GetAuditTrailAsync(
            GuidHelper.ToGuidString(batchId), new PagedRequestDto { PageNumber = -1, PageSize = 1 });

        report.TotalCount.Should().Be(5);
        report.Rows.Should().ContainSingle();
        report.Rows.Single().Reason.Should().Be("Kho bắt đầu xuất");

        var searched = await service.GetAuditTrailAsync(GuidHelper.ToGuidString(batchId),
            new PagedRequestDto { PageNumber = 1, PageSize = 1, SearchKeyword = "Coordinator" });
        searched.TotalCount.Should().Be(1);
        searched.Rows.Single().Reason.Should().Be("Coordinator chuyển trạng thái");
        var sourceFirst = await batches.GetSourceChangesPageAsync(GuidHelper.ToGuidString(batchId), new PagedRequestDto { PageSize = 1 });
        var sourceSecond = await batches.GetSourceChangesPageAsync(GuidHelper.ToGuidString(batchId), new PagedRequestDto { PageSize = 1, PageNumber = 2 });
        sourceFirst.TotalCount.Should().Be(sourceChanges.Count);
        sourceFirst.Items.Should().HaveCount(1);
        sourceSecond.Items.Should().HaveCount(1);
        sourceFirst.Items.Single().ChangeId.Should().NotBe(sourceSecond.Items.Single().ChangeId);

        var exportRows = await CollectAsync(service.StreamAuditTrailExportAsync(GuidHelper.ToGuidString(batchId)));
        exportRows.Should().HaveCount(5);
        exportRows.Should().Contain(row => row.Reason == "Coordinator chuyển trạng thái");
        exportRows.Should().Contain(row => row.Reason == "Kho bắt đầu xuất");
        exportRows.Should().NotContain(row => row.Reason == "DEFAULT không thuộc MRX");

        await using var csv = new MemoryStream();
        await MrxReportCsvStreamWriter.WriteAuditAsync(
            csv,
            service.StreamAuditTrailExportAsync(GuidHelper.ToGuidString(batchId)));
        var csvStr = Encoding.UTF8.GetString(csv.ToArray());
        csvStr.Should().Contain("ReconciliationBatch");
        csvStr.Should().Contain("Coordinator chuyển trạng thái");
        csvStr.Should().Contain("Kho bắt đầu xuất");
        csvStr.Should().NotContain("DEFAULT không thuộc MRX");
    }
}
