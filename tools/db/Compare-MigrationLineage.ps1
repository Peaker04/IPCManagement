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

$sourceMigrationIds = @(
    Get-ChildItem -LiteralPath $migrationsPath -File -Filter '*.cs' |
        Where-Object { $_.BaseName -match '^\d{14}_[A-Za-z0-9_]+$' } |
        ForEach-Object { $_.BaseName } |
        Sort-Object -Unique
)

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

$allMigrationIds | ForEach-Object {
    [pscustomobject]@{
        MigrationId = $_
        InDatabase = $_ -in $databaseMigrationIds
        InSource = $_ -in $sourceMigrationIds
        Status = if ($_ -in $databaseOnly) {
            'DATABASE_ONLY'
        }
        elseif ($_ -in $sourceOnly) {
            'SOURCE_ONLY'
        }
        else {
            'MATCHED'
        }
    }
}

Write-Host "Compared $($databaseMigrationIds.Count) database migration IDs with $($sourceMigrationIds.Count) source migration files."
Write-Host "Database-only: $($databaseOnly.Count); source-only: $($sourceOnly.Count)."

if ($FailOnDrift -and ($databaseOnly.Count -gt 0 -or $sourceOnly.Count -gt 0)) {
    exit 3
}
