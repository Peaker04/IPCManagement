<#
.SYNOPSIS
    Dump logic mot database MySQL ra file .sql roi nen thanh .zip, tu don ban cu.

.DESCRIPTION
    Dung mysqldump --single-transaction nen KHONG khoa bang InnoDB trong luc dump.
    Mat khau KHONG duoc hardcode: lay tu tham so -Password hoac bien moi truong MYSQL_PWD.
    Script tra exit code khac 0 neu dump loi, va xoa file dump do dang thay vi de lai file rong.

.EXAMPLE
    $env:MYSQL_PWD = '...'
    .\Backup-Database.ps1

.EXAMPLE
    .\Backup-Database.ps1 -Database ipcmanagement -OutputDir D:\Backups\ipc -RetentionDays 30
#>
[CmdletBinding()]
param(
    [string]$Database = 'ipcmanagement',
    [string]$OutputDir = (Join-Path $env:USERPROFILE 'ipc-backups'),
    [int]$RetentionDays = 14,
    [string]$DbUser = 'root',
    [string]$Password = $env:MYSQL_PWD,
    [string]$DbHost = 'localhost',
    [int]$Port = 3306,
    [string]$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 9.5\bin'
)

$ErrorActionPreference = 'Stop'

$dumpExe = Join-Path $MySqlBin 'mysqldump.exe'
if (-not (Test-Path $dumpExe)) {
    Write-Host "[LOI] Khong tim thay mysqldump.exe tai: $dumpExe" -ForegroundColor Red
    exit 2
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host "[LOI] Chua co mat khau. Dat bien moi truong MYSQL_PWD hoac truyen -Password." -ForegroundColor Red
    exit 2
}
if ($RetentionDays -lt 1) {
    Write-Host "[LOI] -RetentionDays phai >= 1 (tranh xoa nham ban vua tao)." -ForegroundColor Red
    exit 2
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$sqlPath  = Join-Path $OutputDir "$Database-$stamp.sql"
$zipPath  = Join-Path $OutputDir "$Database-$stamp.zip"
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "[BACKUP] $Database -> $zipPath"

# MYSQL_PWD tranh lo mat khau tren command line (visible trong danh sach tien trinh).
$previousPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $Password
try {
    & $dumpExe `
        --host=$DbHost --port=$Port --user=$DbUser `
        --single-transaction --routines --triggers --events `
        --set-gtid-purged=OFF `
        --default-character-set=utf8mb4 `
        --result-file=$sqlPath `
        $Database
    $dumpExit = $LASTEXITCODE
}
finally {
    $env:MYSQL_PWD = $previousPwd
}

function Remove-PartialDump {
    if (Test-Path $sqlPath) { Remove-Item $sqlPath -Force }
}

if ($dumpExit -ne 0) {
    Remove-PartialDump
    Write-Host "[LOI] mysqldump that bai (exit $dumpExit). Khong tao file backup." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $sqlPath)) {
    Write-Host "[LOI] mysqldump bao thanh cong nhung khong co file $sqlPath." -ForegroundColor Red
    exit 1
}

$sqlSize = (Get-Item $sqlPath).Length
if ($sqlSize -lt 1024) {
    Remove-PartialDump
    Write-Host "[LOI] File dump chi $sqlSize byte - coi nhu that bai." -ForegroundColor Red
    exit 1
}

# mysqldump luon ket thuc bang dong comment "-- Dump completed"; thieu no = file bi cat giua chung.
$tail = Get-Content -Path $sqlPath -Tail 5 -ErrorAction SilentlyContinue
if (-not ($tail -match 'Dump completed')) {
    Remove-PartialDump
    Write-Host "[LOI] File dump khong co marker 'Dump completed' - nghi ngo bi cat ngang." -ForegroundColor Red
    exit 1
}

Compress-Archive -Path $sqlPath -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item $sqlPath -Force

$stopwatch.Stop()
$zipSize = (Get-Item $zipPath).Length

# Don ban cu hon retention.
$cutoff  = (Get-Date).AddDays(-$RetentionDays)
$expired = @(Get-ChildItem -Path $OutputDir -Filter "$Database-*.zip" -File |
             Where-Object { $_.LastWriteTime -lt $cutoff })
foreach ($old in $expired) { Remove-Item $old.FullName -Force }

$kept = @(Get-ChildItem -Path $OutputDir -Filter "$Database-*.zip" -File).Count

Write-Host ("[OK] dump {0:N2} MB -> zip {1:N2} MB ({2:N0}%) trong {3:N1}s" -f `
    ($sqlSize / 1MB), ($zipSize / 1MB), ($zipSize / $sqlSize * 100), $stopwatch.Elapsed.TotalSeconds)
Write-Host "[OK] File: $zipPath"
Write-Host "[OK] Retention $RetentionDays ngay: xoa $($expired.Count) ban cu, con giu $kept ban."
exit 0
