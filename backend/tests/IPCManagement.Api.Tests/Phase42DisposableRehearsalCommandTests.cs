using FluentAssertions;
using IPCManagement.DatabaseTool;
using System.Text;
using System.Text.Json;

namespace IPCManagement.Api.Tests;

public class Phase42DisposableRehearsalCommandTests
{
    private const string Hash = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    [Fact]
    public async Task Execute_should_run_exact_chain_with_same_apply_hash_and_teardown()
    {
        var operations = new RecordingOperations();
        var request = ValidRequest();

        var result = await Phase42DisposableRehearsalCommand.ExecuteAsync(request, operations);

        result.Status.Should().Be("REHEARSAL_VERIFIED_AND_TORN_DOWN");
        result.ApplySha256.Should().Be(Hash);
        operations.Calls.Should().Equal(
            "Exists:ipc_rehearsal_phase42_contract",
            "Snapshot:ipcmanagement:" + Hash,
            "Clone:ipcmanagement:ipc_rehearsal_phase42_contract:contract",
            "CloneFidelity:ipc_rehearsal_phase42_contract",
            "Targets:ipc_rehearsal_phase42_contract",
            "Apply:ipc_rehearsal_phase42_contract:" + Hash,
            "Postflight:ipc_rehearsal_phase42_contract",
            "Rollback:ipc_rehearsal_phase42_contract:" + Hash,
            "ExactState:ipc_rehearsal_phase42_contract:" + Hash,
            "Apply:ipc_rehearsal_phase42_contract:" + Hash,
            "Postflight:ipc_rehearsal_phase42_contract",
            "Drop:ipc_rehearsal_phase42_contract:contract",
            "Absent:ipc_rehearsal_phase42_contract");
    }

    [Theory]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    [InlineData("ipcmanagement")]
    [InlineData("ipc_e2e_template")]
    [InlineData("ipc_rehearsal_phase41_old")]
    [InlineData("ipc_rehearsal_phase42_bad-name")]
    [InlineData("ipc_rehearsal_phase42_X")]
    public async Task Execute_should_reject_forbidden_target_before_any_operation(string target)
    {
        var operations = new RecordingOperations();
        var request = ValidRequest() with { TargetDatabase = target };

        var action = () => Phase42DisposableRehearsalCommand.ExecuteAsync(request, operations);

        await action.Should().ThrowAsync<ArgumentException>();
        operations.Calls.Should().BeEmpty();
    }

    [Fact]
    public async Task Execute_should_reject_existing_target_without_dropping_it()
    {
        var operations = new RecordingOperations { TargetExists = true };

        var action = () => Phase42DisposableRehearsalCommand.ExecuteAsync(ValidRequest(), operations);

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("*already exists*");
        operations.Calls.Should().Equal("Exists:ipc_rehearsal_phase42_contract");
    }

    [Fact]
    public async Task Execute_should_teardown_owned_target_when_chain_fails()
    {
        var operations = new RecordingOperations { FailAt = "Postflight:ipc_rehearsal_phase42_contract" };

        var action = () => Phase42DisposableRehearsalCommand.ExecuteAsync(ValidRequest(), operations);

        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("fixture failure");
        operations.Calls.TakeLast(2).Should().Equal(
            "Drop:ipc_rehearsal_phase42_contract:contract",
            "Absent:ipc_rehearsal_phase42_contract");
    }

