[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceConnectionName,

    [Parameter(Mandatory = $true)]
    [string]$TargetConnectionName,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [Parameter(Mandatory = $true)]
    [switch]$ConfirmIsolatedTarget,

    [string]$ConnectionsFile = ".secrets/bom-connections.json",
    [string]$MySqlPath,
    [string]$MySqlDumpPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Utf8NoBom {
    param([string]$Path, [string[]]$Lines)
    $content = if ($Lines.Count -eq 0) { "" } else { ($Lines -join "`n") + "`n" }
    [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
}

function Get-ProfileEnvironmentName {
    param([string]$Name)
    return "IPC_BOM_CONNECTION_$(($Name -replace '[^A-Za-z0-9]', '_').ToUpperInvariant())"
}

function Resolve-ConnectionProfile {
    param([string]$Name, [string]$FilePath)

    $environmentName = Get-ProfileEnvironmentName -Name $Name
    $value = [Environment]::GetEnvironmentVariable($environmentName)
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [Environment]::GetEnvironmentVariable("ConnectionStrings__$Name")
    }
    if ([string]::IsNullOrWhiteSpace($value) -and (Test-Path -LiteralPath $FilePath)) {
        $profiles = Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json
        $property = $profiles.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
        if ($property) { $value = [string]$property.Value }
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Connection profile '$Name' was not found. Set $environmentName, ConnectionStrings__$Name, or use the local untracked profile file."
    }

    $parts = @{}
    foreach ($segment in ($value -split ';')) {
        if ([string]::IsNullOrWhiteSpace($segment) -or $segment -notmatch '=') { continue }
        $pair = $segment -split '=', 2
        $parts[$pair[0].Trim().ToLowerInvariant()] = $pair[1].Trim()
    }
    function First-ConnectionValue {
        param([string[]]$Keys)
        foreach ($key in $Keys) {
            if ($parts.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($parts[$key])) { return [string]$parts[$key] }
        }
        return $null
    }

    $profile = [ordered]@{
        Server = First-ConnectionValue @('server', 'host', 'data source')
        Port = First-ConnectionValue @('port')
        Database = First-ConnectionValue @('database', 'initial catalog')
        User = First-ConnectionValue @('user', 'user id', 'uid', 'username')
        Password = First-ConnectionValue @('password', 'pwd')
    }
    if ([string]::IsNullOrWhiteSpace($profile.Port)) { $profile.Port = '3306' }
    foreach ($required in @('Server', 'Database', 'User')) {
        if ([string]::IsNullOrWhiteSpace($profile[$required])) { throw "Connection profile '$Name' is missing $required." }
    }
    return $profile
}

function Resolve-Tool {
    param([string]$ToolName, [string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $resolved = Resolve-Path -LiteralPath $RequestedPath -ErrorAction SilentlyContinue
        if (-not $resolved) { throw "$ToolName executable not found at the requested path." }
        return $resolved.Path
    }
    $command = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidateDirectories = @(
        'C:\Program Files\MySQL\MySQL Server 9.5\bin',
        'C:\Program Files\MySQL\MySQL Server 8.4\bin',
        'C:\Program Files\MySQL\MySQL Server 8.0\bin',
        'C:\xampp\mysql\bin'
    )
    foreach ($directory in $candidateDirectories) {
        $candidate = Join-Path $directory "$ToolName.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw "$ToolName CLI is required. Supply its explicit path or add it to PATH."
}

function New-ProcessStartInfo {
    param([string]$Executable, [string[]]$Arguments, [string]$Password)

    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardError = $true
    foreach ($argument in $Arguments) {
        if ($argument -match '[\s"]') {
            throw "Unsafe whitespace or quote in a database command argument."
        }
    }
    $info.Arguments = $Arguments -join ' '
    $info.EnvironmentVariables['MYSQL_PWD'] = $Password
    return $info
}

function Invoke-Backup {
    param([System.Collections.IDictionary]$Profile, [string]$Executable, [string]$Destination)

    $arguments = @(
        "--host=$($Profile.Server)", "--port=$($Profile.Port)", "--user=$($Profile.User)",
        '--default-character-set=utf8mb4', '--single-transaction', '--routines', '--triggers', '--events',
        '--hex-blob', '--set-gtid-purged=OFF', '--no-tablespaces', $Profile.Database
    )
    $info = New-ProcessStartInfo -Executable $Executable -Arguments $arguments -Password $Profile.Password
    $info.RedirectStandardOutput = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    [void]$process.Start()
    $errorTask = $process.StandardError.ReadToEndAsync()
    $stream = [System.IO.File]::Open($Destination, [System.IO.FileMode]2, [System.IO.FileAccess]2, [System.IO.FileShare]0)
    try { $process.StandardOutput.BaseStream.CopyTo($stream) } finally { $stream.Dispose() }
    $process.WaitForExit()
    $errorText = $errorTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw "Backup command failed: $($errorText.Trim())" }
}

function Invoke-Restore {
    param([System.Collections.IDictionary]$Profile, [string]$Executable, [string]$SourceFile)

    $arguments = @(
        "--host=$($Profile.Server)", "--port=$($Profile.Port)", "--user=$($Profile.User)",
        "--database=$($Profile.Database)", '--default-character-set=utf8mb4'
    )
    $info = New-ProcessStartInfo -Executable $Executable -Arguments $arguments -Password $Profile.Password
    $info.RedirectStandardInput = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    [void]$process.Start()
    $errorTask = $process.StandardError.ReadToEndAsync()
    $stream = [System.IO.File]::OpenRead($SourceFile)
    try { $stream.CopyTo($process.StandardInput.BaseStream) } finally { $stream.Dispose(); $process.StandardInput.Close() }
    $process.WaitForExit()
    $errorText = $errorTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw "Restore command failed for the confirmed clone: $($errorText.Trim())" }
}

if (-not $ConfirmIsolatedTarget) { throw "-ConfirmIsolatedTarget is mandatory." }
if ($SourceConnectionName -eq $TargetConnectionName) { throw "Source and target profile names must differ." }

$source = Resolve-ConnectionProfile -Name $SourceConnectionName -FilePath $ConnectionsFile
$target = Resolve-ConnectionProfile -Name $TargetConnectionName -FilePath $ConnectionsFile
$sourceIdentity = "$($source.Server):$($source.Port)/$($source.Database)".ToLowerInvariant()
$targetIdentity = "$($target.Server):$($target.Port)/$($target.Database)".ToLowerInvariant()
if ($sourceIdentity -eq $targetIdentity) { throw "Source and target resolve to the same database identity." }
if ($target.Database -match '^(ipcmanagement|production|prod)$' -or $target.Database -notmatch '(clone|restore|rehearsal|sandbox|test)') {
    throw "Target schema name is protected. Use a dedicated clone/restore/rehearsal/sandbox/test schema."
}

$mysql = Resolve-Tool -ToolName 'mysql' -RequestedPath $MySqlPath
$dump = Resolve-Tool -ToolName 'mysqldump' -RequestedPath $MySqlDumpPath
$baselineScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'Get-BomSafetyBaseline.ps1')).Path

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
$sourceBaseline = Join-Path $resolvedOutput 'source-baseline'
$restoredBaseline = Join-Path $resolvedOutput 'restored-baseline'
$backupFile = Join-Path $resolvedOutput 'bom-v1.1-backup.sql'

