using System.Diagnostics;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using MySqlConnector;

if (!OperatingSystem.IsWindows())
    throw new PlatformNotSupportedException("Phase 4.2 local archive requires Windows CurrentUser DPAPI.");

var options = ParseOptions(args);
var settingsPath = Path.GetFullPath(Required(options, "settings"));
var database = Required(options, "database");
var runId = Required(options, "run-id");
var releasePath = Path.GetFullPath(Required(options, "release"));
var outputPath = Path.GetFullPath(Required(options, "output"));
var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
var mode = options.GetValueOrDefault("mode", "archive");
if (database != "ipcmanagement")
    throw new InvalidOperationException("Phase 4.2 local archive source must be ipcmanagement.");
if (!System.Text.RegularExpressions.Regex.IsMatch(runId, "^[a-z0-9_]+$"))
    throw new InvalidOperationException("Phase 4.2 archive requires a lowercase run-owned ID.");
if (!File.Exists(settingsPath) || !File.Exists(releasePath))
    throw new FileNotFoundException("Settings or D-05 release input is missing.");
var currentSid = WindowsIdentity.GetCurrent().User
    ?? throw new InvalidOperationException("Current Windows SID is unavailable.");
if (mode == "restore")
    return await RestoreApprovedArchiveAsync(options, settingsPath, database, runId, releasePath, outputPath, currentSid);
if (mode != "archive")
    throw new InvalidOperationException("Phase 4.2 archive tool mode must be archive or restore.");

var releaseBytes = await File.ReadAllBytesAsync(releasePath);
var releaseSha256 = Convert.ToHexString(SHA256.HashData(releaseBytes));
using (var release = JsonDocument.Parse(releaseBytes))
{
    var root = release.RootElement;
    if (root.GetProperty("status").GetString() != "PASS" ||
        root.GetProperty("subjectCount").GetInt32() != 3555 ||
        root.GetProperty("businessSqlStatements").GetInt32() != 0 ||
        root.GetProperty("databaseConnections").GetInt32() != 0 ||
        root.GetProperty("runtimeBooted").GetBoolean() ||
        root.GetProperty("mutationStatements").GetInt32() != 0)
        throw new InvalidOperationException("D-05 release is not the exact zero-execution 3,555-row input.");
}

using var settings = JsonDocument.Parse(await File.ReadAllBytesAsync(settingsPath));
var sourceConnectionString = settings.RootElement.GetProperty("ConnectionStrings")
    .GetProperty("DefaultConnection").GetString()
    ?? throw new InvalidOperationException("DefaultConnection is missing.");
var connectionBuilder = new MySqlConnectionStringBuilder(sourceConnectionString) { Database = string.Empty };
var mysqlDump = FindMySqlDump();
var archiveRoot = Path.Combine("D:\\IPCManagement-backups", "phase42", runId);
var keyRoot = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "IPCManagement", "Phase42", runId);
var archivePath = Path.Combine(archiveRoot, $"{runId}-{database}.ipc42");
var keyPath = Path.Combine(keyRoot, "archive-key.dpapi");
var keyPathReference = $"localappdata:IPCManagement/Phase42/{runId}/archive-key.dpapi";
Directory.CreateDirectory(archiveRoot);
Directory.CreateDirectory(keyRoot);
await RestrictAclAsync(archiveRoot, currentSid, directory: true);
await RestrictAclAsync(keyRoot, currentSid, directory: true);

var temp = Path.Combine(Path.GetTempPath(), $"ipc-phase42-archive-{runId}-{Guid.NewGuid():N}");
Directory.CreateDirectory(temp);
await RestrictAclAsync(temp, currentSid, directory: true);
var defaultsPath = Path.Combine(temp, "mysql-client.cnf");
var plainRoot = Path.Combine(temp, "plain");
Directory.CreateDirectory(plainRoot);
var dumpPath = Path.Combine(plainRoot, $"{database}.sql");
var innerManifestPath = Path.Combine(plainRoot, "manifest.json");
var zipPath = Path.Combine(temp, "payload.zip");
var decryptedTestPath = Path.Combine(temp, "payload-decrypted.zip");

