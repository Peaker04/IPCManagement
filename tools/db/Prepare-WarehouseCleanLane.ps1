<#
.SYNOPSIS
    Dry-run or remove legacy warehouse data from a disposable development lane.

.DESCRIPTION
    This command preserves BOM/catalog, menu/planning, material demand, PR/PO,
    supplier decisions, and their approval/audit history. It clears only physical
    warehouse aggregates: receipts, issues, returns, supplemental issues, stock,
    stocktake, receipt corrections, and warehouse-owned audit/lifecycle records.

    The default mode is read-only. Apply is restricted to
    ipc_dev_warehouse_YYYYMMDD databases.
#>
[CmdletBinding()]
param(
    [ValidatePattern('^ipc_dev_warehouse_[0-9]{8}$')]
    [string]$Database = 'ipc_dev_warehouse_20260812',
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$DbUser = 'root',
    [string]$Password = $env:MYSQL_PWD,
    [ValidatePattern('^[A-Za-z0-9_.-]+$')]
    [string]$DbHost = 'localhost',
    [ValidateRange(1, 65535)]
    [int]$Port = 3306,
    [string]$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin',
    [switch]$Apply,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$ProtectedDatabases = @('ipcmanagement', 'ipc_lane1', 'ipc_lane9', 'ipc_e2e_template')
if ($ProtectedDatabases -contains $Database.ToLowerInvariant()) {
    throw "Refusing to operate on protected database '$Database'."
}

$mysqlExe = Join-Path $MySqlBin 'mysql.exe'
if (-not (Test-Path -LiteralPath $mysqlExe)) { throw "mysql.exe not found: $mysqlExe" }
if ([string]::IsNullOrWhiteSpace($Password)) { throw 'Set MYSQL_PWD or pass -Password.' }

$WarehouseTables = @(
    'receiptcorrectionlines', 'receiptcorrections',
    'inventoryreturnlines', 'inventoryreturns',
    'supplementalmaterialrequests', 'legacylinedispositions',
    'inventoryissuelines', 'inventoryissues',
    'inventoryreceiptlines', 'inventoryreceipts',
    'currentstocklots', 'currentstock', 'stocksnapshots', 'stockmovements',
    'stocktakelines', 'stocktakes'
)
$WarehouseAggregateTypes = @(
    'InventoryReceipt', 'InventoryIssue', 'InventoryReturn',
    'SupplementalMaterialRequest', 'ReceiptCorrection', 'Stocktake'
)
$WarehouseAuditEntities = @(
    'CanonicalStockRebuildBatch', 'Currentstock', 'Inventoryissue',
    'Inventoryreceipt', 'Inventoryreturn', 'LegacyReceiptMovementBatch',
    'LegacyUnitConversionBatch', 'ReceiptCorrection', 'Stocktake',
    'SupplementalMaterialRequest'
)
$PreservedTables = @(
    '__efmigrationshistory', 'units', 'ingredients', 'dishes', 'dishbom',
    'menus', 'menuitems', 'menuschedules', 'menuversions',
    'mealquantityplans', 'mealquantityplanlines',
    'productionplans', 'productionplanlines',
    'materialrequests', 'materialrequestlines',
    'purchaserequests', 'purchaserequestlines',
    'purchaseorders', 'purchaseorderlines',
    'purchaselinesupplierdecisions', 'approvalhistories'
)

$oldPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    function Invoke-MySqlScalar {
        param([Parameter(Mandatory = $true)][string]$Sql)
        $value = & $mysqlExe --host=$DbHost --port=$Port --user=$DbUser --batch --skip-column-names --raw --execute=$Sql 2>&1
        if ($LASTEXITCODE -ne 0) { throw "MySQL query failed: $value" }
        return ([string]$value).Trim()
    }
    function Quote-LiteralList {
        param([Parameter(Mandatory = $true)][string[]]$Values)
        return ($Values | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ', '
    }

    $state = Invoke-MySqlScalar "SELECT COUNT(*), COALESCE((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_type='BASE TABLE'),0) FROM information_schema.schemata WHERE schema_name='$Database';"
    $parts = $state -split "`t"
    if ($parts.Count -ne 2 -or [int64]$parts[0] -ne 1 -or [int64]$parts[1] -lt 1) {
        throw "Disposable database '$Database' does not exist or has no schema."
    }

    $requiredTables = @($WarehouseTables + $PreservedTables + @(
        'auditlogs', 'lifecycletransitions', 'lifecyclecommandreceipts',
        'lifecycleoutboxmessages', 'lifecycleoutboxdeliveries'
    )) | Select-Object -Unique
    $missing = @()
    foreach ($table in $requiredTables) {
        if ([int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database' AND table_name='$table' AND table_type='BASE TABLE';") -ne 1) {
            $missing += $table
        }
    }
    if ($missing.Count -gt 0) { throw "Target schema is missing tables: $($missing -join ', ')" }

    $beforeWarehouse = [ordered]@{}
    foreach ($table in $WarehouseTables) {
        $beforeWarehouse[$table] = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
    }
    $beforePreserved = [ordered]@{}
    foreach ($table in $PreservedTables) {
        $beforePreserved[$table] = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
    }

    $aggregateList = Quote-LiteralList $WarehouseAggregateTypes
    $auditList = Quote-LiteralList $WarehouseAuditEntities
    $selectiveBefore = [ordered]@{
        warehouseAuditLogs = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.auditlogs WHERE entityName IN ($auditList);")
        warehouseTransitions = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.lifecycletransitions WHERE aggregateType IN ($aggregateList);")
        warehouseCommandReceipts = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.lifecyclecommandreceipts WHERE aggregateType IN ($aggregateList);")
        warehouseOutboxMessages = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.lifecycleoutboxmessages WHERE aggregateType IN ($aggregateList);")
    }

    $result = [ordered]@{
        runId = "warehouse-clean-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))"
        generatedAtUtc = [DateTime]::UtcNow.ToString('O')
        database = $Database
        mode = if ($Apply) { 'apply' } else { 'dry-run' }
        scope = 'warehouse-only'
        schemaTableCount = [int64]$parts[1]
        clearedTables = $WarehouseTables
        preservedTables = $PreservedTables
        beforeWarehouseRowCounts = $beforeWarehouse
        beforeSelectiveRowCounts = $selectiveBefore
        beforePreservedRowCounts = $beforePreserved
        applyStatus = 'NOT_RUN'
    }

    if ($Apply) {
        $sql = @(
            'SET FOREIGN_KEY_CHECKS=0;',
            'START TRANSACTION;',
            "DELETE delivery FROM ``$Database``.lifecycleoutboxdeliveries delivery INNER JOIN ``$Database``.lifecycleoutboxmessages message ON message.outboxMessageId=delivery.outboxMessageId WHERE message.aggregateType IN ($aggregateList);",
            "DELETE FROM ``$Database``.lifecycleoutboxmessages WHERE aggregateType IN ($aggregateList);",
            "DELETE FROM ``$Database``.lifecyclecommandreceipts WHERE aggregateType IN ($aggregateList);",
            "DELETE FROM ``$Database``.lifecycletransitions WHERE aggregateType IN ($aggregateList);",
            "DELETE FROM ``$Database``.auditlogs WHERE entityName IN ($auditList);"
        )
        foreach ($table in $WarehouseTables) { $sql += "DELETE FROM ``$Database``.``$table``;" }
        $sql += @('COMMIT;', 'SET FOREIGN_KEY_CHECKS=1;')
        $applySql = $sql -join "`n"
        $applyOutput = & $mysqlExe --host=$DbHost --port=$Port --user=$DbUser "--database=$Database" --batch --raw "--execute=$applySql" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Warehouse clean apply failed: $applyOutput" }

        $afterWarehouse = [ordered]@{}
        foreach ($table in $WarehouseTables) {
            $afterWarehouse[$table] = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
            if ($afterWarehouse[$table] -ne 0) { throw "Postflight failed: $table is not empty." }
        }
        $afterPreserved = [ordered]@{}
        foreach ($table in $PreservedTables) {
            $afterPreserved[$table] = [int64](Invoke-MySqlScalar "SELECT COUNT(*) FROM ``$Database``.``$table``;")
            if ($afterPreserved[$table] -ne $beforePreserved[$table]) { throw "Preserved table changed: $table." }
        }
        $result.afterWarehouseRowCounts = $afterWarehouse
        $result.afterPreservedRowCounts = $afterPreserved
        $result.applyStatus = 'PASS'
    }

    $json = $result | ConvertTo-Json -Depth 8
    if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
        $fullPath = [IO.Path]::GetFullPath($OutputPath)
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fullPath) | Out-Null
        Set-Content -LiteralPath $fullPath -Value $json -Encoding utf8
    }
    Write-Output $json
}
finally {
    $env:MYSQL_PWD = $oldPassword
}
