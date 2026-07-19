param(
    [Parameter(Mandatory = $true)]
    [string]$Baseline,

    [Parameter(Mandatory = $true)]
    [string]$Allowlist
)

$ErrorActionPreference = 'Stop'

function Normalize-RepoPath([string]$Path) {
    return $Path.Trim().Replace('\', '/')
}

function Get-RecordedPaths([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Evidence file not found: $Path"
    }

    return Get-Content -LiteralPath $Path |
        Where-Object { $_ -match '^( M|M |A |D |R |C |\?\?) ' } |
        ForEach-Object {
            $candidate = $_.Substring(3).Trim()
            if ($candidate.Contains(' -> ')) {
                $candidate = $candidate.Split(' -> ')[-1]
            }
            Normalize-RepoPath $candidate
        }
}

$baselinePaths = @(Get-RecordedPaths $Baseline)
$allowedEntries = @(Get-Content -LiteralPath $Allowlist |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and -not $_.TrimStart().StartsWith('#') } |
    ForEach-Object { Normalize-RepoPath $_ })

$currentPaths = @(git status --short | ForEach-Object {
    $candidate = $_.Substring(3).Trim()
    if ($candidate.Contains(' -> ')) {
        $candidate = $candidate.Split(' -> ')[-1]
    }
    Normalize-RepoPath $candidate
})

$unexpected = @($currentPaths | Where-Object {
    $path = $_
    if ($baselinePaths -contains $path) {
        return $false
    }

    foreach ($allowed in $allowedEntries) {
        if ($allowed.EndsWith('/') -and $path.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
        if ($path.Equals($allowed, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }
    return $true
})

if ($unexpected.Count -gt 0) {
    Write-Error ("Unexpected worktree paths:`n - " + ($unexpected -join "`n - "))
    exit 1
}

Write-Output "BOM worktree ownership PASS: $($currentPaths.Count) current paths are baseline-owned or explicitly allowlisted."
