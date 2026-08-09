using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace IPCManagement.DatabaseTool;

public sealed record BusinessEvidenceClosureRow(
    string SourceEntityId,
    string PackageFingerprint,
    string CurrentFingerprint,
    string Decision,
    bool HasRequiredAttestations,
    bool SourceIsImmutable,
    bool HasFullDownstreamProof,
    string? OutcomeEntityType,
    string? OutcomeEntityId,
    decimal? SourceToCatalogFactor,
    bool CompatibleDimension,
    bool HasAuthoritativeSource);

public sealed record BusinessEvidenceClosureSnapshot(
    IReadOnlyList<BusinessEvidenceClosureRow> Movements,
    IReadOnlyList<BusinessEvidenceClosureRow> MenuWeeks,
    IReadOnlyList<BusinessEvidenceClosureRow> UnitReviews);

public sealed record BusinessEvidenceClosureResult(
    bool IsClosed,
    int MovementCount,
    int MenuWeekCount,
    int UnitReviewCount,
    int MutationStatements,
    IReadOnlyList<string> Issues);

public static class BusinessEvidenceClosureCommand
{
    private const int ExpectedMovementCount = 2461;
    private const int ExpectedMenuWeekCount = 84;
    private const int ExpectedUnitReviewCount = 44;

    public static BusinessEvidenceClosureResult Evaluate(BusinessEvidenceClosureSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var issues = new List<string>();
        RequireExactCount("movement", snapshot.Movements.Count, ExpectedMovementCount, issues);
        RequireExactCount("menu-week", snapshot.MenuWeeks.Count, ExpectedMenuWeekCount, issues);
        RequireExactCount("unit review", snapshot.UnitReviews.Count, ExpectedUnitReviewCount, issues);

        ValidateStableRows("movement", snapshot.Movements, issues);
        ValidateStableRows("menu-week", snapshot.MenuWeeks, issues);
        ValidateStableRows("unit review", snapshot.UnitReviews, issues);

        foreach (var row in snapshot.Movements)
        {
            if (row.Decision == "RESOLVED_NO_CHANGE")
            {
                if (row.OutcomeEntityType is not null || row.OutcomeEntityId is not null)
                    issues.Add($"movement {row.SourceEntityId} no-change outcome must not fabricate a correction link.");
            }
            else if (row.Decision == "CORRECTED")
            {
                RequireOutcome("movement", row, issues);
            }
            else
            {
                issues.Add($"movement {row.SourceEntityId} is not terminal.");
            }
        }

        foreach (var row in snapshot.MenuWeeks)
        {
            if (row.Decision is not ("SUPERSEDED" or "CORRECTED"))
                issues.Add($"menu-week {row.SourceEntityId} is not terminal.");
            else
                RequireOutcome("menu-week", row, issues);
            if (!row.HasFullDownstreamProof)
                issues.Add($"menu-week {row.SourceEntityId} is missing full downstream proof.");
        }

        foreach (var row in snapshot.UnitReviews)
        {
            if (row.Decision == "CONFIRMED")
            {
                if (row.SourceToCatalogFactor is null or <= 0)
                    issues.Add($"unit review {row.SourceEntityId} has no positive factor.");
                if (!row.CompatibleDimension)
                    issues.Add($"unit review {row.SourceEntityId} has an incompatible dimension.");
            }
            else if (row.Decision != "RETAIN_DISTINCT")
            {
                issues.Add($"unit review {row.SourceEntityId} is not CONFIRMED or RETAIN_DISTINCT.");
            }
        }

        return new BusinessEvidenceClosureResult(
            issues.Count == 0,
            snapshot.Movements.Count,
            snapshot.MenuWeeks.Count,
            snapshot.UnitReviews.Count,
            MutationStatements: 0,
            issues);
    }

