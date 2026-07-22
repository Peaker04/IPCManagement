using FluentAssertions;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.DatabaseTool;

namespace IPCManagement.Api.Tests;

public class PurchaseHistoryReconciliationTests
{
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

    [Fact(Skip = "Plan 09-02 owns ambiguous-unit and ambiguous-supplier diagnostics.")]
    public void Preview_blocks_ambiguous_rows_with_source_evidence()
    {
        Assert.Fail("Plan 09-02 must retain sheet, row, raw cells, and blocker diagnostics.");
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
}
