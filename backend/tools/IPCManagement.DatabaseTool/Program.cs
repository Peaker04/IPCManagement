using System.Text.Json;
using IPCManagement.DatabaseTool;
using MySqlConnector;

if (args.Length == 7 &&
    args[0] == "weekly-menu-evidence" &&
    args[1] == "--settings" &&
    args[3] == "--database" &&
    args[5] == "--week")
{
    var evidenceSettingsPath = Path.GetFullPath(args[2]);
    var evidenceDatabase = args[4];
    if (!DateOnly.TryParseExact(args[6], "yyyy-MM-dd", out var evidenceWeek))
    {
        Console.Error.WriteLine("Weekly-menu evidence week must use yyyy-MM-dd.");
        return 2;
    }

    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(evidenceDatabase);
        await using var connection = await OpenServerConnectionAsync(evidenceSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT customer.customerCode,
                   COUNT(DISTINCT version.menuVersionId) AS menuVersionCount,
                   COUNT(DISTINCT schedule.menuScheduleId) AS menuScheduleCount,
                   COUNT(DISTINCT tier.tierId) AS tierCount,
                   COALESCE(GROUP_CONCAT(DISTINCT version.status ORDER BY version.status SEPARATOR ','), '') AS statuses
            FROM {Quote(evidenceDatabase)}.{Quote("customers")} AS customer
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("menuversions")} AS version
                ON version.customerId = customer.customerId
               AND version.weekStartDate = @week
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("menuschedules")} AS schedule
                ON schedule.customerId = customer.customerId
               AND schedule.weekStartDate = @week
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("customerweekmenutiers")} AS tier
                ON tier.customerId = customer.customerId
               AND tier.weekStartDate = @week
            WHERE customer.customerCode IN ('ANV', 'DAV')
            GROUP BY customer.customerCode
            ORDER BY customer.customerCode;
            """,
            connection);
        command.Parameters.AddWithValue("@week", evidenceWeek.ToDateTime(TimeOnly.MinValue));
        await using var reader = await command.ExecuteReaderAsync();
        var customers = new List<object>();
        while (await reader.ReadAsync())
        {
            customers.Add(new
            {
                CustomerCode = reader.GetString("customerCode"),
                MenuVersionCount = reader.GetInt32("menuVersionCount"),
                MenuScheduleCount = reader.GetInt32("menuScheduleCount"),
                TierCount = reader.GetInt32("tierCount"),
                Statuses = reader.GetString("statuses")
            });
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = evidenceDatabase,
            WeekStartDate = evidenceWeek.ToString("yyyy-MM-dd"),
            Customers = customers
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Weekly-menu evidence failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "sanitize-e2e" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var sanitizeSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateSanitizeTarget(database);
        await using var connection = await OpenServerConnectionAsync(sanitizeSettingsPath);
        var transactionTables = DatabaseSanitizePolicy.TransactionTables;

        var importedMenuIdsTable = $"phase18_imported_menu_ids_{Environment.ProcessId}";
        await ExecuteAsync(connection, $"""
            CREATE TEMPORARY TABLE {Quote(importedMenuIdsTable)} (
                menuId BINARY(16) NOT NULL PRIMARY KEY
            );
            INSERT IGNORE INTO {Quote(importedMenuIdsTable)} (menuId)
            SELECT DISTINCT schedule.menuId
            FROM {Quote(database)}.{Quote("menuschedules")} AS schedule
            INNER JOIN {Quote(database)}.{Quote("menuversions")} AS version
                ON version.menuVersionId = schedule.menuVersionId
            WHERE schedule.menuVersionId IS NOT NULL
              AND (
                  COALESCE(version.sourceChecksum, '') <> '' OR
                  COALESCE(version.sourceImportBatch, '') <> ''
              );
            """);
        var importedMenuCount = await ReadScalarAsync(
            connection,
            $"SELECT COUNT(*) FROM {Quote(importedMenuIdsTable)};");

        await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=0;");
        try
        {
            foreach (var table in transactionTables)
            {
                await ExecuteAsync(connection, $"TRUNCATE TABLE {Quote(database)}.{Quote(table)};");
            }

            await ExecuteAsync(connection, $"""
                DELETE item
                FROM {Quote(database)}.{Quote("menuitems")} AS item
                INNER JOIN {Quote(importedMenuIdsTable)} AS imported
                    ON imported.menuId = item.menuId;
                DELETE menu
                FROM {Quote(database)}.{Quote("menus")} AS menu
                INNER JOIN {Quote(importedMenuIdsTable)} AS imported
                    ON imported.menuId = menu.menuId;
                """);
        }
        finally
        {
            await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=1;");
        }

        foreach (var table in transactionTables)
        {
            var count = await ReadRowCountAsync(connection, database, table);
            if (count != 0)
            {
                throw new InvalidOperationException($"E2E sanitization left {count} rows in {table}.");
            }
        }
        var importedMenusLeft = await ReadScalarAsync(
            connection,
            $"""
            SELECT COUNT(*)
            FROM {Quote(database)}.{Quote("menus")} AS menu
            INNER JOIN {Quote(importedMenuIdsTable)} AS imported ON imported.menuId = menu.menuId;
            """);
        var importedMenuItemsLeft = await ReadScalarAsync(
            connection,
            $"""
            SELECT COUNT(*)
            FROM {Quote(database)}.{Quote("menuitems")} AS item
            INNER JOIN {Quote(importedMenuIdsTable)} AS imported ON imported.menuId = item.menuId;
            """);
        var importedMenuArtifactsLeft = importedMenusLeft + importedMenuItemsLeft;
        if (importedMenuArtifactsLeft != 0)
        {
            throw new InvalidOperationException(
                $"E2E sanitization left {importedMenuArtifactsLeft} imported menu artifacts.");
        }

        Console.WriteLine($"SANITIZE={database}");
        Console.WriteLine($"TRANSACTION_TABLES={transactionTables.Count}");
        Console.WriteLine($"IMPORTED_MENUS_REMOVED={importedMenuCount}");
        Console.WriteLine("VERIFY=PASS");
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"E2E sanitization failed: {exception.Message}");
        return 1;
    }
}

if (args.Length != 7 ||
    args[0] != "clone" ||
    args[1] != "--settings" ||
    args[3] != "--source" ||
    args[5] != "--target")
{
    Console.Error.WriteLine(
        "Usage: dotnet run --project IPCManagement.DatabaseTool -- clone --settings <appsettings.json> --source <database> --target <database>\n" +
        "   or: dotnet run --project IPCManagement.DatabaseTool -- sanitize-e2e --settings <appsettings.json> --database <ipc_laneN>\n" +
        "   or: dotnet run --project IPCManagement.DatabaseTool -- weekly-menu-evidence --settings <appsettings.json> --database <ipc_laneN|ipc_e2e_template> --week <yyyy-MM-dd>");
    return 2;
}

var settingsPath = Path.GetFullPath(args[2]);
var sourceDatabase = args[4];
var targetDatabase = args[6];

try
{
    DatabaseClonePolicy.ValidateTransition(sourceDatabase, targetDatabase);
    await using var connection = await OpenServerConnectionAsync(settingsPath);

    var sourceTables = await ReadTablesAsync(connection, sourceDatabase);
    if (sourceTables.Count == 0)
    {
        throw new InvalidOperationException($"Source database {sourceDatabase} has no base tables.");
    }

    var stagingDatabase = $"{targetDatabase}_clone_{Environment.ProcessId}";
    try
    {
        await CloneDatabaseAsync(connection, sourceDatabase, stagingDatabase, sourceTables);
        await VerifyCloneAsync(connection, sourceDatabase, stagingDatabase, sourceTables);
        await CloneDatabaseAsync(connection, stagingDatabase, targetDatabase, sourceTables);
        await VerifyCloneAsync(connection, sourceDatabase, targetDatabase, sourceTables);
    }
    finally
    {
        await ExecuteAsync(connection, $"DROP DATABASE IF EXISTS {Quote(stagingDatabase)};");
    }

    Console.WriteLine($"CLONE={sourceDatabase}->{targetDatabase}");
    Console.WriteLine($"TABLES={sourceTables.Count}");
    Console.WriteLine("VERIFY=PASS");
    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine($"Database clone failed: {exception.Message}");
    return 1;
}

static async Task CloneDatabaseAsync(
    MySqlConnection connection,
    string sourceDatabase,
    string targetDatabase,
    IReadOnlyList<string> tables)
{
    var (characterSet, collation) = await ReadDatabaseCollationAsync(connection, sourceDatabase);
    await ExecuteAsync(
        connection,
        $"DROP DATABASE IF EXISTS {Quote(targetDatabase)}; " +
        $"CREATE DATABASE {Quote(targetDatabase)} CHARACTER SET {Quote(characterSet)} COLLATE {Quote(collation)}; " +
        "SET FOREIGN_KEY_CHECKS=0;");

    try
    {
        foreach (var table in tables)
        {
            var columns = await ReadPhysicalColumnsAsync(connection, sourceDatabase, table);
            if (columns.Count == 0)
            {
                throw new InvalidOperationException($"Table {sourceDatabase}.{table} has no writable columns.");
            }

            var sourceTable = $"{Quote(sourceDatabase)}.{Quote(table)}";
            var targetTable = $"{Quote(targetDatabase)}.{Quote(table)}";
            var columnList = string.Join(", ", columns.Select(Quote));
            await ExecuteAsync(
                connection,
                $"CREATE TABLE {targetTable} LIKE {sourceTable}; " +
                $"INSERT INTO {targetTable} ({columnList}) SELECT {columnList} FROM {sourceTable};",
                commandTimeout: 300);
        }
    }
    finally
    {
        await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=1;");
    }
}

static async Task VerifyCloneAsync(
    MySqlConnection connection,
    string sourceDatabase,
    string targetDatabase,
    IReadOnlyList<string> expectedTables)
{
    var targetTables = await ReadTablesAsync(connection, targetDatabase);
    if (!expectedTables.SequenceEqual(targetTables, StringComparer.Ordinal))
    {
        throw new InvalidOperationException("Target table inventory does not match the source database.");
    }

    foreach (var table in expectedTables)
    {
        var sourceCount = await ReadRowCountAsync(connection, sourceDatabase, table);
        var targetCount = await ReadRowCountAsync(connection, targetDatabase, table);
        if (sourceCount != targetCount)
        {
            throw new InvalidOperationException(
                $"Row count mismatch for {table}: source={sourceCount}, target={targetCount}.");
        }
    }
}

static async Task<IReadOnlyList<string>> ReadTablesAsync(MySqlConnection connection, string database)
{
    const string sql = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = @database
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    var tables = new List<string>();
    while (await reader.ReadAsync())
    {
        tables.Add(reader.GetString(0));
    }

    return tables;
}

static async Task<IReadOnlyList<string>> ReadPhysicalColumnsAsync(
    MySqlConnection connection,
    string database,
    string table)
{
    const string sql = """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = @database
          AND table_name = @table
          AND COALESCE(generation_expression, '') = ''
        ORDER BY ordinal_position;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    command.Parameters.AddWithValue("@table", table);
    await using var reader = await command.ExecuteReaderAsync();
    var columns = new List<string>();
    while (await reader.ReadAsync())
    {
        columns.Add(reader.GetString(0));
    }

    return columns;
}

