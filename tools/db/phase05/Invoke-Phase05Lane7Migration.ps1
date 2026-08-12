[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database = 'ipc_lane7',
    [string]$Sql = (Join-Path $PSScriptRoot 'phase05-service-run-ipc-lane7-reviewed.sql'),
    [string]$ApprovedSqlSha256,
    [string]$CheckpointReceipt,
    [switch]$Apply,
    [string]$MySqlExe = 'mysql',
    [string]$DbHost = 'localhost',
    [int]$Port = 3306,
    [string]$DbUser = 'root'
)

$ErrorActionPreference = 'Stop'
$allowedDatabase = 'ipc_lane7'

if ($Database -cne $allowedDatabase) {
    throw "Phase 05 migration target must be exactly '$allowedDatabase'; no database connection was attempted."
}
if (-not (Test-Path -LiteralPath $Sql -PathType Leaf)) {
    throw "Reviewed SQL is missing: $Sql"
}

$sqlHash = (Get-FileHash -LiteralPath $Sql -Algorithm SHA256).Hash.ToUpperInvariant()
$manifest = [ordered]@{
    formatVersion = 1
    targetDatabase = $allowedDatabase
    protectedLaneConnectionAttempts = 0
    inspectedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
    sqlPath = (Resolve-Path -LiteralPath $Sql).Path
    sqlSha256 = $sqlHash
    receiptStages = @('PRE-FLIGHT', 'CHECKPOINT', 'APPLY', 'POST-FLIGHT', 'ROLLBACK')
    requiredMigrationHead = '20260812170357_AddMultiCustomerServiceRunKernel'
    requiredPlan0505Addition = 'Ordered purchasing migration and reviewed SQL are owned by Plan 05-05.'
}

if (-not $Apply) {
    $manifest | ConvertTo-Json -Depth 4
    return
}
if ([string]::IsNullOrWhiteSpace($ApprovedSqlSha256) -or $ApprovedSqlSha256.ToUpperInvariant() -ne $sqlHash) {
    throw 'APPLY requires the exact -ApprovedSqlSha256 for the reviewed SQL; no database connection was attempted.'
}
if ([string]::IsNullOrWhiteSpace($CheckpointReceipt) -or -not (Test-Path -LiteralPath $CheckpointReceipt -PathType Leaf)) {
    throw 'APPLY requires an existing -CheckpointReceipt; no database connection was attempted.'
}

# The first command capable of opening a connection is intentionally below every target/hash/checkpoint guard.
$manifest.protectedLaneConnectionAttempts = 1
Get-Content -LiteralPath $Sql -Raw | & $MySqlExe "--host=$DbHost" "--port=$Port" "--user=$DbUser" "--database=$allowedDatabase"
if ($LASTEXITCODE -ne 0) {
    throw "MySQL apply failed with exit code $LASTEXITCODE. Preserve the checkpoint and collect a POST-FLIGHT failure receipt."
}

$manifest | ConvertTo-Json -Depth 4
