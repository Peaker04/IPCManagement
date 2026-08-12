[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Runbook,
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Runner,
    [switch]$NoDatabase
)

$ErrorActionPreference = 'Stop'
if (-not $NoDatabase) { throw 'This contract test is file-only; pass -NoDatabase.' }
foreach ($path in @($Runbook, $Sql, $Runner)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing contract file: $path" }
}

$runbookText = Get-Content -LiteralPath $Runbook -Raw
$sqlText = Get-Content -LiteralPath $Sql -Raw
$runnerText = Get-Content -LiteralPath $Runner -Raw
$sqlHash = (Get-FileHash -LiteralPath $Sql -Algorithm SHA256).Hash.ToUpperInvariant()

foreach ($stage in @('PRE-FLIGHT', 'CHECKPOINT', 'APPLY', 'POST-FLIGHT', 'ROLLBACK')) {
    if ($runbookText -notmatch [regex]::Escape($stage)) { throw "Runbook is missing receipt stage $stage." }
}
foreach ($required in @('ipc_lane7', 'protectedLaneConnectionAttempts = 0', $sqlHash, 'Plan 05-05')) {
    if ($runbookText -notmatch [regex]::Escape($required)) { throw "Runbook is missing required contract value: $required" }
}
if ($sqlText -match '(?im)^\s*(USE\s+|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)') {
    throw 'Reviewed SQL contains a forbidden database or table destruction statement.'
}
foreach ($required in @("`$allowedDatabase = 'ipc_lane7'", 'if ($Database -cne $allowedDatabase)', 'if (-not $Apply)', 'ApprovedSqlSha256', 'CheckpointReceipt')) {
    if ($runnerText -notmatch [regex]::Escape($required)) { throw "Runner is missing guard: $required" }
}

Write-Host "PASS connection-free Phase 05 lane7 migration contract; SQL SHA-256 $sqlHash"
