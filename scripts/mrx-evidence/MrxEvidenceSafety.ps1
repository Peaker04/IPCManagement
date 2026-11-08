Set-StrictMode -Version Latest

function Get-MrxBuildInputs {
    param([Parameter(Mandatory = $true)][string]$RepoRoot, [Parameter(Mandatory = $true)][ValidateSet('Frontend','Backend')][string]$Kind)
    $files = [Collections.Generic.List[string]]::new()
    $source = if ($Kind -eq 'Frontend') { 'frontend/src','frontend/public' } else { 'backend/src' }
    foreach ($relative in $source) {
        $directory = Join-Path $RepoRoot $relative
        if (Test-Path -LiteralPath $directory) {
            foreach ($file in Get-ChildItem -LiteralPath $directory -File -Recurse -Force) {
                if ($file.FullName -match '[\\/](?:bin|obj|__tests__|test)[\\/]|\.(?:test|spec)\.[^\\/]+$') { continue }
                Assert-MrxCampaignPath -Path $file.FullName -Root $RepoRoot | Out-Null
                $files.Add($file.FullName)
            }
        }
    }
    $directories = if ($Kind -eq 'Frontend') { @($RepoRoot, (Join-Path $RepoRoot 'frontend')) } else { @($RepoRoot, (Join-Path $RepoRoot 'backend')) }
    $pattern = if ($Kind -eq 'Frontend') { '^(package.*\.json|tsconfig.*\.json|vite\.config\..*|index\.html|\.env.*|\.npmrc)$' } else { '^(Directory\..*\.(props|targets)|global\.json|[Nn]u[Gg]et\.[Cc]onfig|.*\.slnx)$' }
    foreach ($directory in $directories) {
        if (Test-Path -LiteralPath $directory) {
            foreach ($file in Get-ChildItem -LiteralPath $directory -File -Force | Where-Object { $_.Name -match $pattern }) { $files.Add($file.FullName) }
        }
    }
    $toolInputs = if ($Kind -eq 'Frontend') {
        @('node_modules/vite/package.json','node_modules/typescript/package.json','frontend/node_modules/vite/package.json','frontend/node_modules/typescript/package.json')
    } else { @('.artifacts/dotnet/obj/IPCManagement.Api/project.assets.json') }
    foreach ($relative in $toolInputs) {
        $file = Join-Path $RepoRoot $relative
        if (Test-Path -LiteralPath $file -PathType Leaf) { $files.Add($file) }
    }
    $inputs = [ordered]@{}
    $prefix = [IO.Path]::GetFullPath($RepoRoot).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    foreach ($file in @($files | Sort-Object -Unique)) {
        Assert-MrxCampaignPath -Path $file -Root $RepoRoot | Out-Null
        $inputs[$file.Substring($prefix.Length).Replace('\','/')] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    }
    $tool = if ($Kind -eq 'Frontend') { 'node' } else { 'dotnet' }
    $version = (& $tool --version) -join ''
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($version)) { throw 'Cannot verify installed build tool version.' }
    $inputs['<build-tool-version>'] = $version
    $environment = [ordered]@{}
    $environmentPattern = if ($Kind -eq 'Frontend') { '^(VITE_|NODE_ENV$)' } else { '^(DOTNET_|MSBuild)' }
    foreach ($variable in @(Get-ChildItem Env: | Where-Object { $_.Name -match $environmentPattern } | Sort-Object Name)) {
        $environment[$variable.Name] = Get-MrxEvidenceTextHash -Text $variable.Value
    }
    $inputs['<build-environment>'] = Get-MrxEvidenceTextHash -Text ($environment | ConvertTo-Json -Compress)
    return @{ key = Get-MrxEvidenceTextHash -Text ($inputs | ConvertTo-Json -Compress); files = $inputs }
}

function Get-MrxBuildOutputs {
    param([string]$RepoRoot, [ValidateSet('Frontend','Backend')][string]$Kind)
    $relative = if ($Kind -eq 'Frontend') { 'frontend/dist' } else { '.artifacts/dotnet/bin/IPCManagement.Api/release' }
    $root = Join-Path $RepoRoot $relative
    $files = [ordered]@{}
    if (Test-Path -LiteralPath $root) {
        foreach ($file in @(Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName)) {
            Assert-MrxCampaignPath -Path $file.FullName -Root $RepoRoot | Out-Null
            $files[$file.FullName.Substring($RepoRoot.TrimEnd('\','/').Length + 1)] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }
    return @{ fileCount=$files.Count; key=Get-MrxEvidenceTextHash -Text ($files | ConvertTo-Json -Compress); files=$files }
}

function Get-MrxCampaignStorage {
    param([Parameter(Mandatory = $true)][string]$Root, [string]$WorkingDirectory, [int64]$ReserveBytes = 268435456)
    if ($ReserveBytes -lt 0) { throw 'Invalid campaign storage reservation.' }
    $bytes = [int64]0; $count = 0; $watch = [Diagnostics.Stopwatch]::StartNew()
    $pending = [Collections.Generic.Stack[string]]::new()
    foreach ($directory in @($Root,$WorkingDirectory)) {
        if ($directory -and (Test-Path -LiteralPath $directory)) {
            $full = [IO.Path]::GetFullPath($directory)
            # Windows PowerShell 5 needs extended paths for nested Playwright trace attachments.
            if ($full.StartsWith('\\')) { $full = '\\?\UNC\' + $full.Substring(2) }
            elseif ([IO.Path]::DirectorySeparatorChar -eq '\') { $full = '\\?\' + $full }
            $pending.Push($full)
        }
    }
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        if (([IO.File]::GetAttributes($directory) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Storage accounting refuses reparse paths.' }
        foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($directory)) {
            if ($watch.ElapsedMilliseconds -gt 3000 -or ++$count -gt 10000) { throw 'Campaign storage reconciliation exceeded its bounded budget; usage is unknown, not zero.' }
            $attributes = [IO.File]::GetAttributes($entry)
            if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Storage accounting refuses reparse paths.' }
            if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $pending.Push($entry); $count-- }
            else { $bytes += ([IO.FileInfo]::new($entry)).Length }
        }
    }
    $free = ([IO.DriveInfo]::new([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Root)))).AvailableFreeSpace
    if ($bytes + $ReserveBytes -gt 4294967296 -or $free -lt $ReserveBytes) { throw "Campaign hard storage/headroom cap reached: measuredBytes=$bytes, freeBytes=$free, reserveBytes=$ReserveBytes; evidence retained and new work denied." }
    if ($bytes -ge 2147483648) { Write-Warning 'Campaign soft storage cap reached (2GiB).' }
    return @{ bytes=$bytes; fileCount=$count; freeBytes=$free; softCapBytes=[int64]2147483648; hardCapBytes=[int64]4294967296 }
}

function Assert-MrxCampaignInvocation {
    param([string]$Mode, [string]$Profile, [string]$CampaignId, [string]$Diagnostic)
    if ($Diagnostic -eq 'MenuIntegrityPerformance' -and ($Profile -cne 'Qualification' -or $Mode -notin @('Preflight','Execute') -or $CampaignId)) {
        throw 'MenuIntegrityPerformance requires a fresh Qualification Preflight/Execute, never G1 or a retained campaign.'
    }
    if ($Mode -eq 'Run' -and $env:MRX_COORDINATED_TAIL_RECEIPT -and $Diagnostic -cne 'RepairCheck') { throw 'Retained-member continuation is diagnostic-only RepairCheck, never full lifecycle acceptance.' }
    if ($Mode -eq 'Execute' -and $CampaignId) { throw 'Legacy Execute cannot resume or replace a campaign.' }
    if ($Mode -in @('Start','Run','Finish','Abort') -or $CampaignId) {
        if ($Profile -cne 'Qualification') { throw 'Campaign commands require Qualification profile.' }
        Assert-MrxEvidenceTarget -DatabaseName "ipc_mrx_evidence_$CampaignId" -RunId $CampaignId | Out-Null
        if ($Mode -notin @('Preflight','Start','Run','Finish','Abort')) { throw 'Invalid campaign command.' }
        if ($Mode -eq 'Run') {
            if ($Diagnostic -notin @('Admission','Golden','Supplemental','Race','Recovery','Session','SupplementalRecovery','CombinedFE','SourceCustomer','LifecycleAcceptance','RepairCheck')) {
                throw 'Campaign Run requires an explicit currently admitted functional selector; quantitative phases are not admitted.'
            }
        } elseif ($Diagnostic) { throw 'Campaign diagnostics are valid only for Run.' }
    }
}

function Get-MrxCampaignPaths {
    param([Parameter(Mandatory = $true)][string]$RepoRoot, [Parameter(Mandatory = $true)][string]$CampaignId)
    $database = "ipc_mrx_evidence_$CampaignId"
    Assert-MrxEvidenceTarget -DatabaseName $database -RunId $CampaignId | Out-Null
    $root = [IO.Path]::GetFullPath((Join-Path $RepoRoot ".artifacts/mrx-evidence/$CampaignId"))
    return [ordered]@{
        root = $root; database = $database; receipt = Join-Path $root 'campaign.json'
        credentials = Join-Path $root 'credentials.dpapi'; lock = Join-Path $root 'campaign.lock'
    }
}

function Assert-MrxCampaignPath {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Root)
    $full = [IO.Path]::GetFullPath($Path)
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Campaign path escapes its owned directory.' }
    $current = $full
    while (-not [string]::IsNullOrEmpty($current)) {
        if (Test-Path -LiteralPath $current) {
            if (((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Campaign paths cannot traverse reparse points.'
            }
        }
        $current = [IO.Path]::GetDirectoryName($current)
    }
    return $full
}

function Read-MrxCampaignReceipt {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$CampaignId,
        [Parameter(Mandatory = $true)][string]$Database
    )
    Assert-MrxEvidenceTarget -DatabaseName $Database -RunId $CampaignId | Out-Null
    $root = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    if ([IO.Path]::GetFileName($root) -cne $CampaignId -or [IO.Path]::GetFileName($Path) -cne 'campaign.json') { throw 'Campaign receipt location is invalid.' }
    Assert-MrxCampaignPath -Path $Path -Root $root | Out-Null
    $receipt = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($receipt.schemaVersion -ne 1 -or $receipt.campaignId -cne $CampaignId -or $receipt.database -cne $Database -or
        $receipt.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or
        $receipt.principalName -cne "mrx_$CampaignId" -or [string]::IsNullOrWhiteSpace($receipt.serverIdentity) -or
        $receipt.schemaHash -cnotmatch '^[A-Fa-f0-9]{64}$' -or @($receipt.migrationIds).Count -eq 0) { throw 'Campaign receipt identity is invalid.' }
    [DateTimeOffset]::Parse($receipt.createdAtUtc, [Globalization.CultureInfo]::InvariantCulture) | Out-Null
    $credentials = Assert-MrxCampaignPath -Path $receipt.encryptedCredentialsPath -Root $root
    $source = Assert-MrxCampaignPath -Path $receipt.sourceManifestPath -Root $root
    if ($credentials -cne (Join-Path $root 'credentials.dpapi') -or $source -cne (Join-Path $root 'source-manifest.json')) { throw 'Campaign receipt private paths are invalid.' }
    foreach ($prerequisite in @($receipt.prerequisiteReceiptPaths)) { Assert-MrxCampaignPath -Path $prerequisite -Root $root | Out-Null }
    return $receipt
}

function Enter-MrxCampaignLock {
    param([Parameter(Mandatory = $true)][string]$Path)
    Assert-MrxCampaignPath -Path $Path -Root ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) | Out-Null
    return [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}

function Protect-MrxCampaignCredentials {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Credentials)
    Assert-MrxCampaignPath -Path $Path -Root ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) | Out-Null
    Add-Type -AssemblyName System.Security
    $plain = [Text.Encoding]::UTF8.GetBytes(($Credentials | ConvertTo-Json -Depth 12 -Compress))
    try { $encrypted = [Security.Cryptography.ProtectedData]::Protect($plain, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser) }
    finally { [Array]::Clear($plain, 0, $plain.Length) }
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $acl = [Security.AccessControl.FileSecurity]::new()
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetOwner($sid)
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, [Security.AccessControl.FileSystemRights]::FullControl, [Security.AccessControl.AccessControlType]::Allow))
        Set-Acl -LiteralPath $Path -AclObject $acl
        $stream.Write($encrypted, 0, $encrypted.Length)
    } finally { $stream.Dispose() }
}

function Unprotect-MrxCampaignCredentials {
    param([Parameter(Mandatory = $true)][string]$Path)
    Assert-MrxCampaignPath -Path $Path -Root ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))) | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl = Get-Acl -LiteralPath $Path
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid -or -not $acl.AreAccessRulesProtected -or
        @($rules | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -cne $sid }).Count -ne 0) { throw 'Campaign credential ACL is not private to the current owner.' }
    Add-Type -AssemblyName System.Security
    $plain = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($Path), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { return [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json }
    finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Get-MrxMenuIntegrityPerformancePhases {
    return [ordered]@{
        functional = '@G6-Menu-Coverage'
        adversarial = '@G6-Direct-Source-Edit|@G4-Race|@G5-Recovery Committed initial|@G5-Recovery Committed supplemental|@G5-Session'
        'data-path-performance' = '@G7-Data-Path'
    }
}

function Get-MrxLifecycleAcceptancePhases {
    return [ordered]@{
        functional = '@G1-Golden|Stock oracle rejects|@G2-(Admission|RBAC)|@G3-Submitted|@G4-Race|@G5-(Recovery|Session|Coordinated)|@G6-(Direct-Source-Edit|Merged-Customer)'
    }
}

function ConvertTo-MrxNativeArgument {
    [CmdletBinding()]
    param([AllowEmptyString()][string]$Value)

    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function ConvertFrom-MrxConnectionString {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$ConnectionString)

    $builder = [System.Data.Common.DbConnectionStringBuilder]::new()
    $builder.set_ConnectionString($ConnectionString)
    return $builder
}

function Assert-MrxEvidenceSource {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$DatabaseName)

    if (-not [string]::Equals($DatabaseName.Trim(), 'ipcmanagement', [StringComparison]::OrdinalIgnoreCase)) {
        throw "MRX evidence source must be exact database 'ipcmanagement'."
    }

    return $DatabaseName.Trim()
}

