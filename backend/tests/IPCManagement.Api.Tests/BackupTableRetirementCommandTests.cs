using FluentAssertions;
using IPCManagement.DatabaseTool;

namespace IPCManagement.Api.Tests;

public class BackupTableRetirementCommandTests
{
    private static readonly string[] ExpectedTables =
    [
        "backup_bomadjustments_20260717_141300",
        "backup_dishbom_20260717_141300",
        "backup_dishes_20260717_141300",
        "backup_ingredients_20260717_141300",
        "backup_materialrequestlines_bom_20260717_141300",
        "backup_menuitems_20260717_141300",
        "backup_menuitems_pre2026_20260717_141300",
    ];

    [Fact]
    public void Exact_table_policy_should_accept_only_the_seven_reviewed_names()
    {
        var action = () => BackupTableRetirementCommand.ValidateExactTableSet(ExpectedTables);

        action.Should().NotThrow();
        BackupTableRetirementCommand.Tables.Should().Equal(ExpectedTables);
    }

    [Fact]
    public void Exact_table_policy_should_reject_missing_eighth_duplicate_or_dynamic_name()
    {
        var variants = new[]
        {
            ExpectedTables[..^1],
            ExpectedTables.Append("backup_eighth_20260717_141300").ToArray(),
            ExpectedTables.Append(ExpectedTables[0]).ToArray(),
            ExpectedTables.Select((name, index) => index == 0 ? "backup_%" : name).ToArray(),
        };

        foreach (var tables in variants)
        {
            var action = () => BackupTableRetirementCommand.ValidateExactTableSet(tables);
            action.Should().Throw<ArgumentException>();
        }
    }

    [Fact]
    public void Consumer_scan_should_require_every_database_source_and_declared_surface()
    {
        var zeroScan = Enum.GetValues<BackupConsumerSurface>()
            .Select(surface => new BackupConsumerScanResult(surface, Completed: true, ConsumerCount: 0))
            .ToArray();

        var action = () => BackupTableRetirementCommand.ValidateConsumerClosure(zeroScan);

        action.Should().NotThrow();
        Enum.GetValues<BackupConsumerSurface>().Should().Contain(
        [
            BackupConsumerSurface.ApplicationSource,
            BackupConsumerSurface.EfModel,
            BackupConsumerSurface.RawSql,
            BackupConsumerSurface.ForeignKey,
            BackupConsumerSurface.View,
            BackupConsumerSurface.Trigger,
            BackupConsumerSurface.Routine,
            BackupConsumerSurface.Event,
            BackupConsumerSurface.DeclaredJob,
            BackupConsumerSurface.DeclaredReport,
            BackupConsumerSurface.DeclaredTaskAction,
        ]);
    }

    [Fact]
    public void Consumer_scan_should_reject_missing_incomplete_or_nonzero_surface()
    {
        var all = Enum.GetValues<BackupConsumerSurface>()
            .Select(surface => new BackupConsumerScanResult(surface, Completed: true, ConsumerCount: 0))
            .ToList();

        Action missing = () => BackupTableRetirementCommand.ValidateConsumerClosure(all.Skip(1).ToArray());
        Action incomplete = () => BackupTableRetirementCommand.ValidateConsumerClosure(
            all.Select((item, index) => index == 1 ? item with { Completed = false } : item).ToArray());
        Action consumer = () => BackupTableRetirementCommand.ValidateConsumerClosure(
            all.Select((item, index) => index == 2 ? item with { ConsumerCount = 1 } : item).ToArray());

        missing.Should().Throw<InvalidOperationException>();
        incomplete.Should().Throw<InvalidOperationException>();
        consumer.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Drop_sql_policy_should_accept_only_seven_explicit_qualified_statements()
    {
        var sql = string.Join(
            Environment.NewLine,
            ExpectedTables.Select(table => $"DROP TABLE `{{{{TARGET_DATABASE}}}}`.`{table}`;"));

        var action = () => BackupTableRetirementCommand.ValidateDropSql(sql);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("DROP TABLE `{{TARGET_DATABASE}}`.`backup_%`;")]
    [InlineData("SET @sql = 'DROP TABLE x'; PREPARE x FROM @sql; EXECUTE x;")]
    [InlineData("USE ipcmanagement; DROP TABLE backup_dishes_20260717_141300;")]
    [InlineData("DROP DATABASE ipcmanagement;")]
    [InlineData("UPDATE ingredients SET isActive = 0;")]
    [InlineData("DELETE FROM ingredients;")]
    [InlineData("ROLLBACK;")]
    [InlineData("DROP TABLE `ipcmanagement`.`backup_dishes_20260717_141300`;")]
    public void Drop_sql_policy_should_reject_wildcard_dynamic_unrelated_or_existing_database_sql(string sql)
    {
        var action = () => BackupTableRetirementCommand.ValidateDropSql(sql);

        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Rollback_extract_should_require_encrypted_immutable_restore_tested_exact_content()
    {
        var extract = new BackupRollbackExtract(
            Tables: ExpectedTables,
            DefinitionsSha256: Hash('A'),
            DataSha256: Hash('B'),
            TriggersSha256: Hash('C'),
            CountsSha256: Hash('D'),
            RowDigestsSha256: Hash('E'),
            ArchiveSha256: Hash('F'),
            Encrypted: true,
            ImmutableProviderVersion: "provider-version-1",
            RestoreTestedDatabase: "ipc_rehearsal_phase42_extract_contract",
            RestoreVerified: true);

        var action = () => BackupTableRetirementCommand.ValidateRollbackExtract(extract);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("ipcmanagement")]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    [InlineData("ipc_restore_existing")]
    public void Rollback_extract_should_reject_existing_or_non_rehearsal_restore_target(string target)
    {
        var extract = new BackupRollbackExtract(
            ExpectedTables, Hash('A'), Hash('B'), Hash('C'), Hash('D'), Hash('E'), Hash('F'),
            Encrypted: true, ImmutableProviderVersion: "provider-version-1",
            RestoreTestedDatabase: target, RestoreVerified: true);

        var action = () => BackupTableRetirementCommand.ValidateRollbackExtract(extract);

        action.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("prepare", "ipcmanagement", true)]
    [InlineData("apply", "ipc_rehearsal_phase42_cleanup_contract", true)]
    [InlineData("postflight", "ipc_rehearsal_phase42_cleanup_contract", true)]
    [InlineData("rollback", "ipc_rehearsal_phase42_cleanup_contract", true)]
    [InlineData("apply", "ipcmanagement", false)]
    [InlineData("rollback", "ipc_lane9", false)]
    public void Mode_target_policy_should_keep_mutation_and_restore_disposable_only(
        string mode,
        string target,
        bool allowed)
    {
        var action = () => BackupTableRetirementCommand.ValidateModeTarget(mode, target);

        if (allowed) action.Should().NotThrow();
        else action.Should().Throw<ArgumentException>();
    }

    private static string Hash(char value) => new(value, 64);
}
