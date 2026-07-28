[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database = 'ipcmanagement',

    [ValidatePattern('^[A-Za-z0-9_.-]+$')]
    [string]$DbHost = 'localhost',

    [ValidateRange(1, 65535)]
    [int]$Port = 3306,

    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$DbUser = 'ipc_backup',

    [string]$Password = $env:MYSQL_PWD,

    [string]$MySqlExe = 'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe',

    [string]$ManifestPath,

    [switch]$FailOnDrift
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw 'Database password is required via -Password or MYSQL_PWD.'
}

if (-not (Test-Path -LiteralPath $MySqlExe -PathType Leaf)) {
    throw "mysql executable not found: $MySqlExe"
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$migrationsPath = Join-Path $repoRoot 'backend\src\IPCManagement.Api\Migrations'
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $PSScriptRoot 'migration-lineage.json'
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Migration lineage manifest not found: $ManifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1) {
    throw "Unsupported migration lineage manifest schemaVersion: $($manifest.schemaVersion)"
}
$manifestEntries = @($manifest.databaseOnlyMigrations)
$manifestErrors = [System.Collections.Generic.List[string]]::new()
$manifestById = @{}
foreach ($entry in $manifestEntries) {
    $migrationId = [string]$entry.migrationId
    if ($migrationId -notmatch '^\d{14}_[A-Za-z0-9_]+$') {
        $manifestErrors.Add("Invalid manifest migration ID: $migrationId")
        continue
    }
    if ($manifestById.ContainsKey($migrationId)) {
        $manifestErrors.Add("Duplicate manifest migration ID: $migrationId")
        continue
    }
    if ($entry.disposition -notin @('retired-data-only', 'superseded-by-source')) {
        $manifestErrors.Add("Unsupported disposition '$($entry.disposition)' for $migrationId")
    }
    if ([string]::IsNullOrWhiteSpace([string]$entry.reason)) {
        $manifestErrors.Add("Missing reason for $migrationId")
    }
    $manifestById[$migrationId] = $entry
}

$sourceMigrationIds = @(
    Get-ChildItem -LiteralPath $migrationsPath -File -Filter '*.cs' |
        Where-Object { $_.BaseName -match '^\d{14}_[A-Za-z0-9_]+$' } |
        ForEach-Object { $_.BaseName } |
        Sort-Object -Unique
)

foreach ($entry in $manifestEntries) {
    if (-not [string]::IsNullOrWhiteSpace([string]$entry.sourceBlobOid)) {
        $blobSpec = "$($entry.sourceBlobOid)^{blob}"
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & git -C $repoRoot cat-file -e $blobSpec 2>$null
            $blobExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($blobExitCode -ne 0) {
            $manifestErrors.Add("Missing Git blob evidence $($entry.sourceBlobOid) for $($entry.migrationId)")
        }
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$entry.successorMigrationId) -and
        $entry.successorMigrationId -notin $sourceMigrationIds) {
        $manifestErrors.Add("Missing source successor $($entry.successorMigrationId) for $($entry.migrationId)")
    }
}

$sql = @'
START TRANSACTION READ ONLY;
SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;
ROLLBACK;
'@

$previousPassword = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    $mysqlArguments = @(
        "--host=$DbHost"
        "--port=$Port"
        "--user=$DbUser"
        "--database=$Database"
        '--batch'
        '--raw'
        '--silent'
        '--skip-column-names'
    )
    $databaseMigrationIds = @(
        $sql | & $MySqlExe @mysqlArguments
    )
    $mysqlExitCode = $LASTEXITCODE
}
finally {
    $env:MYSQL_PWD = $previousPassword
}

if ($mysqlExitCode -ne 0) {
    throw "Migration lineage query failed with mysql exit code $mysqlExitCode."
}

$databaseMigrationIds = @($databaseMigrationIds | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique)
$databaseOnly = @($databaseMigrationIds | Where-Object { $_ -notin $sourceMigrationIds })
$sourceOnly = @($sourceMigrationIds | Where-Object { $_ -notin $databaseMigrationIds })
$allMigrationIds = @(($databaseMigrationIds + $sourceMigrationIds) | Sort-Object -Unique)
$unexplainedDatabaseOnly = @($databaseOnly | Where-Object { -not $manifestById.ContainsKey($_) })
$staleManifestEntries = @($manifestEntries | Where-Object { $_.migrationId -notin $databaseOnly })

$allMigrationIds | ForEach-Object {
    $manifestEntry = if ($manifestById.ContainsKey($_)) { $manifestById[$_] } else { $null }
    [pscustomobject]@{
        MigrationId = $_
        InDatabase = $_ -in $databaseMigrationIds
        InSource = $_ -in $sourceMigrationIds
        Status = if ($null -ne $manifestEntry -and $_ -in $databaseOnly) {
            'CANONICAL_DATABASE_ONLY'
        }
        elseif ($_ -in $databaseOnly) {
            'DATABASE_ONLY'
        }
        elseif ($_ -in $sourceOnly) {
            'SOURCE_ONLY'
        }
        else {
            'MATCHED'
        }
        CanonicalDisposition = $manifestEntry.disposition
        SuccessorMigrationId = $manifestEntry.successorMigrationId
    }
}

Write-Host "Compared $($databaseMigrationIds.Count) database migration IDs with $($sourceMigrationIds.Count) source migration files."
Write-Host "Canonical database-only: $($databaseOnly.Count - $unexplainedDatabaseOnly.Count); unexplained database-only: $($unexplainedDatabaseOnly.Count); source-only: $($sourceOnly.Count)."
Write-Host "Stale manifest entries: $($staleManifestEntries.Count); manifest errors: $($manifestErrors.Count)."

foreach ($manifestError in $manifestErrors) {
    Write-Host "Manifest error: $manifestError" -ForegroundColor Red
}

if ($manifestErrors.Count -gt 0) {
    exit 3
}

if ($FailOnDrift -and (
    $unexplainedDatabaseOnly.Count -gt 0 -or
    $sourceOnly.Count -gt 0 -or
    $staleManifestEntries.Count -gt 0)) {
    exit 3
}
