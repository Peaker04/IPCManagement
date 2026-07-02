param(
    [string]$OutputRoot = ".artifacts/release-gates",
    [string]$BackendBaseUrl = "http://localhost:5262",
    [string]$E2ELogPath = "",
    [switch]$RunSeedReset,
    [switch]$AuditOnly
)

$ErrorActionPreference = "Stop"

function New-GateResult {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Status,
        [string]$Evidence,
        [string]$Reason = ""
    )

    [pscustomobject]@{
        Name = $Name
        Command = $Command
        Status = $Status
        Evidence = $Evidence
        Reason = $Reason
    }
}

function Write-Log {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -LiteralPath $script:LogPath -Value $line
}

function Invoke-GateCommand {
    param(
        [string]$Name,
        [string]$Command
    )

    Write-Log "START $Name :: $Command"
    $started = Get-Date
    cmd.exe /c $Command 2>&1 | Tee-Object -FilePath $script:LogPath -Append
    $exitCode = $LASTEXITCODE
    $elapsed = [Math]::Round(((Get-Date) - $started).TotalSeconds, 1)

    if ($exitCode -ne 0) {
        Write-Log "FAIL $Name exit=$exitCode elapsed=${elapsed}s"
        return New-GateResult -Name $Name -Command $Command -Status "FAIL" -Evidence $script:LogPath -Reason "Command exited with $exitCode."
    }

    Write-Log "PASS $Name elapsed=${elapsed}s"
    return New-GateResult -Name $Name -Command $Command -Status "PASS" -Evidence $script:LogPath
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutputRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$script:LogPath = Join-Path $runDir "quality-gate.log"
$summaryPath = Join-Path $runDir "quality-gate-summary.md"

Write-Log "Iter1 quality gate started. AuditOnly=$AuditOnly RunSeedReset=$RunSeedReset BackendBaseUrl=$BackendBaseUrl"

$results = New-Object System.Collections.Generic.List[object]

if ($AuditOnly) {
    $checks = @(
        @{ Name = "backend build command"; Path = "package.json"; Command = "npm run build:be" },
        @{ Name = "backend test command"; Path = "package.json"; Command = "npm run test:be" },
        @{ Name = "frontend lint command"; Path = "package.json"; Command = "npm run lint:fe" },
        @{ Name = "frontend build command"; Path = "package.json"; Command = "npm run build:fe" },
        @{ Name = "frontend smoke command"; Path = "frontend/package.json"; Command = "npm run test:smoke -w frontend" },
        @{ Name = "seed reset script"; Path = ".docs/MVP_DEMO_SEED_RESET.ps1"; Command = "powershell -ExecutionPolicy Bypass -File .docs/MVP_DEMO_SEED_RESET.ps1" }
    )

    foreach ($check in $checks) {
        if (Test-Path -LiteralPath $check.Path) {
            $results.Add((New-GateResult -Name $check.Name -Command $check.Command -Status "PASS" -Evidence $check.Path))
        }
        else {
            $results.Add((New-GateResult -Name $check.Name -Command $check.Command -Status "FAIL" -Evidence $check.Path -Reason "Required file is missing."))
        }
    }
}
else {
    $commands = @(
        @{ Name = "backend build"; Command = "npm run build:be" },
        @{ Name = "backend tests"; Command = "npm run test:be" },
        @{ Name = "frontend lint"; Command = "npm run lint:fe" },
        @{ Name = "frontend build"; Command = "npm run build:fe" },
        @{ Name = "frontend smoke"; Command = "npm run test:smoke -w frontend" }
    )

    foreach ($gate in $commands) {
        $result = Invoke-GateCommand -Name $gate.Name -Command $gate.Command
        $results.Add($result)
        if ($result.Status -ne "PASS") {
            break
        }
    }

    if (@($results | Where-Object { $_.Status -ne "PASS" }).Count -gt 0) {
        Write-Log "Skipping online evidence checks because a command gate failed."
    }
    else {
        if ($RunSeedReset) {
            $seedCommand = "powershell -ExecutionPolicy Bypass -File .docs/MVP_DEMO_SEED_RESET.ps1 -BaseUrl `"$BackendBaseUrl`""
            $results.Add((Invoke-GateCommand -Name "seed reset" -Command $seedCommand))
        }
        else {
            $results.Add((New-GateResult `
                -Name "seed reset" `
                -Command "powershell -ExecutionPolicy Bypass -File .docs/MVP_DEMO_SEED_RESET.ps1 -BaseUrl `"$BackendBaseUrl`"" `
                -Status "BLOCKED" `
                -Evidence $script:LogPath `
                -Reason "Release gate requires seed reset evidence. Re-run with -RunSeedReset against the release candidate backend."))
        }

        if ([string]::IsNullOrWhiteSpace($E2ELogPath)) {
            $results.Add((New-GateResult `
                -Name "selected E2E evidence" `
                -Command "Provide -E2ELogPath <path>" `
                -Status "BLOCKED" `
                -Evidence $script:LogPath `
                -Reason "Release gate requires a dated E2E log path."))
        }
        elseif (Test-Path -LiteralPath $E2ELogPath) {
            $results.Add((New-GateResult `
                -Name "selected E2E evidence" `
                -Command "Provided -E2ELogPath" `
                -Status "PASS" `
                -Evidence (Resolve-Path -LiteralPath $E2ELogPath).Path))
        }
        else {
            $results.Add((New-GateResult `
                -Name "selected E2E evidence" `
                -Command "Provided -E2ELogPath" `
                -Status "FAIL" `
                -Evidence $E2ELogPath `
                -Reason "E2E evidence file does not exist."))
        }
    }
}

$hasBlockingResult = @($results | Where-Object { $_.Status -ne "PASS" }).Count -gt 0
$status = if ($hasBlockingResult) {
    "BLOCKED"
}
elseif ($AuditOnly) {
    "AUDIT_PASS"
}
else {
    "PASS"
}

$summary = @()
$summary += "# Iter1 Quality Gate Summary"
$summary += ""
$summary += "- Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")"
$summary += "- Status: $status"
$summary += "- Log: $script:LogPath"
$summary += ""
$summary += "| Gate | Status | Command | Evidence | Reason |"
$summary += "| --- | --- | --- | --- | --- |"
foreach ($result in $results) {
    $summary += "| $($result.Name) | $($result.Status) | ``$($result.Command)`` | $($result.Evidence) | $($result.Reason) |"
}
$summary | Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Log "Summary written to $summaryPath"
Write-Log "Iter1 quality gate status: $status"

if ($status -eq "BLOCKED") {
    exit 1
}

exit 0
