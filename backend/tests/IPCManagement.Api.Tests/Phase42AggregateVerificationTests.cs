using System.Text.Json;
using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class Phase42AggregateVerificationTests
{
    private static readonly string[] Requirements =
    [
        "DCR-01", "DCR-02", "DCR-03", "DCR-04", "DCR-05",
        "DCR-06", "DCR-07", "DCR-08", "DCR-09", "VER-03",
    ];

    private static readonly string[] EvidenceFields =
    [
        "gateId", "requirementId", "command", "commandVersion", "sourceCommit",
        "target", "migrationHead", "inputHashes", "artifactPath", "status",
        "exitCode", "counts", "stdoutSha256", "stderrSha256", "redactedError",
    ];

    [Fact]
    public void Gate_spec_should_define_one_strict_ordered_contract()
    {
        using var document = ReadGateSpec();
        var root = document.RootElement;
        var gates = root.GetProperty("gates").EnumerateArray().ToArray();
        var ids = gates.Select(gate => gate.GetProperty("id").GetString()).ToArray();

        ids.Should().OnlyHaveUniqueItems();
        gates.Select(gate => gate.GetProperty("order").GetInt32())
            .Should().Equal(Enumerable.Range(1, gates.Length));
        gates.First().GetProperty("stage").GetString().Should().Be("W0");
        IndexOfRequirement(gates, "DCR-01").Should().BeLessThan(IndexOfRequirement(gates, "DCR-07"));
        IndexOfRequirement(gates, "DCR-07").Should().BeLessThan(IndexOfRequirement(gates, "DCR-09"));
        IndexOfRequirement(gates, "DCR-09").Should().BeLessThan(IndexOfRequirement(gates, "VER-03"));

        gates.Select(gate => gate.GetProperty("requirementId").GetString())
            .Where(value => value is not null)
            .Distinct()
            .Should().Equal(Requirements);
    }

    [Fact]
    public void Gate_spec_should_require_complete_exact_command_evidence()
    {
        using var document = ReadGateSpec();
        var root = document.RootElement;

        root.GetProperty("requirementsTotal").GetInt32().Should().Be(10);
        root.GetProperty("requiredEvidenceFields").EnumerateArray()
            .Select(item => item.GetString()).Should().Equal(EvidenceFields);

        foreach (var gate in root.GetProperty("gates").EnumerateArray())
        {
            gate.GetProperty("command").GetString().Should().NotBeNullOrWhiteSpace();
            gate.GetProperty("versionCommand").GetString().Should().NotBeNullOrWhiteSpace();
            gate.GetProperty("targetMode").GetString().Should().BeOneOf("none", "explicit");
            gate.GetProperty("requiredArtifacts").ValueKind.Should().Be(JsonValueKind.Array);
        }
    }

    [Theory]
    [InlineData("BLOCKED_BUSINESS")]
    [InlineData("BLOCKED_EXTERNAL")]
    [InlineData("NEEDS_CONFIRMATION")]
    [InlineData("STALE")]
    [InlineData("EXPIRED")]
    [InlineData("PLACEHOLDER")]
    [InlineData("MISSING_ARTIFACT")]
    public void Gate_spec_should_list_every_non_terminal_status_as_failure(string status)
    {
        using var document = ReadGateSpec();

        document.RootElement.GetProperty("failureStatuses").EnumerateArray()
            .Select(item => item.GetString()).Should().Contain(status);
    }

    [Fact]
    public void Gate_spec_should_make_run_target_receipts_and_teardown_first_class_inputs()
    {
        using var document = ReadGateSpec();
        var root = document.RootElement;
        var inputs = root.GetProperty("requiredExecutionInputs").EnumerateArray()
            .Select(item => item.GetString()).ToArray();
        var artifacts = root.GetProperty("gates").EnumerateArray()
            .SelectMany(gate => gate.GetProperty("requiredArtifacts").EnumerateArray())
            .Select(item => item.GetString()).ToArray();

        inputs.Should().Contain(["runId", "target"]);
        artifacts.Should().Contain([
            "source-owner-attestations", "provider-object-receipt",
            "restore-teardown", "rehearsal-teardown",
        ]);
    }

    private static int IndexOfRequirement(JsonElement[] gates, string requirement)
        => Array.FindIndex(gates, gate => gate.GetProperty("requirementId").GetString() == requirement);

    private static JsonDocument ReadGateSpec()
        => JsonDocument.Parse(File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "standardization", "phase42-verification-gates.json")));

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
    }
}
