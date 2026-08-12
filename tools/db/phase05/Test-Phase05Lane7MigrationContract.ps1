[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Runbook,
    [Parameter(Mandatory = $true)][string]$Sql,
    [Parameter(Mandatory = $true)][string]$Runner,
    [switch]$NoDatabase
)

$ErrorActionPreference = 'Stop'
if (-not $NoDatabase) { throw 'This contract test is file-only; pass -NoDatabase.' }
$sqlPaths = $Sql -split ',' | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
if ($sqlPaths.Count -ne 2) { throw 'The Phase 05 contract requires ordered ServiceRun and purchasing reviewed SQL files.' }
foreach ($path in @($Runbook, $Runner) + $sqlPaths) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing contract file: $path" }
}
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path
$serviceRunMigration = Join-Path $repositoryRoot 'backend\src\IPCManagement.Api\Migrations\20260812170357_AddMultiCustomerServiceRunKernel.cs'
if (-not (Test-Path -LiteralPath $serviceRunMigration -PathType Leaf)) {
    throw "Missing ServiceRun migration source: $serviceRunMigration"
}

$runbookText = Get-Content -LiteralPath $Runbook -Raw
$runnerText = Get-Content -LiteralPath $Runner -Raw
$serviceRunMigrationText = Get-Content -LiteralPath $serviceRunMigration -Raw
$sqlArtifacts = $sqlPaths | ForEach-Object {
    [pscustomobject]@{
        Path = $_
        Text = Get-Content -LiteralPath $_ -Raw
        Hash = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToUpperInvariant()
    }
}

foreach ($stage in @('PRE-FLIGHT', 'CHECKPOINT', 'APPLY', 'POST-FLIGHT', 'ROLLBACK')) {
    if ($runbookText -notmatch [regex]::Escape($stage)) { throw "Runbook is missing receipt stage $stage." }
}
foreach ($required in @('ipc_lane7', 'protectedLaneConnectionAttempts = 0', 'Plan 05-05')) {
    if ($runbookText -notmatch [regex]::Escape($required)) { throw "Runbook is missing required contract value: $required" }
}
foreach ($sqlArtifact in $sqlArtifacts) {
    if ($sqlArtifact.Text -match '(?im)^\s*(USE\s+|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)') {
        throw "Reviewed SQL contains a forbidden database or table destruction statement: $($sqlArtifact.Path)"
    }
    if ($runbookText -notmatch [regex]::Escape($sqlArtifact.Hash)) {
        throw "Runbook is missing reviewed SQL SHA-256: $($sqlArtifact.Path)"
    }
}

$serviceRunSql = $sqlArtifacts[0].Text
if ($serviceRunSql -match '(?im)DROP\s+INDEX\s+(IF\s+EXISTS\s+)?`?uqServiceRunsPlanShift`?') {
    throw 'ServiceRun reviewed SQL must preserve uqServiceRunsPlanShift because an existing foreign key depends on it.'
}
foreach ($required in @(
    'Keep the legacy plan/shift unique key: an existing foreign key depends on it.',
    'MySQL 9.5 does not support IF NOT EXISTS on ADD COLUMN or CREATE INDEX.',
    '`information_schema`.`columns`',
    '`information_schema`.`statistics`',
    '`information_schema`.`table_constraints`',
    'CREATE UNIQUE INDEX `uqServiceRunsCustomerDateShiftTier` ON `serviceruns` (`customerId`, `serviceDate`, `shiftName`, `priceTierAmount`)',
    'ADD CONSTRAINT `fkServiceRunsCustomer` FOREIGN KEY (`customerId`)'
)) {
    if ($serviceRunSql -notmatch [regex]::Escape($required)) {
        throw "ServiceRun reviewed SQL is missing additive scoped-identity contract: $required"
    }
}
if ($serviceRunSql -match '(?im)\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b|\bADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS\b') {
    throw 'ServiceRun reviewed SQL must guard MySQL 9.5-incompatible conditional DDL through information_schema and prepared statements.'
}
if ($serviceRunMigrationText -match 'DropIndex\(\s*name:\s*"uqServiceRunsPlanShift"') {
    throw 'ServiceRun EF migration must preserve uqServiceRunsPlanShift because an existing foreign key depends on it.'
}
foreach ($required in @(
    'name: "uqServiceRunsCustomerDateShiftTier"',
    'columns: new[] { "customerId", "serviceDate", "shiftName", "priceTierAmount" }',
    'unique: true'
)) {
    if ($serviceRunMigrationText -notmatch [regex]::Escape($required)) {
        throw "ServiceRun EF migration is missing additive scoped-identity contract: $required"
    }
}
if ($runbookText.IndexOf('20260812170357_AddMultiCustomerServiceRunKernel', [StringComparison]::Ordinal) -gt
    $runbookText.IndexOf('20260812172709_AddPurchaseOrderCompatibilityScope', [StringComparison]::Ordinal)) {
    throw 'Runbook migration order must place ServiceRun before purchasing compatibility.'
}
foreach ($required in @('receivingWarehouseId', 'purchasingTerms', 'proposedDeliveryDate', 'ixPurchaseOrdersCompatibility', 'ixPurchaseLineSupplierDecisionsCompatibility', 'forward-recovery')) {
    if ($runbookText -notmatch [regex]::Escape($required)) { throw "Runbook is missing purchasing postflight or recovery assertion: $required" }
}
foreach ($required in @("`$allowedDatabase = 'ipc_lane7'", 'if ($Database -cne $allowedDatabase)', 'if (-not $Apply)', 'ApprovedSqlSha256', 'CheckpointReceipt')) {
    if ($runnerText -notmatch [regex]::Escape($required)) { throw "Runner is missing guard: $required" }
}
foreach ($required in @('[string[]]$Sql', '[string[]]$ApprovedSqlSha256', 'exactly two ordered reviewed SQL artifacts', 'targetLaneConnectionAttempts', 'protectedLaneConnectionAttempts = 0')) {
    if ($runnerText -notmatch [regex]::Escape($required)) { throw "Runner is missing ordered migration contract: $required" }
}
if ($runnerText -match 'protectedLaneConnectionAttempts\s*=\s*1') {
    throw 'Runner must not record an ipc_lane7 connection as a protected-lane connection attempt.'
}

Write-Host "PASS connection-free Phase 05 lane7 migration contract; SQL SHA-256 $($sqlArtifacts.Hash -join ', ')"
