using System.Text.Json;
using IPCManagement.DatabaseTool;
using MySqlConnector;

if (args.Length != 7 ||
    args[0] != "clone" ||
    args[1] != "--settings" ||
    args[3] != "--source" ||
    args[5] != "--target")
{
    Console.Error.WriteLine(
        "Usage: dotnet run --project IPCManagement.DatabaseTool -- clone --settings <appsettings.json> --source <database> --target <database>");
    return 2;
}

var settingsPath = Path.GetFullPath(args[2]);
var sourceDatabase = args[4];
var targetDatabase = args[6];

try
{
    DatabaseClonePolicy.ValidateTransition(sourceDatabase, targetDatabase);
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

    await using var connection = new MySqlConnection(connectionBuilder.ConnectionString);
    await connection.OpenAsync();

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

static async Task ExecuteAsync(MySqlConnection connection, string sql, int commandTimeout = 120)
{
    await using var command = new MySqlCommand(sql, connection)
    {
        CommandTimeout = commandTimeout
    };
    await command.ExecuteNonQueryAsync();
}

static string Quote(string identifier) => $"`{identifier.Replace("`", "``")}`";
