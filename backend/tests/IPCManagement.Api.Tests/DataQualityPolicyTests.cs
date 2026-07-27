using FluentAssertions;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class DataQualityPolicyTests
{
    [Fact]
    public void BuildIssue_Should_DeriveStablePriorityOwnerAndSlaFromInputs()
    {
        var now = new DateTime(2026, 7, 28, 1, 2, 3, DateTimeKind.Utc);

        var issue = DataQualityPolicy.BuildIssue(
            "inventory_ledger_mismatch",
            "error",
            "CurrentStock",
            "warehouse:ingredient",
            "WH-01",
            "Gạo",
            "Ledger mismatch",
            "Reconcile ledger",
            "/reports",
            now);

        issue.IssueId.Should().Be("inventory_ledger_mismatch:CurrentStock:warehouse:ingredient");
        issue.Owner.Should().Be("Thủ kho");
        issue.PriorityRank.Should().Be(1);
        issue.SlaHours.Should().Be(2);
        issue.SlaDueAt.Should().Be(now.AddHours(2));
        issue.SlaLabel.Should().Be("P1 / 2h");
    }

    [Theory]
    [InlineData("resolved", "resolved")]
    [InlineData(" REOPENED ", "reopened")]
    [InlineData(null, "open")]
    [InlineData("unknown", "open")]
    public void NormalizeRemediationStatus_Should_MapOnlySupportedStates(string? value, string expected)
        => DataQualityPolicy.NormalizeRemediationStatus(value).Should().Be(expected);
}
