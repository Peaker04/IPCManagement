[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$GoldenManifest,
    [string]$ArtifactRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/exceptions',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
if ($ValidateOnly) {
    Write-Host 'PASS static exception-runner contract; no runtime, browser, or database action was attempted.'
    return
}
if (-not (Test-Path -LiteralPath $GoldenManifest -PathType Leaf)) { throw 'Exception matrix is blocked: golden manifest is missing.' }
$golden = Get-Content -Raw -LiteralPath $GoldenManifest | ConvertFrom-Json
if ($golden.verdict -ne 'PASS' -or $golden.lane -cne 'ipc_lane7' -or $golden.databaseFence.protectedLaneConnectionAttempts -ne 0) {
    throw 'Exception matrix is blocked: golden proof must be PASS on ipc_lane7 with zero protected-lane connections.'
}
throw 'Exception implementation requires a matching current golden/preflight/migration receipt and explicit runtime checkpoint; no fixture or database action was attempted.'
