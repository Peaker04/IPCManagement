[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Preflight', 'Backup', 'RestoreDrill')]
    [string]$Mode,

    [string]$Database = 'ipcmanagement',
    [string]$SettingsPath = 'backend/src/IPCManagement.Api/appsettings.json',
    [string]$ProviderAdapterPath,
    [string]$ProviderReceiptPath,
    [string]$ProviderObjectKey,
    [string]$EncryptionKeyReference,
    [string]$RestoreDatabase,
    [string]$DcrClosureArtifactPath,
    [string]$EvidenceDirectory = '.artifacts/shipyard-live/phase-04.2/db/recovery',
    [switch]$Teardown
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $PSScriptRoot 'ImmutableObjectProvider.ps1')

$mysql = 'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe'
$mysqldump = 'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysqldump.exe'
$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
$settings = Join-Path $workspace $SettingsPath
$evidence = Join-Path $workspace $EvidenceDirectory
$encryptionPassword = $env:IPC_BACKUP_ENCRYPTION_PASSWORD

function Assert-File([string]$Path, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label does not exist: $Path"
    }
}

function Assert-SourceDatabase([string]$Name) {
    if ($Name -ne 'ipcmanagement') {
        throw 'Phase 4.2 backup source must be ipcmanagement.'
    }
}

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $([IO.Path]::GetFileName($Executable))"
    }
}

