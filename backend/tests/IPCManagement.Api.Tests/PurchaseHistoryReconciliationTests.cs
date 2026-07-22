using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.DatabaseTool;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySqlConnector;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class PurchaseHistoryReconciliationTests
{
    [Fact]
    public void PersistenceContract_reconciliation_run_and_actions_bind_complete_audit_evidence()
    {
        using var context = CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;

        var run = model.FindEntityType(typeof(Purchasehistoryreconciliationrun));
        run.Should().NotBeNull();
        run!.GetProperties().Select(property => property.Name).Should().Contain(
            nameof(Purchasehistoryreconciliationrun.ManifestId),
            nameof(Purchasehistoryreconciliationrun.ManifestHash),
            nameof(Purchasehistoryreconciliationrun.SourceName),
            nameof(Purchasehistoryreconciliationrun.SourceSha256),
            nameof(Purchasehistoryreconciliationrun.PolicyVersion),
            nameof(Purchasehistoryreconciliationrun.AsOfDate),
            nameof(Purchasehistoryreconciliationrun.DatabaseFingerprint),
            nameof(Purchasehistoryreconciliationrun.BackupIdentifier),
            nameof(Purchasehistoryreconciliationrun.BackupTargetFingerprint),
            nameof(Purchasehistoryreconciliationrun.RestoreFingerprint),
            nameof(Purchasehistoryreconciliationrun.RestoreVerified),
            nameof(Purchasehistoryreconciliationrun.AppliedBy),
            nameof(Purchasehistoryreconciliationrun.Status),
            nameof(Purchasehistoryreconciliationrun.CandidateCount),
            nameof(Purchasehistoryreconciliationrun.CurrentUniqueBusinessKeyCount),
            nameof(Purchasehistoryreconciliationrun.AuditedDeltaCount),
            nameof(Purchasehistoryreconciliationrun.ActionCount),
            nameof(Purchasehistoryreconciliationrun.BlockerCount));
        run.FindProperty(nameof(Purchasehistoryreconciliationrun.ManifestHash))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(Purchasehistoryreconciliationrun.SourceSha256))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(Purchasehistoryreconciliationrun.DatabaseFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(Purchasehistoryreconciliationrun.BackupTargetFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(Purchasehistoryreconciliationrun.RestoreFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.GetIndexes().Should().Contain(index =>
            index.IsUnique &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(Purchasehistoryreconciliationrun.ManifestHash) }));
        run.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain(
            "ckPurchaseHistoryReconciliationRunsCounts",
            "ckPurchaseHistoryReconciliationRunsStatus",
            "ckPurchaseHistoryReconciliationRunsRestoreVerified");
        run.GetForeignKeys().Should().ContainSingle(foreignKey =>
            foreignKey.IsRequired && foreignKey.PrincipalEntityType.ClrType == typeof(User));

        var action = model.FindEntityType(typeof(Purchasehistoryreconciliationaction));
        action.Should().NotBeNull();
        action!.GetProperties().Select(property => property.Name).Should().Contain(
            nameof(Purchasehistoryreconciliationaction.ActionId),
            nameof(Purchasehistoryreconciliationaction.ActionType),
            nameof(Purchasehistoryreconciliationaction.SourceKey),
            nameof(Purchasehistoryreconciliationaction.SourceSheet),
            nameof(Purchasehistoryreconciliationaction.SourceRow),
            nameof(Purchasehistoryreconciliationaction.BusinessKey),
            nameof(Purchasehistoryreconciliationaction.TargetType),
            nameof(Purchasehistoryreconciliationaction.TargetId),
            nameof(Purchasehistoryreconciliationaction.ReasonCode),
            nameof(Purchasehistoryreconciliationaction.BeforeEvidence),
            nameof(Purchasehistoryreconciliationaction.BeforeHash),
            nameof(Purchasehistoryreconciliationaction.AfterEvidence),
            nameof(Purchasehistoryreconciliationaction.AfterHash),
            nameof(Purchasehistoryreconciliationaction.ActionHash));
        action.FindProperty(nameof(Purchasehistoryreconciliationaction.ActionId))!
            .GetMaxLength().Should().Be(32);
        action.FindProperty(nameof(Purchasehistoryreconciliationaction.ActionHash))!
            .GetMaxLength().Should().Be(64);
        action.FindProperty(nameof(Purchasehistoryreconciliationaction.BeforeHash))!
            .GetMaxLength().Should().Be(64);
        action.FindProperty(nameof(Purchasehistoryreconciliationaction.AfterHash))!
            .GetMaxLength().Should().Be(64);
        action.GetIndexes().Should().Contain(index =>
            index.IsUnique &&
            index.Properties.Select(property => property.Name).SequenceEqual(
                new[]
                {
                    nameof(Purchasehistoryreconciliationaction.PurchaseHistoryReconciliationRunId),
                    nameof(Purchasehistoryreconciliationaction.ActionId)
                }));
        action.GetForeignKeys().Should().ContainSingle(foreignKey =>
            foreignKey.IsRequired &&
            foreignKey.PrincipalEntityType.ClrType == typeof(Purchasehistoryreconciliationrun));
        action.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain(
            "ckPurchaseHistoryReconciliationActionsDisposition",
            "ckPurchaseHistoryReconciliationActionsSourceRow");
    }

    [Fact]
    public async Task Migration_fresh_database_applies_reconciliation_schema()
    {
        if (!MySqlMigrationTestsEnabled())
        {
            return;
        }

        const string database = "ipc_lane8";
        await RecreateDisposableDatabaseAsync(database);
        await BootstrapFreshInstallAsync(database);
        await using var context = CreateMySqlContext(database);

        await context.Database.MigrateAsync();

        (await context.Database.GetAppliedMigrationsAsync()).Should().ContainSingle(
            migration => migration == "20260721120000_AddPurchaseHistoryReconciliation");
        (await context.Purchasehistoryreconciliationruns.CountAsync()).Should().Be(0);
        (await context.Purchasehistoryreconciliationactions.CountAsync()).Should().Be(0);
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'inventoryreceiptlines'
              AND COLUMN_NAME IN (
                'packageQuantitySnapshot',
                'packageBaseUnitIdSnapshot',
                'packagePolicyVersionSnapshot');
            """)).Should().Be(3);
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND CONSTRAINT_NAME IN (
                'ckInventoryReceiptLinesPackageQuantityPositive',
                'ckInventoryReceiptLinesPackageSnapshotComplete',
                'ckPurchaseHistoryReconciliationRunsCounts',
                'ckPurchaseHistoryReconciliationRunsRestoreVerified',
                'ckPurchaseHistoryReconciliationRunsStatus',
                'ckPurchaseHistoryReconciliationActionsDisposition',
                'ckPurchaseHistoryReconciliationActionsSourceRow');
            """)).Should().Be(7);

        // Known pre-existing baseline gap: this proof is scoped to bootstrap-to-09-04,
        // not full model parity, and the fixture must not manufacture these columns.
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'menuversions'
              AND COLUMN_NAME IN ('successRowCount', 'errorRowCount', 'warningRowCount');
            """)).Should().Be(0);
    }

    [Fact]
    public async Task Migration_upgrade_populated_clone_preserves_receipt_history()
    {
        if (!MySqlMigrationTestsEnabled())
        {
            return;
        }

        const string database = "ipc_lane9";
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        await using var context = CreateMySqlContext(database);
        var appliedBefore = (await context.Database.GetAppliedMigrationsAsync()).ToArray();
        appliedBefore.Should().NotContain("20260721120000_AddPurchaseHistoryReconciliation");
        var receiptCountBefore = await context.Inventoryreceipts.CountAsync();
        var lineCountBefore = await context.Inventoryreceiptlines.CountAsync();
        receiptCountBefore.Should().BeGreaterThan(0);
        lineCountBefore.Should().BeGreaterThan(0);
        var fingerprintBefore = await ReceiptHistoryFingerprintAsync(database);

        await context.Database.MigrateAsync();
        context.ChangeTracker.Clear();

        var appliedAfter = (await context.Database.GetAppliedMigrationsAsync()).ToArray();
        appliedAfter.Should().ContainSingle(
            migration => migration == "20260721120000_AddPurchaseHistoryReconciliation");
        appliedAfter.Length.Should().BeGreaterThan(appliedBefore.Length);
        (await context.Inventoryreceipts.CountAsync()).Should().Be(receiptCountBefore);
        (await context.Inventoryreceiptlines.CountAsync()).Should().Be(lineCountBefore);
        (await context.Inventoryreceiptlines.CountAsync(line =>
            line.PackageQuantitySnapshot != null ||
            line.PackageBaseUnitIdSnapshot != null ||
            line.PackagePolicyVersionSnapshot != null)).Should().Be(0);
        (await ReceiptHistoryFingerprintAsync(database)).Should().Be(fingerprintBefore);
    }

    [Theory]
    [InlineData("ipc_lane1", "ipc_e2e_template")]
    [InlineData("ipc_e2e_template", "ipc_lane9")]
    public void Disposable_database_fixture_accepts_lane_template_transitions(string source, string target)
    {
        var action = () => DatabaseClonePolicy.ValidateTransition(source, target);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("ipcmanagement", "ipc_e2e_template")]
    [InlineData("ipc_lane10", "ipc_e2e_template")]
    [InlineData("ipc_lane1", "ipc_lane2")]
    public void Disposable_database_fixture_rejects_non_disposable_connections(string source, string target)
    {
        var action = () => DatabaseClonePolicy.ValidateTransition(source, target);

        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Normalized_date_and_ingredient_key_is_case_insensitive()
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "2026-07-20|Cá nục",
            "2026-07-20|cá nục"
        };

        keys.Should().ContainSingle();
    }

    [Fact]
    public void Parser_reproduces_audited_workbook_baseline_and_deterministic_replay()
    {
        var parser = new PurchaseHistorySourceParser();
        var legacyPath = FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx");
        var currentPath = FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx");

        using var legacyStream = File.OpenRead(legacyPath);
        using var currentStream = File.OpenRead(currentPath);
        var legacy = parser.Parse(legacyStream, new DateOnly(2026, 5, 19));
        var current = parser.Parse(currentStream, new DateOnly(2026, 7, 20));

        current.WorkbookSha256.Should().Be("4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88");
        current.SheetCount.Should().Be(34);
        current.SupplierPolicyCount.Should().Be(31);
        current.RecognizedDataSheetCount.Should().Be(30);
        legacy.ImportableBusinessKeys.Should().HaveCount(14_532);
        current.ImportableBusinessKeys.Should().HaveCount(17_739);
        (current.ImportableBusinessKeys.Count - legacy.ImportableBusinessKeys.Count).Should().Be(3_207);

        var scientificQuantityRows = new Dictionary<int, string>
        {
            [9323] = "2026-05-14|Ngũ điếc",
            [9336] = "2026-05-14|Măng khô",
            [9379] = "2026-05-16|Rau quế"
        };
        foreach (var (sourceRow, expectedBusinessKey) in scientificQuantityRows)
        {
            var candidate = legacy.Candidates.Single(item =>
                item.Trace.SourceSheet == "1.Rau" && item.Trace.SourceRow == sourceRow);
            candidate.Quantity.Should().BeGreaterThan(0);
            candidate.IsImportable.Should().BeTrue();
            candidate.BusinessKey.Should().Be(expectedBusinessKey);
        }

        using var replayStream = File.OpenRead(currentPath);
        var replay = parser.Parse(replayStream, new DateOnly(2026, 7, 20));
        replay.Candidates
            .Select(candidate => $"{candidate.SourceKey}|{candidate.BusinessKey}|{candidate.RowHash}")
            .Should()
            .Equal(current.Candidates.Select(candidate =>
                $"{candidate.SourceKey}|{candidate.BusinessKey}|{candidate.RowHash}"));
    }

    [Fact]
    public void Parser_retains_raw_source_trace_and_current_source_supersedes_legacy_key()
    {
        var parser = new PurchaseHistorySourceParser();
        using var legacyStream = File.OpenRead(
            FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx"));
        using var currentStream = File.OpenRead(
            FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx"));
        var legacy = parser.Parse(legacyStream, new DateOnly(2026, 5, 19));
        var current = parser.Parse(currentStream, new DateOnly(2026, 7, 20));
        var duplicateKey = legacy.ImportableBusinessKeys.Intersect(
            current.ImportableBusinessKeys,
            StringComparer.OrdinalIgnoreCase).First();

        var merged = PurchaseHistorySourceParser.Supersede(legacy.Candidates, current.Candidates);
        var winner = merged.Single(candidate =>
            string.Equals(candidate.BusinessKey, duplicateKey, StringComparison.OrdinalIgnoreCase));

        winner.WorkbookSha256.Should().Be(current.WorkbookSha256);
        winner.Trace.SourceSheet.Should().NotBeNullOrWhiteSpace();
        winner.Trace.SourceRow.Should().BeGreaterThan(0);
        winner.Trace.RawCells.Should().ContainKeys(
            "Ngày Giao hàng",
            "Tên hàng",
            "Đơn vị tính",
            "Số lượng",
            "Đơn giá");
        winner.SourceKey.Should().NotBeNullOrWhiteSpace();
        winner.RowHash.Should().MatchRegex("^[0-9A-F]{64}$");
    }

    [Theory]
    [InlineData(" Rau ", "Rau", null)]
    [InlineData("vịt a việt", "Vịt a Việt", null)]
    [InlineData("Nhà Cung Cấp", null, "SUPPLIER_UNKNOWN")]
    [InlineData("Tổng cộng", null, "SUPPLIER_UNKNOWN")]
    public void Normalization_supplier_allowlist_is_audited_and_blocker_first(
        string rawSupplier,
        string? expectedSupplier,
        string? expectedBlocker)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau", "Vịt a Việt"]);

        var result = policy.NormalizeSupplier(rawSupplier, Trace("Nhà cung cấp", rawSupplier));

        result.Value.Should().Be(expectedSupplier);
        result.Blockers.Select(blocker => blocker.Code).Should().BeEquivalentTo(
            expectedBlocker is null ? [] : [expectedBlocker]);
        result.Blockers.Should().OnlyContain(blocker =>
            blocker.RawValue == rawSupplier &&
            blocker.Trace.SourceSheet == "1.Rau" &&
            blocker.Trace.SourceRow == 42);
    }

    [Theory]
    [InlineData("  CÁ   NỤC  ", "Cá nục", null)]
    [InlineData("Cá nục - Chị Phây", null, "INGREDIENT_SUPPLIER_AMBIGUOUS")]
    [InlineData("", null, "INGREDIENT_MISSING")]
    public void Normalization_ingredient_keeps_supplier_separate_and_blocks_ambiguity(
        string rawIngredient,
        string? expectedIngredient,
        string? expectedBlocker)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Cá - Chị Phây"]);

        var result = policy.NormalizeIngredient(rawIngredient, Trace("Tên hàng", rawIngredient));

        result.Value?.IngredientName.Should().Be(expectedIngredient);
        result.Value?.SupplierName.Should().BeNull();
        result.Blockers.Select(blocker => blocker.Code).Should().BeEquivalentTo(
            expectedBlocker is null ? [] : [expectedBlocker]);
    }

    [Theory]
    [InlineData("kg", "KG", null)]
    [InlineData("KGS", "KG", null)]
    [InlineData("ký", "KG", null)]
    [InlineData("bịch", "BICH", null)]
    [InlineData("hủ", "HU", null)]
    [InlineData("loốc", "LOC", null)]
    [InlineData("cay", "CAY", null)]
    [InlineData("lất", "LAT", null)]
    [InlineData("kh", null, "UNIT_AMBIGUOUS")]
    [InlineData("canh", null, "UNIT_AMBIGUOUS")]
    [InlineData("Bành", null, "UNIT_UNKNOWN")]
    public void Normalization_unit_aliases_are_bounded(
        string rawUnit,
        string? expectedUnit,
        string? expectedBlocker)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau"]);

        var result = policy.NormalizeUnit(rawUnit, Trace("Đơn vị tính", rawUnit));

        result.Value.Should().Be(expectedUnit);
        result.Blockers.Select(blocker => blocker.Code).Should().BeEquivalentTo(
            expectedBlocker is null ? [] : [expectedBlocker]);
    }

    [Theory]
    [InlineData("Bịch (10 cái)", false, 10d, "CAI", null)]
    [InlineData("BICH", false, null, null, null)]
    [InlineData("BICH", true, 12d, "CAI", null)]
    public void Normalization_package_snapshots_decorated_or_period_scoped_sizes(
        string rawUnit,
        bool requiresCrossUnitConversion,
        double? expectedSize,
        string? expectedBaseUnit,
        string? expectedBlocker)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(
            ["Tạp hóa Huệ"],
            packageRules:
            [
                new PurchaseHistoryPackageRule(
                    "Bao tay",
                    "Tạp hóa Huệ",
                    new DateOnly(2026, 7, 1),
                    new DateOnly(2026, 7, 31),
                    12,
                    "CAI")
            ]);

        var result = policy.NormalizePackage(
            rawUnit,
            "Bao tay",
            "Tạp hóa Huệ",
            new DateOnly(2026, 7, 20),
            requiresCrossUnitConversion,
            Trace("Đơn vị tính", rawUnit));

        result.Value?.PackageSize.Should().Be(expectedSize is null ? null : (decimal?)expectedSize.Value);
        result.Value?.BaseUnitCode.Should().Be(expectedBaseUnit);
        result.Blockers.Select(blocker => blocker.Code).Should().BeEquivalentTo(
            expectedBlocker is null ? [] : [expectedBlocker]);
    }

    [Fact]
    public void Normalization_plain_bich_blocks_when_required_package_rule_is_missing()
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau"]);

        var result = policy.NormalizePackage(
            "BICH",
            "Rau quế",
            "Rau",
            new DateOnly(2026, 7, 20),
            requiresCrossUnitConversion: true,
            Trace("Đơn vị tính", "BICH"));

        result.Value.Should().BeNull();
        result.Blockers.Should().ContainSingle(blocker =>
            blocker.Code == "PACKAGE_SIZE_REQUIRED" && blocker.RawValue == "BICH");
    }

    [Theory]
    [InlineData("2026-07-20", 2026, 7, 20, null)]
    [InlineData("2026-07-27", 2026, 7, 27, null)]
    [InlineData("2026-07-28", 2026, 7, 28, "DATE_AFTER_AS_OF_WINDOW")]
    [InlineData("2035-01-01", 2035, 1, 1, "DATE_AFTER_AS_OF_WINDOW")]
    public void Normalization_historical_date_has_a_strict_seven_day_future_window(
        string rawDate,
        int year,
        int month,
        int day,
        string? expectedBlocker)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau"]);

        var result = policy.ValidateHistoricalDate(
            rawDate,
            new DateOnly(year, month, day),
            new DateOnly(2026, 7, 20),
            Trace("Ngày Giao hàng", rawDate));

        result.Blockers.Select(blocker => blocker.Code).Should().BeEquivalentTo(
            expectedBlocker is null ? [] : [expectedBlocker]);
    }

    [Fact]
    public void Normalization_parser_routes_every_candidate_once_and_retains_blocker_evidence()
    {
        var parser = new PurchaseHistorySourceParser();
        using var stream = File.OpenRead(
            FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx"));

        var result = parser.Parse(stream, new DateOnly(2026, 7, 20));

        result.Candidates.Should().OnlyContain(candidate => candidate.Normalization != null);
        result.Candidates
            .SelectMany(candidate => candidate.Normalization!.Blockers)
            .Should()
            .OnlyContain(blocker =>
                blocker.Trace.SourceRow > 0 &&
                blocker.Trace.RawCells.Count > 0);
    }

    [Fact]
    public void Normalization_dto_contract_omits_client_paths_actors_and_replacements()
    {
        var requestTypes = new[]
        {
            typeof(PurchaseHistoryPreviewRequestDto),
            typeof(PurchaseHistoryApplyRequestDto)
        };
        var forbiddenFragments = new[]
        {
            "Path", "Directory", "Actor", "UserId", "Replacement", "Normalized"
        };

        requestTypes
            .SelectMany(type => type.GetProperties())
            .Select(property => property.Name)
            .Should()
            .NotContain(name => forbiddenFragments.Any(fragment =>
                name.Contains(fragment, StringComparison.OrdinalIgnoreCase)));

        var invalid = new PurchaseHistoryApplyRequestDto();
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(invalid, new ValidationContext(invalid), errors, validateAllProperties: true)
            .Should().BeFalse();
        errors.Select(error => error.MemberNames.Single()).Should().Contain(
            nameof(PurchaseHistoryApplyRequestDto.ManifestId),
            nameof(PurchaseHistoryApplyRequestDto.ManifestHash),
            nameof(PurchaseHistoryApplyRequestDto.AcceptedActionIds),
            nameof(PurchaseHistoryApplyRequestDto.BackupRestoreEvidence));
    }

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
        first.Manifest.ActionCounts.Should().Contain(new KeyValuePair<string, int>("keep", 1));
        first.Manifest.ActionCounts.Should().Contain(new KeyValuePair<string, int>("version", 1));
        first.Actions.Should().OnlyContain(action =>
            action.ActionHash.Length == 64 &&
            action.BeforeHash.Length == 64 &&
            action.AfterHash.Length == 64 &&
            !string.IsNullOrWhiteSpace(action.ReasonCode));
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
        context.Stockmovements.Add(new Stockmovement
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
        preview.Actions.Should().ContainSingle(action =>
            action.ActionType == "keep" &&
            action.TargetId == Convert.ToHexString(linkedLine.ReceiptLineId) &&
            action.ReasonCode == "IMMUTABLE_DEPENDENCY_PRESERVED");
        preview.Actions.Should().NotContain(action =>
            action.ActionType == "delete" && action.TargetId == Convert.ToHexString(linkedLine.ReceiptLineId));
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

    [Fact]
    public async Task PreviewEndpoint_allows_manager_and_uses_server_identity()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        service.PreviewAsync(Arg.Any<CancellationToken>()).Returns(new PurchaseHistoryPreviewDto
        {
            Manifest = new PurchaseHistoryManifestDto
            {
                ManifestId = "manifest-1",
                ManifestHash = new string('C', 64)
            }
        });
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequestDto());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<PurchaseHistoryPreviewDto>>();
        payload!.Data!.PreviewedBy.Should().Be("preview-test-user");
        payload.Data.Manifest.ManifestId.Should().Be("manifest-1");
        await service.Received(1).PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Chef", HttpStatusCode.Forbidden)]
    public async Task PreviewEndpoint_rejects_unauthorized_callers_before_source_access(
        string? role,
        HttpStatusCode expectedStatus)
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, role);
        }

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequestDto());

        response.StatusCode.Should().Be(expectedStatus);
        await service.DidNotReceive().PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PreviewEndpoint_is_hidden_in_production_before_source_access()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Production");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequestDto());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        await service.DidNotReceive().PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Fact(Skip = "Plan 09-05 owns immutable-history apply and no-op replay behavior.")]
    public void Apply_preserves_immutable_history_and_second_apply_is_no_op()
    {
        Assert.Fail("Plan 09-05 must implement guarded apply and idempotent replay.");
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

    private static PurchaseHistorySourceTrace Trace(string field, string rawValue)
        => new(
            "1.Rau",
            42,
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [field] = rawValue
            });

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"purchase-history-preview-{Guid.NewGuid():N}")
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

    private static async Task RecreateDisposableDatabaseAsync(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var builder = new MySqlConnectionStringBuilder(DisposableConnectionString(database))
        {
            Database = "mysql"
        };
        await using var connection = new MySqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS `{database}`; " +
                              $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
        await command.ExecuteNonQueryAsync();
    }

    private static async Task BootstrapFreshInstallAsync(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        const string duplicateApprovalHistoryIndex =
            "CREATE INDEX        ixApprovalHistoriesTarget     ON approvalhistories(targetType, targetId, actionAt);";
        const string duplicateApproverIndex =
            "CREATE INDEX        IX_approvalassignments_approverUserId ON approvalassignments(approverUserId);";
        var schema = await File.ReadAllTextAsync(
            FindRepositoryFile("backend", "database", "IPCmanagement.sql"));
        schema.Should().Contain(duplicateApprovalHistoryIndex);
        schema.Should().Contain(duplicateApproverIndex);
        schema.Should().NotContain("successRowCount");
        schema.Should().NotContain("errorRowCount");
        schema.Should().NotContain("warningRowCount");
        schema = schema
            .Replace(
                "CREATE DATABASE IF NOT EXISTS ipcManagement",
                $"CREATE DATABASE IF NOT EXISTS `{database}`",
                StringComparison.Ordinal)
            .Replace("USE ipcManagement;", $"USE `{database}`;", StringComparison.Ordinal)
            .Replace(duplicateApprovalHistoryIndex, string.Empty, StringComparison.Ordinal)
            .Replace(duplicateApproverIndex, string.Empty, StringComparison.Ordinal);

        await ExecuteSqlScriptAsync(database, schema);
        await ExecuteSqlScriptAsync(
            database,
            await File.ReadAllTextAsync(
                FindRepositoryFile("backend", "database", "Init_EF_History_For_Old_DB.sql")));

        // The official fresh schema already contains these four schema changes, while its
        // history initializer omits their IDs. Register only those proven baseline gaps so
        // every later migration still executes and any unrelated schema failure remains visible.
        await ExecuteSqlScriptAsync(
            database,
            """
            INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
              ('20260702061320_AddImportAuditFields', '9.0.16'),
              ('20260702072352_AddProductionPlanUpdatedAt', '9.0.16'),
              ('20260702124738_AddSupplierQuotations', '9.0.16'),
              ('20260702164531_AddPurchaseOrders', '9.0.16');
            """);
    }

    private static async Task ExecuteSqlScriptAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 120;
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<long> SchemaObjectCountAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static string DisposableConnectionString(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        using var settings = JsonDocument.Parse(
            File.ReadAllText(FindRepositoryFile("backend", "src", "IPCManagement.Api", "appsettings.json")));
        var configured = settings.RootElement
            .GetProperty("ConnectionStrings")
            .GetProperty("DefaultConnection")
            .GetString() ?? throw new InvalidOperationException("DefaultConnection is missing.");
        return new MySqlConnectionStringBuilder(configured)
        {
            Database = database
        }.ConnectionString;
    }

    private static async Task<string> ReceiptHistoryFingerprintAsync(string database)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT payload
            FROM (
                SELECT CONCAT_WS('|',
                    'R', HEX(receiptId), receiptCode, DATE_FORMAT(receiptDate, '%Y-%m-%d'),
                    HEX(warehouseId), HEX(supplierId), COALESCE(HEX(purchaseRequestId), '<NULL>'),
                    HEX(createdBy), DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s.%f')) AS payload,
                    CONCAT('R|', HEX(receiptId)) AS sortKey
                FROM inventoryreceipts
                UNION ALL
                SELECT CONCAT_WS('|',
                    'L', HEX(receiptLineId), HEX(receiptId), COALESCE(HEX(purchaseRequestLineId), '<NULL>'),
                    HEX(ingredientId), HEX(unitId), CAST(quantity AS CHAR), CAST(unitPrice AS CHAR),
                    COALESCE(CAST(amount AS CHAR), '<NULL>'), COALESCE(lotNumber, '<NULL>'),
                    COALESCE(DATE_FORMAT(manufactureDate, '%Y-%m-%d'), '<NULL>'),
                    COALESCE(DATE_FORMAT(expiredDate, '%Y-%m-%d'), '<NULL>')) AS payload,
                    CONCAT('L|', HEX(receiptLineId)) AS sortKey
                FROM inventoryreceiptlines
            ) AS receiptHistory
            ORDER BY sortKey;
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

    private static async Task SeedCatalogAsync(IpcManagementContext context)
    {
        context.Units.Add(new Unit
        {
            UnitId = Id(10),
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = Id(20),
            IngredientCode = "ING-RAU-MUONG",
            IngredientName = "Rau muống",
            UnitId = Id(10),
            WarehouseId = Id(40),
            ReferencePrice = 25_000,
            IsFreshDaily = true,
            IsActive = true
        });
        context.Suppliers.Add(new Supplier
        {
            SupplierId = Id(30),
            SupplierCode = "SUP-RAU",
            SupplierName = "Rau",
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task<Inventoryreceiptline> SeedReceiptAsync(
        IpcManagementContext context,
        string receiptCode,
        DateOnly receiptDate,
        byte[] supplierId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        decimal unitPrice,
        string lotNumber,
        byte[]? purchaseRequestId = null)
    {
        var sequence = context.Inventoryreceipts.Local.Count + 50;
        var receipt = new Inventoryreceipt
        {
            ReceiptId = Id(sequence),
            ReceiptCode = receiptCode,
            ReceiptDate = receiptDate,
            WarehouseId = Id(40),
            SupplierId = supplierId,
            PurchaseRequestId = purchaseRequestId,
            CreatedBy = Id(41),
            CreatedAt = new DateTime(2026, 7, 20)
        };
        var line = new Inventoryreceiptline
        {
            ReceiptLineId = Id(sequence + 20),
            ReceiptId = receipt.ReceiptId,
            IngredientId = ingredientId,
            UnitId = unitId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            Amount = quantity * unitPrice,
            LotNumber = lotNumber
        };
        context.Inventoryreceipts.Add(receipt);
        context.Inventoryreceiptlines.Add(line);
        await context.SaveChangesAsync();
        return line;
    }

    private static PurchaseHistoryReconciliationService CreatePreviewService(
        IpcManagementContext context,
        params PurchaseHistorySourceCandidate[] candidates)
        => CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidates);

    private static PurchaseHistoryReconciliationService CreatePreviewService(
        IpcManagementContext context,
        string sourceHash,
        DateOnly asOfDate,
        string policyVersion,
        params PurchaseHistorySourceCandidate[] candidates)
        => new(
            context,
            () => new PurchaseHistoryPreviewSource(
                "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx",
                new PurchaseHistoryParseResult(
                    sourceHash,
                    asOfDate,
                    1,
                    1,
                    1,
                    candidates),
                policyVersion));

    private static PurchaseHistorySourceCandidate Candidate(
        string sheet,
        int row,
        string supplier,
        string ingredient,
        string unit,
        DateOnly date,
        decimal quantity,
        decimal unitPrice)
    {
        var sourceKey = $"{sheet}|{row}";
        var businessKey = $"{date:yyyy-MM-dd}|{ingredient}";
        return new PurchaseHistorySourceCandidate(
            new string('A', 64),
            supplier,
            ingredient,
            unit,
            date,
            quantity,
            unitPrice,
            sourceKey,
            businessKey,
            new string('B', 64),
            new PurchaseHistorySourceTrace(
                sheet,
                row,
                new Dictionary<string, string>
                {
                    ["Nhà cung cấp"] = supplier,
                    ["Tên hàng"] = ingredient,
                    ["Đơn vị tính"] = unit,
                    ["Ngày Giao hàng"] = date.ToString("yyyy-MM-dd"),
                    ["Số lượng"] = quantity.ToString(),
                    ["Đơn giá"] = unitPrice.ToString()
                }))
        {
            Normalization = new PurchaseHistoryNormalizationResult(
                PurchaseHistoryPolicyVersion.Current,
                supplier,
                ingredient,
                unit,
                new PurchaseHistoryPackageSnapshot(unit, null, null),
                date,
                [])
        };
    }

    private static async Task<(int Suppliers, int Ingredients, int Receipts, int Lines, int Movements)> DatabaseCountsAsync(
        IpcManagementContext context)
        => (
            await context.Suppliers.CountAsync(),
            await context.Ingredients.CountAsync(),
            await context.Inventoryreceipts.CountAsync(),
            await context.Inventoryreceiptlines.CountAsync(),
            await context.Stockmovements.CountAsync());

    private static byte[] Id(int value)
    {
        var bytes = new byte[16];
        BitConverter.GetBytes(value).CopyTo(bytes, 0);
        return bytes;
    }

    private static async Task<WebApplication> CreatePreviewEndpointAppAsync(
        IPurchaseHistoryReconciliationService reconciliationService,
        string environmentName)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environmentName
        });
        builder.WebHost.UseTestServer();
        builder.Services
            .AddAuthentication(PreviewTestAuthHandler.AuthScheme)
            .AddScheme<AuthenticationSchemeOptions, PreviewTestAuthHandler>(
                PreviewTestAuthHandler.AuthScheme,
                _ => { });
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.CatalogAccess, policy =>
                policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CatalogRoles));
        });
        builder.Services.AddSingleton(reconciliationService);
        builder.Services.AddSingleton(Substitute.For<ISampleDataImportService>());
        builder.Services.AddControllers().AddApplicationPart(typeof(SampleDataController).Assembly);

        var app = builder.Build();
        app.UseMiddleware<SampleDataProductionGuardMiddleware>();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }

    private sealed class PreviewTestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string AuthScheme = "PurchaseHistoryPreviewTest";
        public const string RoleHeader = "X-Test-Role";

        public PreviewTestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(RoleHeader, out var role) || string.IsNullOrWhiteSpace(role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var identity = new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, "preview-test-user"),
                    new Claim(ClaimTypes.Role, role.ToString())
                ],
                AuthScheme);
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), AuthScheme);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
