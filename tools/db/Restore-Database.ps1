<#
.SYNOPSIS
    Restore mot file backup (.sql hoac .zip do Backup-Database.ps1 tao) vao database DICH.

.DESCRIPTION
    Mac dinh huong nguoi dung restore vao mot DB tam de kiem chung, KHONG de len DB that.
    Database nam trong $ProtectedDatabases se bi tu choi tru khi truyen -Force tuong minh.
    Database dich duoc tao tu dong neu chua ton tai.
    Mat khau lay tu -Password hoac bien moi truong MYSQL_PWD (khong hardcode).

.EXAMPLE
    .\Restore-Database.ps1 -BackupPath C:\Users\me\ipc-backups\ipcmanagement-20260726-101500.zip `
                           -Database ipcmanagement_restore_test

.EXAMPLE
    # Ghi de DB that - chi lam khi thuc su co su co, phai co -Force
    .\Restore-Database.ps1 -BackupPath ...zip -Database ipcmanagement -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackupPath,
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [Parameter(Mandatory = $true)][string]$Database,
    [switch]$Force,
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$DbUser = 'root',
    [string]$Password = $env:MYSQL_PWD,
    [ValidatePattern('^[A-Za-z0-9_.-]+$')]
    [string]$DbHost = 'localhost',
    [ValidateRange(1, 65535)]
    [int]$Port = 3306,
    [string]$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin'
)

$ErrorActionPreference = 'Stop'

# DB that - khong bao gio ghi de bang tay nham.
$ProtectedDatabases = @('ipcmanagement', 'ipc_lane1')

if (($ProtectedDatabases -contains $Database.ToLower()) -and (-not $Force)) {
    Write-Host "[CHAN] '$Database' la database that." -ForegroundColor Red
    Write-Host "       Hay restore vao DB tam de kiem chung truoc, vi du:" -ForegroundColor Yellow
    Write-Host "         .\Restore-Database.ps1 -BackupPath '$BackupPath' -Database ${Database}_restore_test" -ForegroundColor Yellow
    Write-Host "       Neu that su muon ghi de DB that, them -Force." -ForegroundColor Yellow
    exit 2
}

$mysqlExe = Join-Path $MySqlBin 'mysql.exe'
if (-not (Test-Path $mysqlExe)) {
    Write-Host "[LOI] Khong tim thay mysql.exe tai: $mysqlExe" -ForegroundColor Red
    exit 2
}
if (-not (Test-Path $BackupPath)) {
    Write-Host "[LOI] Khong tim thay file backup: $BackupPath" -ForegroundColor Red
    exit 2
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host "[LOI] Chua co mat khau. Dat bien moi truong MYSQL_PWD hoac truyen -Password." -ForegroundColor Red
    exit 2
}

$backup  = Get-Item $BackupPath
$workDir = $null
$manifest = $null
if ($backup.Extension -eq '.zip') {
    $workDir = Join-Path ([System.IO.Path]::GetTempPath()) "ipc-restore-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Write-Host "[RESTORE] Giai nen $($backup.Name) ..."
    Expand-Archive -Path $backup.FullName -DestinationPath $workDir -Force
    $sqlFile = Get-ChildItem -Path $workDir -Filter '*.sql' -File | Select-Object -First 1
    if (-not $sqlFile) {
        Remove-Item $workDir -Recurse -Force
        Write-Host "[LOI] Trong file zip khong co file .sql nao." -ForegroundColor Red
        exit 1
    }
    $manifestFile = Get-ChildItem -Path $workDir -Filter '*.manifest.json' -File | Select-Object -First 1
    if ($manifestFile) {
        $manifest = Get-Content -Raw -LiteralPath $manifestFile.FullName | ConvertFrom-Json
        if ($manifest.formatVersion -ne 1) {
            Remove-Item $workDir -Recurse -Force
            Write-Host "[LOI] Manifest backup co formatVersion khong duoc ho tro." -ForegroundColor Red
            exit 1
        }
        $actualSqlHash = (Get-FileHash -LiteralPath $sqlFile.FullName -Algorithm SHA256).Hash
        if (-not [string]::Equals($actualSqlHash, [string]$manifest.sqlSha256, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item $workDir -Recurse -Force
            Write-Host "[LOI] SQL trong backup khong khop SHA-256 cua manifest." -ForegroundColor Red
            exit 1
        }
    }
}
else {
    $sqlFile = $backup
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$errFile   = Join-Path ([System.IO.Path]::GetTempPath()) "ipc-restore-err-$PID.txt"

$previousPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    $databaseState = (& $mysqlExe --host=$DbHost --port=$Port --user=$DbUser -N -B `
        -e "SELECT COUNT(*), COALESCE((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database'), 0) FROM information_schema.schemata WHERE schema_name='$Database';").Trim()
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] Khong kiem tra duoc trang thai database dich '$Database'." -ForegroundColor Red
        exit 1
    }
    $databaseStateParts = $databaseState -split "`t"
    $databaseExists = $databaseStateParts.Count -ge 1 -and [int]$databaseStateParts[0] -gt 0
    $existingTableCount = if ($databaseStateParts.Count -ge 2) { [int]$databaseStateParts[1] } else { 0 }
    if ($databaseExists -and $existingTableCount -gt 0 -and (-not $Force)) {
        Write-Host "[CHAN] Database dich '$Database' da ton tai va co $existingTableCount bang." -ForegroundColor Red
        Write-Host "       Dung mot ten disposable moi hoac -Force sau khi da xac minh target." -ForegroundColor Yellow
        exit 2
    }

    Write-Host "[RESTORE] Tao database '$Database' neu chua co ..."
    & $mysqlExe --host=$DbHost --port=$Port --user=$DbUser `
        -e "CREATE DATABASE IF NOT EXISTS ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[LOI] Khong tao duoc database '$Database' (exit $LASTEXITCODE)." -ForegroundColor Red
        exit 1
    }

    Write-Host "[RESTORE] Nap $($sqlFile.Name) ($('{0:N2}' -f ($sqlFile.Length / 1MB)) MB) vao '$Database' ..."
    $proc = Start-Process -FilePath $mysqlExe `
        -ArgumentList "--host=$DbHost", "--port=$Port", "--user=$DbUser", `
                      '--default-character-set=utf8mb4', $Database `
        -RedirectStandardInput $sqlFile.FullName `
        -RedirectStandardError $errFile `
        -NoNewWindow -Wait -PassThru
    $restoreExit = $proc.ExitCode

    if ($restoreExit -ne 0) {
        Write-Host "[LOI] Restore that bai (exit $restoreExit):" -ForegroundColor Red
        if (Test-Path $errFile) { Get-Content $errFile | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" } }
        exit 1
    }

    $tableCount = (& $mysqlExe --host=$DbHost --port=$Port --user=$DbUser -N -B `
        -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$Database';").Trim()

    if ($manifest) {
        $restoredEvidence = (& $mysqlExe --host=$DbHost --port=$Port --user=$DbUser -N -B `
            --database=$Database `
            -e "SELECT (SELECT COUNT(*) FROM stockmovements), (SELECT COUNT(*) FROM __EFMigrationsHistory), (SELECT MAX(MigrationId) FROM __EFMigrationsHistory);").Trim()
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[LOI] Khong doc duoc restore evidence tu '$Database'." -ForegroundColor Red
            exit 1
        }
        $restoredParts = $restoredEvidence -split "`t"
        $evidenceMatches =
            [int64]$tableCount -eq [int64]$manifest.tableCount -and
            [int64]$restoredParts[0] -eq [int64]$manifest.stockMovementCount -and
            [int64]$restoredParts[1] -eq [int64]$manifest.migrationCount -and
            [string]$restoredParts[2] -eq [string]$manifest.latestMigration
        if (-not $evidenceMatches) {
            Write-Host "[LOI] Restore evidence khong khop manifest (table/stockmovement/migration)." -ForegroundColor Red
            exit 1
        }
    }
}
finally {
    $env:MYSQL_PWD = $previousPwd
    if ($workDir -and (Test-Path $workDir)) { Remove-Item $workDir -Recurse -Force }
    if (Test-Path $errFile) { Remove-Item $errFile -Force }
}

$stopwatch.Stop()
Write-Host ("[OK] Restore xong vao '{0}': {1} bang, {2:N1}s." -f $Database, $tableCount, $stopwatch.Elapsed.TotalSeconds)
if ($manifest) {
    Write-Host "[OK] Manifest verified: table count, stockmovements, migration count va latest migration deu khop."
}
Write-Host "[OK] Buoc tiep theo: doi chieu so dong cac bang quan trong voi DB goc truoc khi tin ban backup nay."
exit 0