function Assert-MrxEvidenceTarget {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][string]$RunId
    )

    if ($RunId -cnotmatch '^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$') {
        throw "MRX evidence run ID has an invalid format."
    }

    $expected = "ipc_mrx_evidence_$RunId"
    if (-not [string]::Equals($DatabaseName, $expected, [StringComparison]::Ordinal)) {
        throw "MRX evidence target must be the exact database owned by this run."
    }

    return $DatabaseName
}

function Assert-MrxEvidenceSubordinateTarget {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][string]$ParentDatabaseName,
        [Parameter(Mandatory = $true)][ValidateSet('integration')][string]$Purpose
    )

    if ($ParentDatabaseName -cnotmatch '^ipc_mrx_evidence_[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$' -or
        -not [string]::Equals($DatabaseName, "${ParentDatabaseName}_$Purpose", [StringComparison]::Ordinal)) {
        throw 'MRX evidence subordinate target must belong to the current parent database.'
    }

    return $DatabaseName
}

function New-MrxScenarioWorkbook {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$TemplatePath,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [Parameter(Mandatory = $true)][string]$WeekStartDate
    )
    $monday = [DateTime]::ParseExact($WeekStartDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
    if ($monday.DayOfWeek -ne [DayOfWeek]::Monday) { throw 'Scenario workbook requires a Monday.' }
    if ([IO.Path]::GetFullPath($TemplatePath) -eq [IO.Path]::GetFullPath($OutputPath)) { throw 'Cannot overwrite canonical workbook.' }
    [IO.File]::Copy($TemplatePath, $OutputPath, $false)
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::Open($OutputPath, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $entry = $zip.GetEntry('xl/sharedStrings.xml')
        if ($null -eq $entry) { throw 'Canonical workbook shared date cells are missing.' }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
        for ($day = 0; $day -lt 6; $day++) {
            $sourceDate = [DateTime]::new(2026, 7, 20).AddDays($day).ToString('dd/MM/yyyy')
            if (-not $text.Contains($sourceDate)) { throw 'Canonical workbook date layout changed; do not fabricate a shifted workbook.' }
            $text = $text.Replace($sourceDate, $monday.AddDays($day).ToString('dd/MM/yyyy'))
        }
        $entry.Delete()
        $writer = [IO.StreamWriter]::new($zip.CreateEntry('xl/sharedStrings.xml').Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write($text) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
}

function Get-MrxEvidenceTextHash {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))).Replace('-', '') }
    finally { $sha.Dispose() }
}