& powershell -NoProfile -ExecutionPolicy Bypass -File $baselineScript -ConnectionName $SourceConnectionName -OutputDirectory $sourceBaseline -ConnectionsFile $ConnectionsFile -MySqlPath $mysql
if ($LASTEXITCODE -ne 0) { throw "Source baseline failed." }

Invoke-Backup -Profile $source -Executable $dump -Destination $backupFile
$backupHash = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash.ToLowerInvariant()
$backupId = "BOMV11-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))-$($backupHash.Substring(0,12))"

Invoke-Restore -Profile $target -Executable $mysql -SourceFile $backupFile

& powershell -NoProfile -ExecutionPolicy Bypass -File $baselineScript -ConnectionName $TargetConnectionName -OutputDirectory $restoredBaseline -ConnectionsFile $ConnectionsFile -MySqlPath $mysql
if ($LASTEXITCODE -ne 0) { throw "Restored-clone baseline failed." }

$sourceImmutable = Get-Content -LiteralPath (Join-Path $sourceBaseline 'immutable-checksums.csv')
$targetImmutable = Get-Content -LiteralPath (Join-Path $restoredBaseline 'immutable-checksums.csv')
$immutableDifference = Compare-Object $sourceImmutable $targetImmutable
if ($immutableDifference) { throw "Immutable checksum mismatch after isolated restore." }

$sourceManifest = Get-Content -Raw -LiteralPath (Join-Path $sourceBaseline 'baseline-manifest.json') | ConvertFrom-Json
$metadata = [ordered]@{
    BackupId = $backupId
    BackupSha256 = $backupHash
    BackupFile = 'bom-v1.1-backup.sql'
    SourceConnectionProfile = $SourceConnectionName
    SourceSchema = $source.Database
    SourceSchemaFingerprintSha256 = $sourceManifest.SchemaFingerprintSha256
    TargetConnectionProfile = $TargetConnectionName
    TargetSchema = $target.Database
    TargetIsolationConfirmed = $true
    ImmutableChecksumEquality = 'PASS'
    CompletedAtUtc = [DateTime]::UtcNow.ToString('o')
}
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'recovery-metadata.json') -Lines @(($metadata | ConvertTo-Json -Depth 4))
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'recovery-result.md') -Lines @(
    '# BOM v1.1 recovery rehearsal', '',
    "- Status: PASS", "- Backup ID: $backupId", "- Backup SHA-256: $backupHash",
    "- Source profile/schema: $SourceConnectionName / $($source.Database)",
    "- Isolated target profile/schema: $TargetConnectionName / $($target.Database)",
    '- Immutable checksum equality: PASS', '- Credentials and absolute executable paths are intentionally omitted.'
)

Write-Output "BOM backup/restore rehearsal PASS."
Write-Output "backupId=$backupId"
Write-Output "backupSha256=$backupHash"
