param(
    [string]$EnvironmentName = "Lan",
    [string]$ProjectPath = "backend/src/IPCManagement.Api/IPCManagement.Api.csproj",
    [string]$StartupProjectPath = "backend/src/IPCManagement.Api/IPCManagement.Api.csproj",
    [string]$OutputRoot = ".artifacts/migrations",
    [string]$ConnectionString = $env:ConnectionStrings__DefaultConnection,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Write-PlanLog {
    param([string]$Message)

    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Output $line
    Add-Content -Path $script:LogPath -Value $line
}

function Resolve-RequiredPath {
    param(
        [string]$Path,
        [string]$Label
    )

    $resolved = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $resolved) {
        throw "$Label not found: $Path"
    }

    return $resolved.Path
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$script:LogPath = Join-Path $outputDir "migration-plan.log"
$summaryPath = Join-Path $outputDir "migration-plan-summary.md"
New-Item -ItemType File -Force -Path $script:LogPath | Out-Null

$projectFullPath = Resolve-RequiredPath -Path $ProjectPath -Label "API project"
$startupProjectFullPath = Resolve-RequiredPath -Path $StartupProjectPath -Label "Startup project"
$apiDir = Split-Path $projectFullPath -Parent
$migrationDir = Join-Path $apiDir "Migrations"
$environmentConfigPath = Join-Path $apiDir "appsettings.$EnvironmentName.json"

Write-PlanLog "Iter1 migration plan started. EnvironmentName=$EnvironmentName Apply=$Apply"
Write-PlanLog "Project=$projectFullPath"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet CLI is required before running the migration plan."
}

$migrationFiles = Get-ChildItem -Path $migrationDir -Filter "*.cs" |
    Where-Object { $_.Name -notlike "*.Designer.cs" -and $_.Name -ne "IpcManagementContextModelSnapshot.cs" } |
    Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    throw "No EF migration files found under $migrationDir"
}

$latestMigration = [System.IO.Path]::GetFileNameWithoutExtension($migrationFiles[-1].Name)
Write-PlanLog "Latest local migration: $latestMigration"

$hasConnection = -not [string]::IsNullOrWhiteSpace($ConnectionString)
$hasEnvironmentConfig = Test-Path $environmentConfigPath

if ($hasConnection) {
    Write-PlanLog "Connection string supplied through parameter or ConnectionStrings__DefaultConnection."
} elseif ($hasEnvironmentConfig) {
    Write-PlanLog "Using environment config file: $environmentConfigPath"
} else {
    Write-PlanLog "No connection string or appsettings.$EnvironmentName.json found. Audit can continue; apply is blocked."
}

$status = "AUDIT_ONLY"
$applyCommand = @(
    "dotnet", "ef", "database", "update",
    "--project", $ProjectPath,
    "--startup-project", $StartupProjectPath
)

if ($hasConnection) {
    $applyCommand += @("--connection", "<redacted>")
}

if ($Apply) {
    if (-not $hasConnection -and -not $hasEnvironmentConfig) {
        throw "Apply requires either -ConnectionString or appsettings.$EnvironmentName.json."
    }

    $previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
    $previousConnection = $env:ConnectionStrings__DefaultConnection

    try {
        $env:ASPNETCORE_ENVIRONMENT = $EnvironmentName
        if ($hasConnection) {
            $env:ConnectionStrings__DefaultConnection = $ConnectionString
        }

        $dotnetArgs = @(
            "ef", "database", "update",
            "--project", $projectFullPath,
            "--startup-project", $startupProjectFullPath
        )

        if ($hasConnection) {
            $dotnetArgs += @("--connection", $ConnectionString)
        }

        Write-PlanLog "Applying EF migrations through dotnet ef database update."
        & dotnet @dotnetArgs 2>&1 | ForEach-Object { Write-PlanLog $_ }

        if ($LASTEXITCODE -ne 0) {
            throw "dotnet ef database update failed with exit code $LASTEXITCODE"
        }

        $status = "APPLIED"
    }
    finally {
        $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
        $env:ConnectionStrings__DefaultConnection = $previousConnection
    }
}

$summary = @(
    "# Iter1 Migration Plan",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | $status |",
    "| Environment | $EnvironmentName |",
    "| Latest local migration | $latestMigration |",
    "| Migration count | $($migrationFiles.Count) |",
    "| Environment config present | $hasEnvironmentConfig |",
    "| Connection string supplied | $hasConnection |",
    "",
    "Apply command:",
    "",
    '```powershell',
    "powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1MigrationPlan.ps1 -EnvironmentName $EnvironmentName -Apply",
    '```',
    "",
    "Equivalent EF command:",
    "",
    '```powershell',
    ($applyCommand -join " "),
    '```',
    "",
    "Log: $script:LogPath"
)

Set-Content -Path $summaryPath -Value $summary
Write-PlanLog "Summary written to $summaryPath"
Write-Output "summary=$summaryPath"