byte[]? rawKey = null;
byte[]? encryptionKey = null;
byte[]? authenticationKey = null;
object? receipt = null;
try
{
    await WriteDefaultsFileAsync(defaultsPath, connectionBuilder, currentSid);
    await using var connection = new MySqlConnection(connectionBuilder.ConnectionString);
    await connection.OpenAsync();
    var metadata = await ReadDatabaseManifestAsync(connection, database);
    var expectedBackupTables = new[]
    {
        "backup_bomadjustments_20260717_141300",
        "backup_dishbom_20260717_141300",
        "backup_dishes_20260717_141300",
        "backup_ingredients_20260717_141300",
        "backup_materialrequestlines_bom_20260717_141300",
        "backup_menuitems_20260717_141300",
        "backup_menuitems_pre2026_20260717_141300",
    };
    var backupTables = metadata.TableNames.Where(name => name.StartsWith("backup_", StringComparison.Ordinal))
        .Order(StringComparer.Ordinal).ToArray();
    if (!backupTables.SequenceEqual(expectedBackupTables.Order(StringComparer.Ordinal), StringComparer.Ordinal))
        throw new InvalidOperationException("The exact seven backup tables are not present before archive.");

    var dumpResult = await RunProcessAsync(mysqlDump,
    [
        $"--defaults-extra-file={defaultsPath}", "--single-transaction", "--routines", "--triggers",
        "--events", "--hex-blob", "--set-gtid-purged=OFF", "--skip-comments",
        "--skip-add-drop-table", $"--result-file={dumpPath}", database,
    ]);
    if (dumpResult.ExitCode != 0)
        throw new InvalidOperationException($"mysqldump failed with exit code {dumpResult.ExitCode}.");
    var dumpText = await File.ReadAllTextAsync(dumpPath);
    if (System.Text.RegularExpressions.Regex.IsMatch(
            dumpText, "(?im)^\\s*(USE|CREATE\\s+DATABASE|DROP\\s+DATABASE|DROP\\s+TABLE)\\b"))
        throw new InvalidOperationException("Dump contains a forbidden database switch or destructive statement.");
    var dumpSha256 = await Sha256FileAsync(dumpPath);
    var dumpBytes = new FileInfo(dumpPath).Length;
    var volumeProof = await ReadVolumeProofAsync(metadata.DataDirectory, archivePath);
    if (!volumeProof.SamePhysicalDisk)
        throw new InvalidOperationException("Archive and MySQL data directory are not on the same physical disk.");

    var innerManifest = new
    {
        schemaVersion = 1,
        runId,
        database,
        createdAtUtc = DateTimeOffset.UtcNow.ToString("O"),
        recoveryClassification = "ACCEPTED_LOCAL_ONLY_RISK",
        sameHost = true,
        samePhysicalNvme = true,
        offSite = false,
        worm = false,
        independentSecurityDomain = false,
        dumpSha256,
        dumpBytes,
        releaseSha256,
        releaseBytes = releaseBytes.LongLength,
        releaseSubjectCount = 3555,
        businessSqlStatements = 0,
        databaseConnectionsForBusinessRelease = 0,
        businessRuntimeBooted = false,
        businessMutationStatements = 0,
        metadata.MigrationIds,
        metadata.MigrationHead,
        metadata.TableDefinitions,
        metadata.ForeignKeyDefinitions,
        metadata.TriggerDefinitions,
        metadata.RowCounts,
        metadata.RowDigests,
        metadata.GtidExecuted,
        metadata.BinaryLogChain,
        metadata.DataDirectory,
        volumeProof,
        backupTables,
    };
    await File.WriteAllTextAsync(
        innerManifestPath,
        JsonSerializer.Serialize(innerManifest, jsonOptions),
        new UTF8Encoding(false));
    var innerManifestSha256 = await Sha256FileAsync(innerManifestPath);
    var innerManifestBytes = new FileInfo(innerManifestPath).Length;
    ZipFile.CreateFromDirectory(plainRoot, zipPath, CompressionLevel.Optimal, includeBaseDirectory: false);
    var zipSha256 = await Sha256FileAsync(zipPath);

    if (File.Exists(keyPath))
    {
        rawKey = Dpapi.Unprotect(await File.ReadAllBytesAsync(keyPath));
        if (rawKey.Length != 64)
            throw new InvalidOperationException("Existing DPAPI key has an invalid length.");
    }
    else
    {
        rawKey = RandomNumberGenerator.GetBytes(64);
        var protectedKey = Dpapi.Protect(rawKey);
        await File.WriteAllBytesAsync(keyPath, protectedKey);
        CryptographicOperations.ZeroMemory(protectedKey);
    }
    await RestrictAclAsync(keyPath, currentSid, directory: false);
    encryptionKey = rawKey[..32];
    authenticationKey = rawKey[32..];
    var crypto = await EncryptArchiveAsync(zipPath, archivePath, encryptionKey, authenticationKey);
    await RestrictAclAsync(archivePath, currentSid, directory: false);
    await DecryptArchiveAsync(archivePath, decryptedTestPath, encryptionKey, authenticationKey);
    var decryptedZipSha256 = await Sha256FileAsync(decryptedTestPath);
    if (!CryptographicOperations.FixedTimeEquals(
            Convert.FromHexString(zipSha256),
            Convert.FromHexString(decryptedZipSha256)))
        throw new InvalidOperationException("Encrypted archive round-trip digest mismatch.");

    var keyBlobSha256 = await Sha256FileAsync(keyPath);
    var keyBlobBytes = new FileInfo(keyPath).Length;
    receipt = new
    {
        schemaVersion = 1,
        status = "PASS",
        runId,
        sourceDatabase = database,
        recoveryClassification = "ACCEPTED_LOCAL_ONLY_RISK",
        sameHost = true,
        samePhysicalNvme = true,
        offSite = false,
        worm = false,
        independentSecurityDomain = false,
        archivePath,
        archiveReference = $"local-archive:{runId}",
        archiveSha256 = await Sha256FileAsync(archivePath),
        archiveBytes = new FileInfo(archivePath).Length,
        archiveFormat = "IPC42A01/AES-256-CBC/HMAC-SHA256",
        archiveHeaderEncrypted = true,
        encryptionKeyReference = keyPathReference,
        encryptionKeyScope = "WindowsCurrentUserDPAPI",
        keyBlobSha256,
        keyBlobBytes,
        keyEntropyBits = 512,
        keyAcl = new
        {
            inheritanceDisabled = true,
            currentUserSidSha256 = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(currentSid.Value))),
            currentUserFullControl = true,
            pathOutsideRepositoryAndArtifacts = true,
        },
        crypto.IvSha256,
        crypto.AuthenticationTagSha256,
        innerManifestSha256,
        innerManifestBytes,
        dumpSha256,
        dumpBytes,
        releaseSha256,
        releaseBytes = releaseBytes.LongLength,
        releaseSubjectCount = 3555,
        migrationIds = metadata.MigrationIds,
        migrationHead = metadata.MigrationHead,
        tableDefinitions = metadata.TableDefinitions,
        foreignKeyDefinitions = metadata.ForeignKeyDefinitions,
        triggerDefinitions = metadata.TriggerDefinitions,
        rowCounts = metadata.RowCounts,
        rowDigests = metadata.RowDigests,
        gtidExecuted = metadata.GtidExecuted,
        binaryLogChain = metadata.BinaryLogChain,
        volumeProof,
        backupTables,
        sevenBackupTablesRetained = true,
        businessSqlStatements = 0,
        businessDatabaseConnections = 0,
        businessRuntimeBooted = false,
        businessMutationStatements = 0,
        providerAccessed = false,
        schedulerAccessed = false,
        ipcLane1Accessed = false,
        archiveRoundTripVerified = true,
        rawKeyPersisted = false,
        rawKeyInCommandLine = false,
        rawKeyInEnvironment = false,
    };
}
finally
{
    if (rawKey is not null) CryptographicOperations.ZeroMemory(rawKey);
    if (encryptionKey is not null) CryptographicOperations.ZeroMemory(encryptionKey);
    if (authenticationKey is not null) CryptographicOperations.ZeroMemory(authenticationKey);
    if (Directory.Exists(temp)) Directory.Delete(temp, recursive: true);
}

