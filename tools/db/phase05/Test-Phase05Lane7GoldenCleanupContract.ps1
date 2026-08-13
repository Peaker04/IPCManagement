[CmdletBinding()]
param(
    [switch]$NoDatabase
)

$ErrorActionPreference = 'Stop'
$runnerPath = Join-Path $PSScriptRoot 'Invoke-Phase05Lane7GoldenCleanup.ps1'
if (-not (Test-Path -LiteralPath $runnerPath)) {
    throw "Missing cleanup runner: $runnerPath"
}

$source = Get-Content -Raw -LiteralPath $runnerPath
$requiredLiterals = @(
    "`$AllowedDatabase = 'ipc_lane7'",
    'if ($Database -cne $AllowedDatabase)',
    'protectedLaneConnectionAttempts = 0',
    'checkpointVerified = $true',
    'sourceDatabase -cne $AllowedDatabase',
    'SET FOREIGN_KEY_CHECKS=0',
    'SET FOREIGN_KEY_CHECKS=1',
    'START TRANSACTION',
    'COMMIT',
    '__efmigrationshistory',
    'ANV',
    'DAV'
)
foreach ($literal in $requiredLiterals) {
    if ($source.IndexOf($literal, [StringComparison]::Ordinal) -lt 0) {
        throw "Cleanup runner is missing contract literal: $literal"
    }
}

foreach ($forbidden in @('ipc_lane9', 'ipc_lane1', 'ipcmanagement', 'ipc_e2e_template')) {
    if ($source -match [regex]::Escape($forbidden)) {
        throw "Cleanup runner must not name or connect to protected database '$forbidden'."
    }
}

try {
    & $runnerPath -Database 'IPC_LANE7' -CheckpointPath 'not-used.zip' 2>$null | Out-Null
    throw 'Case-variant database name was not rejected.'
}
catch {
    if ($_.Exception.Message -notmatch 'exact ipc_lane7') {
        throw
    }
}

try {
    & $runnerPath -Database 'other_lane' -CheckpointPath 'not-used.zip' 2>$null | Out-Null
    throw 'Non-target database name was not rejected.'
}
catch {
    if ($_.Exception.Message -notmatch 'exact ipc_lane7') {
        throw
    }
}

if (-not $NoDatabase) {
    if ([string]::IsNullOrWhiteSpace($env:MYSQL_PWD)) {
        throw 'Set process-only MYSQL_PWD before running the database contract.'
    }
    & $runnerPath -Database ipc_lane7 -CheckpointPath $env:PHASE05_LANE7_CHECKPOINT
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host '[PASS] Phase 05 lane7 Golden cleanup contract.'
