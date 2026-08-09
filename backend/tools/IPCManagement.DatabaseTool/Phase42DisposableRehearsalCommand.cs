using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MySqlConnector;

namespace IPCManagement.DatabaseTool;

public sealed record Phase42RehearsalRequest(
    string SourceDatabase,
    string TargetDatabase,
    string RunId,
    string ApprovedSourceSnapshotSha256,
    string ApplyScriptSha256,
    string RuntimeManifestSha256,
    IReadOnlyList<string> ExpectedTargetIds);

public sealed record Phase42RehearsalResult(
    string Status,
    string SourceDatabase,
    string TargetDatabase,
    string RunId,
    string SourceSnapshotSha256,
    string ApplySha256,
    string RuntimeManifestSha256);

public sealed record Phase42ReleaseIdentity(
    string ScriptSha256,
    string RuntimeManifestSha256)
{
    public static Phase42ReleaseIdentity FromExactBytes(
        ReadOnlySpan<byte> scriptBytes,
        ReadOnlySpan<byte> runtimeManifestBytes)
        => new(
            Convert.ToHexString(SHA256.HashData(scriptBytes)),
            Convert.ToHexString(SHA256.HashData(runtimeManifestBytes)));
}

public sealed record Phase42RehearsalArtifacts(
    string PreflightScriptPath,
    string ApplyScriptPath,
    string PostflightScriptPath,
    string RollbackScriptPath,
    string RuntimeManifestPath);

public interface IPhase42DisposableRehearsalOperations
{
    Task<bool> DatabaseExistsAsync(string database, CancellationToken cancellationToken);
    Task AssertApprovedSourceSnapshotAsync(string source, string expectedSha256, CancellationToken cancellationToken);
    Task CloneApprovedSnapshotAsync(string source, string target, string runId, CancellationToken cancellationToken);
    Task AssertCloneFidelityAsync(string target, CancellationToken cancellationToken);
    Task AssertExpectedTargetIdsAsync(string target, IReadOnlyList<string> ids, CancellationToken cancellationToken);
    Task ApplyReviewedCommandsAsync(string target, string scriptSha256, string manifestSha256, CancellationToken cancellationToken);
    Task AssertPostflightAsync(string target, CancellationToken cancellationToken);
    Task RestoreReviewedRollbackAsync(string target, string runId, CancellationToken cancellationToken);
    Task AssertExactRollbackStateAsync(string target, string sourceSnapshotSha256, CancellationToken cancellationToken);
    Task DropRunOwnedDatabaseAsync(string target, string runId, CancellationToken cancellationToken);
    Task AssertDatabaseAbsentAsync(string target, CancellationToken cancellationToken);
}

public static partial class Phase42DisposableRehearsalCommand
{
    public static async Task<Phase42RehearsalResult> ExecuteAsync(
        Phase42RehearsalRequest request,
        IPhase42DisposableRehearsalOperations operations,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(operations);
        ValidateRequest(request);

        if (await operations.DatabaseExistsAsync(request.TargetDatabase, cancellationToken))
        {
            throw new InvalidOperationException(
                $"Disposable rehearsal target already exists: {request.TargetDatabase}.");
        }

        var ownsTarget = true;
        try
        {
            await operations.AssertApprovedSourceSnapshotAsync(
                request.SourceDatabase,
                request.ApprovedSourceSnapshotSha256,
                cancellationToken);
            await operations.CloneApprovedSnapshotAsync(
                request.SourceDatabase,
                request.TargetDatabase,
                request.RunId,
                cancellationToken);
            await operations.AssertCloneFidelityAsync(request.TargetDatabase, cancellationToken);
            await operations.AssertExpectedTargetIdsAsync(
                request.TargetDatabase,
                request.ExpectedTargetIds,
                cancellationToken);
            await operations.ApplyReviewedCommandsAsync(
                request.TargetDatabase,
                request.ApplyScriptSha256,
                request.RuntimeManifestSha256,
                cancellationToken);
            await operations.AssertPostflightAsync(request.TargetDatabase, cancellationToken);
            await operations.RestoreReviewedRollbackAsync(
                request.TargetDatabase,
                request.RunId,
                cancellationToken);
            await operations.AssertExactRollbackStateAsync(
                request.TargetDatabase,
                request.ApprovedSourceSnapshotSha256,
                cancellationToken);
            await operations.ApplyReviewedCommandsAsync(
                request.TargetDatabase,
                request.ApplyScriptSha256,
                request.RuntimeManifestSha256,
                cancellationToken);
            await operations.AssertPostflightAsync(request.TargetDatabase, cancellationToken);

            return new Phase42RehearsalResult(
                "REHEARSAL_VERIFIED_AND_TORN_DOWN",
                request.SourceDatabase,
                request.TargetDatabase,
                request.RunId,
                request.ApprovedSourceSnapshotSha256,
                request.ApplyScriptSha256,
                request.RuntimeManifestSha256);
        }
        finally
        {
            if (ownsTarget)
            {
                await operations.DropRunOwnedDatabaseAsync(
                    request.TargetDatabase,
                    request.RunId,
                    CancellationToken.None);
                await operations.AssertDatabaseAbsentAsync(
                    request.TargetDatabase,
                    CancellationToken.None);
            }
        }
    }