if (receipt is null || Directory.Exists(temp))
    throw new InvalidOperationException("Archive receipt is missing or plaintext cleanup failed.");
Directory.CreateDirectory(Path.GetDirectoryName(outputPath)
    ?? throw new InvalidOperationException("Archive receipt output requires a parent directory."));
await File.WriteAllTextAsync(outputPath, JsonSerializer.Serialize(receipt, jsonOptions), new UTF8Encoding(false));
Console.WriteLine(JsonSerializer.Serialize(new { status = "PASS", outputPath }));
return 0;

static Dictionary<string, string> ParseOptions(string[] values)
{
    if (values.Length == 0 || values.Length % 2 != 0)
        throw new ArgumentException("Archive tool options must be --name value pairs.");
    var parsed = new Dictionary<string, string>(StringComparer.Ordinal);
    for (var index = 0; index < values.Length; index += 2)
    {
        if (!values[index].StartsWith("--", StringComparison.Ordinal))
            throw new ArgumentException("Archive tool option names must start with --.");
        if (!parsed.TryAdd(values[index][2..], values[index + 1]))
            throw new ArgumentException($"Duplicate archive option: {values[index]}");
    }
    return parsed;
}

static string Required(IReadOnlyDictionary<string, string> values, string name)
    => values.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value)
        ? value
        : throw new ArgumentException($"Missing archive option: --{name}");

static string FindMySqlDump()
{
    var candidates = new[]
    {
        @"C:\Program Files\MySQL\MySQL Server 9.5\bin\mysqldump.exe",
        @"C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysqldump.exe",
    };
    return candidates.FirstOrDefault(File.Exists)
        ?? throw new FileNotFoundException("mysqldump was not found in approved local installations.");
}

static string FindMySql()
{
    var candidates = new[]
    {
        @"C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe",
        @"C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe",
    };
    return candidates.FirstOrDefault(File.Exists)
        ?? throw new FileNotFoundException("mysql client was not found in approved local installations.");
}

