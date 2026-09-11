[CmdletBinding()]
param(
    [ValidateSet('Preflight', 'Execute')]
    [string]$Mode,
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database,
    [Parameter(Mandatory = $true)]
    [string]$WorkbookPath,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedWorkbookSha256,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string]$WeekStartDate,
    [string]$EvidenceRoot = '.artifacts/shipyard-live/phase-18-guardrails-20260729'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ExpectedDatabase = 'ipc_lane1'
$ExpectedViewports = @('1920x1080', '1440x900', '1366x768', '1365x900', '1280x900')
$MutableLifecycleTables = @('menus', 'menuitems', 'currentstock', 'currentstocklots', 'purchaselinesupplierdecisions')
$TransactionTables = @(
    'approvalassignments', 'approvalhistories', 'auditlogs', 'inventoryreturnlines', 'inventoryreturns',
    'supplementalmaterialrequests', 'inventoryissuelines', 'inventoryissues', 'inventoryreceiptlines',
    'inventoryreceipts', 'purchaseorderlines', 'purchaseorders', 'purchaserequestlines', 'purchaserequests',
    'materialrequestlines', 'materialrequests', 'productionplanlines', 'productionplans', 'quantityadjustments',
    'mealquantityplanlines', 'mealquantityplans', 'quantityimportbatches', 'menuschedules', 'menuversions',
    'stockmovements', 'stocksnapshots', 'stocktakelines', 'stocktakes', 'supplierquotations', 'refreshtokens'
)
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EvidenceRoot = [IO.Path]::GetFullPath((Join-Path $Root $EvidenceRoot))
$AppSettings = Join-Path $Root 'backend/src/IPCManagement.Api/appsettings.json'
$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin'
$MySql = Join-Path $MySqlBin 'mysql.exe'
$MySqlDump = Join-Path $MySqlBin 'mysqldump.exe'
$PreflightPath = Join-Path $EvidenceRoot 'preflight.json'
$CleanupPath = Join-Path $EvidenceRoot 'cleanup.json'
$TransitionPath = Join-Path $EvidenceRoot 'import-transition.json'
$ProcessPath = Join-Path $EvidenceRoot 'run-processes.json'

function Write-JsonFile {
    param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Path)
    $Value | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding utf8
}

function Assert-ExactInputs {
    if ($Database -cne $ExpectedDatabase) {
        throw "Refusing database '$Database'; Phase 18 is restricted to literal $ExpectedDatabase."
    }
    if ($Database -in @('ipcmanagement', 'ipc_e2e_template')) {
        throw "Protected database '$Database' is not an E2E target."
    }
    $parsedWeek = [DateTime]::ParseExact($WeekStartDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    if ($parsedWeek.DayOfWeek -ne [DayOfWeek]::Monday -or $WeekStartDate -ne '2026-07-27') {
        throw 'Phase 18 is restricted to Monday week 2026-07-27.'
    }
    if (-not (Test-Path -LiteralPath $WorkbookPath -PathType Leaf)) {
        throw "Workbook was not found: $WorkbookPath"
    }
    $actualWorkbookHash = (Get-FileHash -LiteralPath $WorkbookPath -Algorithm SHA256).Hash
    if (-not [string]::Equals($actualWorkbookHash, $ExpectedWorkbookSha256, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Workbook SHA-256 mismatch. Expected $ExpectedWorkbookSha256; got $actualWorkbookHash."
    }
    if ([string]::IsNullOrWhiteSpace($env:MYSQL_PWD)) {
        throw 'MYSQL_PWD must be present. Its value is never printed or persisted.'
    }
    if ([string]::IsNullOrWhiteSpace($env:K6_PASSWORD) -and [string]::IsNullOrWhiteSpace($env:IPC_E2E_PASSWORD)) {
        throw 'K6_PASSWORD or IPC_E2E_PASSWORD must be present. Its value is never printed or persisted.'
    }
    return $actualWorkbookHash
}

function Assert-PortsStopped {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in 3001, 8001, 8090 })
    if ($listeners.Count -gt 0) {
        $ports = @($listeners.LocalPort | Sort-Object -Unique) -join ', '
        throw "Ports must be stopped before mutation. Listening: $ports"
    }
}

