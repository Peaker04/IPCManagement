[CmdletBinding()]
param(
    [string]$ArtifactRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden',
    [string]$PreflightRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/preflight',
    [string]$ExpectedLane = 'ipc_lane7',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
if ($ValidateOnly) {
    foreach ($required in @('PHYSICAL_INPUT_PASS', 'checkpoint-receipt.json', 'apply-disposition-retry-receipt.json', 'COMMIT_PASS', 'DAV_MENU_DIFFERENT_PASS', 'protectedLaneConnectionAttempts')) {
        if ((Get-Content -Raw -LiteralPath $PSCommandPath) -notmatch [regex]::Escape($required)) {
            throw "Golden runner contract is missing $required."
        }
    }
    Write-Host 'PASS static golden-path contract; no runtime, browser, or database action was attempted.'
    return
}
$controlPath = Join-Path $PreflightRoot 'browser-control.json'
if (-not (Test-Path -LiteralPath $controlPath -PathType Leaf)) { throw 'Golden path is blocked: browser-control.json is missing.' }
$control = Get-Content -Raw -LiteralPath $controlPath | ConvertFrom-Json
if ($control.verdict -ne 'PHYSICAL_INPUT_PASS' -or -not $control.pointer.trusted -or -not $control.keyboard.trusted -or $control.workaroundAccepted -eq $true) {
    throw 'Golden path is blocked: only trusted pointer + keyboard PHYSICAL_INPUT_PASS may authorize fixture work.'
}
$checkpointPath = Join-Path $PreflightRoot 'migration/checkpoint-receipt.json'
$applyPath = Join-Path $PreflightRoot 'migration/apply-disposition-retry-receipt.json'
$commitPath = Join-Path $ArtifactRoot 'commit-anv-dav.json'
$differentPath = Join-Path $ArtifactRoot 'differentiate-dav-menu.json'
foreach ($path in @($checkpointPath, $applyPath, $commitPath, $differentPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Golden path is blocked: missing receipt $path" }
}
$checkpoint = Get-Content -Raw -LiteralPath $checkpointPath | ConvertFrom-Json
$apply = Get-Content -Raw -LiteralPath $applyPath | ConvertFrom-Json
$commit = Get-Content -Raw -LiteralPath $commitPath | ConvertFrom-Json
$different = Get-Content -Raw -LiteralPath $differentPath | ConvertFrom-Json
if ($checkpoint.targetDatabase -cne $ExpectedLane -or $apply.targetDatabase -cne $ExpectedLane -or
    $commit.lane -cne $ExpectedLane -or $different.lane -cne $ExpectedLane) {
    throw 'Golden path is blocked: a checkpoint/migration/menu receipt targets a different database lane.'
}
if ($checkpoint.protectedLaneConnectionAttempts -ne 0 -or $apply.protectedLaneConnectionAttempts -ne 0 -or
    $commit.databaseFence.protectedLaneConnectionAttempts -ne 0 -or $different.databaseFence.protectedLaneConnectionAttempts -ne 0) {
    throw 'Golden path is blocked: protected-lane activity is not zero.'
}
if ($commit.verdict -ne 'COMMIT_PASS' -or $different.verdict -ne 'DAV_MENU_DIFFERENT_PASS') {
    throw 'Golden path is blocked: ANV/DAV atomic menu commit and scoped DAV differentiation must pass first.'
}
throw 'Golden path remains incomplete after menu scope proof: publish, servings, demand, compatible/incompatible purchasing, receipt, issue, kitchen acknowledgement and independent close evidence are still required. No PASS manifest was emitted.'
