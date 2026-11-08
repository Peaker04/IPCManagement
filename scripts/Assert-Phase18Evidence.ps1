[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$EvidenceRoot,
    [Parameter(Mandatory = $true)][string]$ExpectedDatabase,
    [Parameter(Mandatory = $true)][string]$ExpectedWeek,
    [Parameter(Mandatory = $true)][string]$ExpectedViewports
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = [IO.Path]::GetFullPath($EvidenceRoot)
$required = @('preflight.json', 'cleanup.json', 'import-transition.json', 'browser/phase18-headed-audit.json')
foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) {
        throw "Missing Phase 18 evidence: $relative"
    }
}

$preflight = Get-Content -Raw -LiteralPath (Join-Path $root 'preflight.json') | ConvertFrom-Json
$cleanup = Get-Content -Raw -LiteralPath (Join-Path $root 'cleanup.json') | ConvertFrom-Json
$transition = Get-Content -Raw -LiteralPath (Join-Path $root 'import-transition.json') | ConvertFrom-Json
$browser = Get-Content -Raw -LiteralPath (Join-Path $root 'browser/phase18-headed-audit.json') | ConvertFrom-Json
$viewports = @($ExpectedViewports -split ',')

if ($ExpectedDatabase -cne 'ipc_lane1' -or $preflight.database -cne $ExpectedDatabase -or
    $cleanup.database -cne $ExpectedDatabase -or $transition.database -cne $ExpectedDatabase -or
    $browser.database -cne $ExpectedDatabase) {
    throw 'Evidence database identity is not exactly ipc_lane1.'
}
if ($ExpectedWeek -ne '2026-07-27' -or $preflight.weekStartDate -ne $ExpectedWeek -or
    $transition.weekStartDate -ne $ExpectedWeek -or $browser.weekStartDate -ne $ExpectedWeek) {
    throw 'Evidence week does not match 2026-07-27.'
}
if ($viewports -contains '768x1024' -or $viewports.Count -ne 5) { throw 'Viewport contract is invalid.' }
$actualViewports = @($browser.viewports | ForEach-Object name)
if (@(Compare-Object -ReferenceObject $viewports -DifferenceObject $actualViewports).Count -ne 0) {
    throw "Browser viewports differ. Expected $($viewports -join ','); got $($actualViewports -join ',')."
}

foreach ($copy in @(
    @{ path = [string]$preflight.backup.archive; hash = [string]$preflight.backup.archiveSha256 },
    @{ path = [string]$preflight.backup.mirror; hash = [string]$preflight.backup.mirrorSha256 }
)) {
    if (-not (Test-Path -LiteralPath $copy.path) -or
        -not [string]::Equals((Get-FileHash -LiteralPath $copy.path -Algorithm SHA256).Hash, $copy.hash, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Backup evidence failed: $($copy.path)"
    }
}
if (-not $cleanup.protectedHashMatches -or -not $cleanup.lineageMatches -or $cleanup.orphanCount -ne 0 -or
    -not $transition.protectedHashMatches -or -not $transition.lineageMatches -or $transition.orphanCount -ne 0) {
    throw 'Protected hash, migration lineage or orphan evidence failed.'
}
if (@(Compare-Object -ReferenceObject @('currentstock', 'currentstocklots', 'menuitems', 'menus', 'purchaselinesupplierdecisions') `
    -DifferenceObject @($transition.mutableLifecycleTables | Sort-Object)).Count -ne 0) {
    throw 'Mutable lifecycle table evidence is incomplete.'
}
foreach ($table in $cleanup.after.transactionTables) {
    if ([int64]$cleanup.after.rowCounts.$table -ne 0) { throw "Cleanup left rows in $table." }
}
foreach ($table in 'menuversions', 'menuschedules', 'mealquantityplans', 'materialrequests') {
    if ([int64]$transition.afterImport.rowCounts.$table -lt 1) { throw "Missing downstream evidence in $table." }
}

$weeklySummary = @(Get-ChildItem -LiteralPath (Join-Path $root 'weekly') -Filter 'weekly-happy-path-e2e-summary.md' -Recurse -File)
if ($weeklySummary.Count -ne 1 -or -not (Select-String -LiteralPath $weeklySummary[0].FullName -Pattern '| Status | PASS |' -SimpleMatch)) {
    throw 'Weekly E2E PASS summary is missing or ambiguous.'
}
if (@($browser.consoleErrors).Count -gt 0 -or @($browser.pageErrors).Count -gt 0 -or
    @($browser.requestFailures).Count -gt 0 -or @($browser.apiErrors).Count -gt 0 -or
    @($browser.reactKeyWarnings).Count -gt 0) {
    throw 'Browser error/request/React-key evidence is not clean.'
}
foreach ($viewport in $browser.viewports) {
    if ($viewport.horizontalOverflow -or [double]$viewport.cls -gt 0.1 -or [int]$viewport.longTaskFailures -gt 0 -or
        $viewport.selectedWeek -ne $ExpectedWeek -or -not ([string]$viewport.selectedCustomer).StartsWith('ANV')) {
        throw "Browser viewport failed: $($viewport.name)."
    }
    foreach ($screenshot in @($viewport.weeklyScreenshot, $viewport.reloadScreenshot, $viewport.shipyardScreenshot)) {
        if (-not (Test-Path -LiteralPath (Join-Path (Join-Path $root 'browser') $screenshot))) {
            throw "Screenshot missing for $($viewport.name): $screenshot"
        }
    }
}

[pscustomobject]@{
    status = 'PASS'
    database = $ExpectedDatabase
    week = $ExpectedWeek
    viewports = $viewports
    workbookSha256 = $preflight.workbook.sha256
    protectedHash = $preflight.snapshot.combinedProtectedHash
    apiResponses = @($browser.apiResponses).Count
    screenshots = @($browser.viewports).Count * 3
} | ConvertTo-Json -Depth 5
