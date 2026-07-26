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
    [Parameter(Mandatory = $true)][string]$Database,
    [switch]$Force,
    [string]$DbUser = 'root',
    [string]$Password = $env:MYSQL_PWD,
    [string]$DbHost = 'localhost',
    [int]$Port = 3306,
    [string]$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin'
)

$ErrorActionPreference = 'Stop'

# DB that - khong bao gio ghi de bang tay nham.
$ProtectedDatabases = @('ipcmanagement')

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
}
else {
    $sqlFile = $backup
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$errFile   = Join-Path ([System.IO.Path]::GetTempPath()) "ipc-restore-err-$PID.txt"

$previousPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
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
}
finally {
    $env:MYSQL_PWD = $previousPwd
    if ($workDir -and (Test-Path $workDir)) { Remove-Item $workDir -Recurse -Force }
    if (Test-Path $errFile) { Remove-Item $errFile -Force }
}

$stopwatch.Stop()
Write-Host ("[OK] Restore xong vao '{0}': {1} bang, {2:N1}s." -f $Database, $tableCount, $stopwatch.Elapsed.TotalSeconds)
Write-Host "[OK] Buoc tiep theo: doi chieu so dong cac bang quan trong voi DB goc truoc khi tin ban backup nay."
exit 0
