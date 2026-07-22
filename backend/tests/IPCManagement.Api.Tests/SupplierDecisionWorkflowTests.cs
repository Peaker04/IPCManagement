using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Workflow;
using IPCManagement.DatabaseTool;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using MySqlConnector;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Data.Common;

namespace IPCManagement.Api.Tests;

public class SupplierDecisionWorkflowTests
{
    [Fact]
    public async Task Persistence_supplier_decisions_require_complete_evidence_actor_and_append_only_versions()
    {
        await using var context = CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(Purchaselinesupplierdecision));

        entity.Should().NotBeNull();
        entity!.FindProperty(nameof(Purchaselinesupplierdecision.DecisionFingerprint))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(Purchaselinesupplierdecision.Version))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(Purchaselinesupplierdecision.ConcurrencyVersion))!.IsConcurrencyToken.Should().BeTrue();
        entity.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain([
            "ckPurchaseLineSupplierDecisionsEvidenceComplete",
            "ckPurchaseLineSupplierDecisionsConfirmationComplete",
            "ckPurchaseLineSupplierDecisionsStatus",
            "ckPurchaseLineSupplierDecisionsCurrentKey"
        ]);
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(Purchaselinesupplierdecision.PurchaseRequestLineId), nameof(Purchaselinesupplierdecision.Version) }));
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(Purchaselinesupplierdecision.PurchaseRequestLineId), nameof(Purchaselinesupplierdecision.DecisionFingerprint) }));
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(Purchaselinesupplierdecision.CurrentDecisionKey) }));

        var line = model.FindEntityType(typeof(Purchaserequestline));
        line!.FindProperty(nameof(Purchaserequestline.IsLegacySupplierSnapshot))!.IsNullable.Should().BeFalse();
        line.FindNavigation(nameof(Purchaserequestline.SupplierDecisions)).Should().NotBeNull();

        var lineId = GuidHelper.NewId();
        var firstId = GuidHelper.NewId();
        var secondId = GuidHelper.NewId();
        context.Purchaselinesupplierdecisions.AddRange(
            new Purchaselinesupplierdecision
            {
                PurchaseLineSupplierDecisionId = firstId,
                PurchaseRequestLineId = lineId,
                SupplierId = GuidHelper.NewId(),
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = new DateOnly(2026, 7, 20),
                EvidenceReferencePrice = 100m,
                ProposedUnitPrice = 110m,
                ProposedDeliveryDate = new DateOnly(2026, 7, 21),
                ConfirmedBy = GuidHelper.NewId(),
                ConfirmedAt = new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc),
                DecisionFingerprint = new string('A', 64),
                Version = 1,
                Status = "SUPERSEDED",
                SupersededByDecisionId = secondId,
                ConcurrencyVersion = 2
            },
            new Purchaselinesupplierdecision
            {
                PurchaseLineSupplierDecisionId = secondId,
                PurchaseRequestLineId = lineId,
                SupplierId = GuidHelper.NewId(),
                EvidenceType = "LATEST_VALID_RECEIPT",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = new DateOnly(2026, 7, 21),
                EvidenceReferencePrice = 105m,
                ProposedUnitPrice = 112m,
                ProposedDeliveryDate = new DateOnly(2026, 7, 22),
                ConfirmedBy = GuidHelper.NewId(),
                ConfirmedAt = new DateTime(2026, 7, 21, 8, 0, 0, DateTimeKind.Utc),
                DecisionFingerprint = new string('B', 64),
                Version = 2,
                Status = "CURRENT",
                CurrentDecisionKey = lineId,
                ConcurrencyVersion = 1
            });

        await context.SaveChangesAsync();

        (await context.Purchaselinesupplierdecisions.AsNoTracking().OrderBy(item => item.Version).ToListAsync())
            .Select(item => (item.Version, item.Status, item.DecisionFingerprint))
            .Should().Equal(
                (1, "SUPERSEDED", new string('A', 64)),
                (2, "CURRENT", new string('B', 64)));
    }

    [Fact]
    public async Task Migration_fresh_install_applies_decision_exception_and_legacy_marker_schema()
    {
        if (!MySqlMigrationTestsEnabled())
        {
            return;
        }

        await new PurchaseHistoryReconciliationTests().Migration_fresh_database_applies_reconciliation_schema();

        const string database = "ipc_lane8";
        await using var context = CreateMySqlContext(database);
        (await context.Database.GetAppliedMigrationsAsync()).Should().ContainSingle(
            migration => migration == "20260722163000_AddSupplierDecisionsAndPriceExceptions");
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN ('purchaselinesupplierdecisions', 'purchasepriceexceptions');
            """)).Should().Be(2);
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'purchaserequestlines'
              AND COLUMN_NAME = 'supplierId'
              AND IS_NULLABLE = 'YES';
            """)).Should().Be(1);
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'purchaseorders'
              AND INDEX_NAME = 'ixPurchaseOrdersRequestSupplier'
              AND NON_UNIQUE = 0;
            """)).Should().Be(2);
    }

    [Fact]
    public async Task Migration_upgrade_preserves_supplier_snapshots_and_rejects_duplicate_purchase_order_keys()
    {
        if (!MySqlMigrationTestsEnabled())
        {
            return;
        }

        const string database = "ipc_lane9";
        await using var context = CreateMySqlContext(database);
        var appliedBefore = (await context.Database.GetAppliedMigrationsAsync()).ToArray();
        appliedBefore.Should().NotContain("20260722163000_AddSupplierDecisionsAndPriceExceptions");
        var fingerprintBefore = await SupplierSnapshotFingerprintAsync(database);
        var historicalSupplierCount = await SchemaObjectCountAsync(
            database,
            "SELECT COUNT(*) FROM purchaserequestlines WHERE supplierId IS NOT NULL;");

        await context.Database.MigrateAsync();
        context.ChangeTracker.Clear();

        (await context.Database.GetAppliedMigrationsAsync()).Should().ContainSingle(
            migration => migration == "20260722163000_AddSupplierDecisionsAndPriceExceptions");
        (await SupplierSnapshotFingerprintAsync(database)).Should().Be(fingerprintBefore);
        (await SchemaObjectCountAsync(
            database,
            "SELECT COUNT(*) FROM purchaserequestlines WHERE isLegacySupplierSnapshot = 1;"))
            .Should().Be(historicalSupplierCount);
        (await SchemaObjectCountAsync(
            database,
            "SELECT COUNT(*) FROM purchaselinesupplierdecisions;"))
            .Should().Be(0, "the migration must not fabricate quote/receipt confirmation evidence");

        var duplicateInsert = async () => await ExecuteNonQueryAsync(
            database,
            """
            INSERT INTO purchaseorders
                (purchaseOrderId, purchaseOrderCode, purchaseRequestId, supplierId, orderDate, status, createdBy, createdAt, updatedAt)
            SELECT UUID_TO_BIN(UUID()), CONCAT(purchaseOrderCode, '-DUP'), purchaseRequestId, supplierId,
                   orderDate, status, createdBy, createdAt, updatedAt
            FROM purchaseorders
            LIMIT 1;
            """);
        (await SchemaObjectCountAsync(database, "SELECT COUNT(*) FROM purchaseorders;"))
            .Should().BeGreaterThan(0);
        await duplicateInsert.Should().ThrowAsync<MySqlException>()
            .Where(exception => exception.Number == 1062);
    }

    [Theory]
    [InlineData("DRAFT")]
    [InlineData("REJECTED")]
    public async Task ApprovedDemand_Generation_rejects_non_approved_status_before_writes(string status)
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, status, new DateOnly(2026, 7, 20), "FULLDAY");
        await context.SaveChangesAsync();

        var act = () => CreateService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*duyệt nhu cầu nguyên liệu*");
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovedDemand_Generation_creates_supplier_neutral_fullday_lines_and_reuses_draft()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var request = new GeneratePurchaseRequestFromDemandDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
        };

        var first = await service.GenerateFromDemandAsync(request, UserId);
        var second = await service.GenerateFromDemandAsync(request, UserId);

        first.Should().NotBeNull();
        second.Should().NotBeNull();
        second!.PurchaseRequestId.Should().Be(first!.PurchaseRequestId);
        first.PurchaseForDate.Should().Be("2026-07-20");
        first.ShiftName.Should().BeNull();
        first.Lines.Should().ContainSingle().Which.SupplierId.Should().BeNull();
        first.Lines.Single().SupplierName.Should().BeNull();
        second.Lines.Should().ContainSingle()
            .Which.PurchaseRequestLineId.Should().Be(first.Lines.Single().PurchaseRequestLineId);
        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.SingleAsync()).SupplierId.Should().BeNull();
    }

    [Fact]
    public async Task ApprovedDemand_Generation_rejects_non_fullday_scope_before_writes()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "MORNING");
        await context.SaveChangesAsync();

        var act = () => CreateService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*FULLDAY*");
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovedDemand_Generation_rejects_stale_demand_identity_without_mutating_existing_draft()
    {
        await using var context = CreateContext();
        var serviceDate = new DateOnly(2026, 7, 20);
        var current = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-CURRENT");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(current.RequestId)
            },
            UserId);

        var stale = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-STALE");
        await context.SaveChangesAsync();

        var act = () => service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(stale.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*cũ*");
        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.SingleAsync()).MaterialRequestLineId
            .Should().Equal(current.Materialrequestlines.Single().RequestLineId);
    }

    [Fact]
    public async Task Workbench_rejects_non_monday_week_and_cross_week_date()
    {
        await using var context = CreateContext();
        var service = CreateService(context);

        var nonMonday = () => service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-21"
        });
        await nonMonday.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*thứ Hai*");

        var crossWeek = () => service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-27"
        });
        await crossWeek.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*trong tuần*");
    }

    [Fact]
    public async Task Workbench_returns_stable_dates_and_only_selected_date_default_page()
    {
        await using var context = CreateContext();
        for (var index = 10; index >= 1; index--)
        {
            SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY", $"MR-MON-{index:00}");
        }
        SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 22), "FULLDAY", "MR-WED-01");
        SeedDemand(context, "DRAFT", new DateOnly(2026, 7, 23), "FULLDAY", "MR-THU-DRAFT");
        await context.SaveChangesAsync();

        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "demand"
        });

        result.WeekStart.Should().Be("2026-07-20");
        result.WeekEnd.Should().Be("2026-07-26");
        result.PageSize.Should().Be(8);
        result.TotalItems.Should().Be(10);
        result.ServiceDates.Select(item => item.ServiceDate)
            .Should().Equal("2026-07-20", "2026-07-22");
        var selected = result.ServiceDates.First();
        selected.Scope.Should().Be("FULLDAY");
        selected.ApprovedDemands.Should().HaveCount(8);
        selected.ApprovedDemands.Select(item => item.RequestCode)
            .Should().BeInAscendingOrder();
        result.ServiceDates.Last().ApprovedDemands.Should().BeEmpty();

        var capped = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            PageSize = 500
        });
        capped.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task Workbench_counts_each_authoritative_stage_once()
    {
        await using var context = CreateContext();
        var supplier = SeedSupplier(context);
        var demandOnly = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY", "MR-DEMAND");
        var supplierStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 21), "FULLDAY", "MR-SUPPLIER");
        var exceptionStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 22), "FULLDAY", "MR-EXCEPTION");
        var submittedStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 23), "FULLDAY", "MR-SUBMITTED");
        var approvedStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 24), "FULLDAY", "MR-APPROVED");
        var receivingStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 25), "FULLDAY", "MR-RECEIVING");

        SeedPurchaseProgress(context, supplierStage, "DRAFT", supplier, estimatedUnitPrice: 115m);
        var exceptionRequest = SeedPurchaseProgress(context, exceptionStage, "DRAFT", supplier, estimatedUnitPrice: 120m);
        SeedPurchaseProgress(context, submittedStage, "SENTTOSUPPLIER", supplier);
        SeedPurchaseProgress(context, approvedStage, "APPROVED", supplier);
        SeedPurchaseProgress(context, receivingStage, "APPROVED", supplier, withOrder: true);
        await context.SaveChangesAsync();
        var exceptionLine = exceptionRequest.Purchaserequestlines.Single();
        exceptionLine.SupplierId.Should().NotBeNull();
        exceptionLine.Ingredient.ReferencePrice.Should().Be(100m);
        exceptionLine.EstimatedUnitPrice.Should().Be(120m);

        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20"
        });

        var exceptionSummary = result.ServiceDates.Single(item => item.ServiceDate == "2026-07-22");
        exceptionSummary.SupplierReadyLineCount.Should().Be(1);
        exceptionSummary.BlockingExceptionCount.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-21")
            .BlockingExceptionCount.Should().Be(0);
        result.ServiceDates.Select(item => $"{item.ServiceDate}:{item.CurrentStage}")
            .Should().Equal(
                "2026-07-20:demand",
                "2026-07-21:supplier-price",
                "2026-07-22:exception",
                "2026-07-23:submitted",
                "2026-07-24:approved-order",
                "2026-07-25:receiving");
        result.StageCounts.Demand.Should().Be(1);
        result.StageCounts.SupplierPrice.Should().Be(1);
        result.StageCounts.Exception.Should().Be(1);
        result.StageCounts.SubmittedRequest.Should().Be(1);
        result.StageCounts.ApprovedOrder.Should().Be(1);
        result.StageCounts.ReceivingProgress.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-25")
            .ReceivingLineCount.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-25")
            .FullyReceivedLineCount.Should().Be(0);
        demandOnly.RequestCode.Should().Be("MR-DEMAND");
    }

    [Fact]
    public async Task Workbench_query_count_stays_bounded_when_detail_page_grows()
    {
        var counter = new SelectCommandCounter();
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var context = CreateSqliteContext(connection, counter);
        await CreateWorkbenchSqliteSchemaAsync(context);
        for (var index = 1; index <= 25; index++)
        {
            var requestId = GuidHelper.NewId();
            var requestLineId = GuidHelper.NewId();
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO materialrequests
                    (requestId, requestCode, requestDate, requestScope, status)
                VALUES
                    ({requestId}, {$"MR-BOUND-{index:00}"}, {new DateOnly(2026, 7, 20)}, {"FULLDAY"}, {"MANAGERAPPROVED"});
                """);
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO materialrequestlines
                    (requestLineId, requestId, suggestedPurchaseQty)
                VALUES
                    ({requestLineId}, {requestId}, {10m});
                """);
        }

        counter.Reset();
        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Page = 2,
            PageSize = 8
        });

        result.TotalItems.Should().Be(25);
        result.ServiceDates.Single().ApprovedDemands.Should().HaveCount(8);
        counter.SelectCount.Should().BeLessThanOrEqualTo(8);
    }

    [Fact]
    public void Supplier_decision_fixture_requires_evidence_and_explicit_confirmation()
    {
        var requiredEvidence = new[] { "effective-quotation", "latest-valid-receipt" };
        var requiresConfirmation = true;

        requiredEvidence.Should().Equal("effective-quotation", "latest-valid-receipt");
        requiresConfirmation.Should().BeTrue();
    }

    [Fact]
    public async Task Evidence_effective_quotations_are_deterministic_and_inspectable()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplierB = SeedSupplier(context, "SUP-B", "B supplier");
        var supplierA = SeedSupplier(context, "SUP-A", "A supplier");
        var inactiveSupplier = SeedSupplier(context, "SUP-INACTIVE", "Inactive supplier", isActive: false);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var line = demand.Materialrequestlines.Single();
        var quoteB = SeedQuotation(context, supplierB, line.Ingredient, 120m, new DateOnly(2026, 7, 1));
        var quoteA = SeedQuotation(context, supplierA, line.Ingredient, 120m, new DateOnly(2026, 7, 10));
        SeedQuotation(context, inactiveSupplier, line.Ingredient, 90m, new DateOnly(2026, 7, 1));
        SeedQuotation(context, supplierA, line.Ingredient, 80m, new DateOnly(2026, 7, 21));
        SeedQuotation(context, supplierA, new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = "ING-OTHER",
            IngredientName = "Other ingredient",
            UnitId = line.UnitId,
            WarehouseId = GuidHelper.NewId(),
            ReferencePrice = 10m,
            IsActive = true,
            Unit = line.Unit
        }, 70m, new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Blocker.Should().BeNull();
        result.Candidates.Should().HaveCount(2);
        result.Candidates.Select(candidate => candidate.EvidenceId)
            .Should().Equal(
                GuidHelper.ToGuidString(quoteA.QuotationId),
                GuidHelper.ToGuidString(quoteB.QuotationId));
        result.Candidates.Should().OnlyContain(candidate =>
            candidate.EvidenceType == SupplierEvidenceType.EffectiveQuotation &&
            candidate.UnitPrice == 120m &&
            candidate.UnitId == GuidHelper.ToGuidString(line.UnitId) &&
            candidate.EffectiveFrom != null &&
            candidate.EvidenceDate != null);
    }

    [Fact]
    public async Task Evidence_latest_valid_receipt_normalizes_price_and_excludes_incomparable_units_with_reason()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-RECEIPT", "Receipt supplier");
        var inactiveSupplier = SeedSupplier(context, "SUP-INACTIVE-RECEIPT", "Inactive receipt supplier", isActive: false);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var demandLine = demand.Materialrequestlines.Single();
        demandLine.Unit.UnitCode = "KG";
        demandLine.Unit.BaseUnitCode = "KG";
        demandLine.Unit.ConvertRateToBase = 1m;
        var gram = SeedUnit(context, "G", "g", "KG", 0.001m);
        var litre = SeedUnit(context, "L", "l", "L", 1m);
        SeedReceiptLine(context, supplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 10), 0.10m);
        var latest = SeedReceiptLine(context, supplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 19), 0.12m);
        SeedReceiptLine(context, supplier, demandLine.Ingredient, litre, new DateOnly(2026, 7, 20), 50m);
        SeedReceiptLine(context, inactiveSupplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 20), 0.05m);
        await context.SaveChangesAsync();

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Blocker.Should().BeNull();
        result.Candidates.Should().ContainSingle();
        result.Candidates.Single().Should().Match<SupplierEvidenceCandidateDto>(candidate =>
            candidate.EvidenceType == SupplierEvidenceType.LatestValidReceipt &&
            candidate.EvidenceId == GuidHelper.ToGuidString(latest.ReceiptLineId) &&
            candidate.SupplierId == GuidHelper.ToGuidString(supplier.SupplierId) &&
            candidate.UnitPrice == 120m &&
            candidate.EvidenceDate == "2026-07-19");
        result.Diagnostics.Should().Contain(message => message.Contains("không thể quy đổi", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Evidence_without_valid_source_returns_empty_candidates_and_actionable_blocker_without_mutation()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        SeedSupplier(context, "SUP-NO-EVIDENCE", "No evidence supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Candidates.Should().BeEmpty();
        result.Blocker.Should().Contain("đơn giá hiệu lực");
        result.Blocker.Should().Contain("biên nhận");
        var persistedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
        persistedLine.SupplierId.Should().BeNull();
        persistedLine.EstimatedUnitPrice.Should().Be(0m);
    }

    [Fact]
    public async Task Confirmation_revalidates_server_evidence_and_appends_versioned_decisions()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-CONFIRM", "Confirm supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var demandLine = demand.Materialrequestlines.Single();
        var quotation = SeedQuotation(context, supplier, demandLine.Ingredient, 100m, new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;

        var first = await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 110m,
                ProposedDeliveryDate = "2026-07-21",
                ExpectedDecisionVersion = 0
            },
            UserId);
        var second = await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 112m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);

        first.Version.Should().Be(1);
        second.Version.Should().Be(2);
        second.Status.Should().Be("CURRENT");
        second.DecisionFingerprint.Should().HaveLength(64).And.NotBe(first.DecisionFingerprint);
        second.ConfirmedBy.Should().Be(UserId);
        var decisions = await context.Purchaselinesupplierdecisions
            .AsNoTracking()
            .OrderBy(item => item.Version)
            .ToListAsync();
        decisions.Should().HaveCount(2);
        decisions[0].Status.Should().Be("SUPERSEDED");
        decisions[0].SupersededByDecisionId.Should().Equal(decisions[1].PurchaseLineSupplierDecisionId);
        decisions[0].CurrentDecisionKey.Should().BeNull();
        decisions[1].CurrentDecisionKey.Should().Equal(decisions[1].PurchaseRequestLineId);
        var persistedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
        persistedLine.SupplierId.Should().Equal(supplier.SupplierId);
        persistedLine.EstimatedUnitPrice.Should().Be(112m);
        persistedLine.ExpectedDeliveryDate.Should().Be(new DateOnly(2026, 7, 22));
    }

    [Fact]
    public async Task Confirmation_rejects_stale_version_evidence_and_non_draft_status_without_writes()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-CONFLICT", "Conflict supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        var baseRequest = new ConfirmPurchaseLineSupplierDto
        {
            EvidenceType = SupplierEvidenceType.EffectiveQuotation,
            EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
            SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
            ProposedUnitPrice = 105m,
            ProposedDeliveryDate = "2026-07-21",
            ExpectedDecisionVersion = 0
        };
        await service.ConfirmLineSupplierAsync(requestId, lineId, baseRequest, UserId);

        var staleVersion = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 0
            },
            UserId);
        await staleVersion.Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);

        quotation.IsActive = false;
        await context.SaveChangesAsync();
        var staleEvidence = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);
        await staleEvidence.Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);

        var purchaseRequest = await context.Purchaserequests.SingleAsync();
        purchaseRequest.Status = "SENTTOSUPPLIER";
        await context.SaveChangesAsync();
        quotation.IsActive = true;
        await context.SaveChangesAsync();
        var wrongStatus = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);
        await wrongStatus.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*DRAFT*");
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Workbench_projects_current_and_historical_supplier_decision_references()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-AUDIT", "Audit supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        for (var version = 0; version < 2; version++)
        {
            await service.ConfirmLineSupplierAsync(
                requestId,
                lineId,
                new ConfirmPurchaseLineSupplierDto
                {
                    EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                    EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                    SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                    ProposedUnitPrice = 105m + version,
                    ProposedDeliveryDate = $"2026-07-{21 + version:00}",
                    ExpectedDecisionVersion = version
                },
                UserId);
        }

        var workbench = await service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "supplier-price"
        });

        var line = workbench.ServiceDates.Single().PurchaseLines.Single();
        line.SupplierDecisionStatus.Should().Be("CONFIRMED");
        line.CurrentSupplierDecision.Should().NotBeNull();
        line.CurrentSupplierDecision!.Version.Should().Be(2);
        line.SupplierDecisionHistory.Select(item => item.Version).Should().Equal(2, 1);
        line.SupplierDecisionHistory.Should().OnlyContain(item =>
            !string.IsNullOrWhiteSpace(item.EvidenceId) &&
            !string.IsNullOrWhiteSpace(item.ConfirmedBy) &&
            item.DecisionFingerprint.Length == 64);
    }

    [Fact]
    public void Confirmation_endpoint_uses_purchasing_policy_and_contract_omits_server_fields()
    {
        var action = typeof(PurchaseWorkflowController).GetMethod(nameof(PurchaseWorkflowController.ConfirmLineSupplier));
        action.Should().NotBeNull();
        action!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Should().Contain(attribute => attribute.Policy == AuthorizationPolicies.PurchaseGenerateAccess);
        typeof(PurchaseWorkflowController).GetMethod("UpdateLineSupplier").Should().BeNull();

        var clientFields = typeof(ConfirmPurchaseLineSupplierDto).GetProperties()
            .Select(property => property.Name)
            .ToArray();
        clientFields.Should().NotContain([
            "ConfirmedBy",
            "ConfirmedAt",
            "EvidenceReferencePrice",
            "VariancePercent",
            "DecisionFingerprint"
        ]);
    }

    [Fact]
    public async Task Supplier_price_above_threshold_routes_to_manager_exception_approval()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-EXCEPTION", "Exception supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierDto
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 120m,
                ProposedDeliveryDate = "2026-07-21",
                Note = "Giá nguyên liệu tăng",
                ExpectedDecisionVersion = 0
            },
            UserId);

        var blocked = () => service.SubmitAsync(requestId, UserId);
        await blocked.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ngoại lệ giá*");

        var priceException = await context.Purchasepriceexceptions.SingleAsync();
        priceException.Status = "APPROVED";
        priceException.DecidedBy = UserIdBytes;
        priceException.DecisionReason = "Báo giá hợp lệ";
        priceException.DecidedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        var submitted = await service.SubmitAsync(requestId, UserId);
        submitted!.Status.Should().Be("SENTTOSUPPLIER");
    }

    [Fact]
    public async Task Submit_exactly_fifteen_percent_requires_no_exception()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-FIFTEEN", "Fifteen supplier");
        var request = SeedPurchaseProgress(context, demand, "DRAFT", supplier, 115m);
        await context.SaveChangesAsync();

        var result = await CreateService(context).SubmitAsync(
            GuidHelper.ToGuidString(request.PurchaseRequestId),
            UserId);

        result!.Status.Should().Be("SENTTOSUPPLIER");
        (await context.Purchasepriceexceptions.CountAsync()).Should().Be(0);
    }

    private static readonly byte[] UserIdBytes = GuidHelper.NewId();
    private static string UserId => GuidHelper.ToGuidString(UserIdBytes);

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"supplier-decision-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static bool MySqlMigrationTestsEnabled()
        => string.Equals(
            Environment.GetEnvironmentVariable("IPC_RUN_MYSQL_MIGRATION_TESTS"),
            "1",
            StringComparison.Ordinal);

    private static IpcManagementContext CreateMySqlContext(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(
                DisposableConnectionString(database),
                new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;
        return new IpcManagementContext(options);
    }

    private static async Task<long> SchemaObjectCountAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ExecuteNonQueryAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteNonQueryAsync();
    }

    private static string DisposableConnectionString(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        using var settings = JsonDocument.Parse(File.ReadAllText(
            FindRepositoryFile("backend", "src", "IPCManagement.Api", "appsettings.json")));
        var configured = settings.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("DefaultConnection")
            .GetString() ?? throw new InvalidOperationException("DefaultConnection is missing.");
        return new MySqlConnectionStringBuilder(configured)
        {
            Database = database
        }.ConnectionString;
    }

    private static async Task<string> SupplierSnapshotFingerprintAsync(string database)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT CONCAT(HEX(purchaseRequestLineId), '|', COALESCE(HEX(supplierId), '<NULL>'))
            FROM purchaserequestlines
            ORDER BY HEX(purchaseRequestLineId);
            """;
        await using var reader = await command.ExecuteReaderAsync();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        while (await reader.ReadAsync())
        {
            hash.AppendData(Encoding.UTF8.GetBytes(reader.GetString(0)));
            hash.AppendData("\n"u8);
        }

        return Convert.ToHexString(hash.GetHashAndReset());
    }

    private static string FindRepositoryFile(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine([current.FullName, .. segments]);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Không tìm thấy file fixture: {Path.Combine(segments)}");
    }

    private static Task CreateWorkbenchSqliteSchemaAsync(IpcManagementContext context)
        => context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                requestScope TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE materialrequestlines (
                requestLineId BLOB PRIMARY KEY,
                requestId BLOB NOT NULL,
                suggestedPurchaseQty TEXT NOT NULL
            );
            CREATE TABLE purchaserequests (
                purchaseRequestId BLOB PRIMARY KEY,
                purchaseRequestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                purchaseForDate TEXT NOT NULL,
                shiftName TEXT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                approvedBy BLOB NULL,
                approvedAt TEXT NULL
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
            CREATE TABLE purchaserequestlines (
                purchaseRequestLineId BLOB PRIMARY KEY,
                purchaseRequestId BLOB NOT NULL,
                materialRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                supplierId BLOB NULL,
                isLegacySupplierSnapshot INTEGER NOT NULL DEFAULT 0,
                unitId BLOB NOT NULL,
                requiredQty TEXT NOT NULL,
                currentStockQty TEXT NOT NULL,
                purchaseQty TEXT NOT NULL,
                estimatedUnitPrice TEXT NOT NULL,
                expectedDeliveryDate TEXT NULL,
                note TEXT NULL
            );
            CREATE TABLE purchaseorders (
                purchaseOrderId BLOB PRIMARY KEY,
                purchaseOrderCode TEXT NOT NULL,
                purchaseRequestId BLOB NOT NULL,
                supplierId BLOB NOT NULL,
                orderDate TEXT NOT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            CREATE TABLE purchaseorderlines (
                purchaseOrderLineId BLOB PRIMARY KEY,
                purchaseOrderId BLOB NOT NULL,
                purchaseRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                unitId BLOB NOT NULL,
                orderedQty TEXT NOT NULL,
                receivedQty TEXT NOT NULL,
                unitPrice TEXT NOT NULL
            );
            """);

    private static PurchaseRequestWorkflowService CreateService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

    private static IpcManagementContext CreateSqliteContext(
        SqliteConnection connection,
        DbCommandInterceptor interceptor)
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;
        return new IpcManagementContext(options);
    }

    private static Supplier SeedSupplier(IpcManagementContext context)
        => SeedSupplier(context, "SUP-WORKBENCH", "Supplier workbench");

    private static Supplier SeedSupplier(
        IpcManagementContext context,
        string code,
        string name,
        bool isActive = true)
    {
        var supplier = new Supplier
        {
            SupplierId = GuidHelper.NewId(),
            SupplierCode = code,
            SupplierName = name,
            IsActive = isActive
        };
        context.Suppliers.Add(supplier);
        return supplier;
    }

    private static Supplierquotation SeedQuotation(
        IpcManagementContext context,
        Supplier supplier,
        Ingredient ingredient,
        decimal unitPrice,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo = null)
    {
        if (context.Entry(ingredient).State == EntityState.Detached)
        {
            context.Ingredients.Add(ingredient);
        }

        var quotation = new Supplierquotation
        {
            QuotationId = GuidHelper.NewId(),
            SupplierId = supplier.SupplierId,
            IngredientId = ingredient.IngredientId,
            UnitPrice = unitPrice,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Supplier = supplier,
            Ingredient = ingredient
        };
        context.Supplierquotations.Add(quotation);
        return quotation;
    }

    private static Unit SeedUnit(
        IpcManagementContext context,
        string code,
        string name,
        string baseUnitCode,
        decimal convertRateToBase)
    {
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = code,
            UnitName = name,
            BaseUnitCode = baseUnitCode,
            ConvertRateToBase = convertRateToBase
        };
        context.Units.Add(unit);
        return unit;
    }

    private static Inventoryreceiptline SeedReceiptLine(
        IpcManagementContext context,
        Supplier supplier,
        Ingredient ingredient,
        Unit unit,
        DateOnly receiptDate,
        decimal unitPrice)
    {
        var receipt = new Inventoryreceipt
        {
            ReceiptId = GuidHelper.NewId(),
            ReceiptCode = $"REC-{Guid.NewGuid():N}",
            ReceiptDate = receiptDate,
            WarehouseId = GuidHelper.NewId(),
            SupplierId = supplier.SupplierId,
            CreatedBy = UserIdBytes,
            CreatedAt = DateTime.UtcNow,
            Supplier = supplier
        };
        var line = new Inventoryreceiptline
        {
            ReceiptLineId = GuidHelper.NewId(),
            ReceiptId = receipt.ReceiptId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            Quantity = 1m,
            UnitPrice = unitPrice,
            Receipt = receipt,
            Ingredient = ingredient,
            Unit = unit
        };
        receipt.Inventoryreceiptlines.Add(line);
        context.Inventoryreceipts.Add(receipt);
        context.Inventoryreceiptlines.Add(line);
        return line;
    }

    private static Purchaserequest SeedPurchaseProgress(
        IpcManagementContext context,
        Materialrequest demand,
        string status,
        Supplier? supplier = null,
        decimal estimatedUnitPrice = 100m,
        bool withOrder = false)
    {
        var materialLine = demand.Materialrequestlines.Single();
        var request = new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = $"PR-{demand.RequestDate:yyyyMMdd}-FULLDAY",
            RequestDate = demand.RequestDate,
            PurchaseForDate = demand.RequestDate,
            Status = status,
            CreatedBy = UserIdBytes
        };
        var line = new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = request.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = supplier?.SupplierId,
            UnitId = materialLine.UnitId,
            RequiredQty = 10m,
            CurrentStockQty = 0m,
            PurchaseQty = 10m,
            EstimatedUnitPrice = supplier is null ? 0m : estimatedUnitPrice,
            ExpectedDeliveryDate = supplier is null ? null : demand.RequestDate,
            PurchaseRequest = request,
            MaterialRequestLine = materialLine,
            Ingredient = materialLine.Ingredient,
            Supplier = supplier,
            Unit = materialLine.Unit
        };
        if (supplier is not null)
        {
            line.SupplierDecisions.Add(new Purchaselinesupplierdecision
            {
                PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                SupplierId = supplier.SupplierId,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = demand.RequestDate,
                EvidenceReferencePrice = 100m,
                ProposedUnitPrice = estimatedUnitPrice,
                ProposedDeliveryDate = demand.RequestDate,
                ConfirmedBy = UserIdBytes,
                ConfirmedAt = DateTime.UtcNow,
                DecisionFingerprint = Convert.ToHexString(SHA256.HashData(line.PurchaseRequestLineId)),
                Version = 1,
                Status = "CURRENT",
                CurrentDecisionKey = line.PurchaseRequestLineId,
                PurchaseRequestLine = line
            });
        }
        request.Purchaserequestlines.Add(line);
        context.Purchaserequests.Add(request);

        if (withOrder)
        {
            var order = new Purchaseorder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-WORKBENCH",
                PurchaseRequestId = request.PurchaseRequestId,
                SupplierId = supplier!.SupplierId,
                OrderDate = demand.RequestDate,
                Status = "PARTIALLYRECEIVED",
                CreatedBy = UserIdBytes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PurchaseRequest = request,
                Supplier = supplier,
                Purchaseorderlines =
                [
                    new Purchaseorderline
                    {
                        PurchaseOrderLineId = GuidHelper.NewId(),
                        PurchaseRequestLineId = line.PurchaseRequestLineId,
                        IngredientId = line.IngredientId,
                        UnitId = line.UnitId,
                        OrderedQty = 10m,
                        ReceivedQty = 5m,
                        UnitPrice = estimatedUnitPrice,
                        PurchaseRequestLine = line,
                        Ingredient = line.Ingredient,
                        Unit = line.Unit
                    }
                ]
            };
            request.Purchaseorders.Add(order);
            context.Purchaseorders.Add(order);
        }

        return request;
    }

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }

        public void Reset() => SelectCount = 0;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static Materialrequest SeedDemand(
        IpcManagementContext context,
        string status,
        DateOnly serviceDate,
        string scope,
        string? requestCode = null)
    {
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = $"KG-{Guid.NewGuid():N}",
            UnitName = "kg",
            ConvertRateToBase = 1
        };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = $"ING-{Guid.NewGuid():N}",
            IngredientName = requestCode ?? "Ingredient",
            UnitId = unit.UnitId,
            WarehouseId = GuidHelper.NewId(),
            ReferencePrice = 100,
            IsActive = true,
            Unit = unit
        };
        var plan = new Productionplan
        {
            PlanId = GuidHelper.NewId(),
            PlanCode = $"PLAN-{Guid.NewGuid():N}",
            PlanDate = serviceDate,
            WeekStartDate = serviceDate.AddDays(-(int)serviceDate.DayOfWeek + 1),
            Status = "FINALIZED",
            CreatedBy = UserIdBytes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var demand = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = requestCode ?? $"MR-{Guid.NewGuid():N}",
            PlanId = plan.PlanId,
            RequestDate = serviceDate,
            RequestScope = scope,
            Status = status,
            CreatedBy = UserIdBytes,
            Plan = plan
        };
        demand.Materialrequestlines.Add(new Materialrequestline
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = demand.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            TotalRequiredQty = 10,
            SuggestedPurchaseQty = 10,
            Ingredient = ingredient,
            Unit = unit,
            Request = demand
        });
        context.Materialrequests.Add(demand);
        return demand;
    }
}
