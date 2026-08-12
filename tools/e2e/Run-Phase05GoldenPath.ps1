[CmdletBinding()]
param(
    [string]$ArtifactRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden',
    [string]$PreflightRoot = '.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/preflight',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
if ($ValidateOnly) {
    Write-Host 'PASS static golden-path contract; no runtime, browser, or database action was attempted.'
    return
}
$controlPath = Join-Path $PreflightRoot 'browser-control.json'
if (-not (Test-Path -LiteralPath $controlPath -PathType Leaf)) { throw 'Golden path is blocked: browser-control.json is missing.' }
$control = Get-Content -Raw -LiteralPath $controlPath | ConvertFrom-Json
if ($control.verdict -ne 'PHYSICAL_INPUT_PASS' -or -not $control.pointer.trusted -or -not $control.keyboard.trusted -or $control.workaroundAccepted -eq $true) {
    throw 'Golden path is blocked: only trusted pointer + keyboard PHYSICAL_INPUT_PASS may authorize fixture work.'
}
throw 'Golden path implementation requires the approved lane7 migration receipt and an explicit runtime checkpoint; no fixture or database action was attempted.'
