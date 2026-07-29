using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
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
using System.Data.Common;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public partial class SupplierDecisionWorkflowTests
{
    [Fact]
    public async Task Persistence_supplier_decisions_require_complete_evidence_actor_and_append_only_versions()
    {
        await using var context = CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(PurchaseLineSupplierDecision));

        entity.Should().NotBeNull();
        entity!.FindProperty(nameof(PurchaseLineSupplierDecision.DecisionFingerprint))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(PurchaseLineSupplierDecision.Version))!.IsNullable.Should().BeFalse();
        entity.FindProperty(nameof(PurchaseLineSupplierDecision.ConcurrencyVersion))!.IsConcurrencyToken.Should().BeTrue();
        entity.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain([
            "ckPurchaseLineSupplierDecisionsEvidenceComplete",
            "ckPurchaseLineSupplierDecisionsConfirmationComplete",
            "ckPurchaseLineSupplierDecisionsStatus",
            "ckPurchaseLineSupplierDecisionsCurrentKey"
        ]);
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(PurchaseLineSupplierDecision.PurchaseRequestLineId), nameof(PurchaseLineSupplierDecision.Version) }));
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(PurchaseLineSupplierDecision.PurchaseRequestLineId), nameof(PurchaseLineSupplierDecision.DecisionFingerprint) }));
        entity.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(PurchaseLineSupplierDecision.CurrentDecisionKey) }));

        var line = model.FindEntityType(typeof(PurchaseRequestLine));
        line!.FindProperty(nameof(PurchaseRequestLine.IsLegacySupplierSnapshot))!.IsNullable.Should().BeFalse();
        line.FindNavigation(nameof(PurchaseRequestLine.SupplierDecisions)).Should().NotBeNull();

        var lineId = GuidHelper.NewId();
        var firstId = GuidHelper.NewId();
        var secondId = GuidHelper.NewId();
        context.Purchaselinesupplierdecisions.AddRange(
            new PurchaseLineSupplierDecision
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
            new PurchaseLineSupplierDecision
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

}
