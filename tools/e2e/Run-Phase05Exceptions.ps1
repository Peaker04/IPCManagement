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

$required = @(
    @{ Path = 'service-runs/result.json'; Verdicts = @('PASS') },
    @{ Path = 'return-receipt/result.json'; Verdicts = @('PASS') },
    @{ Path = 'waste/result.json'; Verdicts = @('PASS') },
    @{ Path = 'excess-negative/result.json'; Verdicts = @('PASS') },
    @{ Path = 'excess-disposition/result.json'; Verdicts = @('PASS') },
    @{ Path = 'supplemental-clean-dav/result.json'; Verdicts = @('PASS') },
    @{ Path = 'quality-isolation/manifest.json'; Verdicts = @('PASS') },
    @{ Path = 'menu-amendment/correction/result.json'; Verdicts = @('PASS') },
    @{ Path = 'kitchen-discrepancy/result.json'; Verdicts = @('PASS') },
    @{ Path = 'ambiguous-lineage/result.json'; Verdicts = @('PASS') },
    @{ Path = 'shared-shortage-blocked-allocation/result.json'; Verdicts = @('PASS') },
    @{ Path = 'retry-matrix/result.json'; Verdicts = @('PASS') }
)

$entries = foreach ($item in $required) {
    $path = Join-Path $ArtifactRoot $item.Path
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing authoritative exception artifact: $($item.Path)" }
    $receipt = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
    if ($item.Verdicts -notcontains $receipt.verdict -or $receipt.lane -cne 'ipc_lane7' -or $receipt.protectedLaneConnectionAttempts -ne 0) {
        throw "Invalid authoritative exception artifact: $($item.Path)"
    }
    [ordered]@{ path = $item.Path; verdict = $receipt.verdict; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash }
}

$retry = Get-Content -Raw -LiteralPath (Join-Path $ArtifactRoot 'retry-matrix/result.json') | ConvertFrom-Json
$physicalPath = Join-Path $ArtifactRoot 'retry-matrix/physical-attempt.json'
if ($retry.physicalEvidencePointer -ne 'physical-attempt.json' -or -not (Test-Path -LiteralPath $physicalPath) -or
    -not $retry.physicalEvidence.pointerTrusted -or -not $retry.physicalEvidence.keyboardTrusted -or
    $retry.protocolMatrix.replay.status -ne 201 -or -not $retry.protocolMatrix.replay.sameIssue -or
    $retry.protocolMatrix.stale.status -ne 409 -or ($retry.protocolMatrix.concurrentStatuses -join ',') -ne '201,409') {
    throw 'Retry matrix does not join physical evidence with replay/stale/concurrent protocol proof.'
}

$manifest = [ordered]@{
    verdict = 'PASS'
    lane = 'ipc_lane7'
    protectedLaneConnectionAttempts = 0
    goldenManifest = $GoldenManifest
    orderedArtifacts = $entries
    retryPhysicalAttempt = [ordered]@{ path = 'retry-matrix/physical-attempt.json'; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $physicalPath).Hash; disposition = 'ATTEMPT_LINKED_BY_PASS_CONTINUATION' }
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
}
$manifestPath = Join-Path $ArtifactRoot 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Host "PASS Phase 5 authoritative exception matrix: $manifestPath"
