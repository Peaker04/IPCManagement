param(
    [string]$ArtifactDirectory = '.artifacts/shipyard-live/standardization-phase6-20260803/runtime'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimePath = [System.IO.Path]::GetFullPath((Join-Path $root (Join-Path $ArtifactDirectory 'runtime.json')))
if (-not (Test-Path -LiteralPath $runtimePath)) {
    throw "Runtime ownership file not found: $runtimePath"
}

$runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
$ownedProcessIds = @(
    $runtime.apiPid,
    $runtime.frontendPid,
    $runtime.apiListenerPid,
    $runtime.frontendListenerPid
) | Where-Object { $_ } | Select-Object -Unique
foreach ($processId in $ownedProcessIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $processId -Force
    }
}

Write-Output "STOPPED_API_PID=$($runtime.apiPid)"
Write-Output "STOPPED_FRONTEND_PID=$($runtime.frontendPid)"
