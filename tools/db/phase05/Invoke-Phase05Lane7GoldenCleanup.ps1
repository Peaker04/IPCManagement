[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database = 'ipc_lane7',
    [Parameter(Mandatory = $true)]
    [string]$CheckpointPath,
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$DbUser = 'root',
    [string]$Password = $env:MYSQL_PWD,
    [ValidatePattern('^[A-Za-z0-9_.-]+$')]
    [string]$DbHost = 'localhost',
    [ValidateRange(1, 65535)]
    [int]$Port = 3306,
    [string]$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin',
    [string]$OutputPath,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$AllowedDatabase = 'ipc_lane7'
if ($Database -cne $AllowedDatabase) {
    throw "Cleanup accepts only exact ipc_lane7; rejected '$Database' before any connection attempt."
}

$result = [ordered]@{
    runId = "phase05-lane7-golden-cleanup-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))"
    generatedAtUtc = [DateTime]::UtcNow.ToString('O')
    database = $Database
    mode = if ($Apply) { 'apply' } else { 'dry-run' }
    protectedLaneConnectionAttempts = 0
    checkpointVerified = $false
    applyStatus = 'NOT_RUN'
}

if (-not (Test-Path -LiteralPath $CheckpointPath -PathType Leaf)) {
    throw "Checkpoint does not exist: $CheckpointPath"
}
if ([IO.Path]::GetExtension($CheckpointPath) -cne '.zip') {
    throw 'Checkpoint must be a ZIP emitted by Backup-Database.ps1.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($CheckpointPath))
try {
    $manifestEntry = $archive.Entries |
        Where-Object { $_.Name.EndsWith('.manifest.json', [StringComparison]::OrdinalIgnoreCase) } |
        Select-Object -First 1
    if (-not $manifestEntry) { throw 'Checkpoint manifest is missing.' }
    $reader = [IO.StreamReader]::new($manifestEntry.Open())
    try { $manifest = $reader.ReadToEnd() | ConvertFrom-Json }
    finally { $reader.Dispose() }
}
finally {
    $archive.Dispose()
}
if ([string]$manifest.sourceDatabase -cne $AllowedDatabase) {
    throw 'Checkpoint sourceDatabase is not exact ipc_lane7.'
}
if ([int64]$manifest.tableCount -lt 1 -or [int64]$manifest.migrationCount -lt 1) {
    throw 'Checkpoint manifest lacks schema or migration evidence.'
}
$result.checkpointVerified = $true
$result.checkpoint = [ordered]@{
    path = [IO.Path]::GetFullPath($CheckpointPath)
    zipSha256 = (Get-FileHash -LiteralPath $CheckpointPath -Algorithm SHA256).Hash.ToLowerInvariant()
    tableCount = [int64]$manifest.tableCount
    migrationCount = [int64]$manifest.migrationCount
    latestMigration = [string]$manifest.latestMigration
}

$mysqlExe = Join-Path $MySqlBin 'mysql.exe'
if (-not (Test-Path -LiteralPath $mysqlExe)) { throw "mysql.exe not found: $mysqlExe" }
if ([string]::IsNullOrWhiteSpace($Password)) { throw 'Set process-only MYSQL_PWD or pass -Password.' }

$clearTables = @(
    'approvalassignments', 'approvalhistories', 'auditlogs',
    'backup_bomadjustments_20260717_141300', 'backup_dishbom_20260717_141300',
    'backup_dishes_20260717_141300', 'backup_ingredients_20260717_141300',
    'backup_materialrequestlines_bom_20260717_141300',
    'backup_menuitems_20260717_141300', 'backup_menuitems_pre2026_20260717_141300',
    'bomadjustments', 'currentstock', 'currentstocklots',
    'customerimportmappings', 'customerweekmenutiers', 'dataqualitydispositions',
    'inventoryallocationdispositions', 'inventoryissuelines', 'inventoryissues',
    'inventoryreceiptlines', 'inventoryreceipts', 'inventoryreturnlines', 'inventoryreturns',
    'legacylinedispositions', 'lifecyclecommandreceipts', 'lifecycleoutboxdeliveries',
    'lifecycleoutboxmessages', 'lifecycletransitions', 'materialrequestlines', 'materialrequests',
    'mealquantityplanlines', 'mealquantityplans', 'menuamendmentlines',
    'menuamendmentreconciliationcases', 'menuamendmentreconciliationcorrections', 'menuamendments',
    'menuitems', 'menus', 'menuschedules', 'menuversions',
    'productionplanlines', 'productionplans', 'purchasehistoryreconciliationactions',
    'purchasehistoryreconciliationruns', 'purchaselinesupplierdecisions', 'purchaseorderlines',
    'purchaseorders', 'purchasepriceexceptions', 'purchasereceiptactivelines',
    'purchaserequestlines', 'purchaserequests', 'quantityadjustments', 'quantityimportbatches',
    'receiptcorrectionlines', 'receiptcorrections', 'refreshtokens',
    'servicerunadjustments', 'servicerundecisionitems', 'serviceruns', 'servicerunsourcelines',
    'servicerunvariancedeclarations', 'servicerunvariancewaivers', 'stockmovements',
    'stocksnapshots', 'stocktakelines', 'stocktakes', 'supplementalmaterialrequests',
    'unitnormalizationreviews'
)
$preservedTables = @(
    '__efmigrationshistory', 'approvalrules', 'dishbom', 'dishes',
    'ingredients', 'portionrules', 'roles', 'supplierquotations', 'suppliers', 'units', 'users', 'warehouses'
)

$previousPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    function Invoke-Scalar {
        param([Parameter(Mandatory = $true)][string]$Sql)
        $value = & $mysqlExe --host=$DbHost --port=$Port --user=$DbUser --batch --skip-column-names --raw --execute=$Sql 2>&1
        if ($LASTEXITCODE -ne 0) { throw "MySQL query failed: $value" }
        (($value | ForEach-Object { [string]$_ }) -join "`n").Trim()
    }

    $schemaState = Invoke-Scalar "SELECT COUNT(*), COALESCE((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_type='BASE TABLE'),0) FROM information_schema.schemata WHERE schema_name='$Database';"
    $schemaParts = $schemaState -split "`t"
    if ($schemaParts.Count -ne 2 -or [int64]$schemaParts[0] -ne 1 -or [int64]$schemaParts[1] -lt 1) {
        throw "Target '$Database' does not exist or has no schema."
    }

    $requiredTables = @($clearTables + $preservedTables + @('customers', 'customercontracts')) | Select-Object -Unique
    $missingTables = @()
    foreach ($table in $requiredTables) {
        if ([int64](Invoke-Scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='$table' AND table_type='BASE TABLE';") -ne 1) {
            $missingTables += $table
        }
    }
    if ($missingTables.Count -gt 0) { throw "Target schema is missing tables: $($missingTables -join ', ')" }

    $migrationState = Invoke-Scalar "SELECT COUNT(*), MAX(MigrationId) FROM ``$Database``.__efmigrationshistory;"
    $migrationParts = $migrationState -split "`t"
    if ([int64]$migrationParts[0] -ne [int64]$manifest.migrationCount -or [string]$migrationParts[1] -cne [string]$manifest.latestMigration) {
        throw 'Live lane migration lineage does not match checkpoint manifest.'
    }

    $customerCodes = @((Invoke-Scalar "SELECT customerCode FROM ``$Database``.customers ORDER BY customerCode;") -split "`n")
    foreach ($requiredCode in @('ANV', 'DAV')) {
        if ($customerCodes -cnotcontains $requiredCode) { throw "Required customer '$requiredCode' is missing." }
    }

    $beforeClear = [ordered]@{}
    foreach ($table in $clearTables) { $beforeClear[$table] = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.``$table``;") }
    $beforePreserved = [ordered]@{}
    foreach ($table in $preservedTables) { $beforePreserved[$table] = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.``$table``;") }
    $retainedContractCount = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.customercontracts cc INNER JOIN ``$Database``.customers c ON c.customerId=cc.customerId WHERE c.customerCode IN ('ANV','DAV');")
    $retainedPortionRuleCount = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.portionrules pr INNER JOIN ``$Database``.customers c ON c.customerId=pr.customerId WHERE c.customerCode IN ('ANV','DAV');")

    $result.schemaTableCount = [int64]$schemaParts[1]
    $result.migrationCount = [int64]$migrationParts[0]
    $result.latestMigration = [string]$migrationParts[1]
    $result.beforeClearRowCounts = $beforeClear
    $result.beforePreservedRowCounts = $beforePreserved
    $result.beforeCustomerCodes = $customerCodes

    if ($Apply) {
        $sql = @('SET FOREIGN_KEY_CHECKS=0;', 'START TRANSACTION;')
        foreach ($table in $clearTables) { $sql += "DELETE FROM ``$Database``.``$table``;" }
        $sql += @(
            "DELETE cc FROM ``$Database``.customercontracts cc INNER JOIN ``$Database``.customers c ON c.customerId=cc.customerId WHERE c.customerCode NOT IN ('ANV','DAV');",
            "DELETE pr FROM ``$Database``.portionrules pr INNER JOIN ``$Database``.customers c ON c.customerId=pr.customerId WHERE c.customerCode NOT IN ('ANV','DAV');",
            "DELETE FROM ``$Database``.customers WHERE customerCode NOT IN ('ANV','DAV');",
            'COMMIT;',
            'SET FOREIGN_KEY_CHECKS=1;'
        )
        $applyOutput = & $mysqlExe --host=$DbHost --port=$Port --user=$DbUser "--database=$Database" --batch --raw "--execute=$($sql -join "`n")" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Cleanup apply failed: $applyOutput" }

        $afterClear = [ordered]@{}
        foreach ($table in $clearTables) {
            $afterClear[$table] = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
            if ($afterClear[$table] -ne 0) { throw "Postflight failed: '$table' is not empty." }
        }
        $afterPreserved = [ordered]@{}
        foreach ($table in $preservedTables) {
            $afterPreserved[$table] = [int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
            if ($afterPreserved[$table] -ne $beforePreserved[$table]) { throw "Preserved table changed: '$table'." }
        }
        $afterCustomerCodes = @((Invoke-Scalar "SELECT customerCode FROM ``$Database``.customers ORDER BY customerCode;") -split "`n")
        if ($afterCustomerCodes.Count -ne 2 -or $afterCustomerCodes[0] -cne 'ANV' -or $afterCustomerCodes[1] -cne 'DAV') {
            throw "Postflight customer set is not exactly ANV and DAV."
        }
        if ([int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.customercontracts;") -ne $retainedContractCount) { throw 'Retained customer contracts changed.' }
        if ([int64](Invoke-Scalar "SELECT COUNT(*) FROM ``$Database``.portionrules;") -ne $retainedPortionRuleCount) { throw 'Retained portion rules changed.' }
        $afterMigrationState = Invoke-Scalar "SELECT COUNT(*), MAX(MigrationId) FROM ``$Database``.__efmigrationshistory;"
        if ($afterMigrationState -cne $migrationState) { throw 'Migration lineage changed during cleanup.' }
        $afterSchemaCount = [int64](Invoke-Scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_type='BASE TABLE';")
        if ($afterSchemaCount -ne [int64]$schemaParts[1]) { throw 'Schema table count changed during cleanup.' }

        $result.afterClearRowCounts = $afterClear
        $result.afterPreservedRowCounts = $afterPreserved
        $result.afterCustomerCodes = $afterCustomerCodes
        $result.applyStatus = 'PASS'
    }

    $json = $result | ConvertTo-Json -Depth 8
    if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
        $fullOutputPath = [IO.Path]::GetFullPath($OutputPath)
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fullOutputPath) | Out-Null
        Set-Content -LiteralPath $fullOutputPath -Value $json -Encoding utf8
    }
    Write-Output $json
}
finally {
    $env:MYSQL_PWD = $previousPwd
}
