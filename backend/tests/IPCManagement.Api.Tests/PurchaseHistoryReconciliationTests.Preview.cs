using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySqlConnector;
using NSubstitute;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api.Tests;

public partial class PurchaseHistoryReconciliationTests
{
    [Fact]
    public async Task Preview_is_read_only_and_replays_the_same_manifest()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var supplier = await context.Suppliers.SingleAsync();
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            quantity: 10,
            unitPrice: 25_000,
            lotNumber: "SAMPLE-EXACT");
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000),
            Candidate("1.Rau", 11, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 21), 12, 27_000));
        var before = await DatabaseCountsAsync(context);

        var first = await service.PreviewAsync(CancellationToken.None);
        var replay = await service.PreviewAsync(CancellationToken.None);

        (await DatabaseCountsAsync(context)).Should().Be(before);
        context.ChangeTracker.Entries().Should().OnlyContain(entry => entry.State == EntityState.Unchanged);
        first.Manifest.ManifestHash.Should().Be(replay.Manifest.ManifestHash).And.MatchRegex("^[0-9A-F]{64}$");
        first.Manifest.DatabaseFingerprint.Should().Be(replay.Manifest.DatabaseFingerprint).And.MatchRegex("^[0-9A-F]{64}$");
        first.Manifest.SourceName.Should().Be("IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx");
        first.Manifest.SourceSha256.Should().Be(new string('A', 64));
        first.Manifest.ActionCounts.Should().NotContainKey("keep");
        first.Manifest.ActionCounts.Should().Contain(new KeyValuePair<string, int>("version", 1));
        first.Actions.Should().OnlyContain(action =>
            action.ActionHash.Length == 64 &&
            action.BeforeHash.Length == 64 &&
            action.AfterHash.Length == 64 &&
            !string.IsNullOrWhiteSpace(action.ReasonCode));
    }

    [Fact]
    public async Task Preview_uses_the_single_active_supplier_when_an_inactive_duplicate_exists()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        context.Suppliers.Add(new Supplier
        {
            SupplierId = Id(31),
            SupplierCode = "SUP-RAU-LEGACY",
            SupplierName = "Rau",
            IsActive = false
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync(CancellationToken.None);

        preview.Blockers.Should().NotContain(blocker => blocker.Code == "SUPPLIER_CATALOG_AMBIGUOUS");
        preview.Actions.Should().ContainSingle(action => action.ActionType == "version");
    }

    [Fact]
    public async Task Preview_uses_the_single_active_ingredient_when_an_inactive_duplicate_exists()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = Id(21),
            IngredientCode = "ING-RAU-MUONG-LEGACY",
            IngredientName = "Rau muống",
            UnitId = Id(10),
            WarehouseId = Id(40),
            ReferencePrice = 20_000,
            IsFreshDaily = true,
            IsActive = false
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync(CancellationToken.None);

        preview.Blockers.Should().NotContain(blocker => blocker.Code == "INGREDIENT_CATALOG_AMBIGUOUS");
        preview.Actions.Should().ContainSingle(action => action.ActionType == "version");
    }

    [Fact]
    public async Task Preview_ignores_catalog_spacing_when_only_one_active_ingredient_matches()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var ingredient = await context.Ingredients.SingleAsync();
        ingredient.IngredientName = "Rau  muống";
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync();

        preview.Blockers.Should().NotContain(blocker => blocker.Code == "INGREDIENT_CATALOG_AMBIGUOUS");
        preview.Actions.Should().ContainSingle(action => action.ActionType == "version");
    }

    [Fact]
    public async Task Preview_keeps_catalog_ambiguity_when_spacing_variants_are_both_active()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = Id(21),
            IngredientCode = "ING-RAU-MUONG-SPACING-DUPLICATE",
            IngredientName = "Rau  muống",
            UnitId = Id(10),
            WarehouseId = Id(40),
            ReferencePrice = 25_000,
            IsFreshDaily = true,
            IsActive = true
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync();

        preview.Blockers.Should().ContainSingle(blocker => blocker.Code == "INGREDIENT_CATALOG_AMBIGUOUS");
        preview.Actions.Should().ContainSingle(action => action.ActionType == "block");
    }

    [Fact]
    public async Task Preview_accepts_an_exact_existing_source_row_when_supplier_name_has_active_duplicates()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        context.Suppliers.Add(new Supplier
        {
            SupplierId = Id(31),
            SupplierCode = "SUP-RAU-DUPLICATE",
            SupplierName = "Rau",
            IsActive = true
        });
        var supplier = await context.Suppliers.SingleAsync(item => item.SupplierCode == "SUP-RAU");
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            10,
            25_000,
            "SAMPLE-EXACT");
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync();

        preview.Blockers.Should().NotContain(blocker => blocker.Code == "SUPPLIER_CATALOG_AMBIGUOUS");
        preview.Actions.Should().BeEmpty();
    }

    [Fact]
    public async Task Preview_keeps_supplier_blocker_when_exact_rows_point_to_different_supplier_ids()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var duplicateSupplier = new Supplier
        {
            SupplierId = Id(31),
            SupplierCode = "SUP-RAU-DUPLICATE",
            SupplierName = "Rau",
            IsActive = true
        };
        context.Suppliers.Add(duplicateSupplier);
        var supplier = await context.Suppliers.SingleAsync(item => item.SupplierCode == "SUP-RAU");
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        await SeedReceiptAsync(
            context, "RCP-EXACT-A", new DateOnly(2026, 7, 20), supplier.SupplierId,
            ingredient.IngredientId, unit.UnitId, 10, 25_000, "EXACT-A", purchaseRequestId: Id(94));
        await SeedReceiptAsync(
            context, "RCP-EXACT-B", new DateOnly(2026, 7, 20), duplicateSupplier.SupplierId,
            ingredient.IngredientId, unit.UnitId, 10, 25_000, "EXACT-B", purchaseRequestId: Id(95));
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 10, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync();

        preview.Blockers.Should().ContainSingle(blocker => blocker.Code == "SUPPLIER_CATALOG_AMBIGUOUS");
        preview.Actions.Should().ContainSingle(action => action.ActionType == "block");
    }

    [Fact]
    public async Task Preview_deletes_only_dependency_free_sample_orphans()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var supplier = await context.Suppliers.SingleAsync();
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        var orphanLine = await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260718-RAU",
            new DateOnly(2026, 7, 18),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            4,
            20_000,
            "SAMPLE-ORPHAN");
        var linkedLine = await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260719-RAU",
            new DateOnly(2026, 7, 19),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            5,
            21_000,
            "SAMPLE-LINKED",
            purchaseRequestId: Id(90));
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = Id(91),
            MovementDate = new DateTime(2026, 7, 19),
            WarehouseId = Id(40),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            MovementType = "IN",
            RefTable = "InventoryReceiptLine",
            RefId = linkedLine.ReceiptLineId,
            QuantityIn = 5,
            QuantityOut = 0,
            BeforeQty = 0,
            AfterQty = 5,
            PerformedBy = Id(41)
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(context);

        var preview = await service.PreviewAsync(CancellationToken.None);

        preview.Actions.Should().ContainSingle(action =>
            action.ActionType == "delete" && action.TargetId == Convert.ToHexString(orphanLine.ReceiptLineId));
        preview.Actions.Should().NotContain(action =>
            action.TargetId == Convert.ToHexString(linkedLine.ReceiptLineId));
    }

    [Fact]
    public async Task Preview_versions_changed_immutable_history_instead_of_overwriting_it()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var supplier = await context.Suppliers.SingleAsync();
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        var linkedLine = await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            8,
            22_000,
            "SAMPLE-LINKED",
            purchaseRequestId: Id(92));
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 20, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));

        var preview = await service.PreviewAsync(CancellationToken.None);

        preview.Actions.Should().ContainSingle(action =>
            action.ActionType == "version" &&
            action.TargetId == Convert.ToHexString(linkedLine.ReceiptLineId) &&
            action.ReasonCode == "IMMUTABLE_HISTORY_VERSION_REQUIRED" &&
            action.BeforeEvidence.Contains("22000", StringComparison.Ordinal) &&
            action.AfterEvidence.Contains("25000", StringComparison.Ordinal));
        preview.Actions.Should().NotContain(action => action.ActionType == "delete");
    }

    [Fact]
    public async Task Preview_emits_deactivate_and_block_actions_with_auditable_evidence()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var supplier = await context.Suppliers.SingleAsync();
        var ingredient = await context.Ingredients.SingleAsync();
        var unit = await context.Units.SingleAsync();
        await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            10,
            25_000,
            "SAMPLE-CANONICAL");
        var referencedDuplicate = await SeedReceiptAsync(
            context,
            "RCP-SAMPLE-20260720-RAU-2",
            new DateOnly(2026, 7, 20),
            supplier.SupplierId,
            ingredient.IngredientId,
            unit.UnitId,
            10,
            25_000,
            "SAMPLE-REFERENCED",
            purchaseRequestId: Id(93));
        context.ChangeTracker.Clear();
        var service = CreatePreviewService(
            context,
            Candidate("1.Rau", 30, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000),
            Candidate("1.Rau", 31, "Không tồn tại", "Rau muống", "KG", new DateOnly(2026, 7, 21), 12, 26_000));

        var preview = await service.PreviewAsync(CancellationToken.None);

        preview.Actions.Should().ContainSingle(action =>
            action.ActionType == "deactivate" &&
            action.TargetId == Convert.ToHexString(referencedDuplicate.ReceiptLineId) &&
            action.ReasonCode == "REFERENCED_DUPLICATE_REMAP_REQUIRED");
        preview.Actions.Should().ContainSingle(action =>
            action.ActionType == "block" &&
            action.SourceKey == "1.Rau|31" &&
            action.ReasonCode == "SUPPLIER_CATALOG_AMBIGUOUS");
        preview.Blockers.Should().ContainSingle(blocker =>
            blocker.Code == "SUPPLIER_CATALOG_AMBIGUOUS" && blocker.SourceRow == 31);
    }

    [Fact]
    public async Task Preview_manifest_changes_for_source_policy_as_of_database_and_action_drift()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var candidate = Candidate(
            "1.Rau",
            40,
            "Rau",
            "Rau muống",
            "KG",
            new DateOnly(2026, 7, 20),
            10,
            25_000);
        var baseline = await CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidate).PreviewAsync();
        var sourceDrift = await CreatePreviewService(
            context,
            new string('D', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidate).PreviewAsync();
        var asOfDrift = await CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 21),
            PurchaseHistoryPolicyVersion.Current,
            candidate).PreviewAsync();
        var policyDrift = await CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            "purchase-history-normalization/test-drift",
            candidate).PreviewAsync();
        var actionDrift = await CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidate,
            Candidate("1.Rau", 41, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 21), 11, 26_000)).PreviewAsync();

        context.Suppliers.Add(new Supplier
        {
            SupplierId = Id(94),
            SupplierCode = "SUP-DRIFT",
            SupplierName = "Nguồn DB mới",
            IsActive = true
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var databaseDrift = await CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidate).PreviewAsync();

        new[]
        {
            sourceDrift.Manifest.ManifestHash,
            asOfDrift.Manifest.ManifestHash,
            policyDrift.Manifest.ManifestHash,
            databaseDrift.Manifest.ManifestHash,
            actionDrift.Manifest.ManifestHash
        }.Should().OnlyContain(hash => hash != baseline.Manifest.ManifestHash);
    }

}
