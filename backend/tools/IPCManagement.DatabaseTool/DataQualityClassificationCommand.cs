using System.Text.Json;
using MySqlConnector;

namespace IPCManagement.DatabaseTool;

public static class DataQualityClassificationCommand
{
    public static async Task<int> ExecuteAsync(MySqlConnection connection, string database, string? outputPath = null)
    {
        var movements = await ReadMovementMismatchesAsync(connection, database);
        var menuWeeks = await ReadMenuWeekMismatchesAsync(connection, database);
        var json = JsonSerializer.Serialize(new
        {
            Database = database,
            MutationStatements = 0,
            MovementMismatchCount = movements.Count,
            MenuWeekMismatchCount = menuWeeks.Count,
            MovementMismatches = movements,
            MenuWeekMismatches = menuWeeks
        });
        if (outputPath is null)
        {
            Console.WriteLine(json);
        }
        else
        {
            var fullPath = Path.GetFullPath(outputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllTextAsync(fullPath, json);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                Database = database,
                OutputPath = fullPath,
                MovementMismatchCount = movements.Count,
                MenuWeekMismatchCount = menuWeeks.Count,
                MutationStatements = 0
            }));
        }
        return 0;
    }

    private static async Task<List<object>> ReadMovementMismatchesAsync(MySqlConnection connection, string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(movementId) AS sourceEntityId,
                   movementDate,
                   HEX(warehouseId) AS warehouseId,
                   HEX(ingredientId) AS ingredientId,
                   HEX(unitId) AS unitId,
                   movementType,
                   refTable,
                   CASE WHEN refId IS NULL THEN NULL ELSE HEX(refId) END AS refId,
                   beforeQty,
                   quantityIn,
                   quantityOut,
                   afterQty,
                   ROUND(afterQty - (beforeQty + quantityIn - quantityOut), 6) AS equationDelta,
                   SHA2(CONCAT_WS('|', HEX(movementId), DATE_FORMAT(movementDate, '%Y-%m-%d %H:%i:%s'),
                       beforeQty, quantityIn, quantityOut, afterQty, movementType,
                       COALESCE(refTable, ''), COALESCE(HEX(refId), '')), 256) AS sourceFingerprint
            FROM {Quote(database)}.stockmovements
            WHERE ABS(afterQty - (beforeQty + quantityIn - quantityOut)) > 0.000010
            ORDER BY movementDate, movementId;
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<object>();
        while (await reader.ReadAsync())
        {
            var beforeQty = reader.GetDecimal("beforeQty");
            var quantityIn = reader.GetDecimal("quantityIn");
            var quantityOut = reader.GetDecimal("quantityOut");
            var afterQty = reader.GetDecimal("afterQty");
            var snapshotUnavailable = beforeQty == 0 && afterQty == 0 && (quantityIn > 0 || quantityOut > 0);
            rows.Add(new
            {
                IssueType = "STOCK_MOVEMENT_BALANCE",
                SourceEntityId = reader.GetString("sourceEntityId"),
                SourceFingerprint = reader.GetString("sourceFingerprint").ToUpperInvariant(),
                Classification = snapshotUnavailable
                    ? "LEGACY_QUANTITY_SNAPSHOT_UNAVAILABLE"
                    : "HISTORICAL_ROW_EQUATION_MISMATCH",
                ProposedAction = snapshotUnavailable
                    ? "DISPOSITION_NO_LEDGER_ADJUSTMENT"
                    : "REVIEW_APPEND_ONLY_ADJUSTMENT",
                MovementDate = reader.GetDateTime("movementDate").ToString("O"),
                WarehouseId = reader.GetString("warehouseId"),
                IngredientId = reader.GetString("ingredientId"),
                UnitId = reader.GetString("unitId"),
                MovementType = reader.GetString("movementType"),
                RefTable = ReadNullableString(reader, "refTable"),
                RefId = ReadNullableString(reader, "refId"),
                BeforeQty = beforeQty,
                QuantityIn = quantityIn,
                QuantityOut = quantityOut,
                AfterQty = afterQty,
                EquationDelta = reader.GetDecimal("equationDelta")
            });
        }
        return rows;
    }

    private static async Task<List<object>> ReadMenuWeekMismatchesAsync(MySqlConnection connection, string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(menuScheduleId) AS sourceEntityId,
                   serviceDate,
                   weekStartDate,
                   DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY) AS expectedWeekStartDate,
                   shiftName,
                   status,
                   HEX(menuVersionId) AS menuVersionId,
                   (SELECT COUNT(*) FROM {Quote(database)}.productionplans AS plan
                    WHERE plan.menuVersionId = schedule.menuVersionId AND plan.planDate = schedule.serviceDate) AS downstreamPlanCount,
                   SHA2(CONCAT_WS('|', HEX(menuScheduleId), serviceDate, weekStartDate,
                       DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY), shiftName,
                       status, HEX(menuVersionId)), 256) AS sourceFingerprint
            FROM {Quote(database)}.menuschedules AS schedule
            WHERE weekStartDate <> DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY)
            ORDER BY serviceDate, menuScheduleId;
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<object>();
        while (await reader.ReadAsync())
        {
            var downstreamPlanCount = reader.GetInt64("downstreamPlanCount");
            rows.Add(new
            {
                IssueType = "MENU_WEEK_MISMATCH",
                SourceEntityId = reader.GetString("sourceEntityId"),
                SourceFingerprint = reader.GetString("sourceFingerprint").ToUpperInvariant(),
                Classification = downstreamPlanCount == 0
                    ? "NO_PHYSICAL_PLAN_REFERENCE"
                    : "HAS_DOWNSTREAM_PLAN_REFERENCE",
                ProposedAction = downstreamPlanCount == 0
                    ? "REVIEW_SCHEDULE_SUPERSESSION"
                    : "BLOCKED_BUSINESS_RECONCILIATION",
                ServiceDate = reader.GetDateTime("serviceDate").ToString("yyyy-MM-dd"),
                WeekStartDate = reader.GetDateTime("weekStartDate").ToString("yyyy-MM-dd"),
                ExpectedWeekStartDate = reader.GetDateTime("expectedWeekStartDate").ToString("yyyy-MM-dd"),
                ShiftName = reader.GetString("shiftName"),
                Status = reader.GetString("status"),
                MenuVersionId = ReadNullableString(reader, "menuVersionId"),
                DownstreamPlanCount = downstreamPlanCount
            });
        }
        return rows;
    }

    private static string Quote(string identifier) => $"`{identifier.Replace("`", "``", StringComparison.Ordinal)}`";
    private static string? ReadNullableString(MySqlDataReader reader, string name)
        => reader.IsDBNull(reader.GetOrdinal(name)) ? null : reader.GetString(name);
}