static async Task<int> RestoreApprovedArchiveAsync(
    IReadOnlyDictionary<string, string> options,
    string settingsPath,
    string database,
    string runId,
    string releasePath,
    string outputPath,
    SecurityIdentifier currentSid)
{
    var archiveReceiptPath = Path.GetFullPath(Required(options, "archive-receipt"));
    var approvalReceiptPath = Path.GetFullPath(Required(options, "approval-receipt"));
    var restoreTarget = Required(options, "restore-target");
    var expectedTarget = $"ipc_restore_phase42_{runId}";
    if (restoreTarget != expectedTarget ||
        restoreTarget is "ipcmanagement" or "ipc_lane1" or "ipc_lane9" or "ipc_e2e_template" ||
        !System.Text.RegularExpressions.Regex.IsMatch(restoreTarget, "^ipc_restore_phase42_[a-z0-9_]+$"))
        throw new InvalidOperationException("Restore target is not the canonical run-owned absent target.");
    if (!File.Exists(archiveReceiptPath) || !File.Exists(approvalReceiptPath))
        throw new FileNotFoundException("Archive or approval receipt is missing.");

    using var archiveReceiptDocument = JsonDocument.Parse(await File.ReadAllBytesAsync(archiveReceiptPath));
    using var approvalDocument = JsonDocument.Parse(await File.ReadAllBytesAsync(approvalReceiptPath));
    var archiveReceipt = archiveReceiptDocument.RootElement;
    var approval = approvalDocument.RootElement;
    var archivePath = archiveReceipt.GetProperty("archivePath").GetString()
        ?? throw new InvalidOperationException("Archive path is missing.");
    var approvedArchiveSha256 = approval.GetProperty("archiveSha256").GetString()!;
    var approvedArchiveBytes = approval.GetProperty("archiveBytes").GetInt64();
    var approvedInnerManifestSha256 = approval.GetProperty("innerManifestSha256").GetString()!;
    if (approval.GetProperty("status").GetString() != "PASS" ||
        approval.GetProperty("approval").GetString() != "d03-local-archive-restore" ||
        approval.GetProperty("restoreTarget").GetString() != restoreTarget ||
        approval.GetProperty("governanceApprovalIsRuntimeActorOrSignature").GetBoolean() ||
        approvedArchiveSha256 != archiveReceipt.GetProperty("archiveSha256").GetString() ||
        approvedArchiveBytes != archiveReceipt.GetProperty("archiveBytes").GetInt64() ||
        approvedInnerManifestSha256 != archiveReceipt.GetProperty("innerManifestSha256").GetString())
        throw new InvalidOperationException("Restore approval is not bound to the exact archive receipt.");
    if (!File.Exists(archivePath) ||
        await Sha256FileAsync(archivePath) != approvedArchiveSha256 ||
        new FileInfo(archivePath).Length != approvedArchiveBytes)
        throw new InvalidOperationException("Approved ciphertext changed immediately before restore.");

    var releaseBytes = await File.ReadAllBytesAsync(releasePath);
    var releaseSha256 = Convert.ToHexString(SHA256.HashData(releaseBytes));
    if (releaseSha256 != archiveReceipt.GetProperty("releaseSha256").GetString() ||
        releaseBytes.LongLength != archiveReceipt.GetProperty("releaseBytes").GetInt64() ||
        archiveReceipt.GetProperty("releaseSubjectCount").GetInt32() != 3555)
        throw new InvalidOperationException("D-05 release oracle changed before restore.");

    using var settings = JsonDocument.Parse(await File.ReadAllBytesAsync(settingsPath));
    var sourceConnectionString = settings.RootElement.GetProperty("ConnectionStrings")
        .GetProperty("DefaultConnection").GetString()
        ?? throw new InvalidOperationException("DefaultConnection is missing.");
    var connectionBuilder = new MySqlConnectionStringBuilder(sourceConnectionString) { Database = string.Empty };
    var keyPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "IPCManagement", "Phase42", runId, "archive-key.dpapi");
    if (!File.Exists(keyPath) ||
        await Sha256FileAsync(keyPath) != archiveReceipt.GetProperty("keyBlobSha256").GetString() ||
        new FileInfo(keyPath).Length != archiveReceipt.GetProperty("keyBlobBytes").GetInt64())
        throw new InvalidOperationException("DPAPI key blob is missing or stale.");
    await RestrictAclAsync(keyPath, currentSid, directory: false);

    var temp = Path.Combine(Path.GetTempPath(), $"ipc-phase42-restore-{runId}-{Guid.NewGuid():N}");
    Directory.CreateDirectory(temp);
    await RestrictAclAsync(temp, currentSid, directory: true);
    var defaultsPath = Path.Combine(temp, "mysql-client.cnf");
    var zipPath = Path.Combine(temp, "payload.zip");
    var extractPath = Path.Combine(temp, "extract");
    byte[]? rawKey = null;
    byte[]? encryptionKey = null;
    byte[]? authenticationKey = null;
    var targetCreated = false;
    var targetAbsentBefore = false;
    var targetAbsentAfter = false;
    var exactOracles = false;
    DatabaseManifest? actual = null;
    JsonElement expected = default;
    try
    {
        await WriteDefaultsFileAsync(defaultsPath, connectionBuilder, currentSid);
        await using var connection = new MySqlConnection(connectionBuilder.ConnectionString);
        await connection.OpenAsync();
        targetAbsentBefore = !await DatabaseExistsAsync(connection, restoreTarget);
        if (!targetAbsentBefore)
            throw new InvalidOperationException("Restore target already exists; refusing to touch it.");

        rawKey = Dpapi.Unprotect(await File.ReadAllBytesAsync(keyPath));
        if (rawKey.Length != 64) throw new InvalidOperationException("DPAPI archive key length is invalid.");
        encryptionKey = rawKey[..32];
        authenticationKey = rawKey[32..];
        await DecryptArchiveAsync(archivePath, zipPath, encryptionKey, authenticationKey);
        Directory.CreateDirectory(extractPath);
        ZipFile.ExtractToDirectory(zipPath, extractPath);
        var manifests = Directory.GetFiles(extractPath, "manifest.json", SearchOption.TopDirectoryOnly);
        var dumps = Directory.GetFiles(extractPath, "*.sql", SearchOption.TopDirectoryOnly);
        if (manifests.Length != 1 || dumps.Length != 1 || Directory.GetFiles(extractPath).Length != 2)
            throw new InvalidOperationException("Decrypted archive payload membership is not exact.");
        if (await Sha256FileAsync(manifests[0]) != approvedInnerManifestSha256)
            throw new InvalidOperationException("Approved inner manifest digest mismatch.");
        using var innerDocument = JsonDocument.Parse(await File.ReadAllBytesAsync(manifests[0]));
        expected = innerDocument.RootElement.Clone();
        if (expected.GetProperty("releaseSha256").GetString() != releaseSha256 ||
            expected.GetProperty("releaseBytes").GetInt64() != releaseBytes.LongLength ||
            expected.GetProperty("releaseSubjectCount").GetInt32() != 3555 ||
            expected.GetProperty("businessMutationStatements").GetInt32() != 0 ||
            await Sha256FileAsync(dumps[0]) != expected.GetProperty("dumpSha256").GetString() ||
            new FileInfo(dumps[0]).Length != expected.GetProperty("dumpBytes").GetInt64())
            throw new InvalidOperationException("Decrypted D-05 or dump oracle mismatch.");
        var dumpText = await File.ReadAllTextAsync(dumps[0]);
        if (System.Text.RegularExpressions.Regex.IsMatch(
                dumpText, "(?im)^\\s*(USE|CREATE\\s+DATABASE|DROP\\s+DATABASE|DROP\\s+TABLE)\\b"))
            throw new InvalidOperationException("Restore dump contains a forbidden database or destructive statement.");

        await using (var create = new MySqlCommand(
                         $"CREATE DATABASE `{restoreTarget}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
                         connection))
            await create.ExecuteNonQueryAsync();
        targetCreated = true;
        var import = await RunImportAsync(
            FindMySql(),
            [$"--defaults-extra-file={defaultsPath}", $"--database={restoreTarget}"],
            dumps[0]);
        if (import.ExitCode != 0)
            throw new InvalidOperationException(
                $"Restore import failed with exit code {import.ExitCode}: {SanitizeDiagnostic(import.StandardError)}");
        actual = await ReadDatabaseManifestAsync(connection, restoreTarget);
        var oracleMismatches = FindRestoreOracleMismatches(expected, actual);
        exactOracles = oracleMismatches.Length == 0;
        if (!exactOracles)
            throw new InvalidOperationException(
                $"Restored database exact oracles do not match: {string.Join(',', oracleMismatches)}.");
    }
    finally
    {
        try
        {
            await using var cleanupConnection = new MySqlConnection(connectionBuilder.ConnectionString);
            await cleanupConnection.OpenAsync();
            if (targetCreated)
            {
                if (restoreTarget != expectedTarget)
                    throw new InvalidOperationException("Teardown target ownership changed.");
                await using var drop = new MySqlCommand($"DROP DATABASE `{restoreTarget}`;", cleanupConnection);
                await drop.ExecuteNonQueryAsync();
                targetCreated = false;
            }
            targetAbsentAfter = !await DatabaseExistsAsync(cleanupConnection, restoreTarget);
        }
        finally
        {
            if (rawKey is not null) CryptographicOperations.ZeroMemory(rawKey);
            if (encryptionKey is not null) CryptographicOperations.ZeroMemory(encryptionKey);
            if (authenticationKey is not null) CryptographicOperations.ZeroMemory(authenticationKey);
            if (Directory.Exists(temp)) Directory.Delete(temp, recursive: true);
        }
    }
    var plaintextAbsent = !Directory.Exists(temp);
    if (!targetAbsentBefore || !targetAbsentAfter || !plaintextAbsent || !exactOracles || actual is null)
        throw new InvalidOperationException("Restore teardown or exact oracle proof is incomplete.");

    var receipt = new
    {
        schemaVersion = 1,
        status = "PASS",
        runId,
        classification = "ACCEPTED_LOCAL_ONLY_RISK",
        approvedArchiveOnly = true,
        archiveReference = archiveReceipt.GetProperty("archiveReference").GetString(),
        archiveSha256 = approvedArchiveSha256,
        archiveBytes = approvedArchiveBytes,
        innerManifestSha256 = approvedInnerManifestSha256,
        encryptionKeyReference = archiveReceipt.GetProperty("encryptionKeyReference").GetString(),
        restoreTarget,
        restoreTargetAbsentBefore = targetAbsentBefore,
        allExactOraclesPass = true,
        migrationOraclePass = true,
        schemaOraclePass = true,
        foreignKeyOraclePass = true,
        triggerOraclePass = true,
        rowCountOraclePass = true,
        rowDigestOraclePass = true,
        d05ReleaseOraclePass = true,
        binlogMetadataBound = true,
        businessSourceUnchanged = true,
        restoreDatabaseAbsent = targetAbsentAfter,
        plaintextAbsent,
        existingDatabaseTouched = false,
        providerAccessed = false,
        ipcLane1Accessed = false,
        businessMutationStatements = 0,
        migrationHead = actual.MigrationHead,
        migrationCount = actual.MigrationIds.Length,
        tableCount = actual.TableNames.Length,
        foreignKeyCount = actual.ForeignKeyDefinitions.Length,
        triggerCount = actual.TriggerDefinitions.Length,
        releaseSha256,
        releaseSubjectCount = 3555,
    };
    Directory.CreateDirectory(Path.GetDirectoryName(outputPath)
        ?? throw new InvalidOperationException("Restore receipt output requires a parent directory."));
    await File.WriteAllTextAsync(
        outputPath,
        JsonSerializer.Serialize(receipt, new JsonSerializerOptions { WriteIndented = true }),
        new UTF8Encoding(false));
    Console.WriteLine(JsonSerializer.Serialize(new { status = "PASS", outputPath }));
    return 0;
}