function Get-ConnectionInfo {
    $settings = Get-Content -Raw -LiteralPath $AppSettings | ConvertFrom-Json
    $connectionString = [string]$settings.ConnectionStrings.DefaultConnection
    $parts = @{}
    foreach ($part in $connectionString -split ';') {
        if ($part -match '^\s*([^=]+)=(.*)$') {
            $parts[$matches[1].Trim().ToLowerInvariant()] = $matches[2]
        }
    }
    $password = if ($parts.ContainsKey('password')) { $parts['password'] } else { $parts['pwd'] }
    if ([string]::IsNullOrWhiteSpace($password)) { throw 'Configured MySQL password is missing.' }
    return [pscustomobject]@{
        Host = if ($parts['server']) { $parts['server'] } else { '127.0.0.1' }
        Port = if ($parts['port']) { [int]$parts['port'] } else { 3306 }
        User = if ($parts['user']) { $parts['user'] } else { 'root' }
        Password = $password
        Jwt = $settings.JwtSettings
        ConnectionString = [regex]::Replace($connectionString, '(?i)(Database|Initial Catalog)=[^;]*', "Database=$ExpectedDatabase")
    }
}

function Invoke-MySql {
    param(
        [Parameter(Mandatory = $true)]$Connection,
        [Parameter(Mandatory = $true)][string]$Query,
        [switch]$NoDatabase
    )
    $arguments = @(
        "--host=$($Connection.Host)", "--port=$($Connection.Port)", "--user=$($Connection.User)",
        '--batch', '--skip-column-names', '--default-character-set=utf8mb4'
    )
    if (-not $NoDatabase) { $arguments += "--database=$ExpectedDatabase" }
    $arguments += @('-e', $Query)
    $oldPassword = $env:MYSQL_PWD
    $env:MYSQL_PWD = $Connection.Password
    try {
        $output = @(& $MySql @arguments 2>&1)
        if ($LASTEXITCODE -ne 0) { throw "MySQL query failed with exit $LASTEXITCODE." }
        return @($output | ForEach-Object { [string]$_ })
    }
    finally {
        $env:MYSQL_PWD = $oldPassword
    }
}

function Get-TableHash {
    param(
        [Parameter(Mandatory = $true)]$Connection,
        [Parameter(Mandatory = $true)][string]$Table
    )
    $temporary = Join-Path ([IO.Path]::GetTempPath()) "ipc-phase18-$PID-$Table.sql"
    $arguments = @(
        "--host=$($Connection.Host)", "--port=$($Connection.Port)", "--user=$($Connection.User)",
        '--default-character-set=utf8mb4', '--no-create-info', '--skip-triggers', '--compact',
        '--single-transaction', '--set-gtid-purged=OFF', '--order-by-primary', '--skip-extended-insert',
        "--result-file=$temporary", $ExpectedDatabase, $Table
    )
    $oldPassword = $env:MYSQL_PWD
    $env:MYSQL_PWD = $Connection.Password
    try {
        & $MySqlDump @arguments | Out-Null
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporary)) {
            throw "Could not fingerprint protected table $Table."
        }
        return (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash
    }
    finally {
        $env:MYSQL_PWD = $oldPassword
        Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    }
}

