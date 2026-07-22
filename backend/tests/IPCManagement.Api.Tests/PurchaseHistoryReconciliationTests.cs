using FluentAssertions;
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

    [Fact(Skip = "Plan 09-02 owns the pure purchase-history preview parser.")]
    public void Preview_contract_requires_phase_09_02_parser()
    {
        Assert.Fail("Plan 09-02 must implement the pure purchase-history preview parser.");
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
}
