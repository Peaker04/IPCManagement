using System.Text.RegularExpressions;

namespace IPCManagement.DatabaseTool;

public enum BackupConsumerSurface
{
    ApplicationSource,
    EfModel,
    RawSql,
    ForeignKey,
    View,
    Trigger,
    Routine,
    Event,
    DeclaredJob,
    DeclaredReport,
    DeclaredTaskAction,
}

public sealed record BackupConsumerScanResult(
    BackupConsumerSurface Surface,
    bool Completed,
    int ConsumerCount);

public sealed record BackupRollbackExtract(
    IReadOnlyList<string> Tables,
    string DefinitionsSha256,
    string DataSha256,
    string TriggersSha256,
    string CountsSha256,
    string RowDigestsSha256,
    string ArchiveSha256,
    bool Encrypted,
    string ImmutableProviderVersion,
    string RestoreTestedDatabase,
    bool RestoreVerified);

public static partial class BackupTableRetirementCommand
{
    public static IReadOnlyList<string> Tables { get; } =
    [
        "backup_bomadjustments_20260717_141300",
        "backup_dishbom_20260717_141300",
        "backup_dishes_20260717_141300",
        "backup_ingredients_20260717_141300",
        "backup_materialrequestlines_bom_20260717_141300",
        "backup_menuitems_20260717_141300",
        "backup_menuitems_pre2026_20260717_141300",
    ];

    public static void ValidateExactTableSet(IReadOnlyCollection<string> tables)
    {
        ArgumentNullException.ThrowIfNull(tables);
        if (tables.Count != Tables.Count ||
            tables.Distinct(StringComparer.Ordinal).Count() != Tables.Count ||
            !Tables.All(tables.Contains))
        {
            throw new ArgumentException("Retirement requires exactly the seven reviewed backup table names.", nameof(tables));
        }
    }

    public static void ValidateConsumerClosure(IReadOnlyCollection<BackupConsumerScanResult> results)
    {
        ArgumentNullException.ThrowIfNull(results);
        var expected = Enum.GetValues<BackupConsumerSurface>();
        if (results.Count != expected.Length ||
            results.Select(result => result.Surface).Distinct().Count() != expected.Length ||
            expected.Any(surface => results.All(result => result.Surface != surface)))
        {
            throw new InvalidOperationException("Consumer scan does not cover every required surface exactly once.");
        }
        var blocker = results.FirstOrDefault(result => !result.Completed || result.ConsumerCount != 0);
        if (blocker is not null)
        {
            throw new InvalidOperationException(
                $"Consumer surface is not closed: {blocker.Surface}, completed={blocker.Completed}, consumers={blocker.ConsumerCount}.");
        }
    }

    public static void ValidateDropSql(string sql)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sql);
        if (ForbiddenSql().IsMatch(sql) || sql.Contains('%') || sql.Contains('*') || sql.Contains('?'))
        {
            throw new ArgumentException("DROP SQL contains a forbidden token or dynamic name.", nameof(sql));
        }

        var statements = sql.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (statements.Length != Tables.Count)
        {
            throw new ArgumentException("DROP SQL must contain exactly seven statements.", nameof(sql));
        }

        var found = new List<string>();
        foreach (var statement in statements)
        {
            var match = ExplicitDrop().Match(statement);
            if (!match.Success)
            {
                throw new ArgumentException(
                    "Every DROP must use the explicit {{TARGET_DATABASE}} token and one reviewed table name.",
                    nameof(sql));
            }
            found.Add(match.Groups["table"].Value);
        }
        ValidateExactTableSet(found);
    }

    public static void ValidateRollbackExtract(BackupRollbackExtract extract)
    {
        ArgumentNullException.ThrowIfNull(extract);
        ValidateExactTableSet(extract.Tables);
        foreach (var hash in new[]
                 {
                     extract.DefinitionsSha256,
                     extract.DataSha256,
                     extract.TriggersSha256,
                     extract.CountsSha256,
                     extract.RowDigestsSha256,
                     extract.ArchiveSha256,
                 })
        {
            if (!Sha256().IsMatch(hash))
            {
                throw new ArgumentException("Rollback extract hashes must be SHA-256.", nameof(extract));
            }
        }
        if (!extract.Encrypted || !extract.RestoreVerified ||
            string.IsNullOrWhiteSpace(extract.ImmutableProviderVersion))
        {
            throw new ArgumentException(
                "Rollback extract must be encrypted, immutable and restore-verified.",
                nameof(extract));
        }
        if (!RehearsalTarget().IsMatch(extract.RestoreTestedDatabase))
        {
            throw new ArgumentException(
                "Rollback extract may be restore-tested only in ipc_rehearsal_phase42_*.",
                nameof(extract));
        }
    }

    public static void ValidateModeTarget(string mode, string targetDatabase)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(mode);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetDatabase);
        switch (mode.ToLowerInvariant())
        {
            case "prepare" when targetDatabase == "ipcmanagement" || RehearsalTarget().IsMatch(targetDatabase):
            case "apply" when RehearsalTarget().IsMatch(targetDatabase):
            case "postflight" when RehearsalTarget().IsMatch(targetDatabase):
            case "rollback" when RehearsalTarget().IsMatch(targetDatabase):
                return;
            default:
                throw new ArgumentException(
                    "Prepare is read-only; apply/postflight/rollback are restricted to disposable phase42 targets.");
        }
    }

    [GeneratedRegex(
        @"\b(?:USE|CREATE\s+DATABASE|DROP\s+DATABASE|ALTER|TRUNCATE|RENAME|INSERT|UPDATE|DELETE|REPLACE|PREPARE|EXECUTE|DEALLOCATE|ROLLBACK)\b|SET\s+@|--|/\*|\*/",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ForbiddenSql();

    [GeneratedRegex(
        @"^DROP\s+TABLE\s+`\{\{TARGET_DATABASE\}\}`\.`(?<table>[a-z0-9_]+)`$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ExplicitDrop();

    [GeneratedRegex("^[A-Fa-f0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256();

    [GeneratedRegex("^ipc_rehearsal_phase42_[a-z0-9_]+$", RegexOptions.CultureInvariant)]
    private static partial Regex RehearsalTarget();
}
