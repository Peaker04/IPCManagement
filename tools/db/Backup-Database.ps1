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
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$Database = 'ipcmanagement',
    [string]$OutputDir = (Join-Path $env:USERPROFILE 'ipc-backups'),
    [string]$MirrorDir,
    [int]$RetentionDays = 14,
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

$outputRoot = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($OutputDir))
if (-not [string]::IsNullOrWhiteSpace($MirrorDir)) {
    $mirrorRoot = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($MirrorDir))
    if ([string]::Equals($outputRoot, $mirrorRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "[LOI] -MirrorDir phai nam tren volume khac -OutputDir; ca hai dang o '$outputRoot'." -ForegroundColor Red
        exit 2
    }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (-not [string]::IsNullOrWhiteSpace($MirrorDir)) {
    New-Item -ItemType Directory -Force -Path $MirrorDir | Out-Null
}

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$sqlPath  = Join-Path $OutputDir "$Database-$stamp.sql"
$manifestPath = Join-Path $OutputDir "$Database-$stamp.manifest.json"
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
    if (Test-Path $manifestPath) { Remove-Item $manifestPath -Force }
}

function Get-DumpInsertRowCount {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9_]+$')][string]$Table
    )

    $prefix = "INSERT INTO ``$Table`` VALUES "
    $rowCount = 0L
    foreach ($line in [System.IO.File]::ReadLines($Path)) {
        if (-not $line.StartsWith($prefix, [StringComparison]::Ordinal)) {
            continue
        }

        $inString = $false
        $escaped = $false
        $depth = 0
        for ($index = $prefix.Length; $index -lt $line.Length; $index++) {
            $character = $line[$index]
            if ($inString) {
                if ($escaped) {
                    $escaped = $false
                }
                elseif ($character -eq '\') {
                    $escaped = $true
                }
                elseif ($character -eq "'") {
                    $inString = $false
                }
                continue
            }

            if ($character -eq "'") {
                $inString = $true
            }
            elseif ($character -eq '(') {
                if ($depth -eq 0) { $rowCount++ }
                $depth++
            }
            elseif ($character -eq ')') {
                $depth--
                if ($depth -lt 0) {
                    throw "Malformed INSERT for table '$Table': unexpected closing parenthesis."
                }
            }
        }

        if ($inString -or $escaped -or $depth -ne 0) {
            throw "Malformed INSERT for table '$Table': unterminated value list."
        }
    }
    return $rowCount
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

$tableCount = @(Select-String -LiteralPath $sqlPath -Pattern "^CREATE TABLE ``").Count
$stockMovementTableCount = @(Select-String -LiteralPath $sqlPath -Pattern '^CREATE TABLE `stockmovements`').Count
$stockMovementCount = Get-DumpInsertRowCount -Path $sqlPath -Table 'stockmovements'
$migrationIds = @(
    Select-String -LiteralPath $sqlPath -Pattern '^INSERT INTO `__EFMigrationsHistory` VALUES' |
        ForEach-Object {
            foreach ($match in [regex]::Matches($_.Line, "'(20\d{12}_[A-Za-z0-9_]+)'")) {
                $match.Groups[1].Value
            }
        } |
        Where-Object { $_ } |
        Sort-Object -Unique
)
if ($tableCount -lt 1 -or $stockMovementTableCount -ne 1 -or $migrationIds.Count -lt 1) {
    Remove-PartialDump
    Write-Host "[LOI] Khong trich duoc restore evidence tu chinh file dump." -ForegroundColor Red
    exit 1
}
$sqlHash = (Get-FileHash -LiteralPath $sqlPath -Algorithm SHA256).Hash.ToLowerInvariant()
[ordered]@{
    formatVersion = 1
    sourceDatabase = $Database
    createdAtUtc = (Get-Date).ToUniversalTime().ToString('O')
    sqlFileName = [System.IO.Path]::GetFileName($sqlPath)
    sqlSha256 = $sqlHash
    sqlBytes = $sqlSize
    tableCount = [int64]$tableCount
    stockMovementCount = [int64]$stockMovementCount
    migrationCount = [int64]$migrationIds.Count
    latestMigration = $migrationIds[-1]
} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Compress-Archive -Path $sqlPath, $manifestPath -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-PartialDump

$stopwatch.Stop()
$zipSize = (Get-Item $zipPath).Length
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
$mirrorPath = $null
if (-not [string]::IsNullOrWhiteSpace($MirrorDir)) {
    $mirrorPath = Join-Path $MirrorDir ([System.IO.Path]::GetFileName($zipPath))
    Copy-Item -LiteralPath $zipPath -Destination $mirrorPath -Force
    $mirrorHash = (Get-FileHash -LiteralPath $mirrorPath -Algorithm SHA256).Hash
    if (-not [string]::Equals($zipHash, $mirrorHash, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $mirrorPath -Force -ErrorAction SilentlyContinue
        Write-Host "[LOI] Ban mirror khong khop SHA-256 voi backup goc." -ForegroundColor Red
        exit 1
    }
}

# Don ban cu hon retention.
$cutoff  = (Get-Date).AddDays(-$RetentionDays)
$expired = @(Get-ChildItem -Path $OutputDir -Filter "$Database-*.zip" -File |
             Where-Object { $_.LastWriteTime -lt $cutoff })
foreach ($old in $expired) { Remove-Item $old.FullName -Force }
if (-not [string]::IsNullOrWhiteSpace($MirrorDir)) {
    $expiredMirror = @(Get-ChildItem -Path $MirrorDir -Filter "$Database-*.zip" -File |
        Where-Object { $_.LastWriteTime -lt $cutoff })
    foreach ($old in $expiredMirror) { Remove-Item $old.FullName -Force }
}

$kept = @(Get-ChildItem -Path $OutputDir -Filter "$Database-*.zip" -File).Count

Write-Host ("[OK] dump {0:N2} MB -> zip {1:N2} MB ({2:N0}%) trong {3:N1}s" -f `
    ($sqlSize / 1MB), ($zipSize / 1MB), ($zipSize / $sqlSize * 100), $stopwatch.Elapsed.TotalSeconds)
Write-Host "[OK] File: $zipPath"
if ($mirrorPath) { Write-Host "[OK] Mirror: $mirrorPath (SHA-256 verified)" }
Write-Host "[OK] Retention $RetentionDays ngay: xoa $($expired.Count) ban cu, con giu $kept ban."
exit 0