function Get-DatabaseSnapshot {
    param([Parameter(Mandatory = $true)]$Connection)
    $identity = @((Invoke-MySql -Connection $Connection -Query 'SELECT DATABASE();'))[0].Trim()
    if ($identity -cne $ExpectedDatabase) { throw "Connected database identity is '$identity', expected '$ExpectedDatabase'." }

    $tables = @(Invoke-MySql -Connection $Connection -Query @"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@)
    if ($tables.Count -lt 1) { throw 'Target database has no base tables.' }
    $missingTransactionTables = @($TransactionTables | Where-Object { $_ -notin $tables })
    if ($missingTransactionTables.Count -gt 0) {
        throw "Target is missing sanitizer tables: $($missingTransactionTables -join ', ')."
    }

    $rowCounts = [ordered]@{}
    foreach ($table in $tables) {
        $quoted = $table.Replace('`', '``')
        $rowCounts[$table] = [int64]@((Invoke-MySql -Connection $Connection -Query "SELECT COUNT(*) FROM ``$quoted``;"))[0]
    }

    $migrations = @(Invoke-MySql -Connection $Connection -Query 'SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;')
    if ($migrations.Count -lt 1) { throw 'Migration lineage is empty.' }

    $foreignKeys = @(Invoke-MySql -Connection $Connection -Query @"
SELECT table_name, column_name, referenced_table_name, referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
ORDER BY table_name, constraint_name, ordinal_position;
"@)
    $orphanChecks = @()
    foreach ($line in $foreignKeys) {
        $parts = $line -split "`t"
        if ($parts.Count -ne 4) { throw "Unexpected FK metadata row: $line" }
        $childTable, $childColumn, $parentTable, $parentColumn = $parts
        $count = [int64]@((Invoke-MySql -Connection $Connection -Query @"
SELECT COUNT(*)
FROM ``$($childTable.Replace('`','``'))`` c
LEFT JOIN ``$($parentTable.Replace('`','``'))`` p
  ON c.``$($childColumn.Replace('`','``'))`` = p.``$($parentColumn.Replace('`','``'))``
WHERE c.``$($childColumn.Replace('`','``'))`` IS NOT NULL
  AND p.``$($parentColumn.Replace('`','``'))`` IS NULL;
"@))[0]
        $orphanChecks += [pscustomobject]@{
            child = "$childTable.$childColumn"
            parent = "$parentTable.$parentColumn"
            count = $count
        }
    }
    $orphans = @($orphanChecks | Where-Object count -gt 0)
    if ($orphans.Count -gt 0) { throw "Foreign-key orphan audit found $($orphans.Count) failing relationship(s)." }

    $protectedTables = @($tables | Where-Object { $_ -notin $TransactionTables -and $_ -ne '__EFMigrationsHistory' })
    $protectedHashes = [ordered]@{}
    foreach ($table in $protectedTables) {
        $protectedHashes[$table] = Get-TableHash -Connection $Connection -Table $table
    }
    $canonical = @($protectedHashes.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n"
    $canonicalPath = Join-Path ([IO.Path]::GetTempPath()) "ipc-phase18-protected-$PID.txt"
    try {
        [IO.File]::WriteAllText($canonicalPath, $canonical, [Text.UTF8Encoding]::new($false))
        $combinedProtectedHash = (Get-FileHash -LiteralPath $canonicalPath -Algorithm SHA256).Hash
    }
    finally {
        Remove-Item -LiteralPath $canonicalPath -Force -ErrorAction SilentlyContinue
    }

    return [pscustomobject]@{
        capturedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
        database = $identity
        tableCount = $tables.Count
        foreignKeyCount = $foreignKeys.Count
        orphanCount = 0
        migrationCount = $migrations.Count
        latestMigration = $migrations[-1]
        migrations = $migrations
        rowCounts = $rowCounts
        transactionTables = $TransactionTables
        protectedTableCount = $protectedTables.Count
        protectedHashes = $protectedHashes
        combinedProtectedHash = $combinedProtectedHash
    }
}

function New-RollbackCheckpoint {
    param([Parameter(Mandatory = $true)]$Connection, [Parameter(Mandatory = $true)]$Snapshot)
    $outputDir = 'D:\Backups\ipc-phase18-20260729'
    $mirrorDir = 'C:\Users\Administrator\ipc-phase18-20260729'
    $backupScript = Join-Path $Root 'tools/db/Backup-Database.ps1'
    $before = @(Get-ChildItem -LiteralPath $outputDir -Filter "$ExpectedDatabase-*.zip" -File -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName)
    & $backupScript -Database $ExpectedDatabase -OutputDir $outputDir -MirrorDir $mirrorDir -RetentionDays 30 `
        -DbHost $Connection.Host -Port $Connection.Port -DbUser $Connection.User -Password $Connection.Password -MySqlBin $MySqlBin
    if ($LASTEXITCODE -ne 0) { throw "Backup-Database.ps1 failed with exit $LASTEXITCODE." }
    $backup = Get-ChildItem -LiteralPath $outputDir -Filter "$ExpectedDatabase-*.zip" -File |
        Where-Object FullName -notin $before | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $backup) { throw 'Backup script did not create a fresh archive.' }
    $mirror = Get-Item -LiteralPath (Join-Path $mirrorDir $backup.Name)
    $backupHash = (Get-FileHash -LiteralPath $backup.FullName -Algorithm SHA256).Hash
    $mirrorHash = (Get-FileHash -LiteralPath $mirror.FullName -Algorithm SHA256).Hash
    if (-not [string]::Equals($backupHash, $mirrorHash, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Backup and mirror SHA-256 differ.'
    }

    $extractDir = Join-Path ([IO.Path]::GetTempPath()) "ipc-phase18-backup-$PID"
    try {
        Expand-Archive -LiteralPath $backup.FullName -DestinationPath $extractDir -Force
        $manifestFile = Get-ChildItem -LiteralPath $extractDir -Filter '*.manifest.json' -File | Select-Object -First 1
        $sqlFile = Get-ChildItem -LiteralPath $extractDir -Filter '*.sql' -File | Select-Object -First 1
        if (-not $manifestFile -or -not $sqlFile) { throw 'Backup archive is missing SQL or manifest.' }
        $manifest = Get-Content -Raw -LiteralPath $manifestFile.FullName | ConvertFrom-Json
        $sqlHash = (Get-FileHash -LiteralPath $sqlFile.FullName -Algorithm SHA256).Hash
        if ($manifest.sourceDatabase -cne $ExpectedDatabase -or
            -not [string]::Equals($manifest.sqlSha256, $sqlHash, [StringComparison]::OrdinalIgnoreCase) -or
            [int]$manifest.tableCount -ne [int]$Snapshot.tableCount -or
            [int]$manifest.migrationCount -ne [int]$Snapshot.migrationCount -or
            [string]$manifest.latestMigration -ne [string]$Snapshot.latestMigration) {
            throw 'Backup manifest does not match the live rollback checkpoint.'
        }
        $manifestEvidence = [pscustomobject]@{
            formatVersion = $manifest.formatVersion
            sourceDatabase = $manifest.sourceDatabase
            sqlSha256 = $manifest.sqlSha256
            sqlBytes = $manifest.sqlBytes
            tableCount = $manifest.tableCount
            stockMovementCount = $manifest.stockMovementCount
            migrationCount = $manifest.migrationCount
            latestMigration = $manifest.latestMigration
        }
    }
    finally {
        Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    $recoveryEvidence = Join-Path $Root 'docs/DATABASE-RECOVERY-REHEARSAL-2026-07-28.md'
    if (-not (Test-Path -LiteralPath $recoveryEvidence)) { throw 'Prior disposable restore rehearsal evidence is missing.' }
    return [pscustomobject]@{
        archive = $backup.FullName
        mirror = $mirror.FullName
        archiveSha256 = $backupHash
        mirrorSha256 = $mirrorHash
        archiveBytes = $backup.Length
        manifest = $manifestEvidence
        restoreRehearsalEvidence = $recoveryEvidence
        restoreRehearsalSha256 = (Get-FileHash -LiteralPath $recoveryEvidence -Algorithm SHA256).Hash
    }
}

function Wait-HttpReady {
    param([Parameter(Mandatory = $true)][string]$Url, [int]$Seconds = 90)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return }
        }
        catch { Start-Sleep -Milliseconds 800 }
    } while ((Get-Date) -lt $deadline)
    throw "Runtime did not become ready: $Url"
}

function Stop-RunOwnedPorts {
    foreach ($port in 3001, 8001, 8090) {
        @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    }
}

if (-not (Test-Path -LiteralPath $MySql) -or -not (Test-Path -LiteralPath $MySqlDump)) {
    throw "MySQL client tools were not found under $MySqlBin."
}
New-Item -ItemType Directory -Force -Path $EvidenceRoot | Out-Null
$workbookHash = Assert-ExactInputs
$connection = Get-ConnectionInfo

if ($Mode -eq 'Preflight') {
    Assert-PortsStopped
    $snapshot = Get-DatabaseSnapshot -Connection $connection
    $backup = New-RollbackCheckpoint -Connection $connection -Snapshot $snapshot
    $result = [pscustomobject]@{
        formatVersion = 1
        mode = 'Preflight'
        createdAtUtc = (Get-Date).ToUniversalTime().ToString('O')
        sourceHead = (git -C $Root rev-parse HEAD).Trim()
        database = $ExpectedDatabase
        weekStartDate = $WeekStartDate
        workbook = [pscustomobject]@{
            path = [IO.Path]::GetFullPath($WorkbookPath)
            bytes = (Get-Item -LiteralPath $WorkbookPath).Length
            sha256 = $workbookHash
        }
        expectedViewports = $ExpectedViewports
        snapshot = $snapshot
        backup = $backup
        mutationAuthorized = $false
    }
    Write-JsonFile -Value $result -Path $PreflightPath
    Write-Output "PREFLIGHT=PASS database=$ExpectedDatabase tables=$($snapshot.tableCount) migrations=$($snapshot.migrationCount) protected=$($snapshot.protectedTableCount)"
    Write-Output "BACKUP=PASS archive=$($backup.archive) mirror=$($backup.mirror)"
    Write-Output "EVIDENCE=$PreflightPath"
    exit 0
}

if (-not (Test-Path -LiteralPath $PreflightPath)) { throw 'Preflight evidence is missing; Execute is blocked.' }
$preflight = Get-Content -Raw -LiteralPath $PreflightPath | ConvertFrom-Json
if ($preflight.database -cne $ExpectedDatabase -or $preflight.weekStartDate -ne $WeekStartDate -or
    -not [string]::Equals($preflight.workbook.sha256, $workbookHash, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Preflight target/week/workbook does not match Execute inputs.'
}
foreach ($copy in @(
    @{ path = [string]$preflight.backup.archive; hash = [string]$preflight.backup.archiveSha256 },
    @{ path = [string]$preflight.backup.mirror; hash = [string]$preflight.backup.mirrorSha256 }
)) {
    if (-not (Test-Path -LiteralPath $copy.path) -or
        -not [string]::Equals((Get-FileHash -LiteralPath $copy.path -Algorithm SHA256).Hash, $copy.hash, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Rollback copy failed verification: $($copy.path)"
    }
}

Assert-PortsStopped
$immediateBefore = Get-DatabaseSnapshot -Connection $connection
$cleanupEvidence = if (Test-Path -LiteralPath $CleanupPath) {
    Get-Content -Raw -LiteralPath $CleanupPath | ConvertFrom-Json
}
else {
    $null
}
$expectedSnapshot = if ($cleanupEvidence) { $cleanupEvidence.after } else { $preflight.snapshot }
$rowCountDrift = @()
foreach ($property in $expectedSnapshot.rowCounts.PSObject.Properties) {
    $currentValue = [int64]$immediateBefore.rowCounts.($property.Name)
    if ($currentValue -ne [int64]$property.Value) {
        $rowCountDrift += [pscustomobject]@{ table = $property.Name; expected = [int64]$property.Value; current = $currentValue }
    }
}
$protectedHashDrift = @()
foreach ($property in $expectedSnapshot.protectedHashes.PSObject.Properties) {
    $currentValue = [string]$immediateBefore.protectedHashes.($property.Name)
    if (-not [string]::Equals($currentValue, [string]$property.Value, [StringComparison]::OrdinalIgnoreCase)) {
        $protectedHashDrift += [pscustomobject]@{ table = $property.Name; expected = $property.Value; current = $currentValue }
    }
}
$unexpectedProtectedHashDrift = @($protectedHashDrift | Where-Object { $_.table -notin $MutableLifecycleTables })
$mutableHashDriftIsExpected = @($protectedHashDrift | Where-Object { $_.table -notin $MutableLifecycleTables }).Count -eq 0
$partialWeeklyLogs = @(Get-ChildItem -LiteralPath (Join-Path $EvidenceRoot 'weekly') -Filter 'happy-path-e2e.log' `
    -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc)
$partialWeeklyLogText = @($partialWeeklyLogs | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }) -join "`n"
$resumeWeeklyAfterImport = $cleanupEvidence -and $rowCountDrift.Count -gt 0 -and $unexpectedProtectedHashDrift.Count -eq 0 -and
    $mutableHashDriftIsExpected -and
    $immediateBefore.database -ceq $ExpectedDatabase -and
    $immediateBefore.latestMigration -eq $expectedSnapshot.latestMigration -and $immediateBefore.orphanCount -eq 0 -and
    ([int64]$immediateBefore.rowCounts.menus - [int64]$expectedSnapshot.rowCounts.menus) -eq 12 -and
    ([int64]$immediateBefore.rowCounts.menuitems - [int64]$expectedSnapshot.rowCounts.menuitems) -eq 114 -and
    [int64]$immediateBefore.rowCounts.menuversions -eq 1 -and [int64]$immediateBefore.rowCounts.menuschedules -gt 0 -and
    [int64]$immediateBefore.rowCounts.mealquantityplans -ge 2 -and [int64]$immediateBefore.rowCounts.materialrequests -ge 1 -and
    [int64]$immediateBefore.rowCounts.materialrequestlines -ge 62 -and
    $partialWeeklyLogText.Contains('Weekly menu committed: version=1, status=DRAFT.') -and
    $partialWeeklyLogText.Contains('Weekly menu published: version=1, status=ACTIVE.') -and
    $partialWeeklyLogText.Contains('Demand approved: MR-ANV-20260727-FULLDAY DRAFT->MANAGERAPPROVED.')
if ($immediateBefore.database -cne $ExpectedDatabase -or ($rowCountDrift.Count -gt 0 -and -not $resumeWeeklyAfterImport) -or
    ($protectedHashDrift.Count -gt 0 -and -not $resumeWeeklyAfterImport) -or
    $immediateBefore.latestMigration -ne $expectedSnapshot.latestMigration -or
    $immediateBefore.orphanCount -ne 0) {
    $driftPath = Join-Path $EvidenceRoot 'pre-execute-drift.json'
    Write-JsonFile -Value ([pscustomobject]@{
        database = $ExpectedDatabase
        detectedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
        expectedState = if ($cleanupEvidence) { 'cleanup.after' } else { 'preflight.snapshot' }
        rowCountDrift = $rowCountDrift
        protectedHashDrift = $protectedHashDrift
        expectedLatestMigration = $expectedSnapshot.latestMigration
        currentLatestMigration = $immediateBefore.latestMigration
        currentOrphanCount = $immediateBefore.orphanCount
    }) -Path $driftPath
    throw "Database does not match the authorized resume state; Execute is blocked. Evidence: $driftPath"
}

if ($cleanupEvidence) {
    if ($cleanupEvidence.database -cne $ExpectedDatabase -or
        -not $cleanupEvidence.protectedHashMatches -or -not $cleanupEvidence.lineageMatches -or
        $cleanupEvidence.orphanCount -ne 0) {
        throw 'Existing cleanup evidence is not an authorized ipc_lane1 resume point.'
    }
    $afterCleanup = if ($resumeWeeklyAfterImport) { $cleanupEvidence.after } else { $immediateBefore }
    if ($resumeWeeklyAfterImport) {
        Write-Output "WEEKLY=RESUME_AFTER_IMPORT database=$ExpectedDatabase menuVersions=1"
    }
    else {
        Write-Output "CLEANUP=RESUME database=$ExpectedDatabase transactions=0"
    }
}
else {
    $databaseTool = Join-Path $Root 'backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj'
    & dotnet build $databaseTool -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Release DatabaseTool build failed before sanitize.' }
    & dotnet run --project $databaseTool -c Release --no-build -- sanitize-e2e --settings $AppSettings --database $ExpectedDatabase
    if ($LASTEXITCODE -ne 0) { throw "sanitize-e2e failed with exit $LASTEXITCODE." }
    $afterCleanup = Get-DatabaseSnapshot -Connection $connection
    $nonZeroTransaction = @($TransactionTables | Where-Object { [int64]$afterCleanup.rowCounts.$_ -ne 0 })
    if ($nonZeroTransaction.Count -gt 0) { throw "Sanitizer left rows in: $($nonZeroTransaction -join ', ')." }
    if ($afterCleanup.combinedProtectedHash -ne $preflight.snapshot.combinedProtectedHash -or
        $afterCleanup.latestMigration -ne $preflight.snapshot.latestMigration -or $afterCleanup.orphanCount -ne 0) {
        throw 'Cleanup changed protected data, lineage or orphan state.'
    }
    Write-JsonFile -Value ([pscustomobject]@{
        mode = 'Cleanup'
        database = $ExpectedDatabase
        before = $immediateBefore
        after = $afterCleanup
        protectedHashMatches = $true
        lineageMatches = $true
        orphanCount = 0
    }) -Path $CleanupPath
}

$started = @()
$oldE2ePassword = $env:IPC_E2E_PASSWORD
try {
    & dotnet build (Join-Path $Root 'backend/src/IPCManagement.Api/IPCManagement.Api.csproj') -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Release backend build failed.' }

    $env:ConnectionStrings__DefaultConnection = $connection.ConnectionString
    $env:JwtSettings__SecretKey = $connection.Jwt.SecretKey
    $env:JwtSettings__Issuer = $connection.Jwt.Issuer
    $env:JwtSettings__Audience = $connection.Jwt.Audience
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $apiDll = Join-Path $Root 'backend/src/IPCManagement.Api/bin/Release/net9.0/IPCManagement.Api.dll'
    $api = Start-Process -FilePath 'dotnet' -ArgumentList ('"' + $apiDll + '" --urls http://0.0.0.0:8001') `
        -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $EvidenceRoot 'api.out.log') `
        -RedirectStandardError (Join-Path $EvidenceRoot 'api.err.log') -PassThru
    $started += [pscustomobject]@{ name = 'api'; pid = $api.Id; port = 8001 }

    $env:VITE_PROXY_TARGET = 'http://127.0.0.1:8001'
    $frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', '0.0.0.0', '--port', '3001') `
        -WorkingDirectory (Join-Path $Root 'frontend') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $EvidenceRoot 'frontend.out.log') `
        -RedirectStandardError (Join-Path $EvidenceRoot 'frontend.err.log') -PassThru
    $started += [pscustomobject]@{ name = 'frontend'; pid = $frontend.Id; port = 3001 }

    $shipyardRoot = (Resolve-Path (Join-Path $Root '..\shipyard')).Path
    $env:HARNESS_ROOT = $shipyardRoot
    $env:LANES_ROOT = (Resolve-Path (Join-Path $Root '..\shipyard-lanes')).Path
    $env:PROFILE = 'IPCManagement'
    $dashboard = Start-Process -FilePath 'node' -ArgumentList @('server/index.js', '8090') `
        -WorkingDirectory (Join-Path $shipyardRoot 'dashboard') -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $EvidenceRoot 'shipyard.out.log') `
        -RedirectStandardError (Join-Path $EvidenceRoot 'shipyard.err.log') -PassThru
    $started += [pscustomobject]@{ name = 'shipyard'; pid = $dashboard.Id; port = 8090 }
    Write-JsonFile -Value $started -Path $ProcessPath

    Wait-HttpReady -Url 'http://127.0.0.1:8001/health/ready'
    Wait-HttpReady -Url 'http://127.0.0.1:3001/login'
    Wait-HttpReady -Url 'http://127.0.0.1:8090/api/lanes'

    $env:IPC_E2E_PASSWORD = if ($oldE2ePassword) { $oldE2ePassword } else { $env:K6_PASSWORD }
    $weeklyRoot = Join-Path $EvidenceRoot 'weekly'
    & (Join-Path $Root 'scripts/Invoke-WeeklyHappyPathE2E.ps1') `
        -BaseUrl 'http://127.0.0.1:8001' -WeekStartDate $WeekStartDate -CustomerCode 'ANV' `
        -PriceTierAmount 25000 -WeeklyMenuTemplatePath $WorkbookPath -OutputRoot $weeklyRoot -SkipSeedReset `
        -SkipInitialWeeklyMenuImport:$resumeWeeklyAfterImport
    if ($LASTEXITCODE -ne 0 -or -not $?) { throw 'Weekly E2E runner failed.' }

    $afterImport = Get-DatabaseSnapshot -Connection $connection
    $stableProtectedHashDrift = @($preflight.snapshot.protectedHashes.PSObject.Properties |
        Where-Object { $_.Name -notin $MutableLifecycleTables -and
            -not [string]::Equals([string]$afterImport.protectedHashes.($_.Name), [string]$_.Value,
                [StringComparison]::OrdinalIgnoreCase) })
    if ($stableProtectedHashDrift.Count -gt 0 -or $afterImport.latestMigration -ne $preflight.snapshot.latestMigration -or
        $afterImport.orphanCount -ne 0) {
        throw 'Import/lifecycle changed protected data, lineage or orphan state.'
    }
    foreach ($requiredTable in 'menuversions', 'menuschedules', 'mealquantityplans', 'materialrequests') {
        if ([int64]$afterImport.rowCounts.$requiredTable -lt 1) { throw "E2E produced no rows in $requiredTable." }
    }
    Write-JsonFile -Value ([pscustomobject]@{
        mode = 'ImportTransition'
        database = $ExpectedDatabase
        weekStartDate = $WeekStartDate
        workbookSha256 = $workbookHash
        cleanup = $afterCleanup
        afterImport = $afterImport
        mutableLifecycleTables = $MutableLifecycleTables
        protectedHashMatches = $true
        lineageMatches = $true
        orphanCount = 0
    }) -Path $TransitionPath

    $env:PHASE18_EVIDENCE_ROOT = $EvidenceRoot
    $env:PHASE18_WEEK = $WeekStartDate
    $env:PHASE18_DATABASE = $ExpectedDatabase
    & node (Join-Path $EvidenceRoot 'phase18-headed-audit.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Headed browser audit failed with exit $LASTEXITCODE." }
}
finally {
    $env:IPC_E2E_PASSWORD = $oldE2ePassword
    Stop-RunOwnedPorts
}

$remainingPorts = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 3001, 8001, 8090 })
if ($remainingPorts.Count -gt 0) { throw 'Run-owned runtime ports did not stop cleanly.' }
Write-Output "EXECUTE=PASS database=$ExpectedDatabase week=$WeekStartDate"
Write-Output "EVIDENCE=$EvidenceRoot"