static async Task<bool> DatabaseExistsAsync(MySqlConnection connection, string database)
{
    await using var command = new MySqlCommand(
        "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=@database;", connection);
    command.Parameters.AddWithValue("@database", database);
    return Convert.ToInt64(await command.ExecuteScalarAsync()) != 0;
}

static string[] FindRestoreOracleMismatches(JsonElement expected, DatabaseManifest actual)
{
    static string Canonical<T>(T value) => JsonSerializer.Serialize(value);
    var expectedMigrations = expected.GetProperty("MigrationIds").Deserialize<string[]>()!;
    var expectedTables = expected.GetProperty("TableDefinitions")
        .Deserialize<SortedDictionary<string, string>>()!;
    var expectedForeignKeys = expected.GetProperty("ForeignKeyDefinitions").Deserialize<string[]>()!;
    var expectedTriggers = expected.GetProperty("TriggerDefinitions").Deserialize<string[]>()!;
    var expectedCounts = expected.GetProperty("RowCounts").Deserialize<SortedDictionary<string, long>>()!;
    var expectedDigests = expected.GetProperty("RowDigests")
        .Deserialize<SortedDictionary<string, string>>()!;
    var mismatches = new List<string>();
    if (expected.GetProperty("MigrationHead").GetString() != actual.MigrationHead)
        mismatches.Add("migration-head");
    if (Canonical(expectedMigrations) != Canonical(actual.MigrationIds))
        mismatches.Add("migration-ids");
    static SortedDictionary<string, string> NormalizeDefinitions(IReadOnlyDictionary<string, string> definitions)
        => new(
            definitions.ToDictionary(
                pair => pair.Key,
                pair => System.Text.RegularExpressions.Regex.Replace(
                    System.Text.RegularExpressions.Regex.Replace(
                        pair.Value.Replace("\r\n", "\n", StringComparison.Ordinal),
                        @"\sAUTO_INCREMENT=\d+",
                        string.Empty),
                    @"\sCHARACTER SET utf8mb4(?=\sCOLLATE utf8mb4_unicode_ci)",
                    string.Empty).Trim(),
                StringComparer.Ordinal),
            StringComparer.Ordinal);
    var normalizedExpectedTables = NormalizeDefinitions(expectedTables);
    var normalizedActualTables = NormalizeDefinitions(actual.TableDefinitions);
    if (Canonical(normalizedExpectedTables) != Canonical(normalizedActualTables))
    {
        var differingTables = normalizedExpectedTables.Keys
            .Union(normalizedActualTables.Keys, StringComparer.Ordinal)
            .Where(table => !normalizedExpectedTables.TryGetValue(table, out var expectedDefinition) ||
                            !normalizedActualTables.TryGetValue(table, out var actualDefinition) ||
                            expectedDefinition != actualDefinition)
            .Order(StringComparer.Ordinal)
            .ToArray();
        mismatches.Add($"table-definitions[{string.Join('|', differingTables)}]");
        foreach (var table in differingTables)
        {
            if (normalizedExpectedTables.TryGetValue(table, out var expectedDefinition) &&
                normalizedActualTables.TryGetValue(table, out var actualDefinition))
                mismatches.Add(DescribeDefinitionDifference(table, expectedDefinition, actualDefinition));
        }
    }
    if (Canonical(expectedForeignKeys) != Canonical(actual.ForeignKeyDefinitions))
        mismatches.Add("foreign-keys");
    if (Canonical(expectedTriggers) != Canonical(actual.TriggerDefinitions))
        mismatches.Add("triggers");
    if (Canonical(expectedCounts) != Canonical(actual.RowCounts))
        mismatches.Add("row-counts");
    if (Canonical(expectedDigests) != Canonical(actual.RowDigests))
        mismatches.Add("row-digests");
    return mismatches.ToArray();
}

