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
    public void PersistenceContract_reconciliation_run_and_actions_bind_complete_audit_evidence()
    {
        using var context = CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;

        var run = model.FindEntityType(typeof(PurchaseHistoryReconciliationRun));
        run.Should().NotBeNull();
        run!.GetProperties().Select(property => property.Name).Should().Contain(
            nameof(PurchaseHistoryReconciliationRun.ManifestId),
            nameof(PurchaseHistoryReconciliationRun.ManifestHash),
            nameof(PurchaseHistoryReconciliationRun.SourceName),
            nameof(PurchaseHistoryReconciliationRun.SourceSha256),
            nameof(PurchaseHistoryReconciliationRun.PolicyVersion),
            nameof(PurchaseHistoryReconciliationRun.AsOfDate),
            nameof(PurchaseHistoryReconciliationRun.DatabaseFingerprint),
            nameof(PurchaseHistoryReconciliationRun.BackupIdentifier),
            nameof(PurchaseHistoryReconciliationRun.BackupTargetFingerprint),
            nameof(PurchaseHistoryReconciliationRun.RestoreFingerprint),
            nameof(PurchaseHistoryReconciliationRun.RestoreVerified),
            nameof(PurchaseHistoryReconciliationRun.AppliedBy),
            nameof(PurchaseHistoryReconciliationRun.Status),
            nameof(PurchaseHistoryReconciliationRun.CandidateCount),
            nameof(PurchaseHistoryReconciliationRun.CurrentUniqueBusinessKeyCount),
            nameof(PurchaseHistoryReconciliationRun.AuditedDeltaCount),
            nameof(PurchaseHistoryReconciliationRun.ActionCount),
            nameof(PurchaseHistoryReconciliationRun.BlockerCount));
        run.FindProperty(nameof(PurchaseHistoryReconciliationRun.ManifestHash))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(PurchaseHistoryReconciliationRun.SourceSha256))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(PurchaseHistoryReconciliationRun.DatabaseFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(PurchaseHistoryReconciliationRun.BackupTargetFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.FindProperty(nameof(PurchaseHistoryReconciliationRun.RestoreFingerprint))!
            .GetMaxLength().Should().Be(64);
        run.GetIndexes().Should().Contain(index =>
            index.IsUnique &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(PurchaseHistoryReconciliationRun.ManifestHash) }));
        run.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain(
            "ckPurchaseHistoryReconciliationRunsCounts",
            "ckPurchaseHistoryReconciliationRunsStatus",
            "ckPurchaseHistoryReconciliationRunsRestoreVerified");
        run.GetForeignKeys().Should().ContainSingle(foreignKey =>
            foreignKey.IsRequired && foreignKey.PrincipalEntityType.ClrType == typeof(User));

        var action = model.FindEntityType(typeof(PurchaseHistoryReconciliationAction));
        action.Should().NotBeNull();
        action!.GetProperties().Select(property => property.Name).Should().Contain(
            nameof(PurchaseHistoryReconciliationAction.ActionId),
            nameof(PurchaseHistoryReconciliationAction.ActionType),
            nameof(PurchaseHistoryReconciliationAction.SourceKey),
            nameof(PurchaseHistoryReconciliationAction.SourceSheet),
            nameof(PurchaseHistoryReconciliationAction.SourceRow),
            nameof(PurchaseHistoryReconciliationAction.BusinessKey),
            nameof(PurchaseHistoryReconciliationAction.TargetType),
            nameof(PurchaseHistoryReconciliationAction.TargetId),
            nameof(PurchaseHistoryReconciliationAction.ReasonCode),
            nameof(PurchaseHistoryReconciliationAction.BeforeEvidence),
            nameof(PurchaseHistoryReconciliationAction.BeforeHash),
            nameof(PurchaseHistoryReconciliationAction.AfterEvidence),
            nameof(PurchaseHistoryReconciliationAction.AfterHash),
            nameof(PurchaseHistoryReconciliationAction.ActionHash));
        action.FindProperty(nameof(PurchaseHistoryReconciliationAction.ActionId))!
            .GetMaxLength().Should().Be(32);
        action.FindProperty(nameof(PurchaseHistoryReconciliationAction.ActionHash))!
            .GetMaxLength().Should().Be(64);
        action.FindProperty(nameof(PurchaseHistoryReconciliationAction.BeforeHash))!
            .GetMaxLength().Should().Be(64);
        action.FindProperty(nameof(PurchaseHistoryReconciliationAction.AfterHash))!
            .GetMaxLength().Should().Be(64);
        action.GetIndexes().Should().Contain(index =>
            index.IsUnique &&
            index.Properties.Select(property => property.Name).SequenceEqual(
                new[]
                {
                    nameof(PurchaseHistoryReconciliationAction.PurchaseHistoryReconciliationRunId),
                    nameof(PurchaseHistoryReconciliationAction.ActionId)
                }));
        action.GetForeignKeys().Should().ContainSingle(foreignKey =>
            foreignKey.IsRequired &&
            foreignKey.PrincipalEntityType.ClrType == typeof(PurchaseHistoryReconciliationRun));
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

        // Ba cột này TỪNG được ghim là "known baseline gap" với kỳ vọng Be(0), vì fixture đánh
        // dấu sẵn 20260702061320_AddImportAuditFields là đã applied nên migration không bao giờ
        // chạy. Nhưng entity MenuVersion khai SuccessRowCount/ErrorRowCount/WarningRowCount và
        // database đang chạy có đủ cả ba — tức database cài mới đang THIẾU cột so với model.
        // Đã bỏ ID đó khỏi danh sách đánh dấu sẵn nên migration chạy thật; kỳ vọng lật thành 3.
        (await SchemaObjectCountAsync(
            database,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'menuversions'
              AND COLUMN_NAME IN ('successRowCount', 'errorRowCount', 'warningRowCount');
            """)).Should().Be(3);
    }

    [Fact]
    public async Task Migration_upgrade_populated_clone_preserves_receipt_history()
    {
        if (!MySqlMigrationTestsEnabled())
        {
            return;
        }

        const string database = "ipc_lane9";
        await PrepareUpgradeMigrationFixtureAsync(
            database,
            "20260719143000_AddSupplementalMaterialRequests");
        await SeedReceiptUpgradeFixtureAsync(database);
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

    [PrivateWorkbookFact]
    public void Parser_reproduces_audited_current_workbook_baseline_and_deterministic_replay()
    {
        var parser = new PurchaseHistorySourceParser();
        var currentPath = FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx");

        using var currentStream = File.OpenRead(currentPath);
        var current = parser.Parse(currentStream, new DateOnly(2026, 7, 20));

        current.WorkbookSha256.Should().Be("4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88");
        current.SheetCount.Should().Be(34);
        current.SupplierPolicyCount.Should().Be(31);
        current.RecognizedDataSheetCount.Should().Be(30);
        current.ImportableBusinessKeys.Should().HaveCount(17_739);

        using var replayStream = File.OpenRead(currentPath);
        var replay = parser.Parse(replayStream, new DateOnly(2026, 7, 20));
        replay.Candidates
            .Select(candidate => $"{candidate.SourceKey}|{candidate.BusinessKey}|{candidate.RowHash}")
            .Should()
            .Equal(current.Candidates.Select(candidate =>
                $"{candidate.SourceKey}|{candidate.BusinessKey}|{candidate.RowHash}"));
    }

    [PrivateWorkbookFact]
    public void Parser_retains_raw_source_trace_for_current_workbook()
    {
        var parser = new PurchaseHistorySourceParser();
        using var currentStream = File.OpenRead(
            FindRepositoryFile(".docs", "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx"));
        var current = parser.Parse(currentStream, new DateOnly(2026, 7, 20));
        var winner = current.Candidates.First(candidate => candidate.IsImportable);

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
    [InlineData("Cá nục bông 200 - 400", "Cá nục bông 200 - 400", null)]
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
    [InlineData("Cảithiaf", "Cải thìa")]
    [InlineData("Nấm bào ngừ", "Nấm bào ngư")]
    [InlineData("Bì ngòi xanh", "Bí ngòi xanh")]
    [InlineData("dđu đủ", "Đu đủ")]
    [InlineData("Đường cắt trắng", "Đường cát trắng")]
    [InlineData("Đù gà chay", "Đùi gà chay")]
    [InlineData("Heo mỡ có da", "Mỡ heo có da")]
    [InlineData("Căn cuộn chay", "Căn cuộn")]
    [InlineData("Dẻ sườn bò", "Thịt dẻ sườn bò")]
    [InlineData("Thịt bò dẻ sườn", "Thịt dẻ sườn bò")]
    [InlineData("Thăn bò", "Thịt thăn bò")]
    [InlineData("Bông lí", "Bông thiên lý")]
    [InlineData("Đùi má", "Má đùi gà")]
    [InlineData("Heo đùi mông ( đặc tề sẵn)", "Heo đùi mông đặc (tề sẵn)")]
    [InlineData("Bông cải xanh", "Súp lơ xanh")]
    public void Normalization_ingredient_applies_only_approved_typo_aliases(
        string rawIngredient,
        string expectedIngredient)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau"]);

        var result = policy.NormalizeIngredient(rawIngredient, Trace("Tên hàng", rawIngredient));

        result.Value?.IngredientName.Should().Be(expectedIngredient);
        result.Value?.SupplierName.Should().BeNull();
        result.Blockers.Should().BeEmpty();
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
    [InlineData("g", "G", null)]
    [InlineData("k", "KG", null)]
    [InlineData("lát nhỏ", "LAT", null)]
    [InlineData("kh", null, "UNIT_AMBIGUOUS")]
    [InlineData("canh", null, "UNIT_AMBIGUOUS")]
    [InlineData("Bành", "BICH", null)]
    [InlineData("vit", "VIT", null)]
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
    [InlineData("bao", "BAO")]
    [InlineData("CAN", "CAN")]
    [InlineData("cặp", "CAP")]
    [InlineData("CỤC", "CUC")]
    [InlineData("đôi", "DOI")]
    [InlineData("LON", "LON")]
    [InlineData("lít", "LIT")]
    [InlineData("PHẦN", "PHAN")]
    [InlineData("trái", "TRAI")]
    [InlineData("VỈ", "VI")]
    [InlineData("viên", "VIEN")]
    [InlineData("XẤP", "XAP")]
    [InlineData("bó", "BO_BUNCH")]
    [InlineData("BỘ", "BO_SET")]
    [InlineData("bình", "BINH")]
    [InlineData("CHIẾC", "CHIEC")]
    [InlineData("con", "CON")]
    [InlineData("BÌ", "BI")]
    public void Normalization_approved_canonical_units_is_case_insensitive(
        string rawUnit,
        string expectedUnit)
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Rau"]);

        var result = policy.NormalizeUnit(rawUnit, Trace("Đơn vị tính", rawUnit));

        result.Value.Should().Be(expectedUnit);
        result.Blockers.Should().BeEmpty();
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

    [Fact]
    public void Normalization_full_candidate_accepts_explicit_decorated_package_evidence()
    {
        var policy = new PurchaseHistoryNormalizationPolicy(["Tạp hóa Huệ"]);
        var candidate = Candidate(
            "1.Rau",
            42,
            "Tạp hóa Huệ",
            "Bao tay",
            "Bịch (10 cái)",
            new DateOnly(2026, 7, 20),
            2,
            25_000);

        var result = policy.Normalize(candidate, new DateOnly(2026, 7, 20));

        result.UnitCode.Should().Be("BICH");
        result.Package.Should().Be(
            new PurchaseHistoryPackageSnapshot("BICH", 10, "CAI"));
        result.Blockers.Should().BeEmpty();
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

    [PrivateWorkbookFact]
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
            typeof(PurchaseHistoryPreviewRequest),
            typeof(PurchaseHistoryApplyRequest)
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

        var invalid = new PurchaseHistoryApplyRequest();
        var errors = new List<ValidationResult>();
        Validator.TryValidateObject(invalid, new ValidationContext(invalid), errors, validateAllProperties: true)
            .Should().BeFalse();
        errors.Select(error => error.MemberNames.Single()).Should().Contain(
            nameof(PurchaseHistoryApplyRequest.ManifestId),
            nameof(PurchaseHistoryApplyRequest.ManifestHash),
            nameof(PurchaseHistoryApplyRequest.AcceptedActionIds),
            nameof(PurchaseHistoryApplyRequest.BackupRestoreEvidence));
    }

}
