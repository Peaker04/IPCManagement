[CmdletBinding(DefaultParameterSetName = 'Backend')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Backend')]
    [string]$BackendOwner,
    [Parameter(Mandatory, ParameterSetName = 'Playwright')]
    [string]$PlaywrightPattern,
    [Parameter(Mandatory)]
    [int]$ExpectedCount,
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string]$ExpectedSha256,
    [Parameter(Mandatory)]
    [string]$FilePattern,
    [switch]$ExpectedBodySha256FromCallsiteChecklist
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Get-Sha256Text([string[]]$Lines) {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Lines -join "`n"))
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes)) -replace '-', '')
    }
    finally {
        $algorithm.Dispose()
    }
}

if ($PSCmdlet.ParameterSetName -eq 'Backend') {
    Push-Location $root
    try {
        $output = @(& dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj `
            --list-tests --no-restore --verbosity quiet)
        if ($LASTEXITCODE -ne 0) { throw "Backend test discovery failed with exit code $LASTEXITCODE." }
    }
    finally {
        Pop-Location
    }

    $escapedOwner = [Regex]::Escape($BackendOwner)
    $names = @($output |
        Where-Object { $_ -match "^\s+IPCManagement\.Api\.Tests\.$escapedOwner\." } |
        ForEach-Object { $_.Trim() } |
        Sort-Object)
    $searchRoot = Join-Path $root 'backend/tests/IPCManagement.Api.Tests'
}
else {
    $frontend = Join-Path $root 'frontend'
    $specFiles = @(Get-ChildItem -LiteralPath (Join-Path $frontend 'tests') -Filter $PlaywrightPattern -File |
        Sort-Object Name |
        ForEach-Object { "tests/$($_.Name)" })
    if ($specFiles.Count -eq 0) { throw "No Playwright spec matched '$PlaywrightPattern'." }

    Push-Location $frontend
    try {
        $output = @(& npx playwright test @specFiles --list)
        if ($LASTEXITCODE -ne 0) { throw "Playwright discovery failed with exit code $LASTEXITCODE." }
    }
    finally {
        Pop-Location
    }

    $names = @($output |
        Where-Object { $_ -match '^\s+\[chromium\]' } |
        ForEach-Object { ($_ -replace '^\s+\[chromium\]\s+›\s+[^›]+›\s+', '').Trim() } |
        Sort-Object)
    $searchRoot = Join-Path $root 'frontend/tests'
}

$actualSha256 = Get-Sha256Text $names
if ($names.Count -ne $ExpectedCount) {
    throw "Discovery count drift: expected $ExpectedCount, actual $($names.Count)."
}
if (-not [string]::Equals($actualSha256, $ExpectedSha256, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Discovery SHA-256 drift: expected $ExpectedSha256, actual $actualSha256."
}

$oversized = @(Get-ChildItem -LiteralPath $searchRoot -Filter $FilePattern -File | ForEach-Object {
    $lines = [System.IO.File]::ReadAllLines($_.FullName).Count
    if ($lines -gt 1500) { "{0}: {1} lines" -f $_.FullName, $lines }
})
if ($oversized.Count -gt 0) {
    throw "Test file ceiling exceeded:`n$($oversized -join "`n")"
}

if ($ExpectedBodySha256FromCallsiteChecklist) {
    $checklist = Join-Path $root '.planning/phases/18-guardrails-and-workflow-closeout/18-GITNEXUS-CALLSITES.md'
    $label = if ($PSCmdlet.ParameterSetName -eq 'Backend') { $BackendOwner } else { 'route-smoke' }
    $content = [System.IO.File]::ReadAllText($checklist)
    if ($content -notmatch "Body SHA-256 ``$([Regex]::Escape($label))``: ``[A-F0-9]{64}`` \(pre=post\)") {
        throw "Missing exact pre=post body SHA-256 evidence for $label in the GitNexus checklist."
    }
}

Write-Host "Decomposition verified: count=$($names.Count), sha256=$actualSha256, files<=1500."