    public static async Task<int> ExecuteAsync(
        Func<Task<MySqlConnection>> connectionFactory,
        string database,
        string? outputPath = null)
    {
        ArgumentNullException.ThrowIfNull(connectionFactory);
        ValidateTarget(database);
        await using var connection = await connectionFactory();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();

        var snapshot = await ReadSnapshotAsync(connection, database);
        var result = Evaluate(snapshot);
        var json = JsonSerializer.Serialize(new
        {
            Database = database,
            result.IsClosed,
            result.MovementCount,
            result.MenuWeekCount,
            result.UnitReviewCount,
            result.MutationStatements,
            result.Issues
        });

        if (outputPath is null)
        {
            Console.WriteLine(json);
        }
        else
        {
            var fullPath = Path.GetFullPath(outputPath);
            var parent = Path.GetDirectoryName(fullPath)
                ?? throw new ArgumentException("Closure output path must have a parent directory.");
            Directory.CreateDirectory(parent);
            await File.WriteAllTextAsync(fullPath, json);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                Database = database,
                OutputPath = fullPath,
                result.IsClosed,
                result.MutationStatements
            }));
        }

        return result.IsClosed ? 0 : 1;
    }

    public static void ValidateTarget(string database)
    {
        if (!string.Equals(database, "ipcmanagement", StringComparison.Ordinal) &&
            !Regex.IsMatch(database ?? string.Empty, "^ipc_rehearsal_phase42_[a-z0-9_]+$",
                RegexOptions.CultureInvariant))
            throw new ArgumentException(
                "Business evidence closure is restricted to ipcmanagement or a new ipc_rehearsal_phase42_* target.");
    }

    private static void RequireExactCount(string family, int actual, int expected, ICollection<string> issues)
    {
        if (actual != expected)
            issues.Add($"Expected exactly {expected} {family} rows but found {actual}.");
    }

    private static void ValidateStableRows(
        string family,
        IReadOnlyList<BusinessEvidenceClosureRow> rows,
        ICollection<string> issues)
    {
        foreach (var duplicate in rows.GroupBy(row => row.SourceEntityId, StringComparer.Ordinal)
                     .Where(group => group.Count() != 1))
            issues.Add($"{family} source {duplicate.Key} is duplicate.");

        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.SourceEntityId))
                issues.Add($"{family} has a missing stable source ID.");
            if (!IsSha256(row.PackageFingerprint) || !IsSha256(row.CurrentFingerprint) ||
                !string.Equals(row.PackageFingerprint, row.CurrentFingerprint, StringComparison.Ordinal))
                issues.Add($"{family} {row.SourceEntityId} has stale or invalid fingerprint evidence.");
            if (!row.HasRequiredAttestations)
                issues.Add($"{family} {row.SourceEntityId} is missing required source-owner attestations.");
            if (!row.SourceIsImmutable)
                issues.Add($"{family} {row.SourceEntityId} source immutability is not proven.");
            if (!row.HasAuthoritativeSource)
                issues.Add($"{family} {row.SourceEntityId} has no authoritative source evidence.");
            if (row.Decision is "BLOCKED_BUSINESS" or "NEEDS_CONFIRMATION" or "CORRECTION_REQUIRED" or "SUPERSESSION_REQUIRED")
                issues.Add($"{family} {row.SourceEntityId} remains open or blocked.");
        }
    }

    private static void RequireOutcome(
        string family,
        BusinessEvidenceClosureRow row,
        ICollection<string> issues)
    {
        if (string.IsNullOrWhiteSpace(row.OutcomeEntityType) || !IsStableId(row.OutcomeEntityId))
            issues.Add($"{family} {row.SourceEntityId} is missing an append-only outcome link.");
    }

    private static bool IsSha256(string? value)
        => value is { Length: 64 } && value.All(Uri.IsHexDigit);

    private static bool IsStableId(string? value)
        => Guid.TryParse(value, out _) ||
           value is { Length: 32 } && value.All(Uri.IsHexDigit);

    private static async Task<BusinessEvidenceClosureSnapshot> ReadSnapshotAsync(
        MySqlConnection connection,
        string database)
    {
        var currentFingerprints = await ReadCurrentFingerprintsAsync(connection, database);
        var unitFacts = await ReadUnitFactsAsync(connection, database);
        var rows = await ReadPackageRowsAsync(connection, database, currentFingerprints, unitFacts);
        return new BusinessEvidenceClosureSnapshot(
            rows.Where(row => row.IssueType == "STOCK_MOVEMENT_BALANCE").Select(row => row.Row).ToArray(),
            rows.Where(row => row.IssueType == "MENU_WEEK_MISMATCH").Select(row => row.Row).ToArray(),
            rows.Where(row => row.IssueType == "UNIT_NORMALIZATION").Select(row => row.Row).ToArray());
    }

    private static async Task<Dictionary<(string IssueType, string SourceId), string>> ReadCurrentFingerprintsAsync(
        MySqlConnection connection,
        string database)
    {
        var result = new Dictionary<(string, string), string>();
        await ReadFingerprintFamilyAsync(connection,
            $"""
            SELECT HEX(movementId) AS sourceId,
                   SHA2(CONCAT_WS('|', HEX(movementId), DATE_FORMAT(movementDate, '%Y-%m-%d %H:%i:%s'),
                       beforeQty, quantityIn, quantityOut, afterQty, movementType,
                       COALESCE(refTable, ''), COALESCE(HEX(refId), '')), 256) AS fingerprint
            FROM {Quote(database)}.stockmovements
            WHERE ABS(afterQty - (beforeQty + quantityIn - quantityOut)) > 0.000010;
            """, "STOCK_MOVEMENT_BALANCE", result);
        await ReadFingerprintFamilyAsync(connection,
            $"""
            SELECT HEX(menuScheduleId) AS sourceId,
                   SHA2(CONCAT_WS('|', HEX(menuScheduleId), serviceDate, weekStartDate,
                       DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY), shiftName,
                       status, HEX(menuVersionId)), 256) AS fingerprint
            FROM {Quote(database)}.menuschedules
            WHERE weekStartDate <> DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY);
            """, "MENU_WEEK_MISMATCH", result);
        await ReadFingerprintFamilyAsync(connection,
            $"""
            SELECT HEX(review.reviewId) AS sourceId,
                   SHA2(CONCAT_WS('|', HEX(review.reviewId), HEX(review.ingredientId), HEX(review.sourceUnitId),
                       sourceUnit.unitCode, COALESCE(sourceUnit.baseUnitCode, ''), sourceUnit.convertRateToBase,
                       HEX(review.catalogUnitId), catalogUnit.unitCode, COALESCE(catalogUnit.baseUnitCode, ''),
                       catalogUnit.convertRateToBase), 256) AS fingerprint
            FROM {Quote(database)}.unitnormalizationreviews AS review
            INNER JOIN {Quote(database)}.units AS sourceUnit ON sourceUnit.unitId = review.sourceUnitId
            INNER JOIN {Quote(database)}.units AS catalogUnit ON catalogUnit.unitId = review.catalogUnitId;
            """, "UNIT_NORMALIZATION", result);
        return result;
    }

    private static async Task ReadFingerprintFamilyAsync(
        MySqlConnection connection,
        string sql,
        string issueType,
        IDictionary<(string IssueType, string SourceId), string> result)
    {
        await using var command = new MySqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            result[(issueType, reader.GetString("sourceId"))] = reader.GetString("fingerprint").ToUpperInvariant();
    }

    private static async Task<Dictionary<string, UnitFact>> ReadUnitFactsAsync(
        MySqlConnection connection,
        string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(review.reviewId) AS sourceId,
                   review.proposedSourceToCatalogFactor,
                   COALESCE(sourceUnit.baseUnitCode, sourceUnit.unitCode) =
                       COALESCE(catalogUnit.baseUnitCode, catalogUnit.unitCode) AS compatibleDimension
            FROM {Quote(database)}.unitnormalizationreviews AS review
            INNER JOIN {Quote(database)}.units AS sourceUnit ON sourceUnit.unitId = review.sourceUnitId
            INNER JOIN {Quote(database)}.units AS catalogUnit ON catalogUnit.unitId = review.catalogUnitId;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new Dictionary<string, UnitFact>(StringComparer.Ordinal);
        while (await reader.ReadAsync())
        {
            result[reader.GetString("sourceId")] = new UnitFact(
                reader.IsDBNull(reader.GetOrdinal("proposedSourceToCatalogFactor"))
                    ? null
                    : reader.GetDecimal("proposedSourceToCatalogFactor"),
                reader.GetBoolean("compatibleDimension"));
        }
        return result;
    }

    private static async Task<List<PackageClosureRow>> ReadPackageRowsAsync(
        MySqlConnection connection,
        string database,
        IReadOnlyDictionary<(string IssueType, string SourceId), string> currentFingerprints,
        IReadOnlyDictionary<string, UnitFact> unitFacts)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT package.issueType,
                   HEX(package.subjectId) AS sourceId,
                   package.sourceFingerprint,
                   package.manifestUtf8,
                   package.decision,
                   package.outcomeEntityType,
                   CASE WHEN package.outcomeEntityId IS NULL THEN NULL ELSE HEX(package.outcomeEntityId) END AS outcomeEntityId,
                   SUM(attestation.authoritySlot = 'WAREHOUSE_SOURCE_OWNER') AS warehouseCount,
                   SUM(attestation.authoritySlot = 'FINANCE_SOURCE_OWNER') AS financeCount,
                   SUM(attestation.authoritySlot = 'COORDINATION_SOURCE_OWNER') AS coordinationCount,
                   SUM(attestation.authoritySlot = 'CATALOG_SOURCE_OWNER') AS catalogCount,
                   COUNT(DISTINCT HEX(attestation.actorId)) AS distinctActorCount
            FROM {Quote(database)}.businessevidencepackages AS package
            LEFT JOIN {Quote(database)}.businessevidenceattestations AS attestation
              ON attestation.packageId = package.packageId
             AND attestation.manifestSha256 = package.manifestSha256
             AND (attestation.expiresAtUtc IS NULL OR attestation.expiresAtUtc > UTC_TIMESTAMP())
            WHERE package.issueType IN ('STOCK_MOVEMENT_BALANCE','MENU_WEEK_MISMATCH','UNIT_NORMALIZATION')
              AND (package.expiresAtUtc IS NULL OR package.expiresAtUtc > UTC_TIMESTAMP())
            GROUP BY package.packageId, package.issueType, package.subjectId, package.sourceFingerprint,
                     package.manifestUtf8, package.decision, package.outcomeEntityType, package.outcomeEntityId;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new List<PackageClosureRow>();
        while (await reader.ReadAsync())
        {
            var issueType = reader.GetString("issueType");
            var sourceId = reader.GetString("sourceId");
            var packageFingerprint = reader.GetString("sourceFingerprint").ToUpperInvariant();
            currentFingerprints.TryGetValue((issueType, sourceId), out var currentFingerprint);
            var sourceTypes = ReadSourceTypes(reader.GetFieldValue<byte[]>(reader.GetOrdinal("manifestUtf8")));
            var requiredAttestations = issueType switch
            {
                "STOCK_MOVEMENT_BALANCE" => reader.GetInt64("warehouseCount") == 1 &&
                    reader.GetInt64("financeCount") == 1 && reader.GetInt64("distinctActorCount") >= 2,
                "MENU_WEEK_MISMATCH" => reader.GetInt64("coordinationCount") == 1,
                "UNIT_NORMALIZATION" => reader.GetInt64("catalogCount") == 1 || reader.GetInt64("warehouseCount") == 1,
                _ => false
            };
            var unitFact = unitFacts.GetValueOrDefault(sourceId);
            result.Add(new PackageClosureRow(issueType, new BusinessEvidenceClosureRow(
                sourceId,
                packageFingerprint,
                currentFingerprint ?? string.Empty,
                reader.GetString("decision"),
                requiredAttestations,
                currentFingerprint is not null && string.Equals(packageFingerprint, currentFingerprint, StringComparison.Ordinal),
                issueType != "MENU_WEEK_MISMATCH" || sourceTypes.Contains("DOWNSTREAM_TRAVERSAL"),
                reader.IsDBNull(reader.GetOrdinal("outcomeEntityType")) ? null : reader.GetString("outcomeEntityType"),
                reader.IsDBNull(reader.GetOrdinal("outcomeEntityId")) ? null : reader.GetString("outcomeEntityId"),
                unitFact?.Factor,
                unitFact?.CompatibleDimension ?? issueType != "UNIT_NORMALIZATION",
                HasAuthoritativeSource(issueType, sourceTypes))));
        }
        return result;
    }

    private static HashSet<string> ReadSourceTypes(byte[] manifestUtf8)
    {
        using var document = JsonDocument.Parse(manifestUtf8);
        if (!TryGetProperty(document.RootElement, "sourceReferences", out var references) ||
            references.ValueKind != JsonValueKind.Array)
            return [];

        var result = new HashSet<string>(StringComparer.Ordinal);
        foreach (var source in references.EnumerateArray())
        {
            if (TryGetProperty(source, "sourceType", out var sourceType) && sourceType.ValueKind == JsonValueKind.String)
                result.Add(sourceType.GetString()!.Trim().ToUpperInvariant());
        }
        return result;
    }

    private static bool TryGetProperty(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }
        value = default;
        return false;
    }

    private static bool HasAuthoritativeSource(string issueType, IReadOnlySet<string> sourceTypes)
        => issueType switch
        {
            "STOCK_MOVEMENT_BALANCE" => sourceTypes.Contains("LEDGER") && sourceTypes.Contains("RECEIPT") &&
                sourceTypes.Contains("STOCK_SNAPSHOT"),
            "MENU_WEEK_MISMATCH" => sourceTypes.Contains("SOURCE_WORKBOOK") && sourceTypes.Contains("DOWNSTREAM_TRAVERSAL"),
            "UNIT_NORMALIZATION" => sourceTypes.Contains("AUTHORITATIVE_UNIT_SOURCE"),
            _ => false
        };

    private static string Quote(string identifier)
        => $"`{identifier.Replace("`", "``", StringComparison.Ordinal)}`";

    private sealed record PackageClosureRow(string IssueType, BusinessEvidenceClosureRow Row);
    private sealed record UnitFact(decimal? Factor, bool CompatibleDimension);
}
