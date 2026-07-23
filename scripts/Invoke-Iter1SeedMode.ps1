param(
    [ValidateSet("DemoReset", "ProductionBaseline")]
    [string]$Mode = "DemoReset",
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$ServiceDate = "2026-06-18",
    [string]$OutputRoot = ".artifacts/seed-modes",
    [switch]$DryRun,
    [switch]$AuditOnly,
    [switch]$AllowRemoteDemoReset
)

$ErrorActionPreference = "Stop"

function Write-SeedLog {
    param([string]$Message)

    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Output $line
    Add-Content -Path $script:LogPath -Value $line
}

function Test-PrivateOrLocalHost {
    param([string]$HostName)

    if ($HostName -in @("localhost", "127.0.0.1", "::1")) {
        return $true
    }

    if ($HostName.EndsWith(".local", [StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    $ip = $null
    if ([System.Net.IPAddress]::TryParse($HostName, [ref]$ip)) {
        $bytes = $ip.GetAddressBytes()
        return $bytes[0] -eq 10 -or
            ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
            ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
    }

    return $false
}

function Assert-DemoTarget {
    param([string]$TargetUrl)

    $uri = [Uri]$TargetUrl
    if ($AllowRemoteDemoReset) {
        Write-SeedLog "AllowRemoteDemoReset enabled. Demo reset target safety check bypassed by operator."
        return
    }

    if (-not (Test-PrivateOrLocalHost -HostName $uri.Host)) {
        throw "DemoReset is blocked for non-local/non-private host '$($uri.Host)'. Use ProductionBaseline for production or pass -AllowRemoteDemoReset only for an approved demo host."
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$script:LogPath = Join-Path $outputDir "seed-mode.log"
$summaryPath = Join-Path $outputDir "seed-mode-summary.md"
New-Item -ItemType File -Force -Path $script:LogPath | Out-Null

Write-SeedLog "Iter1 seed mode started. Mode=$Mode BaseUrl=$BaseUrl AuditOnly=$AuditOnly DryRun=$DryRun"

$status = "AUDIT_ONLY"
$command = ""

if ($Mode -eq "DemoReset") {
    Assert-DemoTarget -TargetUrl $BaseUrl
    $command = "powershell -ExecutionPolicy Bypass -File scripts/MVP_DEMO_SEED_RESET.ps1 -BaseUrl `"$BaseUrl`" -Username `"$Username`" -ServiceDate `"$ServiceDate`""
    if ($DryRun) {
        $command += " -DryRun"
    }

    if ($AuditOnly) {
        Write-SeedLog "DemoReset audit passed. Command is ready but was not executed."
    }
    else {
        Write-SeedLog "Executing DemoReset through MVP_DEMO_SEED_RESET.ps1."
        $seedArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-File", "scripts/MVP_DEMO_SEED_RESET.ps1",
            "-BaseUrl", $BaseUrl,
            "-Username", $Username,
            "-Password", $Password,
            "-ServiceDate", $ServiceDate
        )

        if ($DryRun) {
            $seedArgs += "-DryRun"
        }

        & powershell @seedArgs 2>&1 | ForEach-Object { Write-SeedLog $_ }

        if ($LASTEXITCODE -ne 0) {
            throw "DemoReset failed with exit code $LASTEXITCODE"
        }

        $status = if ($DryRun) { "DEMO_DRY_RUN_PASS" } else { "DEMO_RESET_PASS" }
    }
}
else {
    $command = "ProductionBaseline performs no sample-data import. Run migrations, create production config, then verify GET $BaseUrl/."
    Write-SeedLog "ProductionBaseline selected. No demo/sample import endpoint will be called."

    if (-not $AuditOnly) {
        $response = Invoke-WebRequest -Method GET -Uri "$BaseUrl/" -UseBasicParsing
        Write-SeedLog "Production baseline root endpoint status: $($response.StatusCode)"
        $status = "PRODUCTION_BASELINE_PASS"
    }
}

$summary = @(
    "# Iter1 Seed Mode Summary",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | $status |",
    "| Mode | $Mode |",
    "| Base URL | $BaseUrl |",
    "| Audit only | $AuditOnly |",
    "| Dry run | $DryRun |",
    "",
    "Command:",
    "",
    '```powershell',
    $command,
    '```',
    "",
    "Log: $script:LogPath"
)

Set-Content -Path $summaryPath -Value $summary
Write-SeedLog "Summary written to $summaryPath"
Write-Output "summary=$summaryPath"