    [Theory]
    [InlineData("reset --database ipcmanagement")]
    [InlineData("seed ipc_lane9")]
    [InlineData("restore ipcmanagement backup.sql")]
    [InlineData("clone ipc_lane1 ipc_rehearsal_phase42_x")]
    public void Administrative_command_policy_should_reject_existing_database_mutation(string command)
    {
        var action = () => Phase42DisposableRehearsalCommand.ValidateAdministrativeCommand(command);

        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Administrative_command_policy_should_accept_only_phase42_run_owned_chain()
    {
        var action = () => Phase42DisposableRehearsalCommand.ValidateAdministrativeCommand(
            "phase42-rehearse --source ipcmanagement --target ipc_rehearsal_phase42_contract --run-id phase42_contract");

        action.Should().NotThrow();
    }

    [Fact]
    public void Release_templates_should_require_explicit_target_and_exact_hash_pairing()
    {
        foreach (var name in new[]
                 {
                     "business-preflight.sql", "business-apply.sql",
                     "business-postflight.sql", "business-rollback.sql",
                 })
        {
            var script = ReadRepositoryFile("tools", "db", "phase-04.2", name);
            script.Should().Contain("{{TARGET_DATABASE}}");
            script.Should().NotContain("USE ");
            script.Should().NotContain("CREATE DATABASE");
            script.Should().NotContain("DROP DATABASE");
        }
    }

    [Fact]
    public void Command_manifest_schema_should_be_strict_and_require_business_identity_fields()
    {
        using var schema = JsonDocument.Parse(ReadRepositoryFile(
            "tools", "db", "phase-04.2", "business-command-manifest.schema.json"));
        var root = schema.RootElement;

        root.GetProperty("additionalProperties").GetBoolean().Should().BeFalse();
        var required = root.GetProperty("required").EnumerateArray().Select(item => item.GetString()).ToArray();
        required.Should().Contain(
        [
            "targetDatabase", "scriptSha256", "stableSubjectId", "currentFingerprint",
            "expectedVersion", "commandId", "signerPackageDigest", "appendOnlyOutcome",
        ]);
        root.GetProperty("properties").GetProperty("targetDatabase").GetProperty("pattern").GetString()
            .Should().Be("^ipc_rehearsal_phase42_[a-z0-9_]+$");
    }

    [Fact]
    public void Release_identity_should_change_when_either_exact_byte_sequence_changes()
    {
        var script = Encoding.UTF8.GetBytes("SELECT '{{TARGET_DATABASE}}';\n");
        var manifest = Encoding.UTF8.GetBytes("{\"commandId\":\"01\"}\n");

        var baseline = Phase42ReleaseIdentity.FromExactBytes(script, manifest);
        var changedScript = Phase42ReleaseIdentity.FromExactBytes([.. script, (byte)' '], manifest);
        var changedManifest = Phase42ReleaseIdentity.FromExactBytes(script, [.. manifest, (byte)' ']);

        baseline.ScriptSha256.Should().NotBe(changedScript.ScriptSha256);
        baseline.RuntimeManifestSha256.Should().NotBe(changedManifest.RuntimeManifestSha256);
        baseline.ScriptSha256.Should().MatchRegex("^[A-F0-9]{64}$");
        baseline.RuntimeManifestSha256.Should().MatchRegex("^[A-F0-9]{64}$");
    }

    private static Phase42RehearsalRequest ValidRequest() => new(
        SourceDatabase: "ipcmanagement",
        TargetDatabase: "ipc_rehearsal_phase42_contract",
        RunId: "contract",
        ApprovedSourceSnapshotSha256: Hash,
        ApplyScriptSha256: Hash,
        RuntimeManifestSha256: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        ExpectedTargetIds: ["movement:01", "menu-week:02", "unit:03"]);

    private static string ReadRepositoryFile(params string[] segments)
        => File.ReadAllText(Path.Combine(FindRepositoryRoot(), Path.Combine(segments)));

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
    }

    private sealed class RecordingOperations : IPhase42DisposableRehearsalOperations
    {
        public List<string> Calls { get; } = [];
        public bool TargetExists { get; init; }
        public string? FailAt { get; init; }

        public Task<bool> DatabaseExistsAsync(string database, CancellationToken cancellationToken)
            => RecordAsync($"Exists:{database}", TargetExists);

        public Task AssertApprovedSourceSnapshotAsync(string source, string expectedSha256, CancellationToken cancellationToken)
            => RecordAsync($"Snapshot:{source}:{expectedSha256}");

        public Task CloneApprovedSnapshotAsync(string source, string target, string runId, CancellationToken cancellationToken)
            => RecordAsync($"Clone:{source}:{target}:{runId}");

        public Task AssertCloneFidelityAsync(string target, CancellationToken cancellationToken)
            => RecordAsync($"CloneFidelity:{target}");

        public Task AssertExpectedTargetIdsAsync(string target, IReadOnlyList<string> ids, CancellationToken cancellationToken)
            => RecordAsync($"Targets:{target}");

        public Task ApplyReviewedCommandsAsync(string target, string scriptSha256, string manifestSha256, CancellationToken cancellationToken)
            => RecordAsync($"Apply:{target}:{scriptSha256}");

        public Task AssertPostflightAsync(string target, CancellationToken cancellationToken)
            => RecordAsync($"Postflight:{target}");

        public Task RestoreReviewedRollbackAsync(string target, string runId, CancellationToken cancellationToken)
            => RecordAsync($"Rollback:{target}:{Hash}");

        public Task AssertExactRollbackStateAsync(string target, string sourceSnapshotSha256, CancellationToken cancellationToken)
            => RecordAsync($"ExactState:{target}:{sourceSnapshotSha256}");

        public Task DropRunOwnedDatabaseAsync(string target, string runId, CancellationToken cancellationToken)
            => RecordAsync($"Drop:{target}:{runId}");

        public Task AssertDatabaseAbsentAsync(string target, CancellationToken cancellationToken)
            => RecordAsync($"Absent:{target}");

        private Task RecordAsync(string call)
        {
            Calls.Add(call);
            if (call == FailAt) throw new InvalidOperationException("fixture failure");
            return Task.CompletedTask;
        }

        private Task<T> RecordAsync<T>(string call, T result)
        {
            RecordAsync(call);
            return Task.FromResult(result);
        }
    }
}