static string DescribeDefinitionDifference(string table, string expected, string actual)
{
    var limit = Math.Min(expected.Length, actual.Length);
    var index = 0;
    while (index < limit && expected[index] == actual[index]) index++;
    var start = Math.Max(0, index - 40);
    var expectedContext = expected.Substring(start, Math.Min(120, expected.Length - start))
        .Replace('\r', ' ').Replace('\n', ' ');
    var actualContext = actual.Substring(start, Math.Min(120, actual.Length - start))
        .Replace('\r', ' ').Replace('\n', ' ');
    return $"schema-diff[{table}@{index}:expected={expectedContext};actual={actualContext}]";
}

static async Task WriteDefaultsFileAsync(
    string path,
    MySqlConnectionStringBuilder builder,
    SecurityIdentifier sid)
{
    static string Escape(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace("\"", "\\\"", StringComparison.Ordinal);
    var text = string.Join('\n',
    [
        "[client]",
        $"host=\"{Escape(builder.Server)}\"",
        $"port={builder.Port}",
        $"user=\"{Escape(builder.UserID)}\"",
        $"password=\"{Escape(builder.Password)}\"",
        string.Empty,
    ]);
    await File.WriteAllTextAsync(path, text, new UTF8Encoding(false));
    await RestrictAclAsync(path, sid, directory: false);
}

static async Task RestrictAclAsync(string path, SecurityIdentifier sid, bool directory)
{
    var grant = directory ? $"*{sid.Value}:(OI)(CI)F" : $"*{sid.Value}:F";
    var result = await RunProcessAsync("icacls.exe", [path, "/inheritance:r", "/grant:r", grant]);
    if (result.ExitCode != 0)
        throw new InvalidOperationException("Could not apply the restrictive current-user ACL.");
}

static async Task<DatabaseManifest> ReadDatabaseManifestAsync(MySqlConnection connection, string database)
{
    var migrationIds = await ReadColumnAsync(
        connection, $"SELECT MigrationId FROM `{database}`.`__EFMigrationsHistory` ORDER BY MigrationId;");
    var tableNames = await ReadColumnAsync(connection,
        "SELECT table_name FROM information_schema.tables WHERE table_schema=@database " +
        "AND table_type='BASE TABLE' ORDER BY table_name;", database);
    var tableDefinitions = new SortedDictionary<string, string>(StringComparer.Ordinal);
    var rowCounts = new SortedDictionary<string, long>(StringComparer.Ordinal);
    var rowDigests = new SortedDictionary<string, string>(StringComparer.Ordinal);
    foreach (var table in tableNames)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(table, "^[A-Za-z0-9_]+$"))
            throw new InvalidOperationException("Unsafe table name returned by metadata query.");
        await using (var create = new MySqlCommand($"SHOW CREATE TABLE `{database}`.`{table}`;", connection))
        await using (var reader = await create.ExecuteReaderAsync())
        {
            await reader.ReadAsync();
            tableDefinitions[table] = reader.GetString(1);
        }
        rowCounts[table] = await ScalarLongAsync(connection, $"SELECT COUNT(*) FROM `{database}`.`{table}`;");
        await using var checksum = new MySqlCommand($"CHECKSUM TABLE `{database}`.`{table}`;", connection);
        await using var checksumReader = await checksum.ExecuteReaderAsync();
        await checksumReader.ReadAsync();
        rowDigests[table] = checksumReader.IsDBNull(1) ? "NULL" : Convert.ToString(checksumReader.GetValue(1))!;
    }
    var foreignKeys = await ReadRowsAsync(connection,
        "SELECT table_name,constraint_name,referenced_table_name,update_rule,delete_rule " +
        "FROM information_schema.referential_constraints WHERE constraint_schema=@database " +
        "ORDER BY table_name,constraint_name;", database);
    var triggers = await ReadRowsAsync(connection,
        "SELECT trigger_name,event_object_table,action_timing,event_manipulation,action_statement " +
        "FROM information_schema.triggers WHERE trigger_schema=@database ORDER BY trigger_name;", database);
    var gtid = await ReadColumnAsync(connection, "SELECT @@GLOBAL.gtid_executed;");
    var binlogs = await ReadRowsAsync(connection, "SHOW BINARY LOGS;");
    var dataDirectory = await ScalarStringAsync(connection, "SELECT @@datadir;");
    return new DatabaseManifest(
        migrationIds, migrationIds.LastOrDefault() ?? string.Empty, tableNames, tableDefinitions,
        foreignKeys, triggers, rowCounts, rowDigests, gtid, binlogs, dataDirectory);
}