function Get-MrxQualificationBCryptPath {
    $project = [xml](Get-Content -Raw (Join-Path $PSScriptRoot '../../backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj'))
    $version = $project.SelectSingleNode("//PackageReference[@Include='BCrypt.Net-Next']").Version
    $packages = if ($env:NUGET_PACKAGES) { $env:NUGET_PACKAGES } else { Join-Path $env:USERPROFILE '.nuget/packages' }
    $library = Join-Path $packages "bcrypt.net-next/$version/lib/net462/BCrypt-Net-Next.dll"
    if (-not (Test-Path -LiteralPath $library -PathType Leaf)) { throw 'Installed BCrypt framework-compatible library is required; no installation is permitted.' }
    return $library
}

function New-MrxQualificationAccounts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$PrivateDirectory
    )
    Assert-MrxEvidenceTarget -DatabaseName $DatabaseName -RunId $RunId | Out-Null
    $directory = [IO.Path]::GetFullPath($PrivateDirectory).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ([IO.Path]::GetFileName($directory) -cne $RunId) { throw 'Account bootstrap files must belong to the exact run directory.' }
    $credentialsPath = Join-Path $directory 'qualification-credentials.json'
    $sqlPath = Join-Path $directory 'qualification-users.sql'
    $databaseConfigPath = Join-Path $directory 'qualification-db.json'
    $databaseSqlPath = Join-Path $directory 'qualification-db.sql'
    if (@($credentialsPath, $sqlPath, $databaseConfigPath, $databaseSqlPath | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0) {
        throw 'Refusing to overwrite existing qualification account files.'
    }
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls.exe $directory '/inheritance:r' '/grant:r' "*${sid}:(OI)(CI)(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not restrict account bootstrap directory ACLs.' }
    [Reflection.Assembly]::LoadFrom((Get-MrxQualificationBCryptPath)) | Out-Null
    $roles = [ordered]@{ admin = 'ADMIN'; dieuphoi = 'COORDINATOR'; thukho = 'WAREHOUSESTAFF'; beptruong = 'CHEF'; manager = 'MANAGER' }
    $credentials = [ordered]@{}
    $sql = [Collections.Generic.List[string]]::new()
    $sql.Add('USE `' + $DatabaseName + '`;')
    $sql.Add('START TRANSACTION;')
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        foreach ($role in $roles.Keys) {
            $bytes = New-Object byte[] 32
            $random.GetBytes($bytes)
            $password = [Convert]::ToBase64String($bytes)
            $username = "mrx_${RunId}_$role"
            $hash = [BCrypt.Net.BCrypt]::HashPassword($password, 11, $false)
            $id = [Guid]::NewGuid().ToString('N')
            $credentials[$role] = [ordered]@{ username = $username; password = $password }
            $sql.Add("INSERT INTO users (userId, fullName, username, passwordHash, roleId, isActive, createdAt) SELECT UNHEX('$id'), 'MRX qualification $role', '$username', '$hash', roleId, 1, UTC_TIMESTAMP() FROM roles WHERE roleCode = '$($roles[$role])';")
        }
        $random.GetBytes($bytes)
        $databasePassword = [Convert]::ToBase64String($bytes)
        $random.GetBytes($bytes)
        $databaseConfig = [ordered]@{ username = "mrx_$RunId"; password = $databasePassword; jwtSecret = [Convert]::ToBase64String($bytes) }
    } finally { $random.Dispose() }
    $sql.Add('COMMIT;')
    $principal = "'$($databaseConfig.username)'@'127.0.0.1'"
    $attribute = '{"mrxEvidenceRunId":"' + $RunId + '"}'
    $databaseSql = "CREATE USER $principal IDENTIFIED BY '$databasePassword' ATTRIBUTE '$attribute';`nGRANT SELECT, INSERT, UPDATE, DELETE ON ``$DatabaseName``.* TO $principal;"
    $files = @{
        $credentialsPath = ($credentials | ConvertTo-Json); $sqlPath = ($sql -join "`n")
        $databaseConfigPath = ($databaseConfig | ConvertTo-Json); $databaseSqlPath = $databaseSql
    }
    foreach ($file in $files.Keys) {
        $stream = [IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
        try { $writer.Write($files[$file]) } finally { $writer.Dispose() }
    }
}

function Assert-MrxEvidenceTargetAbsent {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][scriptblock]$ReadDatabaseCount
    )

    $count = & $ReadDatabaseCount $DatabaseName
    if ([int64]$count -ne 0) {
        throw "MRX evidence target '$DatabaseName' already exists."
    }
}
