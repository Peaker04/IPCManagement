using System.Text.Json;
using System.Text.Json.Nodes;
using System.Diagnostics;
using FluentAssertions;
using IPCManagement.Api.Security;

namespace IPCManagement.Api.Tests;

public class Phase42AggregateVerificationTests
{
    private static readonly string[] BackupTables =
    [
        "backup_bomadjustments_20260717_141300",
        "backup_dishbom_20260717_141300",
        "backup_dishes_20260717_141300",
        "backup_ingredients_20260717_141300",
        "backup_materialrequestlines_bom_20260717_141300",
        "backup_menuitems_20260717_141300",
        "backup_menuitems_pre2026_20260717_141300",
    ];

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

        var dotnetCommands = root.GetProperty("gates").EnumerateArray()
            .Select(gate => gate.GetProperty("command").GetString() ?? string.Empty)
            .Where(command => command.Contains("dotnet ", StringComparison.Ordinal))
            .ToArray();
        dotnetCommands.Should().OnlyContain(command =>
            command.Contains("BaseOutputPath", StringComparison.Ordinal) &&
            command.Contains("EnableDefaultContentItems", StringComparison.Ordinal));
        root.GetProperty("gates").EnumerateArray()
            .Single(gate => gate.GetProperty("id").GetString() == "ver-03-root-verify")
            .GetProperty("command").GetString().Should().Contain("BaseOutputPath");
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
    public void Gate_spec_should_make_business_authority_local_recovery_and_retention_first_class_inputs()
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
            "d05-evidence-only-release", "accepted-unverified-business-risk",
            "fixed-no-correction-outcomes", "zero-business-execution", "accepted-local-only-risk",
            "encrypted-local-archive", "approved-local-archive-only",
            "restore-teardown", "plaintext-teardown", "seven-table-retention",
            "destructive-path-dormancy",
        ]);
        artifacts.Should().NotContain(["provider-object-receipt", "remote-only-restore", "base-promotion"]);
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
                $"-GateSpec \"{spec}\" -Output \"{output}\" -RunId contract -Target ipcmanagement " +
                "-MigrationHead 20260810120000_AddBusinessEvidenceClosure");

            result.ExitCode.Should().NotBe(0);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            var root = document.RootElement;
            var gates = root.GetProperty("gates").EnumerateArray().ToArray();
            gates.Should().HaveCount(3, root.TryGetProperty("redactedError", out var error)
                ? error.GetString()
                : result.StdErr);
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

    [Fact]
    public void Runner_should_stop_after_named_gate_without_running_successors()
    {
        var spec = Path.Combine(Path.GetTempPath(), $"phase42-stop-spec-{Guid.NewGuid():N}.json");
        var output = Path.Combine(Path.GetTempPath(), $"phase42-stop-result-{Guid.NewGuid():N}.json");
        try
        {
            File.WriteAllText(spec, JsonSerializer.Serialize(new
            {
                schemaVersion = 1,
                requirementsTotal = 2,
                requiredExecutionInputs = new[] { "runId", "target" },
                requiredEvidenceFields = EvidenceFields,
                failureStatuses = new[] { "FAILED" },
                gates = new object[]
                {
                    FixtureGate(1, "first", "DCR-01", "powershell -NoProfile -Command exit 0"),
                    FixtureGate(2, "must-not-run", "DCR-02", "powershell -NoProfile -Command exit 9"),
                },
            }));

            var result = RunVerifier(
                $"-GateSpec \"{spec}\" -Output \"{output}\" -RunId phase_04_2_execution " +
                "-Database ipcmanagement -MigrationHead head -StopAfter first");

            result.ExitCode.Should().Be(0, result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            document.RootElement.GetProperty("status").GetString().Should().Be("STOPPED");
            document.RootElement.GetProperty("stoppedAfter").GetString().Should().Be("first");
            document.RootElement.GetProperty("gates").EnumerateArray()
                .Select(gate => gate.GetProperty("status").GetString())
                .Should().Equal("PASS", "NOT_RUN");
        }
        finally
        {
            File.Delete(spec);
            File.Delete(output);
        }
    }

    [Fact]
    public void Runner_should_select_exactly_one_named_gate()
    {
        var spec = Path.Combine(Path.GetTempPath(), $"phase42-only-spec-{Guid.NewGuid():N}.json");
        var output = Path.Combine(Path.GetTempPath(), $"phase42-only-result-{Guid.NewGuid():N}.json");
        try
        {
            File.WriteAllText(spec, JsonSerializer.Serialize(new
            {
                schemaVersion = 1,
                requirementsTotal = 1,
                requiredExecutionInputs = new[] { "runId", "target" },
                requiredEvidenceFields = EvidenceFields,
                failureStatuses = new[] { "FAILED" },
                gates = new object[]
                {
                    FixtureGate(1, "not-selected", "DCR-01", "powershell -NoProfile -Command exit 9"),
                    FixtureGate(2, "selected", "DCR-01", "powershell -NoProfile -Command exit 0"),
                },
            }));

            var result = RunVerifier(
                $"-GateSpec \"{spec}\" -Output \"{output}\" -RunId phase_04_2_execution " +
                "-Database ipcmanagement -MigrationHead head -Only selected");

            result.ExitCode.Should().Be(0, result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            document.RootElement.GetProperty("selectedOnly").GetString().Should().Be("selected");
            document.RootElement.GetProperty("gates").EnumerateArray()
                .Select(gate => gate.GetProperty("status").GetString())
                .Should().Equal("NOT_RUN", "PASS");
        }
        finally
        {
            File.Delete(spec);
            File.Delete(output);
        }
    }

    [Theory]
    [InlineData("phase-04.2-execution", "lowercase run-owned")]
    [InlineData("phase_04_2_execution", "forbidden")]
    public void Runner_should_validate_canonical_run_id_and_database_target(string runId, string expectedError)
    {
        var output = Path.Combine(Path.GetTempPath(), $"phase42-guard-{Guid.NewGuid():N}.json");
        try
        {
            var database = runId.Contains('-', StringComparison.Ordinal) ? "ipcmanagement" : "ipc_lane1";
            var result = RunVerifier(
                $"-GateSpec scripts/standardization/phase42-verification-gates.json -Output \"{output}\" " +
                $"-RunId {runId} -Database {database} -MigrationHead head -FailFast");

            result.ExitCode.Should().NotBe(0);
            (result.StdErr + (File.Exists(output) ? File.ReadAllText(output) : string.Empty))
                .Should().Contain(expectedError);
        }
        finally
        {
            File.Delete(output);
        }
    }

    [Fact]
    public void Hygiene_should_pass_clean_d03_local_archive_restore_and_retention_fixtures()
    {
        var fixture = CreateHygieneFixture();
        try
        {
            var result = RunVerifier(HygieneArguments(fixture.Root, fixture.Output, fixture.ScanFile));

            result.ExitCode.Should().Be(0, File.Exists(fixture.Output)
                ? File.ReadAllText(fixture.Output)
                : result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(fixture.Output));
            document.RootElement.GetProperty("status").GetString().Should().Be("PASS");
        }
        finally
        {
            Directory.Delete(fixture.Root, recursive: true);
        }
    }

    [Theory]
    [InlineData("secret")]
    [InlineData("stub")]
    [InlineData("offsite")]
    [InlineData("provider-field")]
    [InlineData("raw-key")]
    [InlineData("fabricated-actor")]
    [InlineData("missing-teardown")]
    [InlineData("cleanup-executed")]
    public void Hygiene_should_fail_closed_and_redact_sensitive_fixture_values(string violation)
    {
        var fixture = CreateHygieneFixture();
        try
        {
            switch (violation)
            {
                case "secret":
                    File.WriteAllText(Path.Combine(fixture.Root, "secret.json"), "{\"apiKey\":\"super-secret-value\"}");
                    break;
                case "stub":
                    File.WriteAllText(fixture.ScanFile, "TODO wire production evidence");
                    break;
                case "offsite":
                    WriteD03Archive(fixture.Root, offSite: true);
                    break;
                case "provider-field":
                    WriteD03Archive(fixture.Root, providerReference: "must-not-be-active");
                    break;
                case "raw-key":
                    WriteD03Archive(fixture.Root, rawKeyBase64: "must-never-persist");
                    break;
                case "fabricated-actor":
                    File.WriteAllText(Path.Combine(fixture.Root, "actor.json"), "{\"actorId\":\"placeholder\"}");
                    break;
                case "missing-teardown":
                    File.Delete(Path.Combine(fixture.Root, "dcr-08-approved-local-restore.json"));
                    break;
                case "cleanup-executed":
                    WriteD03Retention(fixture.Root, destructiveExecutionCount: 1, dropExecution: "PASS");
                    break;
            }

            var result = RunVerifier(HygieneArguments(fixture.Root, fixture.Output, fixture.ScanFile));

            result.ExitCode.Should().NotBe(0);
            var output = File.ReadAllText(fixture.Output);
            output.Should().Contain("\"status\":  \"FAILED\"");
            output.Should().NotContain("super-secret-value");
        }
        finally
        {
            Directory.Delete(fixture.Root, recursive: true);
        }
    }

    [Fact]
    public void Runner_should_lock_d03_rebind_and_business_authority_without_provider_dependency()
    {
        var script = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "standardization", "Invoke-Phase42AggregateVerification.ps1"));

        script.Should().Contain("Invoke-D03RebindCheck");
        script.Should().Contain("Invoke-BusinessAuthorityCheck");
        script.Should().Contain("ACCEPTED_LOCAL_ONLY_RISK");
        script.Should().Contain("SUPERSEDED_D03_NOT_CURRENT_AUTHORITY");
        script.Should().Contain("DORMANT_FORBIDDEN_UNDER_D03");
        script.Should().Contain("NOT_RUN_DORMANT_D03");

        var businessStart = script.IndexOf("function Invoke-BusinessAuthorityCheck", StringComparison.Ordinal);
        var hygieneStart = script.IndexOf("function Invoke-HygieneVerification", StringComparison.Ordinal);
        var businessContract = script[businessStart..hygieneStart];
        businessContract.Should().Contain("businessAuthorityRecords");
        businessContract.Should().Contain("sourceReferences");
        businessContract.Should().NotContain("providerReference");
        businessContract.Should().NotContain("credentialReference");
    }

    [Fact]
    public void Gate_spec_should_replace_provider_remote_restore_and_cleanup_promotion_with_d03_semantics()
    {
        using var document = ReadGateSpec();
        var gates = document.RootElement.GetProperty("gates").EnumerateArray().ToArray();

        gates.Single(gate => gate.GetProperty("requirementId").GetString() == "DCR-07")
            .GetProperty("id").GetString().Should().Be("dcr-07-local-archive-risk");
        gates.Single(gate => gate.GetProperty("requirementId").GetString() == "DCR-08")
            .GetProperty("id").GetString().Should().Be("dcr-08-approved-local-restore");
        gates.Single(gate => gate.GetProperty("requirementId").GetString() == "DCR-09")
            .GetProperty("id").GetString().Should().Be("dcr-09-seven-table-retention");

        var text = File.ReadAllText(GateSpecPath());
        text.Should().NotContain("provider-object-receipt");
        text.Should().NotContain("remote-only-restore");
        text.Should().NotContain("cleanup-rehearsal-promotion");
    }

    [Fact]
    public void Existing_roles_should_resolve_the_required_d04_permissions_without_finance_or_catalog()
    {
        var required = new (string Role, string Permission)[]
        {
            ("Admin", AuthorizationPolicies.InventoryAdjustmentApprove),
            ("Manager", AuthorizationPolicies.CoordinationOrderSignoff),
            ("Coordinator", AuthorizationPolicies.CoordinationOrderSignoff),
            ("Purchasing", AuthorizationPolicies.PurchaseQuotationManage),
            ("WarehouseStaff", AuthorizationPolicies.InventoryAdjustmentApprove),
            ("Chef", AuthorizationPolicies.CatalogRead),
        };

        foreach (var (role, permission) in required)
        {
            AuthorizationPolicies.ResolvePermissions(role).Should().Contain(permission);
        }
        AuthorizationPolicies.ResolvePermissions("Finance").Should().BeEmpty();
        AuthorizationPolicies.ResolvePermissions("Catalog").Should().BeEmpty();
    }

    [Fact]
    public void D04_role_rebind_should_accept_the_exact_existing_role_permission_contract()
    {
        var fixture = CreateD04RoleRebindFixture();
        try
        {
            var result = RunVerifier(
                $"-RunId phase_04_2_execution -Only d04-role-rebind-check " +
                $"-Manifest \"{fixture.Manifest}\" -Output \"{fixture.Output}\"");

            result.ExitCode.Should().Be(0, result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(fixture.Output));
            document.RootElement.GetProperty("status").GetString().Should().Be("PASS");
            document.RootElement.GetProperty("allowedRoleFamilyCount").GetInt32().Should().Be(6);
            document.RootElement.GetProperty("governanceDecisionUsedAsActor").GetBoolean().Should().BeFalse();
        }
        finally
        {
            Directory.Delete(fixture.Root, recursive: true);
        }
    }

    [Theory]
    [InlineData("finance-role")]
    [InlineData("catalog-role")]
    [InlineData("unknown-role")]
    [InlineData("permission-bypass")]
    [InlineData("fake-signature")]
    [InlineData("finance-independence")]
    [InlineData("inferred-correction")]
    public void D04_role_rebind_should_reject_prohibited_identity_permission_and_inference_claims(string violation)
    {
        var fixture = CreateD04RoleRebindFixture(violation);
        try
        {
            var result = RunVerifier(
                $"-RunId phase_04_2_execution -Only d04-role-rebind-check " +
                $"-Manifest \"{fixture.Manifest}\" -Output \"{fixture.Output}\"");

            result.ExitCode.Should().NotBe(0);
        }
        finally
        {
            Directory.Delete(fixture.Root, recursive: true);
        }
    }

    [Fact]
    public void D05_evidence_release_should_emit_exact_accepted_risk_rows_without_business_execution_claims()
    {
        var root = FindRepositoryRoot();
        var sourceManifest = Path.Combine(
            root, ".artifacts", "shipyard-live", "phase-04.2-execution", "manifest.json");
        var temp = Path.Combine(Path.GetTempPath(), $"phase42-d05-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temp);
        var manifest = Path.Combine(temp, "manifest.json");
        File.WriteAllText(manifest, CreateD05PendingManifest(sourceManifest).ToJsonString());
        var output = Path.Combine(temp, "business-release.json");
        try
        {
            var result = RunVerifier(
                $"-RunId phase_04_2_execution -Only d05-evidence-release " +
                $"-Manifest \"{manifest}\" -Output \"{output}\"");

            result.ExitCode.Should().Be(0, result.StdErr);
            using var document = JsonDocument.Parse(File.ReadAllText(output));
            var release = document.RootElement;
            release.GetProperty("status").GetString().Should().Be("PASS");
            release.GetProperty("subjectCount").GetInt32().Should().Be(3555);
            release.GetProperty("businessSqlStatements").GetInt32().Should().Be(0);
            release.GetProperty("databaseConnections").GetInt32().Should().Be(0);
            release.GetProperty("runtimeBooted").GetBoolean().Should().BeFalse();
            release.GetProperty("mutationStatements").GetInt32().Should().Be(0);

            var rows = release.GetProperty("rows").EnumerateArray().ToArray();
            rows.Should().HaveCount(3555);
            rows.Should().OnlyContain(row =>
                row.GetProperty("businessClassification").GetString() ==
                "ACCEPTED_UNVERIFIED_BUSINESS_RISK");
            var expected = new Dictionary<string, (int Count, string Outcome)>
            {
                ["movement"] = (2461, "NO_CORRECTION"),
                ["menu-week"] = (84, "NO_CORRECTION"),
                ["unit"] = (44, "RETAIN_DISTINCT"),
                ["quotation"] = (756, "NO_PRICE_CREATED"),
                ["bom"] = (194, "NO_BOM_CREATED"),
                ["duplicate-group"] = (16, "KEEP_DISTINCT"),
            };
            foreach (var (family, contract) in expected)
            {
                var familyRows = rows.Where(row => row.GetProperty("family").GetString() == family).ToArray();
                familyRows.Should().HaveCount(contract.Count);
                familyRows.Should().OnlyContain(row =>
                    row.GetProperty("outcome").GetString() == contract.Outcome);
            }

            var text = File.ReadAllText(output);
            text.Should().NotContain("VERIFIED_IN_APP");
            text.Should().NotContain("runtimeActor");
            text.Should().NotContain("signature");
            text.Should().NotContain("independentActor");
            text.Should().NotContain("commandManifest");
            text.Should().NotContain("SELECT ");
            text.Should().NotContain("INSERT ");
            text.Should().NotContain("UPDATE ");
            text.Should().NotContain("DELETE ");
        }
        finally
        {
            Directory.Delete(temp, recursive: true);
        }
    }

    [Theory]
    [InlineData("database-connection")]
    [InlineData("runtime-boot")]
    [InlineData("mutation")]
    [InlineData("signature")]
    [InlineData("finance-role")]
    [InlineData("business-sql")]
    public void D05_evidence_release_should_reject_execution_identity_and_sql_claims(string violation)
    {
        var root = FindRepositoryRoot();
        var sourceManifest = Path.Combine(
            root, ".artifacts", "shipyard-live", "phase-04.2-execution", "manifest.json");
        var temp = Path.Combine(Path.GetTempPath(), $"phase42-d05-negative-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temp);
        var manifest = Path.Combine(temp, "manifest.json");
        var output = Path.Combine(temp, "business-release.json");
        var node = CreateD05PendingManifest(sourceManifest);
        var closure = node["activeBusinessClosure"]!.AsObject();
        switch (violation)
        {
            case "database-connection": closure["databaseConnections"] = 1; break;
            case "runtime-boot": closure["runtimeBooted"] = true; break;
            case "mutation": closure["mutationStatements"] = 1; break;
            case "signature": closure["runtimeActorSignature"] = "opaque"; break;
            case "business-sql": closure["businessSql"] = "SELECT 1"; break;
            case "finance-role":
                node["completedD04RolePolicy"]!["allowedRoleFamilies"]!.AsArray()[0] = "Finance";
                break;
        }
        File.WriteAllText(manifest, node.ToJsonString());
        try
        {
            var result = RunVerifier(
                $"-RunId phase_04_2_execution -Only d05-evidence-release " +
                $"-Manifest \"{manifest}\" -Output \"{output}\"");
            result.ExitCode.Should().NotBe(0);
        }
        finally
        {
            Directory.Delete(temp, recursive: true);
        }
    }

    private static JsonObject CreateD05PendingManifest(string sourceManifest)
    {
        var node = JsonNode.Parse(File.ReadAllText(sourceManifest))!.AsObject();
        node["status"] = "D05_EVIDENCE_RELEASE_PENDING";
        node["currentTask"] = 3;
        node["currentTaskName"] = "Produce the exact D-05 evidence-only accepted-risk release";
        node["completedTasks"] = 2;
        node["revisedTaskCompletions"]!.AsObject().Remove("task3");
        var closure = node["activeBusinessClosure"]!.AsObject();
        closure["status"] = "D05_EVIDENCE_RELEASE_PENDING";
        closure["releaseArtifactStatus"] = "PENDING_TASK_3";
        closure.Remove("releasePath");
        closure.Remove("releaseSha256");
        closure.Remove("releaseBytes");
        var guardrails = node["resumeGuardrails"]!.AsObject();
        guardrails["completedTasksPreserved"] = 2;
        guardrails["nextTask"] = 3;
        guardrails["d05EvidenceReleaseMustRun"] = true;
        return node;
    }

    [Fact]
    public void D03_local_archive_executor_should_keep_key_material_out_of_commands_environment_and_evidence()
    {
        var root = FindRepositoryRoot();
        var tool = File.ReadAllText(Path.Combine(
            root, "backend", "tools", "IPCManagement.Phase42ArchiveTool", "Program.cs"));
        var runner = File.ReadAllText(Path.Combine(
            root, "scripts", "standardization", "Invoke-Phase42AggregateVerification.ps1"));

        tool.Should().Contain("CryptProtectData");
        tool.Should().Contain("CryptUnprotectData");
        tool.Should().Contain("UiForbidden");
        tool.Should().Contain("RandomNumberGenerator.GetBytes(64)");
        tool.Should().Contain("CryptographicOperations.ZeroMemory");
        tool.Should().Contain("AES-256-CBC/HMAC-SHA256");
        tool.Should().Contain("WindowsCurrentUserDPAPI");
        tool.Should().Contain("icacls.exe");
        tool.Should().Contain("rawKeyInCommandLine = false");
        tool.Should().Contain("rawKeyInEnvironment = false");
        tool.Should().NotContain("IPC_BACKUP_ENCRYPTION_PASSWORD");
        tool.Should().NotContain("Environment.SetEnvironmentVariable");
        tool.Should().NotContain("ProviderAdapter");
        tool.Should().Contain("RestoreApprovedArchiveAsync");
        tool.Should().Contain("targetAbsentBefore");
        tool.Should().Contain("DROP DATABASE");
        tool.Should().Contain("finally");
        tool.Should().Contain("FindRestoreOracleMismatches");
        tool.Should().Contain("ProveSevenTableRetentionAsync");
        tool.Should().Contain("DORMANT_FORBIDDEN_UNDER_D03");
        tool.Should().Contain("SUPERSEDED_D05_NOT_APPLICABLE");
        runner.Should().Contain("Invoke-D03LocalArchive");
        runner.Should().Contain("Invoke-D03RestoreDrill");
        runner.Should().Contain("Invoke-D03SevenTableRetention");
        runner.Should().Contain("IPCManagement.Phase42ArchiveTool.csproj");
        runner.Should().Contain("Assert-D05Release");
        runner.Should().Contain("Test-Plan05ArtifactGate");
        runner.Should().Contain("{manifest}");
        runner.Should().Contain("ReadToEndAsync");
        runner.Should().Contain("WaitForExit");
        runner.Should().NotContain("Start-Process -FilePath 'cmd.exe'");
    }

    [Fact]
    public void D03_restore_approval_should_bind_only_the_exact_reviewed_archive()
    {
        var root = FindRepositoryRoot();
        var sourceManifest = Path.Combine(
            root, ".artifacts", "shipyard-live", "phase-04.2-execution", "manifest.json");
        var temp = Path.Combine(Path.GetTempPath(), $"phase42-d03-approval-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temp);
        var manifest = Path.Combine(temp, "manifest.json");
        File.WriteAllText(manifest, CreateTask5ApprovalManifest(sourceManifest).ToJsonString());
        try
        {
            var wrong = RunVerifier(
                $"-RunId phase_04_2_execution -Only approval-check -Approval wrong " +
                $"-Manifest \"{manifest}\"");
            wrong.ExitCode.Should().NotBe(0);

            var result = RunVerifier(
                $"-RunId phase_04_2_execution -Only approval-check " +
                $"-Approval d03-local-archive-restore -Manifest \"{manifest}\"");
            result.ExitCode.Should().Be(0, result.StdErr);
            var updated = JsonNode.Parse(File.ReadAllText(manifest))!.AsObject();
            updated["status"]!.GetValue<string>().Should().Be("RESTORE_DRILL_PENDING");
            updated["currentTask"]!.GetValue<int>().Should().Be(6);
            updated["completedTasks"]!.GetValue<int>().Should().Be(5);
            updated["revisedTaskCompletions"]!["task5"]!["status"]!
                .GetValue<string>().Should().Be("PASS");
        }
        finally
        {
            Directory.Delete(temp, recursive: true);
        }
    }

    private static JsonObject CreateTask5ApprovalManifest(string sourceManifest)
    {
        var node = JsonNode.Parse(File.ReadAllText(sourceManifest))!.AsObject();
        node["status"] = "AWAITING_LOCAL_ARCHIVE_RESTORE_APPROVAL";
        node["currentTask"] = 5;
        node["currentTaskName"] = "Approve exact local archive restore";
        node["completedTasks"] = 4;
        node["revisedTaskCompletions"]!.AsObject().Remove("task5");
        var guardrails = node["resumeGuardrails"]!.AsObject();
        guardrails["completedTasksPreserved"] = 4;
        guardrails["nextTask"] = 5;
        guardrails["restoreApprovalRequired"] = true;
        return node;
    }

    [Fact]
    public void Runner_should_never_reset_clean_or_retarget_unrelated_work()
    {
        var script = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "standardization", "Invoke-Phase42AggregateVerification.ps1"));

        script.Should().Contain("git status --porcelain -- $repoOwnedPaths");
        script.Should().NotContain("git reset");
        script.Should().NotContain("git clean");
        script.Should().NotContain("git checkout --");
    }

    [Fact]
    public void Cleanup_drop_template_should_name_exactly_seven_tables_without_dynamic_scope()
    {
        var sql = ReadCleanupSql("backup-tables-drop.sql");
        var drops = System.Text.RegularExpressions.Regex.Matches(
                sql, "(?im)^DROP TABLE `\\{\\{TARGET_DATABASE\\}\\}`\\.`([^`]+)`;")
            .Select(match => match.Groups[1].Value).ToArray();

        drops.Should().Equal(BackupTables);
        AssertNoForbiddenCleanupSql(sql, allowDropTable: true);
        sql.Should().NotContain("backup_%");
        sql.Contains("PREPARE", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
        sql.Contains("EXECUTE", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
    }

    [Fact]
    public void Cleanup_pre_and_postflight_should_pin_definitions_counts_consumers_and_scope_stability()
    {
        var preflight = ReadCleanupSql("backup-tables-preflight.sql");
        var postflight = ReadCleanupSql("backup-tables-postflight.sql");

        foreach (var sql in new[] { preflight, postflight })
        {
            BackupTables.Should().OnlyContain(table => sql.Contains(table, StringComparison.Ordinal));
            sql.Should().Contain("{{TARGET_DATABASE}}");
            sql.Should().Contain("consumer");
            sql.Should().Contain("outsideScope");
            sql.Should().Contain("SHA2");
            AssertNoForbiddenCleanupSql(sql, allowDropTable: false);
        }

        preflight.Should().Contain("SHOW CREATE TABLE", Exactly.Times(7));
        preflight.Should().Contain("rowCount");
        preflight.Should().Contain("rowDigest");
        postflight.Should().Contain("ABSENT");
    }

    [Fact]
    public void Cleanup_restore_should_be_extract_bound_and_disposable_only()
    {
        var sql = ReadCleanupSql("backup-tables-restore.sql");

        BackupTables.Should().OnlyContain(table => sql.Contains(table, StringComparison.Ordinal));
        sql.Should().Contain("{{TARGET_DATABASE}}");
        sql.Should().Contain("{{RUN_ID}}");
        sql.Should().Contain("{{ROLLBACK_EXTRACT_SHA256}}");
        sql.Should().Contain("{{ROLLBACK_EXTRACT_PATH}}");
        sql.Should().Contain("ipc_rehearsal_phase42_");
        sql.Should().Contain("NO_GO_TARGET");
        sql.Should().NotContain("ipc_lane1");
        sql.Should().NotContain("`ipcmanagement`");
        AssertNoForbiddenCleanupSql(sql, allowDropTable: false);
    }

    private static string ReadCleanupSql(string name)
        => File.ReadAllText(Path.Combine(FindRepositoryRoot(), "tools", "db", "phase-04.2", name));

    private static void AssertNoForbiddenCleanupSql(string sql, bool allowDropTable)
    {
        sql.Should().NotMatchRegex("(?im)^\\s*USE\\s+");
        sql.Should().NotMatchRegex("(?im)^\\s*CREATE\\s+DATABASE\\b");
        sql.Should().NotMatchRegex("(?im)^\\s*DROP\\s+DATABASE\\b");
        sql.Should().NotMatchRegex("(?im)^\\s*UPDATE\\s+");
        sql.Should().NotMatchRegex("(?im)^\\s*DELETE\\s+");
        if (!allowDropTable)
        {
            sql.Should().NotMatchRegex("(?im)^\\s*DROP\\s+TABLE\\b");
        }
    }

    private static (string Root, string Manifest, string Output) CreateD04RoleRebindFixture(
        string? violation = null)
    {
        var root = Path.Combine(Path.GetTempPath(), $"phase42-d04-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var manifest = Path.Combine(root, "manifest.json");
        var output = Path.Combine(root, "result.json");
        var authorizationPolicyPath = Path.Combine(
            FindRepositoryRoot(), "backend", "src", "IPCManagement.Api", "Security", "AuthorizationPolicies.cs");
        var authorizationPolicySha256 = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(authorizationPolicyPath)));

        var matrix = new List<Dictionary<string, object?>>
        {
            RoleContract("Admin", "Admin", [
                AuthorizationPolicies.InventoryAdjustmentApprove,
                AuthorizationPolicies.CoordinationOrderSignoff,
                AuthorizationPolicies.CatalogWrite,
                AuthorizationPolicies.PurchaseQuotationManage,
            ]),
            RoleContract("Manager", "Manager", [AuthorizationPolicies.CoordinationOrderSignoff]),
            RoleContract("Coordinator", "Coordinator", [AuthorizationPolicies.CoordinationOrderSignoff]),
            RoleContract("Procurement/Purchasing", "Purchasing", [AuthorizationPolicies.PurchaseQuotationManage]),
            RoleContract("Warehouse", "WarehouseStaff", [AuthorizationPolicies.InventoryAdjustmentApprove]),
            RoleContract("Chef/Kitchen", "Chef", [AuthorizationPolicies.CatalogRead]),
        };

        if (violation is "finance-role" or "catalog-role" or "unknown-role")
        {
            var role = violation switch
            {
                "finance-role" => "Finance",
                "catalog-role" => "Catalog",
                _ => "ExternalReviewer",
            };
            matrix.Add(RoleContract(role, role, [AuthorizationPolicies.ReportRead]));
        }
        if (violation == "permission-bypass")
        {
            matrix.Single(item => (string)item["roleFamily"]! == "Warehouse")["resolvedPermissions"] =
                AuthorizationPolicies.ResolvePermissions("WarehouseStaff")
                    .Where(permission => permission != AuthorizationPolicies.InventoryAdjustmentApprove)
                    .ToArray();
        }

        var businessPolicy = new Dictionary<string, object?>
        {
            ["status"] = "D04_ROLE_REBIND_PENDING",
            ["decision"] = "ROLE_BOUNDED_OPERATIONAL_DISPOSITION",
            ["decisionReference"] = "opaque:d04:session-decision:2026-08-10",
            ["decisionSha256"] = "91AABB097AE68F473C0CCF6521234316D7826B630F20B00CC3BD77261B36ADBD",
            ["decisionCapturedAtUtc"] = "2026-08-10T09:12:50Z",
            ["governanceDecisionIsApplicationActorOrSignature"] = false,
            ["authorizationPolicyPath"] = "backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs",
            ["authorizationPolicySha256"] = authorizationPolicySha256,
            ["allowedRoleFamilies"] = new[]
            {
                "Admin", "Manager", "Coordinator", "Procurement/Purchasing", "Warehouse", "Chef/Kitchen",
            },
            ["rolePermissionMatrix"] = matrix,
            ["finalResidualRiskAcceptanceRole"] = "Admin",
            ["businessClassifications"] = new[] { "VERIFIED_IN_APP", "ACCEPTED_UNVERIFIED_BUSINESS_RISK" },
            ["financeIndependenceClaimed"] = violation == "finance-independence",
            ["fakeSignaturePresent"] = violation == "fake-signature",
            ["inferencePolicy"] = new Dictionary<string, object?>
            {
                ["correction"] = violation == "inferred-correction",
                ["conversion"] = false,
                ["price"] = false,
                ["bom"] = false,
                ["merge"] = false,
            },
        };

        File.WriteAllText(manifest, JsonSerializer.Serialize(new
        {
            schemaVersion = 2,
            runId = "phase_04_2_execution",
            planRevision = "D03_D04_13_TASK",
            target = "ipcmanagement",
            migrationHead = "20260810030000_AddDataQualityDispositions",
            status = "D04_ROLE_REBIND_PENDING",
            currentTask = 2,
            completedTasks = 1,
            totalTasks = 13,
            mutationStatements = 0,
            priorPackageEvidence = new
            {
                status = "PASS",
                packageSha256 = "C281CB92E66939657680F0D31CA80B4A3451F5EE71A94745DBD60335DAE66EC2",
                counts = new
                {
                    movements = 2461,
                    menuWeeks = 84,
                    unitReviews = 44,
                    quotationSubjects = 756,
                    bomSubjects = 194,
                    duplicateGroups = 16,
                },
            },
            revisedTaskCompletions = new { task1 = new { status = "PASS" } },
            activeBusinessPolicy = businessPolicy,
            supersededBusinessAuthorityWorkflow = new
            {
                status = "SUPERSEDED_D04_NOT_CURRENT_AUTHORITY",
                formerExternalSlotCount = 9,
                newIdentitySetupRequired = false,
                externalSignatureInputRequired = false,
            },
        }));
        return (root, manifest, output);

        Dictionary<string, object?> RoleContract(
            string roleFamily,
            string roleName,
            string[] requiredPermissions) => new()
        {
            ["roleFamily"] = roleFamily,
            ["representativeRole"] = roleName,
            ["resolvedPermissions"] = AuthorizationPolicies.ResolvePermissions(roleName).ToArray(),
            ["requiredPermissions"] = requiredPermissions,
        };
    }

    private static (string Root, string Output, string ScanFile) CreateHygieneFixture()
    {
        var root = Path.Combine(Path.GetTempPath(), $"phase42-hygiene-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);
        var output = Path.Combine(root, "hygiene-output.json");
        var scanFile = Path.Combine(root, "owned-source.txt");
        File.WriteAllText(scanFile, "verified production evidence");
        WriteD03Archive(root);
        WriteD03Restore(root);
        WriteD03Retention(root);
        return (root, output, scanFile);
    }

    private static void WriteD03Archive(
        string root,
        bool offSite = false,
        string? providerReference = null,
        string? rawKeyBase64 = null)
    {
        var artifact = D03Topology(offSite);
        artifact["opaqueKeyReferenceSha256"] = new string('A', 64);
        if (providerReference is not null)
        {
            artifact["providerReference"] = providerReference;
        }
        if (rawKeyBase64 is not null)
        {
            artifact["rawKeyBase64"] = rawKeyBase64;
        }
        File.WriteAllText(
            Path.Combine(root, "dcr-07-local-archive.json"),
            JsonSerializer.Serialize(artifact));
    }

    private static void WriteD03Restore(string root)
    {
        var artifact = D03Topology();
        artifact["approvedArchiveOnly"] = true;
        artifact["restoreTarget"] = "ipc_restore_phase42_contract";
        artifact["restoreDatabaseAbsent"] = true;
        artifact["plaintextAbsent"] = true;
        artifact["existingDatabaseTouched"] = false;
        File.WriteAllText(
            Path.Combine(root, "dcr-08-approved-local-restore.json"),
            JsonSerializer.Serialize(artifact));
    }

    private static void WriteD03Retention(
        string root,
        int destructiveExecutionCount = 0,
        string dropExecution = "NOT_RUN_DORMANT_D03")
    {
        var artifact = D03Topology();
        artifact["tables"] = BackupTables;
        artifact["retained"] = true;
        artifact["dropSqlStatus"] = "DORMANT_FORBIDDEN_UNDER_D03";
        artifact["dropExecution"] = dropExecution;
        artifact["cleanupRehearsal"] = "NOT_RUN_DORMANT_D03";
        artifact["rollbackExtractRehearsal"] = "NOT_RUN_DORMANT_D03";
        artifact["cleanupApproval"] = "NOT_RUN_DORMANT_D03";
        artifact["baseCleanupPromotion"] = "NOT_RUN_DORMANT_D03";
        artifact["destructiveExecutionCount"] = destructiveExecutionCount;
        File.WriteAllText(
            Path.Combine(root, "dcr-09-seven-table-retention.json"),
            JsonSerializer.Serialize(artifact));
    }

    private static Dictionary<string, object?> D03Topology(bool offSite = false) => new()
    {
        ["recoveryClassification"] = "ACCEPTED_LOCAL_ONLY_RISK",
        ["sameHost"] = true,
        ["samePhysicalNvme"] = true,
        ["offSite"] = offSite,
        ["worm"] = false,
        ["independentSecurityDomain"] = false,
    };

    private static string HygieneArguments(string root, string output, string scanFile)
        => $"-HygieneOnly -Output \"{output}\" -RunId contract -Target ipcmanagement " +
           $"-MigrationHead 20260810120000_AddBusinessEvidenceClosure -EvidenceRoot \"{root}\" " +
           $"-AdditionalScanPath \"{scanFile}\"";

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