static async Task<string[]> ReadColumnAsync(MySqlConnection connection, string sql, string? database = null)
{
    await using var command = new MySqlCommand(sql, connection);
    if (database is not null) command.Parameters.AddWithValue("@database", database);
    var rows = new List<string>();
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync()) rows.Add(reader.IsDBNull(0) ? string.Empty : reader.GetString(0));
    return rows.ToArray();
}

static async Task<string[]> ReadRowsAsync(MySqlConnection connection, string sql, string? database = null)
{
    await using var command = new MySqlCommand(sql, connection);
    if (database is not null) command.Parameters.AddWithValue("@database", database);
    var rows = new List<string>();
    await using var reader = await command.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var values = new string[reader.FieldCount];
        for (var index = 0; index < values.Length; index++)
            values[index] = reader.IsDBNull(index) ? string.Empty : Convert.ToString(reader.GetValue(index))!;
        rows.Add(string.Join('\t', values));
    }
    return rows.ToArray();
}

static async Task<long> ScalarLongAsync(MySqlConnection connection, string sql)
{
    await using var command = new MySqlCommand(sql, connection);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task<string> ScalarStringAsync(MySqlConnection connection, string sql)
{
    await using var command = new MySqlCommand(sql, connection);
    return Convert.ToString(await command.ExecuteScalarAsync()) ?? string.Empty;
}

static async Task<VolumeProof> ReadVolumeProofAsync(string dataDirectory, string archivePath)
{
    var dataDrive = Path.GetPathRoot(dataDirectory)?.TrimEnd('\\').TrimEnd(':')
        ?? throw new InvalidOperationException("MySQL data directory drive is unavailable.");
    var archiveDrive = Path.GetPathRoot(archivePath)?.TrimEnd('\\').TrimEnd(':')
        ?? throw new InvalidOperationException("Archive drive is unavailable.");
    var command = "$letters=@('" + dataDrive + "','" + archiveDrive + "');" +
                  "Get-Partition -DriveLetter $letters|Select-Object DriveLetter,DiskNumber|ConvertTo-Json -Compress";
    var result = await RunProcessAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command]);
    if (result.ExitCode != 0) throw new InvalidOperationException("Physical disk topology query failed.");
    using var json = JsonDocument.Parse(result.StandardOutput);
    var rows = json.RootElement.ValueKind == JsonValueKind.Array
        ? json.RootElement.EnumerateArray().ToArray()
        : [json.RootElement];
    var disks = rows.ToDictionary(
        row => row.GetProperty("DriveLetter").GetString()!,
        row => row.GetProperty("DiskNumber").GetInt32(),
        StringComparer.OrdinalIgnoreCase);
    if (!disks.TryGetValue(dataDrive, out var dataDisk) || !disks.TryGetValue(archiveDrive, out var archiveDisk))
        throw new InvalidOperationException("Physical disk topology is incomplete.");
    return new VolumeProof(dataDrive, dataDisk, archiveDrive, archiveDisk, dataDisk == archiveDisk);
}

static async Task<CryptoReceipt> EncryptArchiveAsync(
    string inputPath,
    string outputPath,
    byte[] encryptionKey,
    byte[] authenticationKey)
{
    var magic = Encoding.ASCII.GetBytes("IPC42A01");
    var iv = RandomNumberGenerator.GetBytes(16);
    var cipherPath = outputPath + ".cipher.tmp";
    try
    {
        using (var aes = Aes.Create())
        {
            aes.KeySize = 256;
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.Key = encryptionKey;
            aes.IV = iv;
            await using var input = File.OpenRead(inputPath);
            await using var cipher = File.Create(cipherPath);
            await using var crypto = new CryptoStream(cipher, aes.CreateEncryptor(), CryptoStreamMode.Write);
            await input.CopyToAsync(crypto);
            crypto.FlushFinalBlock();
        }
        byte[] tag;
        using (var hmac = new HMACSHA256(authenticationKey))
        {
            hmac.TransformBlock(magic, 0, magic.Length, magic, 0);
            hmac.TransformBlock(iv, 0, iv.Length, iv, 0);
            await using var cipher = File.OpenRead(cipherPath);
            var buffer = new byte[81920];
            int read;
            while ((read = await cipher.ReadAsync(buffer)) > 0)
                hmac.TransformBlock(buffer, 0, read, buffer, 0);
            hmac.TransformFinalBlock([], 0, 0);
            tag = hmac.Hash!;
            CryptographicOperations.ZeroMemory(buffer);
        }
        await using (var output = File.Create(outputPath))
        {
            await output.WriteAsync(magic);
            await output.WriteAsync(iv);
            await output.WriteAsync(tag);
            await using var cipher = File.OpenRead(cipherPath);
            await cipher.CopyToAsync(output);
        }
        return new CryptoReceipt(
            Convert.ToHexString(SHA256.HashData(iv)),
            Convert.ToHexString(SHA256.HashData(tag)));
    }
    finally
    {
        CryptographicOperations.ZeroMemory(iv);
        if (File.Exists(cipherPath)) File.Delete(cipherPath);
    }
}

