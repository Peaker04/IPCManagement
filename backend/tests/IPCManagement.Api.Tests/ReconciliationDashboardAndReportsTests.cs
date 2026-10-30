using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationDashboardAndReportsTests
{
    private static async Task EnsureSchemaAsync(IpcManagementContext context) => await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcedeltas (SourceDeltaId BLOB PRIMARY KEY, SourceRevisionId BLOB NOT NULL, BatchId BLOB NOT NULL, DailyLineId BLOB NULL, ServiceDate TEXT NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL, PreviousRequiredQuantity TEXT NOT NULL, NewRequiredQuantity TEXT NOT NULL, DeltaQuantity TEXT NOT NULL, WorkKind TEXT NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ResolvedAt TEXT NULL, ResolvedBy BLOB NULL, ResolutionEntity TEXT NULL, ResolutionId BLOB NULL, ResolutionCommandId TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdailydispositions (dispositionId BLOB PRIMARY KEY, dailyLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL);
        """);

    [Fact]
    public async Task OperationalSummary_Returns_Exact_Counts_And_Links_To_Real_Work_Objects()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
        });

        var amendmentId = GuidHelper.NewId();
        context.Menuamendments.Add(new MenuAmendment
        {
            MenuAmendmentId = amendmentId, CustomerId = fixture.CustomerId, WeekStartDate = new DateOnly(2026, 6, 15),
            Status = "PENDING_REVIEW", Reason = "Điều chỉnh số suất", CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
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

        var summary = await service.GetOperationalSummaryAsync();

        summary.PendingSourceChangesCount.Should().Be(1);
        summary.AwaitingWarehouseBatchesCount.Should().Be(1);
        summary.PendingDeltasCount.Should().Be(1);

        summary.Items.Should().Contain(i => i.QueueType == "PENDING_SOURCE_CHANGE" && i.TargetUrl.Contains(GuidHelper.ToGuidString(amendmentId)));
        summary.Items.Should().Contain(i => i.QueueType == "AWAITING_WAREHOUSE" && i.TargetUrl.Contains(GuidHelper.ToGuidString(batchId)));
        summary.Items.Should().Contain(i => i.QueueType == "PENDING_DELTA" && i.TargetUrl == "/warehouse?view=mrx-issues");
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
            IssueId = issueId, IssueCode = "PX-MRX-HIST", IssueDate = new DateOnly(2026, 6, 15),
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
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-MRX-HIST", ReturnDate = new DateOnly(2026, 6, 15),
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

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var report = await service.GetTransactionsHistoryAsync(GuidHelper.ToGuidString(batchId), null, null);

        report.TotalCount.Should().Be(2);
        report.Rows.Should().Contain(r => r.TransactionType == "INITIAL_ISSUE" && r.DocumentCode == "PX-MRX-HIST" && r.Quantity == 10m && r.CustomerName == "Customer");
        report.Rows.Should().Contain(r => r.TransactionType == "PHYSICAL_RETURN" && r.DocumentCode == "RET-MRX-HIST" && r.Quantity == 2m && r.CustomerName == "Customer");

        var csvBytes = ReconciliationReportsService.BuildTransactionsHistoryCsv(report.Rows);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().Contain("PX-MRX-HIST");
        csvStr.Should().Contain("RET-MRX-HIST");
        csvStr.Should().NotContain("UnitPrice");
        csvStr.Should().NotContain("PriceTier");
    }

    [Fact]
    public async Task VarianceRegister_Includes_Over_And_Under_Issued_Variances_And_AuditNotes()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var dailyLineId = GuidHelper.NewId();
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
            IssueId = GuidHelper.NewId(), IssueCode = "PX-VAR", IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batchId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    ReconciliationBatchLineId = lineId, ReconciliationBatchDailyLineId = dailyLineId,
                    ReconciliationServiceDate = serviceDate, RequestedQty = 10m, IssuedQty = 12m
                }
            ]
        });

        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = dailyLineId, Category = "ACCEPTED_VARIANCE",
            Reason = "Bao bì đóng gói lẻ", Version = 1, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow
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
        row.Difference.Should().Be(2m);
        row.VarianceType.Should().Be("OVER_ISSUED");
        row.DispositionCategory.Should().Be("ACCEPTED_VARIANCE");
        row.DispositionReason.Should().Be("Bao bì đóng gói lẻ");
        row.IssueNotes.Should().Contain("Xuất nguyên bao");

        var csvBytes = ReconciliationReportsService.BuildVarianceRegisterCsv(report.Rows);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().Contain("ACCEPTED_VARIANCE");
        csvStr.Should().Contain("Bao bì đóng gói lẻ");
        csvStr.Should().Contain("Xuất nguyên bao");
    }

    [Fact]
    public async Task CompletedRegister_Returns_Only_Completed_Batches()
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

        var report = await service.GetCompletedRegisterAsync(1, 50);

        report.TotalCount.Should().Be(1);
        report.Rows.Single().BatchId.Should().Be(GuidHelper.ToGuidString(completedBatchId));

        var csvBytes = ReconciliationReportsService.BuildCompletedRegisterCsv(report.Rows);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().Contain(GuidHelper.ToGuidString(completedBatchId));
        csvStr.Should().NotContain(GuidHelper.ToGuidString(transferredBatchId));
    }

    [Fact]
    public async Task AuditTrail_Reconstructs_Audit_Logs_With_Real_Actors()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();

        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = fixture.UserId,
            BusinessArea = "Reconciliation",
            EntityName = nameof(ReconciliationBatch),
            EntityId = batchId,
            FieldName = "Status",
            OldValue = "DRAFT",
            NewValue = "READY",
            Reason = "Coordinator chuyển trạng thái"
        });

        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);
        var service = new ReconciliationReportsService(context, batches, requestContext);

        var report = await service.GetAuditTrailAsync(GuidHelper.ToGuidString(batchId), 1, 50);

        report.TotalCount.Should().Be(1);
        var row = report.Rows.Single();
        row.EntityName.Should().Be(nameof(ReconciliationBatch));
        row.OldValue.Should().Be("DRAFT");
        row.NewValue.Should().Be("READY");
        row.Reason.Should().Be("Coordinator chuyển trạng thái");

        var csvBytes = ReconciliationReportsService.BuildAuditTrailCsv(report.Rows);
        var csvStr = Encoding.UTF8.GetString(csvBytes);
        csvStr.Should().Contain("ReconciliationBatch");
        csvStr.Should().Contain("Coordinator chuyển trạng thái");
    }
}
