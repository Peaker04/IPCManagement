[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database = 'ipc_lane7',
    [string[]]$Sql,
    [string[]]$ApprovedSqlSha256,
    [string]$CheckpointReceipt,
    [switch]$Apply,
    [string]$MySqlExe = 'mysql',
    [string]$DbHost = 'localhost',
    [int]$Port = 3306,
    [string]$DbUser = 'root'
)

$ErrorActionPreference = 'Stop'
$allowedDatabase = 'ipc_lane7'

if (-not $Sql -or $Sql.Count -eq 0) {
    $Sql = @(
        (Join-Path $PSScriptRoot 'phase05-service-run-ipc-lane7-reviewed.sql'),
        (Join-Path $PSScriptRoot 'phase05-purchasing-ipc-lane7-reviewed.sql')
    )
}

if ($Database -cne $allowedDatabase) {
    throw "Phase 05 migration target must be exactly '$allowedDatabase'; no database connection was attempted."
}
if ($Sql.Count -ne 2) {
    throw 'Phase 05 requires exactly two ordered reviewed SQL artifacts: ServiceRun, then purchasing compatibility.'
}
foreach ($sqlPath in $Sql) {
    if (-not (Test-Path -LiteralPath $sqlPath -PathType Leaf)) {
        throw "Reviewed SQL is missing: $sqlPath"
    }
}

$sqlArtifacts = @($Sql | ForEach-Object {
    [pscustomobject]@{
        path = (Resolve-Path -LiteralPath $_).Path
        sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToUpperInvariant()
    }
})
$manifest = [ordered]@{
    formatVersion = 2
    targetDatabase = $allowedDatabase
    protectedLaneConnectionAttempts = 0
    targetLaneConnectionAttempts = 0
    inspectedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
    sqlArtifacts = $sqlArtifacts
    receiptStages = @('PRE-FLIGHT', 'CHECKPOINT', 'APPLY', 'POST-FLIGHT', 'ROLLBACK')
    requiredMigrationHeads = @(
        '20260812170357_AddMultiCustomerServiceRunKernel',
        '20260812172709_AddPurchaseOrderCompatibilityScope'
    )
}

if (-not $Apply) {
    $manifest | ConvertTo-Json -Depth 4
    return
}
if ($ApprovedSqlSha256.Count -ne $sqlArtifacts.Count -or
    (@($ApprovedSqlSha256 | ForEach-Object { $_.ToUpperInvariant() }) -join ',') -cne
    (@($sqlArtifacts | ForEach-Object { $_.sha256 }) -join ',')) {
    throw 'APPLY requires exact ordered -ApprovedSqlSha256 values for ServiceRun then purchasing SQL; no database connection was attempted.'
}
if ([string]::IsNullOrWhiteSpace($CheckpointReceipt) -or -not (Test-Path -LiteralPath $CheckpointReceipt -PathType Leaf)) {
    throw 'APPLY requires an existing -CheckpointReceipt; no database connection was attempted.'
}

# The first command capable of opening a connection is intentionally below every target/hash/checkpoint guard.
# The only connection-capable action targets ipc_lane7; protected lanes remain at zero attempts.
foreach ($sqlArtifact in $sqlArtifacts) {
    $manifest.targetLaneConnectionAttempts++
    Get-Content -LiteralPath $sqlArtifact.path -Raw | & $MySqlExe "--host=$DbHost" "--port=$Port" "--user=$DbUser" "--database=$allowedDatabase"
    if ($LASTEXITCODE -ne 0) {
        throw "MySQL apply failed for $($sqlArtifact.path) with exit code $LASTEXITCODE. Preserve the checkpoint and collect a POST-FLIGHT failure receipt."
    }
}

$manifest | ConvertTo-Json -Depth 4