function New-DefaultsFile([string]$RunDirectory) {
    $connector = Join-Path $workspace 'backend/src/IPCManagement.Api/bin/Release/net9.0/MySqlConnector.dll'
    Assert-File $connector 'MySqlConnector Release assembly'
    Add-Type -Path $connector
    $json = Get-Content -Raw -LiteralPath $settings | ConvertFrom-Json
    $builder = New-Object MySqlConnector.MySqlConnectionStringBuilder([string]$json.ConnectionStrings.DefaultConnection)
    $path = Join-Path $RunDirectory 'mysql-client.cnf'
    @(
        '[client]',
        "host=`"$($builder.Server.Replace('`"', '\`"'))`"",
        "port=$($builder.Port)",
        "user=`"$($builder.UserID.Replace('`"', '\`"'))`"",
        "password=`"$($builder.Password.Replace('`"', '\`"'))`""
    ) | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Invoke-MySqlRows([string]$DefaultsFile, [string]$Sql) {
    $output = & $mysql "--defaults-extra-file=$DefaultsFile" '--batch' '--raw' '--skip-column-names' '--execute' $Sql
    if ($LASTEXITCODE -ne 0) { throw 'Database metadata query failed.' }
    return @($output)
}

function Get-DatabaseManifest([string]$DefaultsFile, [string]$DatabaseName, [string]$ClosurePath) {
    Assert-File $ClosurePath 'DCR closure baseline'
    $migrationIds = @(Invoke-MySqlRows $DefaultsFile "SELECT MigrationId FROM ``$DatabaseName``.``__EFMigrationsHistory`` ORDER BY MigrationId;")
    $migrationHead = if ($migrationIds.Count -gt 0) { $migrationIds[-1] } else { $null }
    $tableDefinitions = @(Invoke-MySqlRows $DefaultsFile "SELECT table_name, engine, table_collation FROM information_schema.tables WHERE table_schema='$DatabaseName' AND table_type='BASE TABLE' ORDER BY table_name;")
    $foreignKeyDefinitions = @(Invoke-MySqlRows $DefaultsFile "SELECT table_name, constraint_name, referenced_table_name FROM information_schema.referential_constraints WHERE constraint_schema='$DatabaseName' ORDER BY table_name, constraint_name;")
    $triggerDefinitions = @(Invoke-MySqlRows $DefaultsFile "SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement FROM information_schema.triggers WHERE trigger_schema='$DatabaseName' ORDER BY trigger_name;")
    $tables = @(Invoke-MySqlRows $DefaultsFile "SELECT table_name FROM information_schema.tables WHERE table_schema='$DatabaseName' AND table_type='BASE TABLE' ORDER BY table_name;")
    $rowCounts = [ordered]@{}
    $rowDigests = [ordered]@{}
    foreach ($table in $tables) {
        if ($table -notmatch '^[A-Za-z0-9_]+$') { throw 'Unsafe table name returned by metadata query.' }
        $rowCounts[$table] = [long](Invoke-MySqlRows $DefaultsFile "SELECT COUNT(*) FROM ``$DatabaseName``.``$table``;")[0]
        $rowDigests[$table] = (Invoke-MySqlRows $DefaultsFile "CHECKSUM TABLE ``$DatabaseName``.``$table``;")[0]
    }
    $gtidExecuted = @(Invoke-MySqlRows $DefaultsFile 'SELECT @@GLOBAL.gtid_executed;')
    $binaryLogChain = @(Invoke-MySqlRows $DefaultsFile 'SHOW BINARY LOGS;')
    return [ordered]@{
        migrationIds = $migrationIds
        migrationHead = $migrationHead
        tableDefinitions = $tableDefinitions
        foreignKeyDefinitions = $foreignKeyDefinitions
        triggerDefinitions = $triggerDefinitions
        rowCounts = $rowCounts
        rowDigests = $rowDigests
        dcrClosureBaseline = (Get-FileHash -LiteralPath $ClosurePath -Algorithm SHA256).Hash
        gtidExecuted = $gtidExecuted
        binaryLogChain = $binaryLogChain
    }
}

function Assert-RestoreOracle([object]$Expected, [object]$Actual) {
    foreach ($field in @('migrationIds', 'migrationHead', 'tableDefinitions', 'foreignKeyDefinitions',
            'triggerDefinitions', 'rowCounts', 'rowDigests', 'dcrClosureBaseline', 'gtidExecuted', 'binaryLogChain')) {
        $expectedJson = $Expected.$field | ConvertTo-Json -Depth 20 -Compress
        $actualJson = $Actual.$field | ConvertTo-Json -Depth 20 -Compress
        if ($expectedJson -ne $actualJson) { throw "Restore oracle mismatch: $field" }
    }
}

function Assert-RestoreDatabaseAbsent([string]$DefaultsFile, [string]$DatabaseName) {
    $count = [long](Invoke-MySqlRows $DefaultsFile "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$DatabaseName';")[0]
    if ($count -ne 0) { throw "Restore database still exists after teardown: $DatabaseName" }
}

function Remove-RunOwnedRestoreDatabase([string]$DefaultsFile, [string]$DatabaseName, [string]$RunId, [string]$OwnerRunId) {
    if ($RunId -ne $OwnerRunId) { throw 'Teardown run ownership mismatch.' }
    Invoke-Checked $mysql @("--defaults-extra-file=$DefaultsFile", '--execute', "DROP DATABASE ``$DatabaseName``;")
    Assert-RestoreDatabaseAbsent $DefaultsFile $DatabaseName
}

function Import-ProviderAdapter([string]$Path) {
    Assert-File $Path 'Official provider adapter'
    . (Resolve-Path -LiteralPath $Path).Path
    foreach ($command in @('Upload-ProviderObjectVersion', 'Read-ProviderObjectMetadata', 'Download-ProviderObjectVersion')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Provider adapter is not configured: missing $command"
        }
    }
}

$preflight = [ordered]@{
    mode = $Mode
    sourceDatabase = $Database
    mysqlFound = Test-Path -LiteralPath $mysql
    mysqldumpFound = Test-Path -LiteralPath $mysqldump
    sevenZipFound = Test-Path -LiteralPath $sevenZip
    settingsFound = Test-Path -LiteralPath $settings
    encryptionPasswordConfigured = -not [string]::IsNullOrWhiteSpace($encryptionPassword)
    providerAdapterConfigured = -not [string]::IsNullOrWhiteSpace($ProviderAdapterPath) -and (Test-Path -LiteralPath $ProviderAdapterPath -PathType Leaf)
    providerReceiptConfigured = -not [string]::IsNullOrWhiteSpace($ProviderReceiptPath) -and (Test-Path -LiteralPath $ProviderReceiptPath -PathType Leaf)
    encryptionKeyReferenceConfigured = -not [string]::IsNullOrWhiteSpace($EncryptionKeyReference)
}

if ($Mode -eq 'Preflight') {
    $preflight.status = 'BLOCKED_EXTERNAL'
    if ($preflight.mysqlFound -and $preflight.mysqldumpFound -and $preflight.sevenZipFound -and
        $preflight.settingsFound -and $preflight.encryptionPasswordConfigured -and
        $preflight.providerAdapterConfigured -and $preflight.encryptionKeyReferenceConfigured) {
        $preflight.status = 'READY'
    }
    New-Item -ItemType Directory -Force -Path $evidence | Out-Null
    $preflight | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence 'recovery-preflight.json') -Encoding UTF8
    $preflight | ConvertTo-Json
    exit 0
}

Assert-File $mysql 'mysql client'
Assert-File $mysqldump 'mysqldump'
Assert-File $sevenZip '7-Zip'
Assert-File $settings 'API settings'
Assert-File $DcrClosureArtifactPath 'DCR closure baseline'
if ([string]::IsNullOrWhiteSpace($encryptionPassword)) { throw 'Encryption secret is missing; no archive will be created.' }
if ([string]::IsNullOrWhiteSpace($EncryptionKeyReference)) { throw 'Opaque encryption key reference is missing.' }
Import-ProviderAdapter $ProviderAdapterPath

$runId = "database-recovery-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
$temp = Join-Path ([IO.Path]::GetTempPath()) $runId
New-Item -ItemType Directory -Force -Path $temp, $evidence | Out-Null
$defaultsFile = $null
$ownedRestoreDatabase = $null
try {
    $defaultsFile = New-DefaultsFile $temp
    if ($Mode -eq 'Backup') {
        Assert-SourceDatabase $Database
        if ([string]::IsNullOrWhiteSpace($ProviderObjectKey)) { throw 'Provider object key is missing.' }
        $dump = Join-Path $temp "$Database.sql"
        $innerManifest = Join-Path $temp 'manifest.json'
        $archive = Join-Path $temp "$runId-$Database.7z"
        Invoke-Checked $mysqldump @("--defaults-extra-file=$defaultsFile", '--single-transaction', '--routines',
            '--triggers', '--events', '--hex-blob', '--set-gtid-purged=OFF', '--skip-comments',
            '--skip-add-drop-table', "--result-file=$dump", $Database)
        $manifestData = Get-DatabaseManifest $defaultsFile $Database $DcrClosureArtifactPath
        $manifestData.schemaVersion = 2
        $manifestData.runId = $runId
        $manifestData.database = $Database
        $manifestData.dumpSha256 = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
        $manifestData.dumpBytes = (Get-Item -LiteralPath $dump).Length
        $manifestData.encrypted = $true
        $manifestData.headerEncrypted = $true
        $manifestData | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $innerManifest -Encoding UTF8
        $innerManifestSha256 = (Get-FileHash -LiteralPath $innerManifest -Algorithm SHA256).Hash
        Invoke-Checked $sevenZip @('a', '-t7z', '-mhe=on', "-p$encryptionPassword", $archive, $dump, $innerManifest)
        Invoke-Checked $sevenZip @('t', "-p$encryptionPassword", $archive)
        $archiveSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
        $receipt = Publish-ImmutableObjectVersion -ArchivePath $archive -ObjectKey $ProviderObjectKey `
            -EncryptionKeyReference $EncryptionKeyReference -ProviderAdapter {
                param($ArchivePath, $ObjectKey, $EncryptionKeyReference)
                Upload-ProviderObjectVersion -ArchivePath $ArchivePath -ObjectKey $ObjectKey -EncryptionKeyReference $EncryptionKeyReference
            }
        if ([string]$receipt.archiveSha256 -ne $archiveSha256) { throw 'Uploaded object hash mismatch.' }
        $live = Get-LiveImmutableObjectMetadata -Receipt $receipt -ProviderAdapter {
            param($Receipt) Read-ProviderObjectMetadata -Receipt $Receipt
        }
        Assert-LiveRetentionMatchesReceipt -Receipt $receipt -LiveMetadata $live | Out-Null
        [ordered]@{ runId=$runId; status='BACKUP_PROVIDER_VERIFIED'; innerManifestSha256=$innerManifestSha256; archiveSha256=$archiveSha256; providerReceipt=$receipt } |
            ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $evidence "$runId-backup.json") -Encoding UTF8
        exit 0
    }

    Assert-File $ProviderReceiptPath 'Provider receipt'
    $receipt = Get-Content -Raw -LiteralPath $ProviderReceiptPath | ConvertFrom-Json
    Assert-ProviderReceipt $receipt | Out-Null
    $live = Get-LiveImmutableObjectMetadata -Receipt $receipt -ProviderAdapter {
        param($Receipt) Read-ProviderObjectMetadata -Receipt $Receipt
    }
    Assert-LiveRetentionMatchesReceipt -Receipt $receipt -LiveMetadata $live | Out-Null
    Assert-NewRestoreTarget -DatabaseName $RestoreDatabase -TestDatabaseExists {
        param($DatabaseName)
        [long](Invoke-MySqlRows $defaultsFile "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$DatabaseName';")[0] -ne 0
    } | Out-Null
    $ownedRestoreDatabase = $RestoreDatabase
    $download = Receive-ImmutableObjectVersion -Receipt $receipt -Destination $temp -ProviderAdapter {
        param($Receipt, $Destination) Download-ProviderObjectVersion -Receipt $Receipt -Destination $Destination
    }
    Assert-File $download.archivePath 'Provider-downloaded archive'
    if ((Get-FileHash -LiteralPath $download.archivePath -Algorithm SHA256).Hash -ne [string]$receipt.archiveSha256) {
        throw 'Downloaded provider object hash mismatch.'
    }
    $extract = Join-Path $temp 'extract'
    New-Item -ItemType Directory -Force -Path $extract | Out-Null
    Invoke-Checked $sevenZip @('x', '-y', "-o$extract", "-p$encryptionPassword", $download.archivePath)
    $dump = Get-ChildItem -LiteralPath $extract -Filter '*.sql' | Select-Object -Single
    $manifest = Get-ChildItem -LiteralPath $extract -Filter 'manifest.json' | Select-Object -Single
    $expected = Get-Content -Raw -LiteralPath $manifest.FullName | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $dump.FullName -Algorithm SHA256).Hash -ne $expected.dumpSha256) { throw 'Inner dump hash mismatch.' }
    $forbidden = Select-String -LiteralPath $dump.FullName -Pattern '(?i)^\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\b'
    if ($forbidden) { throw 'Dump contains a forbidden database-switch or destructive statement.' }
    Invoke-Checked $mysql @("--defaults-extra-file=$defaultsFile", '--execute', "CREATE DATABASE ``$RestoreDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    $process = Start-Process -FilePath $mysql -ArgumentList @("--defaults-extra-file=$defaultsFile", "--database=$RestoreDatabase") -RedirectStandardInput $dump.FullName -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0) { throw 'Restore import failed.' }
    $actual = Get-DatabaseManifest $defaultsFile $RestoreDatabase $DcrClosureArtifactPath
    Assert-RestoreOracle -Expected $expected -Actual $actual
    $result = [ordered]@{ runId=$runId; status='RESTORE_VERIFIED'; restoreDatabase=$RestoreDatabase; provider=$receipt.provider; objectKey=$receipt.objectKey; objectVersion=$receipt.objectVersion }
    $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence "$runId-restore.json") -Encoding UTF8
    if ($Teardown) {
        Remove-RunOwnedRestoreDatabase -DefaultsFile $defaultsFile -DatabaseName $RestoreDatabase -RunId $runId -OwnerRunId $runId
        $ownedRestoreDatabase = $null
    }
    $result | ConvertTo-Json
}
finally {
    if ($ownedRestoreDatabase -and $Teardown -and $defaultsFile) {
        Remove-RunOwnedRestoreDatabase -DefaultsFile $defaultsFile -DatabaseName $ownedRestoreDatabase -RunId $runId -OwnerRunId $runId
    }
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
