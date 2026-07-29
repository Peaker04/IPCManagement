using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var orphanRequestId = GuidHelper.NewId();
        var stalePurchaseRequestId = GuidHelper.NewId();
        var stalePurchaseRequestLineId = GuidHelper.NewId();
        var activeDraftPurchaseRequestId = GuidHelper.NewId();
        var orphanIssueId = GuidHelper.NewId();

        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = orphanRequestId,
            RequestCode = "MR-CLEANUP-ORPHAN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = stalePurchaseRequestId,
            PurchaseRequestCode = "PR-CLEANUP-STALE",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequestlines.Add(new PurchaseRequestLine
        {
            PurchaseRequestLineId = stalePurchaseRequestLineId,
            PurchaseRequestId = stalePurchaseRequestId,
            MaterialRequestLineId = GuidHelper.NewId(),
            IngredientId = fixture.IngredientId,
            SupplierId = fixture.SupplierId,
            UnitId = fixture.UnitId,
            RequiredQty = 2,
            CurrentStockQty = 0,
            PurchaseQty = 2,
            EstimatedUnitPrice = 1000
        });
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = activeDraftPurchaseRequestId,
            PurchaseRequestCode = "PR-ACTIVE-DRAFT",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        });
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = orphanIssueId,
            IssueCode = "ISS-CLEANUP-ORPHAN",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });
        context.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = orphanIssueId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            RequestedQty = 1,
            IssuedQty = 1
        });
        await context.SaveChangesAsync();

        var commandService = new DataQualityCommandService(context);
        var dryRun = await commandService.CleanupDataQualityAsync(new DataQualityCleanupRequest
        {
            DryRun = true,
            Limit = 20
        }, fixture.UserIdString);

        dryRun.DryRun.Should().BeTrue();
        dryRun.TotalActions.Should().BeGreaterThanOrEqualTo(3);
        dryRun.RemovedMaterialRequests.Should().Be(1);
        dryRun.RemovedPurchaseRequests.Should().Be(1);
        dryRun.RemovedPurchaseRequestLines.Should().Be(1);
        dryRun.RemovedInventoryIssues.Should().Be(1);
        dryRun.RemovedInventoryIssueLines.Should().Be(1);
        dryRun.AuditLogCount.Should().Be(0);
        (await context.Materialrequests.AnyAsync(request => request.RequestId == orphanRequestId)).Should().BeTrue();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == stalePurchaseRequestId)).Should().BeTrue();
        (await context.Inventoryissues.AnyAsync(issue => issue.IssueId == orphanIssueId)).Should().BeTrue();

        var applied = await commandService.CleanupDataQualityAsync(new DataQualityCleanupRequest
        {
            DryRun = false,
            Limit = 20,
            Note = "PRD-142 cleanup"
        }, fixture.UserIdString);

        applied.DryRun.Should().BeFalse();
        applied.TotalActions.Should().BeGreaterThanOrEqualTo(3);
        applied.RemovedMaterialRequests.Should().Be(1);
        applied.RemovedPurchaseRequests.Should().Be(1);
        applied.RemovedPurchaseRequestLines.Should().Be(1);
        applied.RemovedInventoryIssues.Should().Be(1);
        applied.RemovedInventoryIssueLines.Should().Be(1);
        applied.AuditLogCount.Should().Be(applied.TotalActions);

        (await context.Materialrequests.AnyAsync(request => request.RequestId == orphanRequestId)).Should().BeFalse();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == stalePurchaseRequestId)).Should().BeFalse();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == activeDraftPurchaseRequestId)).Should().BeTrue();
        (await context.Purchaserequestlines.AnyAsync(line => line.PurchaseRequestLineId == stalePurchaseRequestLineId)).Should().BeFalse();
        (await context.Inventoryissues.AnyAsync(issue => issue.IssueId == orphanIssueId)).Should().BeFalse();
        (await context.Inventoryissuelines.AnyAsync(line => line.IssueId == orphanIssueId)).Should().BeFalse();
        (await context.Auditlogs.CountAsync(log =>
            log.BusinessArea == "DataQuality" &&
            log.FieldName == "Cleanup" &&
            log.Reason != null &&
            log.Reason.Contains("PRD-142 cleanup"))).Should().Be(applied.AuditLogCount);

        var report = await new DataQualityReportService(context).GetDataQualityAsync(new WorkflowReportQueryDto
        {
            ServiceDate = "2026-06-15",
            Limit = 100
        });
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("MR-CLEANUP-ORPHAN");
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("PR-CLEANUP-STALE");
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("ISS-CLEANUP-ORPHAN");
    }

    [Fact]
    public async Task DataQualityReport_Should_ShowPendingUnitResearchAsWarning_NotActiveConversionError()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var sourceUnitId = GuidHelper.NewId();
        context.Units.Add(new Unit
        {
            UnitId = sourceUnitId,
            UnitCode = "RESEARCH_BOX",
            UnitName = "Research box",
            BaseUnitCode = "RESEARCH_BOX",
            ConvertRateToBase = 1,
        });
        context.Unitnormalizationreviews.Add(new UnitNormalizationReview
        {
            ReviewId = GuidHelper.NewId(),
            IngredientId = fixture.IngredientId,
            SourceUnitId = sourceUnitId,
            CatalogUnitId = fixture.UnitId,
            RecommendedUnitId = fixture.UnitId,
            ObservedStockQty = 5,
            SourceReceiptCount = 3,
            CatalogReceiptCount = 1,
            BomLineCount = 1,
            ProposedSourceToCatalogFactor = null,
            Confidence = "BLOCKED",
            Status = "NEEDS_CONFIRMATION",
            EvidenceSource = "Regression evidence",
            EvidenceNote = "Supplier package label is still required.",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();

        var report = await new DataQualityReportService(context).GetDataQualityAsync(
            new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 100 });

        var reviewIssue = report.Issues.Should().ContainSingle(issue =>
            issue.Category == "unit_normalization_review").Subject;
        reviewIssue.Severity.Should().Be("warning");
        reviewIssue.Message.Should().Contain("chưa đủ bằng chứng");
        report.MissingConversionCount.Should().Be(0);
    }

    [Fact]
    public async Task DataQualityCleanup_Should_BaselineLegacyLedger_AndNormalizeZeroStockUnit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var importedAt = new DateTime(2026, 6, 18, 14, 29, 30, DateTimeKind.Utc);
        var legacyUnitId = GuidHelper.NewId();
        var decoyIngredientId = GuidHelper.NewId();
        var zeroIngredientId = GuidHelper.NewId();
        context.Units.Add(new Unit
        {
            UnitId = legacyUnitId,
            UnitCode = "LEGACY_BOX",
            UnitName = "Legacy box",
            BaseUnitCode = "BOX",
            ConvertRateToBase = 1
        });
        context.Ingredients.AddRange(
            new Ingredient
            {
                IngredientId = decoyIngredientId,
                IngredientCode = "AAA-NO-CLEANUP",
                IngredientName = "No cleanup needed",
                UnitId = fixture.UnitId,
                WarehouseId = fixture.WarehouseId,
                ReferencePrice = 0,
                IsFreshDaily = false,
                IsActive = true
            },
            new Ingredient
            {
                IngredientId = zeroIngredientId,
                IngredientCode = "ING-ZERO-UNIT",
                IngredientName = "Zero stock legacy unit",
                UnitId = fixture.UnitId,
                WarehouseId = fixture.WarehouseId,
                ReferencePrice = 0,
                IsFreshDaily = false,
                IsActive = true
            });
        context.Currentstocks.AddRange(
            new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = decoyIngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 1,
                LastUpdated = importedAt,
                RowVersion = importedAt
            },
            new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 8,
                LastUpdated = importedAt,
                RowVersion = importedAt
            },
            new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = zeroIngredientId,
                UnitId = legacyUnitId,
                CurrentQty = 1,
                LastUpdated = importedAt,
                RowVersion = importedAt
            });
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = importedAt.AddDays(-1),
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            MovementType = "RECEIPT",
            QuantityIn = 10,
            QuantityOut = 0,
            BeforeQty = 0,
            AfterQty = 10,
            PerformedBy = fixture.UserId,
            Reason = "Legacy receipt"
        });
        await context.SaveChangesAsync();
        var decoyStock = await context.Currentstocks.SingleAsync(stock => stock.IngredientId == decoyIngredientId);
        decoyStock.CurrentQty = 0;
        var zeroStock = await context.Currentstocks.SingleAsync(stock => stock.IngredientId == zeroIngredientId);
        zeroStock.CurrentQty = 0;
        await context.SaveChangesAsync();

        var commandService = new DataQualityCommandService(context);
        var request = new DataQualityCleanupRequest
        {
            DryRun = true,
            Limit = 1,
            Categories = ["inventory_ledger_baseline", "zero_stock_unit"],
            Note = "legacy cleanup regression"
        };
        var dryRun = await commandService.CleanupDataQualityAsync(request, fixture.UserIdString);

        dryRun.TotalActions.Should().Be(2);
        dryRun.AuditLogCount.Should().Be(0);
        dryRun.Actions.Select(action => action.Category).Should().BeEquivalentTo(
            ["inventory_ledger_baseline", "zero_stock_unit"]);
        (await context.Stockmovements.CountAsync()).Should().Be(1);
        (await context.Currentstocks.SingleAsync(stock => stock.IngredientId == zeroIngredientId))
            .UnitId.Should().Equal(legacyUnitId);

        request.DryRun = false;
        var applied = await commandService.CleanupDataQualityAsync(request, fixture.UserIdString);

        applied.TotalActions.Should().Be(2);
        applied.AuditLogCount.Should().Be(2);
        var baseline = await context.Stockmovements.SingleAsync(movement =>
            movement.RefTable == "LEGACY_CURRENTSTOCK_BASELINE");
        baseline.QuantityIn.Should().Be(0);
        baseline.QuantityOut.Should().Be(2);
        baseline.BeforeQty.Should().Be(10);
        baseline.AfterQty.Should().Be(8);
        (await context.Currentstocks.SingleAsync(stock => stock.IngredientId == zeroIngredientId))
            .UnitId.Should().Equal(fixture.UnitId);

        var ledger = await new StockLedgerReportService(context)
            .GetStockLedgerReconciliationAsync(new WorkflowReportQueryDto { Limit = 20 });
        ledger.Single(row => row.IngredientId == fixture.IngredientIdString).IsMatched.Should().BeTrue();
    }

    [Fact]
    public async Task StockLedgerReconciliation_Should_ReportCurrentStockMismatch()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 8m,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow
        });
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow.AddMinutes(-5),
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            MovementType = "RECEIPT",
            QuantityIn = 10m,
            QuantityOut = 0m,
            PerformedBy = fixture.UserId,
            Reason = "Seed ledger",
            Note = "Ledger should recompute to 10"
        });
        await context.SaveChangesAsync();

        var ledgerService = new StockLedgerReportService(context);
        var rows = await ledgerService.GetStockLedgerReconciliationAsync(new WorkflowReportQueryDto { Limit = 10 });
        var mismatch = rows.Should().ContainSingle().Subject;
        mismatch.CurrentQty.Should().Be(8m);
        mismatch.LedgerQty.Should().Be(10m);
        mismatch.DifferenceQty.Should().Be(-2m);
        mismatch.IsMatched.Should().BeFalse();

        var report = await new DataQualityReportService(context)
            .GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });
        report.Issues.Should().Contain(issue =>
            issue.Category == "inventory_ledger_mismatch" &&
            issue.Message.Contains("Current stock 8"));
    }

    [Fact]
    public async Task StockLedgerReconciliation_Should_PreserveCurrentOnlyKey()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 4m,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var row = (await new StockLedgerReportService(context).GetStockLedgerReconciliationAsync(
            new WorkflowReportQueryDto { Limit = 10 })).Should().ContainSingle().Subject;

        row.CurrentQty.Should().Be(4m);
        row.LedgerQty.Should().Be(0m);
        row.DifferenceQty.Should().Be(4m);
        row.LastMovementAt.Should().BeNull();
    }

    [Fact]
    public async Task StockLedgerReconciliation_Should_PreserveMovementOnlyKey_AndUseLatestMovementUnit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var alternateUnitId = GuidHelper.NewId();
        context.Units.Add(new Unit
        {
            UnitId = alternateUnitId,
            UnitCode = "ALT",
            UnitName = "Đơn vị mới nhất",
            BaseUnitCode = "ALT",
            ConvertRateToBase = 1m
        });
        var movementDate = new DateTime(2026, 7, 26, 8, 0, 0, DateTimeKind.Utc);
        context.Stockmovements.AddRange(
            new StockMovement
            {
                MovementId = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                MovementDate = movementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 3m,
                PerformedBy = fixture.UserId
            },
            new StockMovement
            {
                MovementId = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
                MovementDate = movementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = alternateUnitId,
                MovementType = "ISSUE",
                QuantityOut = 1m,
                PerformedBy = fixture.UserId
            });
        await context.SaveChangesAsync();

        var row = (await new StockLedgerReportService(context).GetStockLedgerReconciliationAsync(
            new WorkflowReportQueryDto { Limit = 10 })).Should().ContainSingle().Subject;

        row.CurrentQty.Should().Be(0m);
        row.LedgerQty.Should().Be(2m);
        row.UnitId.Should().Be(GuidHelper.ToGuidString(alternateUnitId));
        row.UnitName.Should().Be("Đơn vị mới nhất");
        row.LastMovementAt.Should().Be(movementDate);
    }

    [Fact]
    public async Task StockLedgerReconciliation_Should_IgnoreSubPrecisionImportNoise()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 752.271769m,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow
        });
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow.AddMinutes(-5),
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            MovementType = "RECEIPT",
            QuantityIn = 752.271768m,
            QuantityOut = 0m,
            PerformedBy = fixture.UserId,
            Reason = "Imported ledger",
            Note = "One quantity quantum must not become an operational mismatch"
        });
        await context.SaveChangesAsync();

        var service = new DataQualityReportService(context);
        var row = (await new StockLedgerReportService(context).GetStockLedgerReconciliationAsync(
            new WorkflowReportQueryDto { Limit = 10 })).Should().ContainSingle().Subject;

        row.DifferenceQty.Should().Be(0.000001m);
        row.IsMatched.Should().BeTrue();

        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });
        report.Issues.Should().NotContain(issue => issue.Category == "inventory_ledger_mismatch");
    }

    [Fact]
    public async Task DataQualityPage_Should_SearchAcrossIssueFieldsBeforePaging()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);
        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 5m,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var page = await new DataQualityReportService(context).GetDataQualityPageAsync(
            new DataQualityPageQueryDto
            {
                PageNumber = 1,
                PageSize = 50,
                SearchKeyword = "inventory_ledger"
            });

        page.TotalIssues.Should().BeGreaterThan(page.Page.TotalCount);
        page.Page.Items.Should().NotBeEmpty();
        page.Page.Items.Should().OnlyContain(issue =>
            issue.Category.Contains("inventory_ledger", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task StockSnapshot_Should_GenerateMonthlyOpeningInOutAndClosing_FromLedgerSnapshots()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Stockmovements.AddRange(
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 6, 30, 17, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId
            },
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 7, 5, 8, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 4m,
                BeforeQty = 10m,
                AfterQty = 6m,
                PerformedBy = fixture.UserId
            },
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 7, 12, 8, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 5m,
                QuantityOut = 0m,
                BeforeQty = 6m,
                AfterQty = 11m,
                PerformedBy = fixture.UserId
            });
        await context.SaveChangesAsync();

        var service = new StockSnapshotReportService(context);
        var snapshots = await service.GenerateMonthlyStockSnapshotAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            Limit = 10
        });

        var snapshot = snapshots.Should().ContainSingle().Subject;
        snapshot.PeriodMonth.Should().Be(new DateOnly(2026, 7, 1));
        snapshot.OpeningQty.Should().Be(10m);
        snapshot.QuantityIn.Should().Be(5m);
        snapshot.QuantityOut.Should().Be(4m);
        snapshot.ClosingQty.Should().Be(11m);

        var persisted = await context.Stocksnapshots.AsNoTracking().SingleAsync();
        persisted.OpeningQty.Should().Be(10m);
        persisted.QuantityIn.Should().Be(5m);
        persisted.QuantityOut.Should().Be(4m);
        persisted.ClosingQty.Should().Be(11m);
    }

    [Fact]
    public async Task StockMovements_Should_DefaultToRecentDateWindow_AndAllowExplicitHistoryRange()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var oldMovementDate = DateTime.UtcNow.Date.AddDays(-40).AddHours(8);
        var recentMovementDate = DateTime.UtcNow.Date.AddDays(-1).AddHours(8);
        context.Stockmovements.AddRange(
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = oldMovementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId,
                Note = "old"
            },
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = recentMovementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 2m,
                BeforeQty = 10m,
                AfterQty = 8m,
                PerformedBy = fixture.UserId,
                Note = "recent"
            });
        await context.SaveChangesAsync();

        var service = new StockMovementReportService(context);
        var defaultRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto { Limit = 10 });

        defaultRows.Should().ContainSingle(row => row.Note == "recent");
        defaultRows.Should().NotContain(row => row.Note == "old");

        var filteredRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            MovementType = "issue",
            Limit = 10
        });

        filteredRows.Should().ContainSingle(row => row.Note == "recent");
        filteredRows.Should().OnlyContain(row => row.MovementType == "ISSUE");

        var explicitRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = DateOnly.FromDateTime(oldMovementDate).ToString("yyyy-MM-dd"),
            DateTo = DateOnly.FromDateTime(recentMovementDate).ToString("yyyy-MM-dd"),
            Limit = 10
        });

        explicitRows.Select(row => row.Note).Should().BeEquivalentTo("old", "recent");
    }

    [Fact]
    public async Task StockMovements_Should_PageWithCursorDate_WithoutOffset()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var baseDate = new DateTime(2026, 7, 10, 8, 0, 0, DateTimeKind.Utc);
        context.Stockmovements.AddRange(
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId,
                Note = "newest"
            },
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate.AddDays(-1),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 2m,
                BeforeQty = 10m,
                AfterQty = 8m,
                PerformedBy = fixture.UserId,
                Note = "cursor"
            },
            new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate.AddDays(-2),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RETURN",
                QuantityIn = 1m,
                QuantityOut = 0m,
                BeforeQty = 8m,
                AfterQty = 9m,
                PerformedBy = fixture.UserId,
                Note = "older"
            });
        await context.SaveChangesAsync();

        var service = new StockMovementReportService(context);
        var firstPage = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            Limit = 2
        });

        firstPage.Select(row => row.Note).Should().Equal("newest", "cursor");

        var secondPage = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            CursorDate = firstPage.Last().MovementDate.ToString("O"),
            CursorId = firstPage.Last().MovementId,
            Limit = 2
        });

        secondPage.Should().ContainSingle(row => row.Note == "older");
        secondPage.Should().NotContain(row => row.Note == "newest" || row.Note == "cursor");

        var firstCursorPage = await service.GetStockMovementPageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            Limit = 2
        });

        firstCursorPage.Items.Select(row => row.Note).Should().Equal("newest", "cursor");
        firstCursorPage.HasNext.Should().BeTrue();
        firstCursorPage.NextCursorDate.Should().NotBeNullOrWhiteSpace();

        var ascendingCursorPage = await service.GetStockMovementPageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            SortDirection = "asc",
            Limit = 2
        });

        ascendingCursorPage.Items.Select(row => row.Note).Should().Equal("older", "cursor");
        ascendingCursorPage.HasNext.Should().BeTrue();
    }

}
