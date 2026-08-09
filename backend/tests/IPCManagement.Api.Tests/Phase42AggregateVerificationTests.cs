using System.Text.Json;
using System.Diagnostics;
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

    [Fact]
    public void Contract_only_runner_should_enumerate_every_gate_and_evidence_field()
    {
        var output = Path.Combine(Path.GetTempPath(), $"phase42-contract-{Guid.NewGuid():N}.json");
        try
        {
            var result = RunVerifier(
                $"-ContractOnly -GateSpec scripts/standardization/phase42-verification-gates.json -Output \"{output}\"");

            result.ExitCode.Should().Be(0, result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            var root = document.RootElement;
            root.GetProperty("contractOnly").GetBoolean().Should().BeTrue();
            root.GetProperty("gates").GetArrayLength().Should().Be(20);
            root.GetProperty("gates").EnumerateArray()
                .Should().OnlyContain(gate => gate.GetProperty("status").GetString() == "NOT_RUN");
            foreach (var gate in root.GetProperty("gates").EnumerateArray())
            {
                foreach (var field in EvidenceFields)
                {
                    gate.TryGetProperty(field, out _).Should().BeTrue($"{field} is required");
                }
            }
        }
        finally
        {
            File.Delete(output);
        }
    }

    [Fact]
    public void Runner_should_stop_at_first_failure_and_mark_every_successor_not_run()
    {
        var spec = Path.Combine(Path.GetTempPath(), $"phase42-spec-{Guid.NewGuid():N}.json");
        var output = Path.Combine(Path.GetTempPath(), $"phase42-result-{Guid.NewGuid():N}.json");
        try
        {
            File.WriteAllText(spec, JsonSerializer.Serialize(new
            {
                schemaVersion = 1,
                requirementsTotal = 3,
                requiredExecutionInputs = new[] { "runId", "target" },
                requiredEvidenceFields = EvidenceFields,
                failureStatuses = new[] { "FAILED" },
                gates = new object[]
                {
                    FixtureGate(1, "first", "DCR-01", "powershell -NoProfile -Command exit 0"),
                    FixtureGate(2, "failure", "DCR-02", "powershell -NoProfile -Command exit 7"),
                    FixtureGate(3, "must-not-run", "VER-03", "powershell -NoProfile -Command exit 0"),
                },
            }));

            var result = RunVerifier(
                $"-GateSpec \"{spec}\" -Output \"{output}\" -RunId contract -Target ipcmanagement");

            result.ExitCode.Should().NotBe(0);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            var gates = document.RootElement.GetProperty("gates").EnumerateArray().ToArray();
            gates.Select(gate => gate.GetProperty("status").GetString())
                .Should().Equal("PASS", "FAILED", "NOT_RUN");
            gates[1].GetProperty("exitCode").GetInt32().Should().Be(7);
            gates[2].GetProperty("exitCode").ValueKind.Should().Be(JsonValueKind.Null);
            document.RootElement.GetProperty("requirementsPassed").GetInt32().Should().Be(1);
        }
        finally
        {
            File.Delete(spec);
            File.Delete(output);
        }
    }

    private static object FixtureGate(int order, string id, string requirementId, string command) => new
    {
        order,
        id,
        stage = "FIXTURE",
        requirementId,
        kind = "command",
        command,
        versionCommand = "powershell -NoProfile -Command $PSVersionTable.PSVersion.ToString()",
        targetMode = "none",
        requiredArtifacts = Array.Empty<string>(),
    };

    private static (int ExitCode, string StdErr) RunVerifier(string arguments)
    {
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -File scripts/standardization/Invoke-Phase42AggregateVerification.ps1 {arguments}",
            WorkingDirectory = FindRepositoryRoot(),
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        }) ?? throw new InvalidOperationException("Could not start aggregate verifier.");
        var stdErr = process.StandardError.ReadToEnd();
        process.StandardOutput.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode, stdErr);
    }

    private static int IndexOfRequirement(JsonElement[] gates, string requirement)
        => Array.FindIndex(gates, gate => gate.GetProperty("requirementId").GetString() == requirement);

    private static JsonDocument ReadGateSpec()
        => JsonDocument.Parse(File.ReadAllText(GateSpecPath()));

    private static string GateSpecPath()
        => Path.Combine(FindRepositoryRoot(), "scripts", "standardization", "phase42-verification-gates.json");

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