static async Task DecryptArchiveAsync(
    string archivePath,
    string outputPath,
    byte[] encryptionKey,
    byte[] authenticationKey)
{
    var all = await File.ReadAllBytesAsync(archivePath);
    var magic = all[..8];
    var iv = all[8..24];
    var expectedTag = all[24..56];
    var ciphertext = all[56..];
    if (Encoding.ASCII.GetString(magic) != "IPC42A01")
        throw new InvalidOperationException("Encrypted archive magic is invalid.");
    using (var hmac = new HMACSHA256(authenticationKey))
    {
        var payload = new byte[magic.Length + iv.Length + ciphertext.Length];
        Buffer.BlockCopy(magic, 0, payload, 0, magic.Length);
        Buffer.BlockCopy(iv, 0, payload, magic.Length, iv.Length);
        Buffer.BlockCopy(ciphertext, 0, payload, magic.Length + iv.Length, ciphertext.Length);
        var actualTag = hmac.ComputeHash(payload);
        CryptographicOperations.ZeroMemory(payload);
        if (!CryptographicOperations.FixedTimeEquals(expectedTag, actualTag))
            throw new InvalidOperationException("Encrypted archive authentication failed.");
        CryptographicOperations.ZeroMemory(actualTag);
    }
    using var aes = Aes.Create();
    aes.KeySize = 256;
    aes.Mode = CipherMode.CBC;
    aes.Padding = PaddingMode.PKCS7;
    aes.Key = encryptionKey;
    aes.IV = iv;
    await using var input = new MemoryStream(ciphertext, writable: false);
    await using var crypto = new CryptoStream(input, aes.CreateDecryptor(), CryptoStreamMode.Read);
    await using var output = File.Create(outputPath);
    await crypto.CopyToAsync(output);
    CryptographicOperations.ZeroMemory(all);
    CryptographicOperations.ZeroMemory(ciphertext);
}

static async Task<string> Sha256FileAsync(string path)
{
    await using var stream = File.OpenRead(path);
    return Convert.ToHexString(await SHA256.HashDataAsync(stream));
}

static async Task<ProcessResult> RunProcessAsync(string executable, IReadOnlyList<string> arguments)
{
    var start = new ProcessStartInfo(executable)
    {
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
    };
    foreach (var argument in arguments) start.ArgumentList.Add(argument);
    using var process = Process.Start(start)
        ?? throw new InvalidOperationException($"Could not start {Path.GetFileName(executable)}.");
    var stdout = process.StandardOutput.ReadToEndAsync();
    var stderr = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    return new ProcessResult(process.ExitCode, await stdout, await stderr);
}

static async Task<ProcessResult> RunImportAsync(
    string executable,
    IReadOnlyList<string> arguments,
    string inputPath)
{
    var start = new ProcessStartInfo(executable)
    {
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardInput = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
    };
    foreach (var argument in arguments) start.ArgumentList.Add(argument);
    using var process = Process.Start(start)
        ?? throw new InvalidOperationException($"Could not start {Path.GetFileName(executable)}.");
    var stdout = process.StandardOutput.ReadToEndAsync();
    var stderr = process.StandardError.ReadToEndAsync();
    await using (var input = File.OpenRead(inputPath))
    {
        await input.CopyToAsync(process.StandardInput.BaseStream);
        await process.StandardInput.BaseStream.FlushAsync();
    }
    process.StandardInput.Close();
    await process.WaitForExitAsync();
    return new ProcessResult(process.ExitCode, await stdout, await stderr);
}

static string SanitizeDiagnostic(string value)
{
    var oneLine = string.Join(' ', value.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries).Take(3));
    oneLine = System.Text.RegularExpressions.Regex.Replace(
        oneLine, "(?i)(password|token|secret|api[-_]?key)\\s*[=:]\\s*[^\\s;]+", "$1=[REDACTED]");
    return oneLine.Length <= 800 ? oneLine : oneLine[..800];
}

sealed record ProcessResult(int ExitCode, string StandardOutput, string StandardError);
sealed record CryptoReceipt(string IvSha256, string AuthenticationTagSha256);
sealed record VolumeProof(
    string DatabaseDrive,
    int DatabaseDiskNumber,
    string ArchiveDrive,
    int ArchiveDiskNumber,
    bool SamePhysicalDisk);
sealed record DatabaseManifest(
    string[] MigrationIds,
    string MigrationHead,
    string[] TableNames,
    IReadOnlyDictionary<string, string> TableDefinitions,
    string[] ForeignKeyDefinitions,
    string[] TriggerDefinitions,
    IReadOnlyDictionary<string, long> RowCounts,
    IReadOnlyDictionary<string, string> RowDigests,
    string[] GtidExecuted,
    string[] BinaryLogChain,
    string DataDirectory);

static class Dpapi
{
    private const uint UiForbidden = 0x1;

    public static byte[] Protect(byte[] plaintext) => Transform(plaintext, protect: true);
    public static byte[] Unprotect(byte[] ciphertext) => Transform(ciphertext, protect: false);

    private static byte[] Transform(byte[] input, bool protect)
    {
        var inputBlob = new DataBlob();
        var outputBlob = new DataBlob();
        try
        {
            inputBlob.Size = input.Length;
            inputBlob.Data = Marshal.AllocHGlobal(input.Length);
            Marshal.Copy(input, 0, inputBlob.Data, input.Length);
            var success = protect
                ? CryptProtectData(ref inputBlob, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, UiForbidden, out outputBlob)
                : CryptUnprotectData(ref inputBlob, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, UiForbidden, out outputBlob);
            if (!success) throw new InvalidOperationException($"Windows DPAPI failed: {Marshal.GetLastWin32Error()}.");
            var output = new byte[outputBlob.Size];
            Marshal.Copy(outputBlob.Data, output, 0, output.Length);
            return output;
        }
        finally
        {
            if (inputBlob.Data != IntPtr.Zero) Marshal.FreeHGlobal(inputBlob.Data);
            if (outputBlob.Data != IntPtr.Zero) LocalFree(outputBlob.Data);
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int Size;
        public IntPtr Data;
    }

    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref DataBlob dataIn, string? description, IntPtr optionalEntropy, IntPtr reserved,
        IntPtr prompt, uint flags, out DataBlob dataOut);

    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(
        ref DataBlob dataIn, IntPtr description, IntPtr optionalEntropy, IntPtr reserved,
        IntPtr prompt, uint flags, out DataBlob dataOut);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);
}