    public static void ValidateAdministrativeCommand(string command)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(command);
        if (!AllowedAdministrativeCommand().IsMatch(command))
        {
            throw new ArgumentException(
                "Only the explicit phase42 rehearsal command from ipcmanagement to a run-owned new target is allowed.",
                nameof(command));
        }
    }

    public static void ValidateRequest(Phase42RehearsalRequest request)
    {
        if (!string.Equals(request.SourceDatabase, "ipcmanagement", StringComparison.Ordinal))
        {
            throw new ArgumentException("Phase 4.2 rehearsal source must be ipcmanagement.", nameof(request));
        }
        if (!RehearsalTarget().IsMatch(request.TargetDatabase))
        {
            throw new ArgumentException(
                "Target must match ^ipc_rehearsal_phase42_[a-z0-9_]+$.",
                nameof(request));
        }
        if (!RunId().IsMatch(request.RunId) ||
            !string.Equals(
                request.TargetDatabase,
                $"ipc_rehearsal_phase42_{request.RunId}",
                StringComparison.Ordinal))
        {
            throw new ArgumentException("Target must be owned by the exact run ID.", nameof(request));
        }
        foreach (var hash in new[]
                 {
                     request.ApprovedSourceSnapshotSha256,
                     request.ApplyScriptSha256,
                     request.RuntimeManifestSha256,
                 })
        {
            if (!Sha256().IsMatch(hash))
            {
                throw new ArgumentException("All snapshot, script and manifest hashes must be SHA-256.", nameof(request));
            }
        }
        if (request.ExpectedTargetIds.Count == 0 ||
            request.ExpectedTargetIds.Any(string.IsNullOrWhiteSpace) ||
            request.ExpectedTargetIds.Distinct(StringComparer.Ordinal).Count() != request.ExpectedTargetIds.Count)
        {
            throw new ArgumentException("Expected target IDs must be non-empty and unique.", nameof(request));
        }
    }

    [GeneratedRegex("^ipc_rehearsal_phase42_[a-z0-9_]+$", RegexOptions.CultureInvariant)]
    private static partial Regex RehearsalTarget();

    [GeneratedRegex("^[a-z0-9_]+$", RegexOptions.CultureInvariant)]
    private static partial Regex RunId();

    [GeneratedRegex("^[A-Fa-f0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256();

    [GeneratedRegex(
        "^phase42-rehearse --source ipcmanagement --target ipc_rehearsal_phase42_[a-z0-9_]+ --run-id [a-z0-9_]+$",
        RegexOptions.CultureInvariant)]
    private static partial Regex AllowedAdministrativeCommand();
}

public sealed partial class MySqlPhase42DisposableRehearsalOperations : IPhase42DisposableRehearsalOperations
{
    private readonly MySqlConnection _connection;
    private readonly Phase42RehearsalRequest _request;
    private readonly Phase42RehearsalArtifacts _artifacts;
    private readonly Phase42RuntimeManifest _manifest;
    private string? _sourceSnapshotSha256;

    public MySqlPhase42DisposableRehearsalOperations(
        MySqlConnection connection,
        Phase42RehearsalRequest request,
        Phase42RehearsalArtifacts artifacts)
    {
        _connection = connection ?? throw new ArgumentNullException(nameof(connection));
        _request = request ?? throw new ArgumentNullException(nameof(request));
        _artifacts = artifacts ?? throw new ArgumentNullException(nameof(artifacts));
        var manifestBytes = File.ReadAllBytes(artifacts.RuntimeManifestPath);
        var manifestHash = Convert.ToHexString(SHA256.HashData(manifestBytes));
        if (!string.Equals(manifestHash, request.RuntimeManifestSha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Runtime manifest exact-byte SHA-256 does not match the request.");
        }
        _manifest = JsonSerializer.Deserialize<Phase42RuntimeManifest>(
                manifestBytes,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Runtime manifest is empty.");
        if (!string.Equals(_manifest.TargetDatabase, request.TargetDatabase, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Runtime manifest target does not match the rehearsal target.");
        }
        AssertFileHash(artifacts.ApplyScriptPath, request.ApplyScriptSha256, "apply script");
        if (!string.Equals(_manifest.ScriptSha256, request.ApplyScriptSha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Runtime manifest is not signed for the exact apply script.");
        }
    }

    public async Task<bool> DatabaseExistsAsync(string database, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = @database;",
            _connection);
        command.Parameters.AddWithValue("@database", database);
        return Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) != 0;
    }

    public async Task AssertApprovedSourceSnapshotAsync(
        string source,
        string expectedSha256,
        CancellationToken cancellationToken)
    {
        _sourceSnapshotSha256 = await ComputeSnapshotSha256Async(source, cancellationToken);
        if (!string.Equals(_sourceSnapshotSha256, expectedSha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Approved source snapshot SHA-256 is stale or incorrect.");
        }
        await ExecuteRenderedScriptAsync(_artifacts.PreflightScriptPath, _manifest.PreflightAssertions, cancellationToken);
    }

    public async Task CloneApprovedSnapshotAsync(
        string source,
        string target,
        string runId,
        CancellationToken cancellationToken)
    {
        if (await DatabaseExistsAsync(target, cancellationToken))
        {
            throw new InvalidOperationException("Disposable target became present before clone.");
        }
        var (characterSet, collation) = await ReadDatabaseCollationAsync(source, cancellationToken);
        await ExecuteAsync(
            $"CREATE DATABASE {Quote(target)} CHARACTER SET {Quote(characterSet)} COLLATE {Quote(collation)};",
            cancellationToken);
        await ExecuteAsync("SET FOREIGN_KEY_CHECKS=0;", cancellationToken);
        try
        {
            foreach (var table in await ReadTablesAsync(source, cancellationToken))
            {
                var create = await ReadCreateTableAsync(source, table, cancellationToken);
                var prefix = $"CREATE TABLE {Quote(table)}";
                if (!create.StartsWith(prefix, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException($"Unexpected SHOW CREATE TABLE output for {table}.");
                }
                var columns = await ReadPhysicalColumnsAsync(source, table, cancellationToken);
                var columnList = string.Join(", ", columns.Select(Quote));
                await ExecuteAsync(
                    $"CREATE TABLE {Quote(target)}.{Quote(table)}{create[prefix.Length..]}; " +
                    $"INSERT INTO {Quote(target)}.{Quote(table)} ({columnList}) " +
                    $"SELECT {columnList} FROM {Quote(source)}.{Quote(table)};",
                    cancellationToken,
                    commandTimeout: 300);
            }
            foreach (var trigger in await ReadTriggersAsync(source, cancellationToken))
            {
                await ExecuteAsync(
                    $"CREATE TRIGGER {Quote(target)}.{Quote(trigger.Name)} {trigger.ActionTiming} " +
                    $"{trigger.EventManipulation} ON {Quote(target)}.{Quote(trigger.Table)} " +
                    $"FOR EACH ROW {trigger.Statement};",
                    cancellationToken);
            }
        }
        finally
        {
            await ExecuteAsync("SET FOREIGN_KEY_CHECKS=1;", CancellationToken.None);
        }
    }

    public async Task AssertCloneFidelityAsync(string target, CancellationToken cancellationToken)
    {
        var targetHash = await ComputeSnapshotSha256Async(target, cancellationToken);
        if (!string.Equals(_sourceSnapshotSha256, targetHash, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Clone table definitions, foreign keys, triggers or data do not match source.");
        }
    }

    public async Task AssertExpectedTargetIdsAsync(
        string target,
        IReadOnlyList<string> ids,
        CancellationToken cancellationToken)
    {
        foreach (var item in ids)
        {
            var parts = item.Split(':', 3, StringSplitOptions.TrimEntries);
            if (parts.Length != 3 || !Identifier().IsMatch(parts[0]) || !Identifier().IsMatch(parts[1]) ||
                !HexIdentity().IsMatch(parts[2]))
            {
                throw new InvalidOperationException(
                    "Expected target ID must use table:binaryColumn:hexValue format.");
            }
            await using var command = new MySqlCommand(
                $"SELECT COUNT(*) FROM {Quote(target)}.{Quote(parts[0])} WHERE HEX({Quote(parts[1])}) = @id;",
                _connection);
            command.Parameters.AddWithValue("@id", parts[2]);
            if (Convert.ToInt64(await command.ExecuteScalarAsync(cancellationToken)) != 1)
            {
                throw new InvalidOperationException($"Expected target ID is missing or duplicated: {item}.");
            }
        }
    }

    public Task ApplyReviewedCommandsAsync(
        string target,
        string scriptSha256,
        string manifestSha256,
        CancellationToken cancellationToken)
        => ExecuteRenderedScriptAsync(_artifacts.ApplyScriptPath, _manifest.AppendOnlyCommands, cancellationToken);

    public Task AssertPostflightAsync(string target, CancellationToken cancellationToken)
        => ExecuteRenderedScriptAsync(_artifacts.PostflightScriptPath, _manifest.PostflightAssertions, cancellationToken);

    public Task RestoreReviewedRollbackAsync(string target, string runId, CancellationToken cancellationToken)
        => ExecuteRenderedScriptAsync(
            _artifacts.RollbackScriptPath,
            _manifest.AppendOnlyCompensationCommands,
            cancellationToken);

    public async Task AssertExactRollbackStateAsync(
        string target,
        string sourceSnapshotSha256,
        CancellationToken cancellationToken)
    {
        var actual = await ComputeSnapshotSha256Async(target, cancellationToken);
        if (!string.Equals(actual, sourceSnapshotSha256, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Rollback did not restore the exact approved snapshot state.");
        }
    }

    public async Task DropRunOwnedDatabaseAsync(string target, string runId, CancellationToken cancellationToken)
    {
        if (!string.Equals(target, $"ipc_rehearsal_phase42_{runId}", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Refusing to teardown a target not owned by this run ID.");
        }
        if (await DatabaseExistsAsync(target, cancellationToken))
        {
            await ExecuteAsync($"DROP DATABASE {Quote(target)};", cancellationToken);
        }
    }

    public async Task AssertDatabaseAbsentAsync(string target, CancellationToken cancellationToken)
    {
        if (await DatabaseExistsAsync(target, cancellationToken))
        {
            throw new InvalidOperationException("Run-owned rehearsal target still exists after teardown.");
        }
    }

    private async Task ExecuteRenderedScriptAsync(
        string path,
        string injectedSql,
        CancellationToken cancellationToken)
    {
        var script = await File.ReadAllTextAsync(path, cancellationToken);
        var rendered = script
            .Replace("{{TARGET_DATABASE}}", _request.TargetDatabase, StringComparison.Ordinal)
            .Replace("{{RUNTIME_MANIFEST_SHA256}}", _request.RuntimeManifestSha256, StringComparison.Ordinal)
            .Replace("{{EXPECTED_MIGRATION_HEAD}}", _manifest.ExpectedMigrationHead, StringComparison.Ordinal)
            .Replace("{{COMMAND_ID}}", _manifest.CommandId, StringComparison.Ordinal)
            .Replace("{{PREFLIGHT_ASSERTIONS}}", _manifest.PreflightAssertions, StringComparison.Ordinal)
            .Replace("{{APPEND_ONLY_COMMANDS}}", _manifest.AppendOnlyCommands, StringComparison.Ordinal)
            .Replace("{{POSTFLIGHT_ASSERTIONS}}", _manifest.PostflightAssertions, StringComparison.Ordinal)
            .Replace("{{APPEND_ONLY_COMPENSATION_COMMANDS}}", _manifest.AppendOnlyCompensationCommands, StringComparison.Ordinal);
        if (UnresolvedTemplate().IsMatch(rendered))
        {
            throw new InvalidOperationException("Reviewed script contains an unresolved template token.");
        }
        ValidateRenderedSql(rendered);
        await ExecuteAsync(rendered, cancellationToken, commandTimeout: 300);
    }

    private void ValidateRenderedSql(string sql)
    {
        if (ForbiddenRenderedSql().IsMatch(sql))
        {
            throw new InvalidOperationException("Rendered business script contains forbidden database or history mutation SQL.");
        }
        var databaseReferences = DatabaseReference().Matches(sql).Select(match => match.Groups["database"].Value);
        if (databaseReferences.Any(database => !string.Equals(database, _request.TargetDatabase, StringComparison.Ordinal)))
        {
            throw new InvalidOperationException("Rendered business script references a database other than the run target.");
        }
    }

    private async Task<string> ComputeSnapshotSha256Async(string database, CancellationToken cancellationToken)
    {
        var canonical = new StringBuilder();
        foreach (var table in await ReadTablesAsync(database, cancellationToken))
        {
            canonical.Append("TABLE\t").Append(table).Append('\t')
                .Append(NormalizeCreateSql(await ReadCreateTableAsync(database, table, cancellationToken))).Append('\n');
            await using var count = new MySqlCommand(
                $"SELECT COUNT(*) FROM {Quote(database)}.{Quote(table)};",
                _connection);
            canonical.Append("COUNT\t").Append(table).Append('\t')
                .Append(Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken))).Append('\n');
            await using var checksum = new MySqlCommand(
                $"CHECKSUM TABLE {Quote(database)}.{Quote(table)};",
                _connection);
            await using var reader = await checksum.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            canonical.Append("CHECKSUM\t").Append(table).Append('\t')
                .Append(reader.IsDBNull(1) ? "NULL" : reader.GetValue(1)).Append('\n');
        }
        foreach (var trigger in await ReadTriggersAsync(database, cancellationToken))
        {
            canonical.Append("TRIGGER\t").Append(trigger).Append('\n');
        }
        await using (var command = new MySqlCommand(
                         "SELECT table_name, constraint_name, referenced_table_name, update_rule, delete_rule " +
                         "FROM information_schema.referential_constraints WHERE constraint_schema=@database " +
                         "ORDER BY table_name, constraint_name;",
                         _connection))
        {
            command.Parameters.AddWithValue("@database", database);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                canonical.Append("FK\t")
                    .Append(reader.GetString(0)).Append('\t').Append(reader.GetString(1)).Append('\t')
                    .Append(reader.GetString(2)).Append('\t').Append(reader.GetString(3)).Append('\t')
                    .Append(reader.GetString(4)).Append('\n');
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical.ToString())));
    }

    private async Task<IReadOnlyList<string>> ReadTablesAsync(string database, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            "SELECT table_name FROM information_schema.tables " +
            "WHERE table_schema=@database AND table_type='BASE TABLE' ORDER BY table_name;",
            _connection);
        command.Parameters.AddWithValue("@database", database);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var tables = new List<string>();
        while (await reader.ReadAsync(cancellationToken)) tables.Add(reader.GetString(0));
        if (tables.Count == 0) throw new InvalidOperationException($"Database {database} has no base tables.");
        return tables;
    }

    private async Task<(string CharacterSet, string Collation)> ReadDatabaseCollationAsync(
        string database,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            "SELECT default_character_set_name, default_collation_name FROM information_schema.schemata " +
            "WHERE schema_name=@database;",
            _connection);
        command.Parameters.AddWithValue("@database", database);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Source database is absent.");
        return (reader.GetString(0), reader.GetString(1));
    }

    private async Task<string> ReadCreateTableAsync(string database, string table, CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand($"SHOW CREATE TABLE {Quote(database)}.{Quote(table)};", _connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("SHOW CREATE TABLE returned no row.");
        return reader.GetString(1);
    }

    private async Task<IReadOnlyList<string>> ReadPhysicalColumnsAsync(
        string database,
        string table,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            "SELECT column_name FROM information_schema.columns " +
            "WHERE table_schema=@database AND table_name=@table AND extra NOT LIKE '%GENERATED%' " +
            "ORDER BY ordinal_position;",
            _connection);
        command.Parameters.AddWithValue("@database", database);
        command.Parameters.AddWithValue("@table", table);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var columns = new List<string>();
        while (await reader.ReadAsync(cancellationToken)) columns.Add(reader.GetString(0));
        if (columns.Count == 0) throw new InvalidOperationException($"Table {table} has no writable columns.");
        return columns;
    }

    private async Task<IReadOnlyList<Phase42Trigger>> ReadTriggersAsync(
        string database,
        CancellationToken cancellationToken)
    {
        await using var command = new MySqlCommand(
            "SELECT trigger_name, action_timing, event_manipulation, event_object_table, action_statement " +
            "FROM information_schema.triggers WHERE trigger_schema=@database ORDER BY trigger_name;",
            _connection);
        command.Parameters.AddWithValue("@database", database);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var triggers = new List<Phase42Trigger>();
        while (await reader.ReadAsync(cancellationToken))
        {
            triggers.Add(new Phase42Trigger(
                reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
        }
        return triggers;
    }

    private async Task ExecuteAsync(string sql, CancellationToken cancellationToken, int commandTimeout = 120)
    {
        await using var command = new MySqlCommand(sql, _connection) { CommandTimeout = commandTimeout };
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void AssertFileHash(string path, string expected, string label)
    {
        var actual = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path)));
        if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Exact {label} SHA-256 does not match the request.");
        }
    }

    private static string NormalizeCreateSql(string sql)
        => Regex.Replace(sql.Replace("\r\n", "\n", StringComparison.Ordinal), @"\sAUTO_INCREMENT=\d+", string.Empty).Trim();

    private static string Quote(string identifier) => $"`{identifier.Replace("`", "``", StringComparison.Ordinal)}`";

    [GeneratedRegex("^[A-Za-z0-9_]+$", RegexOptions.CultureInvariant)]
    private static partial Regex Identifier();

    [GeneratedRegex("^[A-Fa-f0-9]+$", RegexOptions.CultureInvariant)]
    private static partial Regex HexIdentity();

    [GeneratedRegex(@"\{\{[A-Z0-9_]+\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex UnresolvedTemplate();

    [GeneratedRegex(
        @"\b(?:USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE|ALTER|TRUNCATE|RENAME|UPDATE|DELETE|REPLACE)\b|PREPARE\s|EXECUTE\s|SET\s+@sql",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ForbiddenRenderedSql();

    [GeneratedRegex(@"`(?<database>ipc[a-z0-9_]*)`\s*\.", RegexOptions.CultureInvariant)]
    private static partial Regex DatabaseReference();

    private sealed record Phase42RuntimeManifest(
        string TargetDatabase,
        string ScriptSha256,
        string CommandId,
        string ExpectedMigrationHead,
        string PreflightAssertions,
        string AppendOnlyCommands,
        string PostflightAssertions,
        string AppendOnlyCompensationCommands);

    private sealed record Phase42Trigger(
        string Name,
        string ActionTiming,
        string EventManipulation,
        string Table,
        string Statement);
}
