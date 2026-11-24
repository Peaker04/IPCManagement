using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace IPCManagement.DatabaseTool;

/// <summary>Private read-only inventory; no schema migration or group mutation.</summary>
public static partial class PreparationGroupReviewCommand
{
    // Contract-tested against the API owner; this tool has no API project dependency.
    public static IReadOnlySet<string> AllowedGroups { get; } = new HashSet<string>(StringComparer.Ordinal)
        { "PRODUCE", "FRESH_MEAT", "FRESH_SEAFOOD", "FROZEN", "SEASONING", "RICE", "NOODLES", "EGGS", "DAIRY", "BAKERY", "BEVERAGES", "PACKAGING", "ICE", "OTHER", "UNCLASSIFIED" };

    public static void ValidateSnapshotTarget(string database)
    {
        if (database != "ipcmanagement" && !EvidenceDatabase().IsMatch(database))
            throw new ArgumentException("Snapshot requires ipcmanagement or a canonical MRX evidence database.");
    }

    [GeneratedRegex("^ipc_mrx_evidence_[0-9]{8}t[0-9]{6}z_[a-f0-9]{6}$", RegexOptions.CultureInvariant)]
    private static partial Regex EvidenceDatabase();

    public static string Fingerprint(JsonElement content)
    {
        using var bytes = new MemoryStream();
        using (var writer = new Utf8JsonWriter(bytes)) WriteCanonical(writer, content);
        return Convert.ToHexString(SHA256.HashData(bytes.ToArray())).ToLowerInvariant();
    }

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            writer.WriteStartObject();
            foreach (var property in element.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal))
            {
                writer.WritePropertyName(property.Name);
                WriteCanonical(writer, property.Value);
            }
            writer.WriteEndObject();
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            writer.WriteStartArray();
            foreach (var item in element.EnumerateArray()) WriteCanonical(writer, item);
            writer.WriteEndArray();
        }
        else element.WriteTo(writer);
    }

    public static async Task<int> SnapshotAsync(MySqlConnection connection, string outputPath, CancellationToken cancellationToken = default)
    {
        ValidateSnapshotTarget(connection.Database);
        // MySQL enforces read-only for the whole consistent snapshot, not just by convention.
        await ExecuteAsync(connection, "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ", cancellationToken);
        await ExecuteAsync(connection, "SET TRANSACTION READ ONLY", cancellationToken);
        await ExecuteAsync(connection, "START TRANSACTION WITH CONSISTENT SNAPSHOT", cancellationToken);
        Dictionary<string, object?> semantic;
        try
        {
            await using var column = new MySqlCommand("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='ingredients' AND column_name='PreparationGroupCode'", connection);
            var hasGroup = Convert.ToInt32(await column.ExecuteScalarAsync(cancellationToken), CultureInfo.InvariantCulture) == 1;
            var groupExpression = hasGroup ? "i.PreparationGroupCode" : "NULL";
            var ingredients = await QueryAsync(connection, $"SELECT HEX(i.IngredientId) ingredientIdHex,i.IngredientCode ingredientCode,i.IngredientName name,HEX(i.UnitId) unitIdHex,u.UnitCode unitCode,i.IsActive isActive,{groupExpression} currentGroup FROM ingredients i LEFT JOIN units u ON u.UnitId=i.UnitId ORDER BY i.IngredientId", cancellationToken);
            var units = await QueryAsync(connection, "SELECT HEX(UnitId) unitIdHex,UnitCode unitCode,UnitName unitName,BaseUnitCode baseUnitCode,CAST(ConvertRateToBase AS CHAR) convertRateToBase FROM units ORDER BY UnitId", cancellationToken);
            var suppliers = await QueryAsync(connection, "SELECT HEX(SupplierId) supplierIdHex,SupplierCode supplierCode,SupplierName name,IsActive isActive FROM suppliers ORDER BY SupplierId", cancellationToken);
            var quotations = await QueryAsync(connection, "SELECT HEX(QuotationId) quotationIdHex,HEX(SupplierId) supplierIdHex,HEX(IngredientId) ingredientIdHex,CAST(EffectiveFrom AS CHAR) effectiveFrom,CAST(EffectiveTo AS CHAR) effectiveTo,IsActive isActive FROM supplierquotations ORDER BY QuotationId", cancellationToken);
            // Global counts expose broken reference coverage without publishing prices or contacts.
            var references = await QueryAsync(connection, "SELECT HEX(s.SupplierId) supplierIdHex,(SELECT COUNT(*) FROM purchaseorders p WHERE p.SupplierId=s.SupplierId) purchaseOrderRefs,(SELECT COUNT(*) FROM inventoryreceipts r WHERE r.SupplierId=s.SupplierId) receiptRefs FROM suppliers s ORDER BY s.SupplierId", cancellationToken);
            semantic = new()
            {
                ["schemaVersion"] = 1, ["databaseIdentity"] = connection.Database,
                ["schemaHasPreparationGroup"] = hasGroup, ["ingredients"] = ingredients,
                ["units"] = units, ["suppliers"] = suppliers, ["quotations"] = quotations,
                ["supplierReferences"] = references
            };
            await ExecuteAsync(connection, "COMMIT", cancellationToken);
        }
        catch
        {
            await ExecuteAsync(connection, "ROLLBACK", CancellationToken.None);
            throw;
        }
        semantic["fingerprint"] = Fingerprint(JsonSerializer.SerializeToElement(semantic));
        semantic["collectedAtUtc"] = DateTime.UtcNow;
        var fullPath = Path.GetFullPath(outputPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await File.WriteAllTextAsync(fullPath, JsonSerializer.Serialize(semantic, new JsonSerializerOptions { WriteIndented = true }), cancellationToken);
        Console.WriteLine(JsonSerializer.Serialize(new { result = "READ_ONLY_SNAPSHOT", ingredients = ((List<Dictionary<string, object?>>)semantic["ingredients"]!).Count, fingerprint = semantic["fingerprint"] }));
        return 0;
    }

    private static async Task<List<Dictionary<string, object?>>> QueryAsync(MySqlConnection connection, string sql, CancellationToken token)
    {
        await using var command = new MySqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(token);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(token))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                row[name] = reader.IsDBNull(i) ? null : name == "isActive" ? reader.GetBoolean(i) : reader.GetValue(i);
            }
            rows.Add(row);
        }
        return rows;
    }

    private static async Task ExecuteAsync(MySqlConnection connection, string sql, CancellationToken token)
    {
        await using var command = new MySqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(token);
    }
}