static async Task<(string CharacterSet, string Collation)> ReadDatabaseCollationAsync(
    MySqlConnection connection,
    string database)
{
    const string sql = """
        SELECT default_character_set_name, default_collation_name
        FROM information_schema.schemata
        WHERE schema_name = @database;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        throw new InvalidOperationException($"Database {database} does not exist.");
    }

    return (reader.GetString(0), reader.GetString(1));
}

static async Task<long> ReadRowCountAsync(MySqlConnection connection, string database, string table)
{
    await using var command = new MySqlCommand(
        $"SELECT COUNT(*) FROM {Quote(database)}.{Quote(table)};",
        connection);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task<long> ReadScalarAsync(MySqlConnection connection, string sql)
{
    await using var command = new MySqlCommand(sql, connection);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task ExecuteAsync(MySqlConnection connection, string sql, int commandTimeout = 120)
{
    await using var command = new MySqlCommand(sql, connection)
    {
        CommandTimeout = commandTimeout
    };
    await command.ExecuteNonQueryAsync();
}

static async Task<MySqlConnection> OpenServerConnectionAsync(string settingsPath)
{
    if (!File.Exists(settingsPath))
    {
        throw new FileNotFoundException("Appsettings file was not found.", settingsPath);
    }

    using var settings = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
    var sourceConnectionString = settings.RootElement
        .GetProperty("ConnectionStrings")
        .GetProperty("DefaultConnection")
        .GetString() ?? throw new InvalidOperationException("DefaultConnection is missing.");
    var connectionBuilder = new MySqlConnectionStringBuilder(sourceConnectionString)
    {
        Database = "mysql"
    };
    var connection = new MySqlConnection(connectionBuilder.ConnectionString);
    await connection.OpenAsync();
    return connection;
}

static string Quote(string identifier) => $"`{identifier.Replace("`", "``")}`";
