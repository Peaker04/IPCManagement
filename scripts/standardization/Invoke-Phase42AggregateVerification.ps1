[CmdletBinding()]
param(
    [switch]$ContractOnly,
    [switch]$HygieneOnly,
    [switch]$FailFast,
    [string]$GateSpec = 'scripts/standardization/phase42-verification-gates.json',
    [string]$Output,
    [string]$RunId,
    [string]$ArchiveRunId,
    [string]$ArchiveReceipt,
    [string]$ApprovalReceipt,
    [string]$Target,
    [string]$Database,
    [string]$MigrationHead,
    [string]$StopAfter,
    [string]$Only,
    [string]$Manifest,
    [string]$Approval,
    [string]$Settings = 'backend/src/IPCManagement.Api/appsettings.json',
    [string]$EvidenceRoot = '.artifacts/shipyard-live/phase-04.2',
    [string[]]$AdditionalScanPath = @()
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$PSDefaultParameterValues['Get-Content:Encoding'] = 'UTF8'
$script:VerifierVersion = '3.0.0-d05'
$script:SelectorRejected = $false
$script:SelectorContract = $null
$script:ExpectedPackageSha256 = 'C281CB92E66939657680F0D31CA80B4A3451F5EE71A94745DBD60335DAE66EC2'
$script:ExpectedApprovalReceiptSha256 = '158C35AAD17463DAD851CB4662A1C69B0252F8B375134446DF63CCAF4E0F90E2'
$script:BackupTables = @(
    'backup_bomadjustments_20260717_141300',
    'backup_dishbom_20260717_141300',
    'backup_dishes_20260717_141300',
    'backup_ingredients_20260717_141300',
    'backup_materialrequestlines_bom_20260717_141300',
    'backup_menuitems_20260717_141300',
    'backup_menuitems_pre2026_20260717_141300'
)

function Get-Sha256Text([AllowEmptyString()][string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') }
    finally { $sha.Dispose() }
}

function Get-Sha256File([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Assert-D03Topology($Value, [string]$Label) {
    $classification = if ($Value.PSObject.Properties.Name -contains 'recoveryClassification') {
        [string]$Value.recoveryClassification
    } else {
        [string]$Value.classification
    }
    if ($classification -ne 'ACCEPTED_LOCAL_ONLY_RISK') {
        throw "$Label recovery classification is not ACCEPTED_LOCAL_ONLY_RISK."
    }
    foreach ($field in @('sameHost', 'samePhysicalNvme')) {
        if ($Value.$field -ne $true) { throw "$Label requires $field=true." }
    }
    foreach ($field in @('offSite', 'worm', 'independentSecurityDomain')) {
        if ($Value.$field -ne $false) { throw "$Label requires $field=false." }
    }
    $activeText = $Value | ConvertTo-Json -Depth 30
    if ($activeText -match '(?i)"(providerReference|accountReference|credentialReference|objectVersion|retentionLock|legalHold|immutableInfrastructure)"\s*:') {
        throw "$Label contains an active provider-shaped field."
    }
}

function Assert-D03Retention($Value, [string]$Label) {
    $tables = @($Value.tables)
    if ($tables.Count -ne $script:BackupTables.Count -or (@(Compare-Object $script:BackupTables $tables).Count -ne 0)) {
        throw "$Label does not retain the exact seven backup tables."
    }
    if ($Value.retained -ne $true -or [string]$Value.dropSqlStatus -ne 'DORMANT_FORBIDDEN_UNDER_D03') {
        throw "$Label does not enforce D-03 retention/dormancy."
    }
    foreach ($field in @('dropExecution', 'cleanupRehearsal', 'rollbackExtractRehearsal', 'cleanupApproval', 'baseCleanupPromotion')) {
        if ([string]$Value.$field -ne 'NOT_RUN_DORMANT_D03') { throw "$Label activated destructive field $field." }
    }
    if ([int]$Value.destructiveExecutionCount -ne 0) { throw "$Label records destructive execution." }
}

function Protect-LogText([AllowNull()][string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }
    $redacted = $Text -replace '(?i)(password|token|secret|api[-_]?key)\s*[=:]\s*[^\s;]+', '$1=[REDACTED]'
    $redacted = $redacted -replace '(?i)(server|host)=[^;\r\n]+;[^\r\n]*', '[REDACTED_CONNECTION_STRING]'
    $redacted = $redacted -replace '(?s)-----BEGIN [^-]+ PRIVATE KEY-----.*?-----END [^-]+ PRIVATE KEY-----', '[REDACTED_PRIVATE_KEY]'
    return $redacted
}

function Get-CommandCounts([AllowEmptyString()][string]$Text) {
    $counts = [ordered]@{ tests = 0; passed = 0; failed = 0; skipped = 0 }
    foreach ($name in @('Passed', 'Failed', 'Skipped', 'Total')) {
        $match = [regex]::Match($Text, "(?im)\b$name\s*:\s*(\d+)")
        if ($match.Success) {
            $key = if ($name -eq 'Total') { 'tests' } else { $name.ToLowerInvariant() }
            $counts[$key] = [int]$match.Groups[1].Value
        }
    }
    return $counts
}

function Invoke-CapturedCommand([string]$Command, [string]$ArtifactPrefix) {
    $directory = Split-Path -Parent $ArtifactPrefix
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $commandFile = "$ArtifactPrefix.cmd"
    $stdoutPath = "$ArtifactPrefix.stdout.txt"
    $stderrPath = "$ArtifactPrefix.stderr.txt"
    [System.IO.File]::WriteAllText($commandFile, "@echo off`r`n$Command`r`n", [System.Text.Encoding]::ASCII)
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'cmd.exe'
    $startInfo.Arguments = '/d /s /c ""' + $commandFile + '""'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { throw "Failed to start captured command: $commandFile" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.WaitForExit()
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        $exitCode = $process.ExitCode
    }
    finally {
        $process.Dispose()
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($stdoutPath, $stdout, $utf8NoBom)
    [System.IO.File]::WriteAllText($stderrPath, $stderr, $utf8NoBom)
    return [pscustomobject]@{
        ExitCode = $exitCode
        StdOut = $stdout
        StdErr = $stderr
        StdOutPath = $stdoutPath
        StdErrPath = $stderrPath
    }
}

function Resolve-CommandTokens([string]$Command, [string]$GateArtifactPath) {
    $resolved = $Command.Replace('{runId}', $RunId).Replace('{target}', $Target)
    $resolved = $resolved.Replace('{archiveRunId}', $ArchiveRunId)
    $resolved = $resolved.Replace('{archiveReceipt}', $ArchiveReceipt).Replace('{approvalReceipt}', $ApprovalReceipt)
    $resolved = $resolved.Replace('{migrationHead}', $MigrationHead).Replace('{evidenceRoot}', $EvidenceRoot)
    $resolved = $resolved.Replace('{manifest}', $Manifest)
    $resolved = $resolved.Replace('{artifactPath}', $GateArtifactPath)
    return $resolved
}

function Get-RepositoryMigrationIds {
    $migrationRoot = 'backend/src/IPCManagement.Api/Migrations'
    if (-not (Test-Path -LiteralPath $migrationRoot -PathType Container)) {
        throw 'Repository migrations directory is missing.'
    }
    $ids = New-Object System.Collections.Generic.List[string]
    foreach ($file in Get-ChildItem -LiteralPath $migrationRoot -Filter '*.cs' -File) {
        if ($file.Name -eq 'IpcManagementContextModelSnapshot.cs') { continue }
        $text = Get-Content -Raw -LiteralPath $file.FullName
        foreach ($match in [regex]::Matches($text, '\[Migration\("([^"]+)"\)\]')) {
            $ids.Add([string]$match.Groups[1].Value)
        }
    }
    return @($ids | Sort-Object -Unique)
}

function Assert-ExactMigrationIds([string[]]$Expected, [string[]]$Actual, [string]$Label) {
    if ($Expected.Count -ne $Actual.Count -or ($Expected -join "`n") -ne ($Actual -join "`n")) {
        throw "$Label ordered migration IDs do not match repository source."
    }
}

function Assert-RetiredGapSourceAbsent {
    $retiredPaths = @(
        'backend/src/IPCManagement.Api/Features/Purchasing/Controllers/QuotationEvidenceResolutionsController.cs',
        'backend/src/IPCManagement.Api/Features/Purchasing/Services/QuotationEvidenceResolutionService.cs',
        'backend/src/IPCManagement.Api/Features/Catalog/Controllers/CatalogEvidenceResolutionsController.cs',
        'backend/src/IPCManagement.Api/Features/Catalog/Services/BomEvidenceResolutionService.cs',
        'backend/src/IPCManagement.Api/Features/Catalog/Services/DuplicateIngredientResolutionService.cs',
        'backend/src/IPCManagement.Api/Shared/Contracts/EvidenceResolutionContracts.cs',
        'backend/src/IPCManagement.Api/Shared/Lifecycle/EvidenceResolutionInfrastructure.cs',
        'backend/src/IPCManagement.Api/Features/Reports/Contracts/BusinessEvidenceEnvelopeDto.cs',
        'backend/src/IPCManagement.Api/Features/Reports/Services/BusinessEvidencePolicy.cs',
        'backend/src/IPCManagement.Api/Features/Reports/Persistence/BusinessEvidencePackageConfiguration.cs',
        'backend/src/IPCManagement.Api/Models/Entities/BusinessEvidencePackage.cs',
        'backend/src/IPCManagement.Api/Models/Entities/BusinessEvidenceAttestation.cs',
        'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.cs',
        'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.Designer.cs',
        'backend/tools/IPCManagement.DatabaseTool/BusinessEvidenceClosureCommand.cs',
        'backend/tools/IPCManagement.DatabaseTool/BusinessEvidenceExportCommand.cs'
    )
    $present = @($retiredPaths | Where-Object { Test-Path -LiteralPath $_ })
    if ($present.Count -ne 0) { throw "Retired pre-D-05 source remains: $($present -join ', ')" }

    $scanFiles = New-Object System.Collections.Generic.List[string]
    $runnerPath = (Resolve-Path -LiteralPath $PSCommandPath).Path
    $scanFiles.Add($runnerPath)
    foreach ($root in @('backend/src/IPCManagement.Api', 'backend/tools/IPCManagement.DatabaseTool')) {
        if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
        foreach ($file in @(& rg --files $root -g '*.cs' -g '!**/bin*/**' -g '!**/obj*/**' -g '!**/.artifacts/**')) {
            $scanFiles.Add((Resolve-Path -LiteralPath $file).Path)
        }
    }
    foreach ($path in @($AdditionalScanPath)) {
        if (Test-Path -LiteralPath $path -PathType Leaf) { $scanFiles.Add((Resolve-Path -LiteralPath $path).Path) }
    }
    $authorityPattern = @($script:SelectorContract.retiredAuthorityTokens | ForEach-Object {
        [regex]::Escape([string]$_)
    }) -join '|'
    $forbidden = '(?i)(?:' + $authorityPattern + ')|ActorRole\s*=\s*"(?:Catalog|Finance|Manager)"|BusinessEvidence(?:Package|Attestation|Policy|Envelope|ClosureCommand|ExportCommand)|Businessevidence(?:packages|attestations)|business-evidence-(?:close|export)'
    $sourceFiles = @($scanFiles | Select-Object -Unique | Where-Object { $_ -ne $runnerPath })
    $findings = @($sourceFiles | Where-Object {
        (Get-Content -Raw -LiteralPath $_) -match $forbidden
    })

    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $runnerPath, [ref]$tokens, [ref]$parseErrors)
    if (@($parseErrors).Count -ne 0) { throw 'Aggregate runner source cannot be parsed for retirement checks.' }
    $retiredFunctions = @($script:SelectorContract.retiredFunctions | ForEach-Object { [string]$_ })
    $retiredLiterals = @($script:SelectorContract.retiredSelectors + $script:SelectorContract.retiredAuthorityTokens |
        ForEach-Object { [string]$_ })
    $functionFindings = @($ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true) | Where-Object { $retiredFunctions -contains $_.Name })
    $literalFindings = @($ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.StringConstantExpressionAst]
    }, $true) | Where-Object { $retiredLiterals -contains $_.Value })
    if ($functionFindings.Count -ne 0 -or $literalFindings.Count -ne 0) {
        $findings += $runnerPath
    }
    if ($findings.Count -ne 0) { throw "Retired or synthesized authority source remains: $($findings -join ', ')" }
}

function Invoke-GapSourceContract {
    if ([string]::IsNullOrWhiteSpace($ArchiveRunId) -or $ArchiveRunId -notmatch '^[a-z0-9_]+$') {
        throw 'A lowercase immutable -ArchiveRunId is required.'
    }
    if ([string]::IsNullOrWhiteSpace($ArchiveReceipt) -or -not (Test-Path -LiteralPath $ArchiveReceipt -PathType Leaf)) {
        throw 'The immutable -ArchiveReceipt is required.'
    }
    if ([string]::IsNullOrWhiteSpace($ApprovalReceipt) -or -not (Test-Path -LiteralPath $ApprovalReceipt -PathType Leaf)) {
        throw 'The immutable -ApprovalReceipt is required.'
    }
    if ([string]::IsNullOrWhiteSpace($Manifest)) { throw '-Manifest is required for the gap source contract.' }

    $archivePath = (Resolve-Path -LiteralPath $ArchiveReceipt).Path
    $approvalPath = (Resolve-Path -LiteralPath $ApprovalReceipt).Path
    $approvalReceiptSha256 = Get-Sha256File $approvalPath
    if ($approvalReceiptSha256 -ne $script:ExpectedApprovalReceiptSha256) {
        throw 'The immutable approval receipt hash changed.'
    }
    $archive = Get-Content -Raw -LiteralPath $archivePath | ConvertFrom-Json
    $approval = Get-Content -Raw -LiteralPath $approvalPath | ConvertFrom-Json
    if ([string]$archive.status -ne 'PASS' -or [string]$archive.runId -ne $ArchiveRunId -or
        [string]$approval.status -ne 'PASS' -or [string]$approval.runId -ne $ArchiveRunId -or
        [string]$approval.approval -ne 'd03-local-archive-restore' -or
        [string]$approval.archiveReference -ne [string]$archive.archiveReference -or
        [string]$approval.archiveSha256 -ne [string]$archive.archiveSha256 -or
        [long]$approval.archiveBytes -ne [long]$archive.archiveBytes -or
        [string]$approval.innerManifestSha256 -ne [string]$archive.innerManifestSha256) {
        throw 'Approval/archive identity is not exact.'
    }
    if (-not (Test-Path -LiteralPath ([string]$archive.archivePath) -PathType Leaf) -or
        (Get-Sha256File ([string]$archive.archivePath)) -ne [string]$archive.archiveSha256 -or
        (Get-Item -LiteralPath ([string]$archive.archivePath)).Length -ne [long]$archive.archiveBytes) {
        throw 'Approved ciphertext identity changed.'
    }
    $expectedRestoreTarget = [string]$approval.restoreTarget
    if ($expectedRestoreTarget -notmatch '^ipc_restore_phase42_[a-z0-9_]+$' -or
        $expectedRestoreTarget -in @('ipcmanagement','ipc_lane1','ipc_lane9','ipc_e2e_template')) {
        throw 'Approval restore target is unsafe.'
    }

    $repositoryMigrationIds = @(Get-RepositoryMigrationIds)
    $archiveMigrationIds = @($archive.migrationIds | ForEach-Object { [string]$_ })
    Assert-ExactMigrationIds $repositoryMigrationIds $archiveMigrationIds 'Archive'
    if ($repositoryMigrationIds.Count -ne 63 -or
        [string]$repositoryMigrationIds[-1] -ne '20260810030000_AddDataQualityDispositions' -or
        [string]$archive.migrationHead -ne [string]$repositoryMigrationIds[-1]) {
        throw 'Repository/archive migration count or head is not the approved migration-63 contract.'
    }
    Assert-RetiredGapSourceAbsent

    $receipt = [ordered]@{
        schemaVersion = 1
        status = 'PASS'
        evidenceRunId = $RunId
        archiveRunId = $ArchiveRunId
        target = 'ipcmanagement'
        repositoryMigrationIds = $repositoryMigrationIds
        repositoryMigrationCount = $repositoryMigrationIds.Count
        repositoryMigrationHead = $repositoryMigrationIds[-1]
        archiveMigrationIds = $archiveMigrationIds
        archiveMigrationCount = $archiveMigrationIds.Count
        archiveMigrationHead = [string]$archive.migrationHead
        repositoryArchiveMigrationIdsExact = $true
        approvalReceiptSha256 = $approvalReceiptSha256
        approvalArchiveBindingExact = $true
        archiveReference = [string]$archive.archiveReference
        archiveSha256 = [string]$archive.archiveSha256
        archiveBytes = [long]$archive.archiveBytes
        innerManifestSha256 = [string]$archive.innerManifestSha256
        expectedRestoreTargetSource = 'IMMUTABLE_APPROVAL_RECEIPT'
        expectedRestoreTarget = $expectedRestoreTarget
        retiredProductionSourceCount = 0
        baseMutationStatements = 0
        ipcLane1Accessed = $false
        providerAccessed = $false
    }
    Write-Manifest $receipt

    $manifestDirectory = Split-Path -Parent $Manifest
    if (-not [string]::IsNullOrWhiteSpace($manifestDirectory)) {
        New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
    }
    $businessReleasePath = '.artifacts/shipyard-live/phase-04.2-execution/db/reconciliation/business-release.json'
    $archiveManifestPath = '.artifacts/shipyard-live/phase-04.2-execution/manifest.json'
    if (-not (Test-Path -LiteralPath $businessReleasePath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $archiveManifestPath -PathType Leaf)) {
        throw 'The immutable release or archive manifest is missing.'
    }
    $businessReleaseSha256 = Get-Sha256File $businessReleasePath
    if ($businessReleaseSha256 -ne '33FB324F64B85FA53B43F02EA204D6B0E076F809F2953F1EA2B1347DE0E05482') {
        throw 'The immutable D-05 release hash changed.'
    }
    $gapManifest = [ordered]@{
        schemaVersion = 3
        plan = '04.2-05'
        planRevision = 'GAP_CLOSURE_TASKS_9_12'
        status = 'SOURCE_CONTRACT_PASS'
        sourceCommit = (git rev-parse HEAD).Trim()
        runId = $RunId
        evidenceRunId = $RunId
        archiveRunId = $ArchiveRunId
        target = 'ipcmanagement'
        migrationCount = $repositoryMigrationIds.Count
        migrationHead = $repositoryMigrationIds[-1]
        currentTask = 11
        completedTasks = 10
        totalTasks = 12
        historicalTasksPreserved = 8
        sourceContractPath = $Output
        sourceContractSha256 = Get-Sha256File $Output
        archiveReceiptPath = $archivePath
        archiveReceiptSha256 = Get-Sha256File $archivePath
        approvalReceiptPath = $approvalPath
        approvalReceiptSha256 = $approvalReceiptSha256
        archiveReference = [string]$archive.archiveReference
        archiveSha256 = [string]$archive.archiveSha256
        archiveBytes = [long]$archive.archiveBytes
        innerManifestSha256 = [string]$archive.innerManifestSha256
        expectedRestoreTargetSource = 'IMMUTABLE_APPROVAL_RECEIPT'
        expectedRestoreTarget = $expectedRestoreTarget
        businessReleasePath = $businessReleasePath
        businessReleaseSha256 = $businessReleaseSha256
        archiveManifestPath = $archiveManifestPath
        archiveManifestSha256 = Get-Sha256File $archiveManifestPath
        restoreReceiptPath = Join-Path $manifestDirectory 'db/recovery/restore-drill.json'
        retentionReceiptPath = Join-Path $manifestDirectory 'db/cleanup/seven-table-retention.json'
        baseMutationStatements = 0
        ipcLane1Accessed = $false
        providerAccessed = $false
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Manifest, ($gapManifest | ConvertTo-Json -Depth 30), $utf8NoBom)
    return 0
}

function New-NotRunGate($Gate, [string]$SourceCommit, [string]$SpecHash, [bool]$IsContract) {
    return [ordered]@{
        gateId = $Gate.id
        requirementId = $Gate.requirementId
        command = $Gate.command
        commandVersion = 'NOT_RUN'
        sourceCommit = $SourceCommit
        target = if ($IsContract) { '<required-at-execution>' } elseif ($Gate.targetMode -eq 'explicit') { $Target } else { 'N/A' }
        migrationHead = if ($IsContract) { '<required-at-execution>' } else { $MigrationHead }
        inputHashes = [ordered]@{ gateSpec = $SpecHash }
        artifactPath = $Output
        status = 'NOT_RUN'
        exitCode = $null
        counts = [ordered]@{ tests = 0; passed = 0; failed = 0; skipped = 0 }
        stdoutSha256 = Get-Sha256Text ''
        stderrSha256 = Get-Sha256Text ''
        redactedError = $null
    }
}

function Assert-D05Release($Release, $Run, [string]$Path) {
    if ([string]$Release.status -ne 'PASS' -or [string]$Release.runId -ne $RunId -or
        [string]$Release.target -ne $Target -or [string]$Release.decision -ne 'EVIDENCE_ONLY_ACCEPTED_RISK_RELEASE' -or
        [string]$Release.packageSha256 -ne $script:ExpectedPackageSha256 -or
        [string]$Release.businessClassification -ne 'ACCEPTED_UNVERIFIED_BUSINESS_RISK' -or
        [int]$Release.subjectCount -ne 3555 -or $Release.sourceFactsReconciled -ne $false -or
        [int]$Release.businessSqlStatements -ne 0 -or [int]$Release.databaseConnections -ne 0 -or
        $Release.runtimeBooted -ne $false -or [int]$Release.mutationStatements -ne 0) {
        throw 'D-05 release header or zero-execution contract is invalid.'
    }
    if ((Get-Sha256File $Path) -ne [string]$Run.revisedTaskCompletions.task3.releaseSha256 -or
        (Get-Item -LiteralPath $Path).Length -ne [long]$Run.revisedTaskCompletions.task3.releaseBytes) {
        throw 'D-05 release bytes do not match the completed Task 3 receipt.'
    }
    $rolePolicy = $Run.completedD04RolePolicy
    if ([string]$Release.authorizationPolicySha256 -ne [string]$rolePolicy.authorizationPolicySha256 -or
        (Get-Sha256File ([string]$rolePolicy.authorizationPolicyPath)) -ne [string]$rolePolicy.authorizationPolicySha256 -or
        (($Release.allowedRoleFamilies | ConvertTo-Json -Compress) -ne ($rolePolicy.allowedRoleFamilies | ConvertTo-Json -Compress)) -or
        (($Release.rolePermissionMatrix | ConvertTo-Json -Depth 20 -Compress) -ne ($rolePolicy.rolePermissionMatrix | ConvertTo-Json -Depth 20 -Compress))) {
        throw 'D-05 release role/policy evidence is stale.'
    }

    $packagePath = [string]$Run.priorPackageEvidence.packagePath
    if ((Get-Sha256File $packagePath) -ne $script:ExpectedPackageSha256) {
        throw 'D-05 preserved package bytes are stale.'
    }
    $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
    $contracts = @(
        [pscustomobject]@{ PackageField='movements'; CountField='movements'; Family='movement'; IdField='sourceEntityId'; Count=2461; Outcome='NO_CORRECTION' },
        [pscustomobject]@{ PackageField='menuWeeks'; CountField='menuWeeks'; Family='menu-week'; IdField='sourceEntityId'; Count=84; Outcome='NO_CORRECTION' },
        [pscustomobject]@{ PackageField='unitReviews'; CountField='unitReviews'; Family='unit'; IdField='sourceEntityId'; Count=44; Outcome='RETAIN_DISTINCT' },
        [pscustomobject]@{ PackageField='quotations'; CountField='quotationSubjects'; Family='quotation'; IdField='sourceEntityId'; Count=756; Outcome='NO_PRICE_CREATED' },
        [pscustomobject]@{ PackageField='boms'; CountField='bomSubjects'; Family='bom'; IdField='sourceEntityId'; Count=194; Outcome='NO_BOM_CREATED' },
        [pscustomobject]@{ PackageField='duplicateGroups'; CountField='duplicateGroups'; Family='duplicate-group'; IdField='groupId'; Count=16; Outcome='KEEP_DISTINCT' }
    )
    $expectedRows = New-Object System.Collections.Generic.List[object]
    foreach ($contract in $contracts) {
        $sourceRows = @($package.($contract.PackageField) | Sort-Object { [string]$_.$($contract.IdField) })
        if ($sourceRows.Count -ne $contract.Count -or [int]$Release.familyCounts.($contract.CountField) -ne $contract.Count) {
            throw "D-05 release family count mismatch: $($contract.Family)"
        }
        foreach ($sourceRow in $sourceRows) {
            $expectedRows.Add([pscustomobject]@{
                Family = $contract.Family
                StableId = [string]$sourceRow.($contract.IdField)
                Fingerprint = [string]$sourceRow.currentFingerprint
                Outcome = $contract.Outcome
            })
        }
    }
    $actualRows = @($Release.rows)
    if ($actualRows.Count -ne $expectedRows.Count) { throw 'D-05 release row count is not exactly 3,555.' }
    for ($index = 0; $index -lt $expectedRows.Count; $index++) {
        $expected = $expectedRows[$index]
        $actual = $actualRows[$index]
        if ([string]$actual.family -ne $expected.Family -or [string]$actual.stableId -ne $expected.StableId -or
            [string]$actual.sourceFingerprint -ne $expected.Fingerprint -or [string]$actual.outcome -ne $expected.Outcome -or
            [string]$actual.packageSha256 -ne $script:ExpectedPackageSha256 -or
            [string]$actual.businessClassification -ne 'ACCEPTED_UNVERIFIED_BUSINESS_RISK' -or
            [string]$actual.unavailableFactMarker -ne 'SOURCE_FACTS_UNAVAILABLE_UNDER_D05') {
            throw "D-05 release membership, fingerprint or fixed outcome drifted at row $index."
        }
    }
}

function Test-Plan05ArtifactGate($Gate, $Run) {
    $taskNumber = if ($Gate.requirementId -in @('DCR-01','DCR-02','DCR-03','DCR-04','DCR-05','DCR-06')) { 3 }
        elseif ($Gate.requirementId -eq 'DCR-07') { 4 }
        elseif ($Gate.requirementId -eq 'DCR-08') { 6 }
        elseif ($Gate.requirementId -eq 'DCR-09') { 7 }
        else { $null }
    if ($null -eq $taskNumber) {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = "Unsupported Plan 05 artifact gate: $($Gate.id)"; ArtifactPath = $Manifest }
    }
    $task = $Run.revisedTaskCompletions."task$taskNumber"
    $path = if ($taskNumber -eq 3) { [string]$task.releasePath } else { [string]$task.receiptPath }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = "Missing current Plan 05 artifact for $($Gate.requirementId)."; ArtifactPath = $path }
    }
    try {
        if ([string]$Run.status -ne 'FINAL_AGGREGATE_PENDING' -or [int]$Run.currentTask -ne 8 -or
            [int]$Run.completedTasks -ne 7 -or [int]$Run.totalTasks -ne 8 -or
            [string]$task.status -ne 'PASS') {
            throw 'Plan 05 manifest is not at the exact Task 8 aggregate position.'
        }
        $artifact = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
        if ($taskNumber -eq 3) {
            Assert-D05Release $artifact $Run $path
        }
        elseif ($taskNumber -eq 4) {
            Assert-D03Topology $artifact 'DCR-07'
            if ((Get-Sha256File $path) -ne [string]$task.receiptSha256 -or
                [string]$artifact.runId -ne $RunId -or [string]$artifact.sourceDatabase -ne $Target -or
                [string]$artifact.archiveSha256 -ne [string]$Run.revisedTaskCompletions.task5.archiveSha256 -or
                [string]$artifact.releaseSha256 -ne [string]$Run.revisedTaskCompletions.task3.releaseSha256 -or
                [int]$artifact.releaseSubjectCount -ne 3555 -or [string]$artifact.migrationHead -ne $MigrationHead -or
                [int]$artifact.businessSqlStatements -ne 0 -or [int]$artifact.businessDatabaseConnections -ne 0 -or
                $artifact.businessRuntimeBooted -ne $false -or [int]$artifact.businessMutationStatements -ne 0 -or
                $artifact.providerAccessed -ne $false -or $artifact.ipcLane1Accessed -ne $false -or
                $artifact.sevenBackupTablesRetained -ne $true -or $artifact.rawKeyPersisted -ne $false -or
                $artifact.rawKeyInCommandLine -ne $false -or $artifact.rawKeyInEnvironment -ne $false) {
                throw 'DCR-07 archive receipt is stale, unsafe or not bound to D-05.'
            }
        }
        elseif ($taskNumber -eq 6) {
            $archive = Get-Content -Raw -LiteralPath ([string]$Run.revisedTaskCompletions.task4.receiptPath) | ConvertFrom-Json
            Assert-D03Topology $archive 'DCR-08 approved archive'
            if ((Get-Sha256File $path) -ne [string]$task.receiptSha256 -or [string]$artifact.runId -ne $RunId -or
                [string]$artifact.classification -ne 'ACCEPTED_LOCAL_ONLY_RISK' -or
                $artifact.approvedArchiveOnly -ne $true -or [string]$artifact.archiveSha256 -ne [string]$Run.revisedTaskCompletions.task5.archiveSha256 -or
                [string]$artifact.restoreTarget -ne "ipc_restore_phase42_$RunId" -or $artifact.restoreTargetAbsentBefore -ne $true -or
                $artifact.allExactOraclesPass -ne $true -or $artifact.migrationOraclePass -ne $true -or
                $artifact.schemaOraclePass -ne $true -or $artifact.foreignKeyOraclePass -ne $true -or
                $artifact.triggerOraclePass -ne $true -or $artifact.rowCountOraclePass -ne $true -or
                $artifact.rowDigestOraclePass -ne $true -or $artifact.d05ReleaseOraclePass -ne $true -or
                $artifact.businessSourceUnchanged -ne $true -or $artifact.restoreDatabaseAbsent -ne $true -or
                $artifact.plaintextAbsent -ne $true -or $artifact.existingDatabaseTouched -ne $false -or
                $artifact.providerAccessed -ne $false -or $artifact.ipcLane1Accessed -ne $false -or
                [int]$artifact.businessMutationStatements -ne 0 -or [string]$artifact.migrationHead -ne $MigrationHead -or
                [string]$artifact.releaseSha256 -ne [string]$Run.revisedTaskCompletions.task3.releaseSha256 -or
                [int]$artifact.releaseSubjectCount -ne 3555) {
                throw 'DCR-08 restore receipt is incomplete, stale or unsafe.'
            }
        }
        else {
            Assert-D03Topology $artifact 'DCR-09'
            Assert-D03Retention $artifact 'DCR-09'
            if ((Get-Sha256File $path) -ne [string]$task.receiptSha256 -or [string]$artifact.runId -ne $RunId -or
                [string]$artifact.sourceDatabase -ne $Target -or [int]$artifact.tablesPresentBefore -ne 7 -or
                [int]$artifact.tablesPresentAfter -ne 7 -or [int]$artifact.databaseConsumerCount -ne 0 -or
                [int]$artifact.productionConsumerCount -ne 0 -or @($artifact.tableProof | Where-Object {
                    $_.definitionMatches -ne $true -or $_.countMatches -ne $true -or $_.digestMatches -ne $true
                }).Count -ne 0 -or [string]$artifact.businessMutationContract -ne 'SUPERSEDED_D05_NOT_APPLICABLE' -or
                [string]$artifact.businessRehearsal -ne 'NOT_RUN_D05' -or [string]$artifact.businessBasePromotion -ne 'NOT_RUN_D05' -or
                $artifact.providerAccessed -ne $false -or $artifact.ipcLane1Accessed -ne $false -or
                [int]$artifact.mutationStatements -ne 0) {
                throw 'DCR-09 retention or destructive-path dormancy proof is incomplete.'
            }
        }
        return [pscustomobject]@{ ExitCode = 0; StdOut = Get-Content -Raw -LiteralPath $path; StdErr = ''; ArtifactPath = $path }
    }
    catch {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = $_.Exception.Message; ArtifactPath = $path }
    }
}

function Test-GapArtifactGate($Gate, $Run) {
    $path = if ($Gate.requirementId -in @('DCR-01','DCR-02','DCR-03','DCR-04','DCR-05','DCR-06')) {
        [string]$Run.businessReleasePath
    } elseif ($Gate.requirementId -eq 'DCR-07') {
        [string]$Run.archiveReceiptPath
    } elseif ($Gate.requirementId -eq 'DCR-08') {
        [string]$Run.restoreReceiptPath
    } elseif ($Gate.requirementId -eq 'DCR-09') {
        [string]$Run.retentionReceiptPath
    } else { $null }
    if ([string]::IsNullOrWhiteSpace($path) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = "Missing gap artifact for $($Gate.requirementId)."; ArtifactPath = $path }
    }
    try {
        if ([string]$Run.planRevision -ne 'GAP_CLOSURE_TASKS_9_12' -or
            [string]$Run.evidenceRunId -ne $RunId -or [string]$Run.archiveRunId -ne $ArchiveRunId -or
            [int]$Run.migrationCount -ne 63 -or [string]$Run.migrationHead -ne $MigrationHead -or
            [string]$Run.approvalReceiptSha256 -ne $script:ExpectedApprovalReceiptSha256) {
            throw 'Gap manifest identity or migration contract is invalid.'
        }
        $source = Get-Content -Raw -LiteralPath ([string]$Run.sourceContractPath) | ConvertFrom-Json
        if ([string]$source.status -ne 'PASS' -or [string]$source.evidenceRunId -ne $RunId -or
            [string]$source.archiveRunId -ne $ArchiveRunId -or $source.repositoryArchiveMigrationIdsExact -ne $true -or
            [int]$source.repositoryMigrationCount -ne 63 -or [string]$source.repositoryMigrationHead -ne $MigrationHead -or
            [string]$source.approvalReceiptSha256 -ne $script:ExpectedApprovalReceiptSha256 -or
            $source.approvalArchiveBindingExact -ne $true) {
            throw 'Gap source contract is stale or incomplete.'
        }
        $repositoryIds = @($source.repositoryMigrationIds | ForEach-Object { [string]$_ })
        $artifact = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
        if ($Gate.requirementId -in @('DCR-01','DCR-02','DCR-03','DCR-04','DCR-05','DCR-06')) {
            if ((Get-Sha256File $path) -ne '33FB324F64B85FA53B43F02EA204D6B0E076F809F2953F1EA2B1347DE0E05482' -or
                [string]$artifact.status -ne 'PASS' -or [string]$artifact.runId -ne $ArchiveRunId -or
                [int]$artifact.subjectCount -ne 3555 -or $artifact.sourceFactsReconciled -ne $false -or
                [int]$artifact.businessSqlStatements -ne 0 -or [int]$artifact.databaseConnections -ne 0 -or
                $artifact.runtimeBooted -ne $false -or [int]$artifact.mutationStatements -ne 0 -or
                @($artifact.rows).Count -ne 3555) {
                throw 'Immutable D-05 release is stale or not zero-execution.'
            }
        }
        elseif ($Gate.requirementId -eq 'DCR-07') {
            Assert-D03Topology $artifact 'Gap DCR-07'
            $archiveIds = @($artifact.migrationIds | ForEach-Object { [string]$_ })
            Assert-ExactMigrationIds $repositoryIds $archiveIds 'Gap archive'
            if ([string]$artifact.runId -ne $ArchiveRunId -or (Get-Sha256File $path) -ne [string]$Run.archiveReceiptSha256 -or
                [string]$artifact.archiveSha256 -ne [string]$Run.archiveSha256 -or
                [long]$artifact.archiveBytes -ne [long]$Run.archiveBytes -or
                [string]$artifact.innerManifestSha256 -ne [string]$Run.innerManifestSha256) {
                throw 'Immutable local archive identity is stale.'
            }
        }
        elseif ($Gate.requirementId -eq 'DCR-08') {
            $restoreIds = @($artifact.migrationIds | ForEach-Object { [string]$_ })
            Assert-ExactMigrationIds $repositoryIds $restoreIds 'Gap restore'
            $repositoryArchiveRestoreMigrationIdsExact = $true
            if ([string]$artifact.status -ne 'PASS' -or [string]$artifact.evidenceRunId -ne $RunId -or
                [string]$artifact.archiveRunId -ne $ArchiveRunId -or
                [string]$artifact.approvalReceiptSha256 -ne $script:ExpectedApprovalReceiptSha256 -or
                [string]$artifact.expectedRestoreTargetSource -ne 'IMMUTABLE_APPROVAL_RECEIPT' -or
                [string]$artifact.restoreTarget -ne [string]$source.expectedRestoreTarget -or
                $artifact.approvalArchiveBindingExact -ne $true -or $artifact.approvedArchiveOnly -ne $true -or
                $artifact.allExactOraclesPass -ne $true -or $artifact.migrationOraclePass -ne $true -or
                $artifact.schemaOraclePass -ne $true -or $artifact.foreignKeyOraclePass -ne $true -or
                $artifact.triggerOraclePass -ne $true -or $artifact.rowCountOraclePass -ne $true -or
                $artifact.rowDigestOraclePass -ne $true -or $artifact.d05ReleaseOraclePass -ne $true -or
                $artifact.restoreDatabaseAbsent -ne $true -or $artifact.plaintextAbsent -ne $true -or
                $artifact.existingDatabaseTouched -ne $false -or $artifact.ipcLane1Accessed -ne $false -or
                $artifact.providerAccessed -ne $false -or [int]$artifact.businessMutationStatements -ne 0 -or
                [int]$artifact.migrationCount -ne 63 -or [string]$artifact.migrationHead -ne $MigrationHead -or
                -not $repositoryArchiveRestoreMigrationIdsExact) {
                throw 'Fresh restore receipt is incomplete, unsafe or migration-stale.'
            }
        }
        else {
            Assert-D03Topology $artifact 'Gap DCR-09'
            Assert-D03Retention $artifact 'Gap DCR-09'
            $retentionIds = @($artifact.migrationIds | ForEach-Object { [string]$_ })
            Assert-ExactMigrationIds $repositoryIds $retentionIds 'Gap retention'
            if ([string]$artifact.evidenceRunId -ne $RunId -or [string]$artifact.archiveRunId -ne $ArchiveRunId -or
                [string]$artifact.approvalReceiptSha256 -ne $script:ExpectedApprovalReceiptSha256 -or
                [int]$artifact.tablesPresentBefore -ne 7 -or [int]$artifact.tablesPresentAfter -ne 7 -or
                [int]$artifact.databaseConsumerCount -ne 0 -or [int]$artifact.productionConsumerCount -ne 0 -or
                [int]$artifact.mutationStatements -ne 0 -or $artifact.ipcLane1Accessed -ne $false -or
                $artifact.providerAccessed -ne $false) {
                throw 'Fresh retention receipt is incomplete or unsafe.'
            }
        }
        return [pscustomobject]@{ ExitCode = 0; StdOut = Get-Content -Raw -LiteralPath $path; StdErr = ''; ArtifactPath = $path }
    }
    catch {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = $_.Exception.Message; ArtifactPath = $path }
    }
}

function Test-ArtifactGate($Gate) {
    if (-not [string]::IsNullOrWhiteSpace($Manifest) -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
        if ([string]$run.planRevision -eq 'D03_D04_D05_8_TASK') {
            return Test-Plan05ArtifactGate $Gate $run
        }
        if ([string]$run.planRevision -eq 'GAP_CLOSURE_TASKS_9_12') {
            return Test-GapArtifactGate $Gate $run
        }
    }
    $fileName = ($Gate.command -replace '^validate-artifact\s+', '').Trim()
    $path = Join-Path $EvidenceRoot $fileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = "Missing artifact: $fileName"; ArtifactPath = $path }
    }
    try {
        $artifact = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
        if ($artifact.status -ne 'PASS') { throw "Artifact status is $($artifact.status), expected PASS." }
        if ($artifact.target -ne $Target) { throw 'Artifact target does not match the explicit aggregate target.' }
        if ($artifact.sourceCommit -ne (git rev-parse HEAD)) { throw 'Artifact source commit is stale.' }
        if ($artifact.migrationHead -ne $MigrationHead) { throw 'Artifact migration head is stale.' }
        if ($null -eq $artifact.inputHashes -or $null -eq $artifact.counts) { throw 'Artifact hashes or counts are missing.' }
        $declared = @($artifact.artifacts)
        foreach ($required in @($Gate.requiredArtifacts)) {
            if ($declared -notcontains $required) { throw "Artifact proof is missing: $required" }
        }
        if ($Gate.requirementId -in @('DCR-07', 'DCR-08', 'DCR-09')) {
            Assert-D03Topology $artifact $Gate.requirementId
        }
        if ($Gate.requirementId -eq 'DCR-08') {
            if ($artifact.approvedArchiveOnly -ne $true -or $artifact.restoreDatabaseAbsent -ne $true -or
                $artifact.plaintextAbsent -ne $true -or $artifact.existingDatabaseTouched -ne $false) {
                throw 'DCR-08 local restore or teardown proof is incomplete.'
            }
        }
        if ($Gate.requirementId -eq 'DCR-09') {
            Assert-D03Retention $artifact 'DCR-09'
        }
        return [pscustomobject]@{ ExitCode = 0; StdOut = Get-Content -Raw -LiteralPath $path; StdErr = ''; ArtifactPath = $path }
    }
    catch {
        return [pscustomobject]@{ ExitCode = 1; StdOut = ''; StdErr = $_.Exception.Message; ArtifactPath = $path }
    }
}

function Write-Manifest($Manifest) {
    $resolvedOutput = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path (Get-Location) $Output }
    $parent = Split-Path -Parent $resolvedOutput
    if (-not [string]::IsNullOrWhiteSpace($parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $json = $Manifest | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($resolvedOutput, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Invoke-D03RebindCheck {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'd03-rebind-check requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.target -ne $Target -or $run.planRevision -ne 'D03_13_TASK') {
        throw 'D-03 manifest run, target or revision does not match.'
    }
    if ([int]$run.completedTasks -ne 1 -or [int]$run.currentTask -ne 2 -or [int]$run.totalTasks -ne 13 -or
        [string]$run.status -ne 'AWAITING_BUSINESS_AUTHORITY') {
        throw 'D-03 manifest task position is not rebound to the business-authority checkpoint.'
    }
    $package = $run.priorPackageEvidence
    if ([string]$package.status -ne 'PASS' -or [int]$run.mutationStatements -ne 0) {
        throw 'Preserved Task 1 package is not PASS or is not read-only.'
    }
    $packagePath = [string]$package.packagePath
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw 'Preserved Task 1 package is missing.' }
    if ((Get-Sha256File $packagePath) -ne $script:ExpectedPackageSha256 -or
        [string]$package.packageSha256 -ne $script:ExpectedPackageSha256) {
        throw 'Preserved Task 1 package exact-byte SHA-256 changed.'
    }
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $packagePath).Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        throw 'Preserved Task 1 package unexpectedly contains a UTF-8 BOM.'
    }
    $counts = $package.counts
    $expectedCounts = [ordered]@{
        movements = 2461; menuWeeks = 84; menuFullPhysicalTraversal = 84; unitReviews = 44
        quotationSubjects = 756; bomSubjects = 194; duplicateGroups = 16
        duplicateCompleteFifteenConsumerMaps = 16
    }
    foreach ($field in $expectedCounts.Keys) {
        if ([int]$counts.$field -ne [int]$expectedCounts[$field]) { throw "Preserved Task 1 count drifted: $field" }
    }
    if ([string]$run.sourceCommit -notmatch '^[A-Fa-f0-9]{40}$' -or [string]::IsNullOrWhiteSpace([string]$run.migrationHead)) {
        throw 'Preserved Task 1 source commit or migration head is missing.'
    }

    $policy = $run.activeRecoveryPolicy
    Assert-D03Topology $policy 'Active manifest policy'
    if ([string]$policy.decisionReference -notmatch '^opaque:d03:[a-z0-9:_-]+$' -or
        [string]$policy.decisionSha256 -notmatch '^[A-Fa-f0-9]{64}$' -or
        [string]::IsNullOrWhiteSpace([string]$policy.decisionCapturedAtUtc)) {
        throw 'D-03 decision reference, digest or timestamp is incomplete.'
    }
    Assert-D03Retention $policy.backupTablePolicy 'Active manifest backup-table policy'

    $superseded = @($run.supersededEvidence)
    if ($superseded.Count -lt 8) { throw 'Superseded provider evidence index is incomplete.' }
    foreach ($entry in $superseded) {
        if ([string]$entry.status -ne 'SUPERSEDED_D03_NOT_CURRENT_AUTHORITY' -or
            -not (Test-Path -LiteralPath $entry.path -PathType Leaf) -or
            (Get-Sha256File $entry.path) -ne [string]$entry.sha256 -or
            [string]::IsNullOrWhiteSpace([string]$entry.capturedAtUtc)) {
            throw "Superseded evidence index is stale: $($entry.path)"
        }
    }
    if ($run.activeRequiredInputsAfterTask1.PSObject.Properties.Name -contains 'provider' -or
        $run.activeRequiredInputsAfterTask1.PSObject.Properties.Name -contains 'recoveryProviderAuthority') {
        throw 'Active required inputs still contain provider authority.'
    }

    Write-Manifest ([ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        target = $Target
        migrationHead = $MigrationHead
        packageSha256 = $script:ExpectedPackageSha256
        recoveryClassification = 'ACCEPTED_LOCAL_ONLY_RISK'
        sameHost = $true
        samePhysicalNvme = $true
        offSite = $false
        worm = $false
        independentSecurityDomain = $false
        sevenBackupTablesRetained = $true
        supersededEvidenceCount = $superseded.Count
        status = 'PASS'
        mutationStatements = 0
    })
    return 0
}

function Invoke-D04RoleRebindCheck {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'd04-role-rebind-check requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.target -ne $Target -or $run.planRevision -ne 'D03_D04_13_TASK') {
        throw 'D-04 manifest run, target or revision does not match.'
    }
    if ([int]$run.completedTasks -ne 1 -or [int]$run.currentTask -ne 2 -or [int]$run.totalTasks -ne 13 -or
        [string]$run.status -ne 'D04_ROLE_REBIND_PENDING' -or
        [string]$run.revisedTaskCompletions.task1.status -ne 'PASS') {
        throw 'D-04 rebind must preserve completed Task 1 and remain at Task 2 during validation.'
    }
    if ([string]$run.priorPackageEvidence.packageSha256 -ne $script:ExpectedPackageSha256 -or
        [string]$run.priorPackageEvidence.status -ne 'PASS' -or [int]$run.mutationStatements -ne 0) {
        throw 'D-04 rebind changed the preserved Task 1 package contract.'
    }
    $counts = $run.priorPackageEvidence.counts
    foreach ($expected in @(
        @{ Field = 'movements'; Value = 2461 }, @{ Field = 'menuWeeks'; Value = 84 },
        @{ Field = 'unitReviews'; Value = 44 }, @{ Field = 'quotationSubjects'; Value = 756 },
        @{ Field = 'bomSubjects'; Value = 194 }, @{ Field = 'duplicateGroups'; Value = 16 }
    )) {
        if ([int]$counts.($expected.Field) -ne [int]$expected.Value) {
            throw "D-04 rebind changed preserved count $($expected.Field)."
        }
    }

    $policy = $run.activeBusinessPolicy
    if ([string]$policy.decision -ne 'ROLE_BOUNDED_OPERATIONAL_DISPOSITION' -or
        [string]$policy.decisionReference -ne 'opaque:d04:session-decision:2026-08-10' -or
        [string]$policy.decisionSha256 -ne '91AABB097AE68F473C0CCF6521234316D7826B630F20B00CC3BD77261B36ADBD' -or
        $policy.governanceDecisionIsApplicationActorOrSignature -ne $false) {
        throw 'D-04 governance decision is missing, stale or presented as an application actor/signature.'
    }
    $policyPath = [string]$policy.authorizationPolicyPath
    if ($policyPath -ne 'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs' -or
        -not (Test-Path -LiteralPath $policyPath -PathType Leaf) -or
        (Get-Sha256File $policyPath) -ne [string]$policy.authorizationPolicySha256) {
        throw 'D-04 authorization policy source hash is stale.'
    }

    $expectedRoles = [ordered]@{
        'Admin' = @{ Representative = 'Admin'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'catalog.read', 'catalog.write', 'coordination.read',
            'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff',
            'demand.generate', 'inventory.read', 'purchase.read', 'purchase.generate',
            'material-demand.approve', 'purchase.price-exception.approve', 'purchase.request.approve',
            'purchase.quotation.manage', 'inventory.receipt.approve', 'inventory.issue.approve',
            'inventory.adjustment.approve', 'production.read', 'warehouse.read', 'report.read') }
        'Manager' = @{ Representative = 'Manager'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'catalog.read', 'catalog.write', 'coordination.read',
            'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff',
            'demand.generate', 'inventory.read', 'purchase.read', 'purchase.generate',
            'material-demand.approve', 'purchase.price-exception.approve', 'purchase.request.approve',
            'purchase.quotation.manage', 'inventory.receipt.approve', 'inventory.issue.approve',
            'inventory.adjustment.approve', 'production.read', 'warehouse.read', 'report.read') }
        'Coordinator' = @{ Representative = 'Coordinator'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'catalog.read', 'coordination.read',
            'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff',
            'demand.generate', 'warehouse.read', 'report.read') }
        'Procurement/Purchasing' = @{ Representative = 'Purchasing'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'inventory.read', 'purchase.read', 'purchase.generate',
            'purchase.quotation.manage', 'inventory.receipt.approve', 'report.read') }
        'Warehouse' = @{ Representative = 'WarehouseStaff'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'inventory.read', 'inventory.receipt.approve',
            'inventory.issue.approve', 'inventory.adjustment.approve', 'warehouse.read', 'report.read') }
        'Chef/Kitchen' = @{ Representative = 'Chef'; Permissions = @(
            'auth.profile.read', 'dashboard.read', 'catalog.read', 'production.read', 'report.read') }
    }
    $allowed = @($policy.allowedRoleFamilies)
    $expectedRoleFamilies = @($expectedRoles.Keys | ForEach-Object { [string]$_ })
    if ($allowed.Count -ne $expectedRoles.Count -or @(Compare-Object $expectedRoleFamilies $allowed).Count -ne 0) {
        throw 'D-04 allowed role families differ from the six source-defined families.'
    }
    $matrix = @($policy.rolePermissionMatrix)
    if ($matrix.Count -ne $expectedRoles.Count) { throw 'D-04 role/permission matrix must contain exactly six entries.' }
    foreach ($family in $expectedRoles.Keys) {
        $entries = @($matrix | Where-Object { $_.roleFamily -eq $family })
        if ($entries.Count -ne 1) { throw "D-04 role family must occur exactly once: $family" }
        $entry = $entries[0]
        $expected = $expectedRoles[$family]
        if ([string]$entry.representativeRole -ne [string]$expected.Representative -or
            @(Compare-Object @($expected.Permissions) @($entry.resolvedPermissions)).Count -ne 0) {
            throw "D-04 resolved permissions are stale or bypassed for $family."
        }
        foreach ($requiredPermission in @($entry.requiredPermissions)) {
            if (@($entry.resolvedPermissions) -notcontains [string]$requiredPermission) {
                throw "D-04 required permission is not resolved for $family."
            }
        }
    }
    if ([string]$policy.finalResidualRiskAcceptanceRole -ne 'Admin' -or
        @(Compare-Object @('VERIFIED_IN_APP', 'ACCEPTED_UNVERIFIED_BUSINESS_RISK') @($policy.businessClassifications)).Count -ne 0) {
        throw 'D-04 classifications or final Admin acceptance role are invalid.'
    }
    if ($policy.financeIndependenceClaimed -ne $false -or $policy.fakeSignaturePresent -ne $false) {
        throw 'D-04 cannot claim Finance independence or signature evidence.'
    }
    foreach ($field in @('correction', 'conversion', 'price', 'bom', 'merge')) {
        if ($policy.inferencePolicy.$field -ne $false) { throw "D-04 inferred business field is forbidden: $field" }
    }
    $superseded = $run.supersededBusinessAuthorityWorkflow
    if ([string]$superseded.status -ne 'SUPERSEDED_D04_NOT_CURRENT_AUTHORITY' -or
        [int]$superseded.formerExternalSlotCount -ne 9 -or
        $superseded.newIdentitySetupRequired -ne $false -or $superseded.externalSignatureInputRequired -ne $false) {
        throw 'Former external-owner workflow is not safely superseded under D-04.'
    }

    $spec = Get-Content -Raw -LiteralPath $GateSpec | ConvertFrom-Json
    $requiredD04Artifacts = @(
        'd04-role-permission-receipts', 'd04-business-classifications',
        'admin-risk-acceptance', 'no-inference-outcomes'
    )
    $requiredD05Artifacts = @(
        'd05-evidence-only-release', 'accepted-unverified-business-risk',
        'fixed-no-correction-outcomes', 'zero-business-execution'
    )
    foreach ($gate in @($spec.gates | Where-Object { $_.requirementId -in @('DCR-01','DCR-02','DCR-03','DCR-04','DCR-05','DCR-06') })) {
        $hasCompleteD04Set = @($requiredD04Artifacts | Where-Object { @($gate.requiredArtifacts) -notcontains $_ }).Count -eq 0
        $hasCompleteD05Set = @($requiredD05Artifacts | Where-Object { @($gate.requiredArtifacts) -notcontains $_ }).Count -eq 0
        if (-not $hasCompleteD04Set -and -not $hasCompleteD05Set) {
            throw "D-04 gate $($gate.id) has neither the complete historical D-04 nor current D-05 artifact set."
        }
    }

    Write-Manifest ([ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        target = $Target
        packageSha256 = $script:ExpectedPackageSha256
        authorizationPolicySha256 = [string]$policy.authorizationPolicySha256
        allowedRoleFamilyCount = $expectedRoles.Count
        governanceDecisionUsedAsActor = $false
        finalResidualRiskAcceptanceRole = 'Admin'
        businessClassifications = @('VERIFIED_IN_APP', 'ACCEPTED_UNVERIFIED_BUSINESS_RISK')
        status = 'PASS'
        mutationStatements = 0
    })
    return 0
}

function Invoke-D05EvidenceRelease {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'd05-evidence-release requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.target -ne $Target -or
        $run.planRevision -ne 'D03_D04_D05_8_TASK') {
        throw 'D-05 manifest run, target or revision does not match.'
    }
    if ([int]$run.completedTasks -ne 2 -or [int]$run.currentTask -ne 3 -or
        [int]$run.totalTasks -ne 8 -or [string]$run.status -ne 'D05_EVIDENCE_RELEASE_PENDING' -or
        [string]$run.revisedTaskCompletions.task1.status -ne 'PASS' -or
        [string]$run.revisedTaskCompletions.task2.status -ne 'PASS') {
        throw 'D-05 release must preserve completed Tasks 1-2 and remain at Task 3 during validation.'
    }
    if ([int]$run.mutationStatements -ne 0 -or $run.runtimeBooted -ne $false -or
        $run.ipcLane1Accessed -ne $false -or $run.providerAccessed -ne $false) {
        throw 'D-05 release cannot inherit runtime, provider, ipc_lane1 or mutation activity.'
    }

    $packagePath = [string]$run.priorPackageEvidence.packagePath
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or
        (Get-Sha256File $packagePath) -ne $script:ExpectedPackageSha256 -or
        [string]$run.priorPackageEvidence.packageSha256 -ne $script:ExpectedPackageSha256) {
        throw 'D-05 preserved package bytes or digest are missing or stale.'
    }
    $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
    if ([int]$package.mutationStatements -ne 0 -or [string]$package.database -ne 'ipcmanagement') {
        throw 'D-05 package is not the read-only ipcmanagement evidence package.'
    }

    $rolePolicy = $run.completedD04RolePolicy
    $expectedRoleFamilies = @('Admin','Manager','Coordinator','Procurement/Purchasing','Warehouse','Chef/Kitchen')
    if ([string]$rolePolicy.status -ne 'PASS' -or
        [string]$rolePolicy.authorizationPolicyPath -ne 'backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs' -or
        -not (Test-Path -LiteralPath ([string]$rolePolicy.authorizationPolicyPath) -PathType Leaf) -or
        (Get-Sha256File ([string]$rolePolicy.authorizationPolicyPath)) -ne [string]$rolePolicy.authorizationPolicySha256 -or
        @($rolePolicy.allowedRoleFamilies).Count -ne 6 -or
        @(Compare-Object $expectedRoleFamilies @($rolePolicy.allowedRoleFamilies)).Count -ne 0 -or
        @($rolePolicy.rolePermissionMatrix).Count -ne 6) {
        throw 'D-05 completed D-04 role/policy receipt is stale or contains an unknown role.'
    }

    $closure = $run.activeBusinessClosure
    $allowedClosureFields = @(
        'status','decision','decisionReference','decisionSha256','decisionCapturedAtUtc','subjectCount',
        'familyCounts','businessClassification','adminGovernanceAcceptanceReference',
        'adminGovernanceAcceptanceIsRuntimeActorOrSignature','businessSqlStatements','databaseConnections',
        'runtimeBooted','mutationStatements','sourceFactsReconciled','releaseArtifactStatus','fixedOutcomes'
    )
    if (@(Compare-Object $allowedClosureFields @($closure.PSObject.Properties.Name)).Count -ne 0) {
        throw 'D-05 closure contains an identity, signature, SQL, command or other undeclared execution field.'
    }
    if ([string]$closure.status -ne 'D05_EVIDENCE_RELEASE_PENDING' -or
        [string]$closure.decision -ne 'EVIDENCE_ONLY_ACCEPTED_RISK_RELEASE' -or
        [string]$closure.decisionReference -ne 'opaque:d05:session-decision:2026-08-10' -or
        [string]$closure.decisionSha256 -ne 'D9262FE6E2A4FF7131303C5E01B8FBCA65427BCB05920783BC0B1ECD0C118DD7' -or
        [string]$closure.businessClassification -ne 'ACCEPTED_UNVERIFIED_BUSINESS_RISK' -or
        [string]$closure.adminGovernanceAcceptanceReference -ne 'opaque:d05:admin-role-governance-acceptance:2026-08-10' -or
        $closure.adminGovernanceAcceptanceIsRuntimeActorOrSignature -ne $false -or
        [int]$closure.businessSqlStatements -ne 0 -or [int]$closure.databaseConnections -ne 0 -or
        $closure.runtimeBooted -ne $false -or [int]$closure.mutationStatements -ne 0 -or
        $closure.sourceFactsReconciled -ne $false) {
        throw 'D-05 closure decision or zero-execution contract is invalid.'
    }
    $superseded = $run.supersededBusinessMutationContract
    if ([string]$superseded.status -ne 'SUPERSEDED_D05_NOT_APPLICABLE' -or
        $superseded.batchCoordinatorOrProductionSchemaExpansionAllowed -ne $false) {
        throw 'D-05 old business mutation architecture is not superseded.'
    }
    foreach ($field in @('businessSql','businessRehearsalDatabase','apply','rollback','reapply','basePromotion')) {
        if ([string]$superseded.$field -ne 'NOT_RUN_D05') { throw "D-05 superseded execution field is active: $field" }
    }

    $contracts = @(
        [pscustomobject]@{ PackageField='movements'; CountField='movements'; Family='movement'; IdField='sourceEntityId'; Count=2461; Outcome='NO_CORRECTION' },
        [pscustomobject]@{ PackageField='menuWeeks'; CountField='menuWeeks'; Family='menu-week'; IdField='sourceEntityId'; Count=84; Outcome='NO_CORRECTION' },
        [pscustomobject]@{ PackageField='unitReviews'; CountField='unitReviews'; Family='unit'; IdField='sourceEntityId'; Count=44; Outcome='RETAIN_DISTINCT' },
        [pscustomobject]@{ PackageField='quotations'; CountField='quotationSubjects'; Family='quotation'; IdField='sourceEntityId'; Count=756; Outcome='NO_PRICE_CREATED' },
        [pscustomobject]@{ PackageField='boms'; CountField='bomSubjects'; Family='bom'; IdField='sourceEntityId'; Count=194; Outcome='NO_BOM_CREATED' },
        [pscustomobject]@{ PackageField='duplicateGroups'; CountField='duplicateGroups'; Family='duplicate-group'; IdField='groupId'; Count=16; Outcome='KEEP_DISTINCT' }
    )
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($contract in $contracts) {
        $sourceRows = @($package.($contract.PackageField) | Sort-Object { [string]$_.$($contract.IdField) })
        if ($sourceRows.Count -ne $contract.Count -or
            [int]$run.priorPackageEvidence.counts.($contract.CountField) -ne $contract.Count -or
            [int]$closure.familyCounts.($contract.CountField) -ne $contract.Count) {
            throw "D-05 family count mismatch: $($contract.Family)"
        }
        $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
        $previous = $null
        foreach ($sourceRow in $sourceRows) {
            $stableId = [string]$sourceRow.($contract.IdField)
            $fingerprint = [string]$sourceRow.currentFingerprint
            if ([string]::IsNullOrWhiteSpace($stableId) -or $fingerprint -notmatch '^[A-F0-9]{64}$' -or
                -not $seen.Add($stableId)) {
                throw "D-05 invalid or duplicate subject in $($contract.Family)."
            }
            if ($null -ne $previous -and [StringComparer]::Ordinal.Compare($previous, $stableId) -ge 0) {
                throw "D-05 family ordering is not ordinal: $($contract.Family)."
            }
            $previous = $stableId
            $rows.Add([ordered]@{
                family = $contract.Family
                stableId = $stableId
                sourceFingerprint = $fingerprint
                packageSha256 = $script:ExpectedPackageSha256
                businessClassification = 'ACCEPTED_UNVERIFIED_BUSINESS_RISK'
                unavailableFactMarker = 'SOURCE_FACTS_UNAVAILABLE_UNDER_D05'
                outcome = $contract.Outcome
                adminGovernanceAcceptanceReference = 'opaque:d05:admin-role-governance-acceptance:2026-08-10'
            })
        }
    }
    if ($rows.Count -ne 3555 -or [int]$closure.subjectCount -ne 3555) {
        throw 'D-05 release must contain exactly 3,555 subjects.'
    }

    $release = [ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        target = $Target
        status = 'PASS'
        decision = 'EVIDENCE_ONLY_ACCEPTED_RISK_RELEASE'
        decisionReference = 'opaque:d05:session-decision:2026-08-10'
        decisionSha256 = 'D9262FE6E2A4FF7131303C5E01B8FBCA65427BCB05920783BC0B1ECD0C118DD7'
        packageSha256 = $script:ExpectedPackageSha256
        authorizationPolicySha256 = [string]$rolePolicy.authorizationPolicySha256
        allowedRoleFamilies = @($rolePolicy.allowedRoleFamilies)
        rolePermissionMatrix = @($rolePolicy.rolePermissionMatrix)
        adminGovernanceAcceptanceReference = 'opaque:d05:admin-role-governance-acceptance:2026-08-10'
        businessClassification = 'ACCEPTED_UNVERIFIED_BUSINESS_RISK'
        subjectCount = 3555
        familyCounts = $closure.familyCounts
        fixedOutcomes = $closure.fixedOutcomes
        sourceFactsReconciled = $false
        businessSqlStatements = 0
        databaseConnections = 0
        runtimeBooted = $false
        mutationStatements = 0
        rows = $rows.ToArray()
    }
    Write-Manifest $release
    $releaseHash = Get-Sha256File $Output
    $releaseBytes = (Get-Item -LiteralPath $Output).Length
    $sidecarPath = if ([IO.Path]::IsPathRooted("$Output.sha256")) { "$Output.sha256" } else { Join-Path (Get-Location) "$Output.sha256" }
    [System.IO.File]::WriteAllText(
        $sidecarPath,
        (([ordered]@{ sha256=$releaseHash; bytes=$releaseBytes; subjectCount=3555 } | ConvertTo-Json -Compress) + "`n"),
        (New-Object System.Text.UTF8Encoding($false)))

    $run.status = 'LOCAL_ARCHIVE_PENDING'
    $run.currentTask = 4
    $run.currentTaskName = 'Provision DPAPI key and create exact encrypted local archive'
    $run.completedTasks = 3
    $run.activeBusinessClosure.status = 'PASS'
    $run.activeBusinessClosure.releaseArtifactStatus = 'PASS'
    $run.activeBusinessClosure | Add-Member -NotePropertyName releasePath -NotePropertyValue $Output -Force
    $run.activeBusinessClosure | Add-Member -NotePropertyName releaseSha256 -NotePropertyValue $releaseHash -Force
    $run.activeBusinessClosure | Add-Member -NotePropertyName releaseBytes -NotePropertyValue $releaseBytes -Force
    $task3 = [ordered]@{
        status='PASS'; completedAtUtc=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        releasePath=$Output; releaseSha256=$releaseHash; releaseBytes=$releaseBytes; subjectCount=3555
        businessSqlStatements=0; databaseConnections=0; runtimeBooted=$false; mutationStatements=0
    }
    $run.revisedTaskCompletions | Add-Member -NotePropertyName task3 -NotePropertyValue $task3 -Force
    $run.resumeGuardrails.completedTasksPreserved = 3
    $run.resumeGuardrails.nextTask = 4
    $run.resumeGuardrails.d05EvidenceReleaseMustRun = $false
    $resolvedManifest = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location) $Manifest }
    [System.IO.File]::WriteAllText(
        $resolvedManifest, ($run | ConvertTo-Json -Depth 30),
        (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-D03LocalArchive {
    if ($Target -ne 'ipcmanagement') { throw 'D-03 local archive source must be ipcmanagement.' }
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'local-archive requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.target -ne $Target -or
        $run.planRevision -ne 'D03_D04_D05_8_TASK' -or [int]$run.completedTasks -ne 3 -or
        [int]$run.currentTask -ne 4 -or [int]$run.totalTasks -ne 8 -or
        [string]$run.status -ne 'LOCAL_ARCHIVE_PENDING' -or
        [string]$run.revisedTaskCompletions.task3.status -ne 'PASS') {
        throw 'D-03 archive must preserve Tasks 1-3 and remain at Task 4 during execution.'
    }
    $releasePath = [string]$run.revisedTaskCompletions.task3.releasePath
    if (-not (Test-Path -LiteralPath $releasePath -PathType Leaf) -or
        (Get-Sha256File $releasePath) -ne [string]$run.revisedTaskCompletions.task3.releaseSha256 -or
        [long](Get-Item -LiteralPath $releasePath).Length -ne [long]$run.revisedTaskCompletions.task3.releaseBytes) {
        throw 'D-03 archive input release bytes are missing or stale.'
    }
    Assert-D03Topology $run.activeRecoveryPolicy 'D-03 active recovery policy'
    Assert-D03Retention $run.activeRecoveryPolicy.backupTablePolicy 'D-03 active backup-table policy'

    $prefix = Join-Path $EvidenceRoot 'commands/04-local-archive'
    $command = 'dotnet run --project backend/tools/IPCManagement.Phase42ArchiveTool/IPCManagement.Phase42ArchiveTool.csproj ' +
        '--no-restore -p:BaseOutputPath=backend/.artifacts/phase42-' + $RunId + '-local-archive/ ' +
        '-p:EnableDefaultContentItems=false -p:UseAppHost=false -- ' +
        '--settings "' + $Settings + '" --database "' + $Target + '" --run-id "' + $RunId +
        '" --release "' + $releasePath + '" --output "' + $Output + '"'
    $execution = Invoke-CapturedCommand $command $prefix
    if ($execution.ExitCode -ne 0) { throw (Protect-LogText $execution.StdErr) }
    if (-not (Test-Path -LiteralPath $Output -PathType Leaf)) { throw 'Local archive tool did not create its receipt.' }
    $receipt = Get-Content -Raw -LiteralPath $Output | ConvertFrom-Json
    Assert-D03Topology $receipt 'DCR-07 local archive'
    $expectedBackupTables = @($script:BackupTables | Sort-Object)
    if ([string]$receipt.status -ne 'PASS' -or [string]$receipt.sourceDatabase -ne 'ipcmanagement' -or
        -not (Test-Path -LiteralPath ([string]$receipt.archivePath) -PathType Leaf) -or
        (Get-Sha256File ([string]$receipt.archivePath)) -ne [string]$receipt.archiveSha256 -or
        [long](Get-Item -LiteralPath ([string]$receipt.archivePath)).Length -ne [long]$receipt.archiveBytes -or
        [string]$receipt.releaseSha256 -ne [string]$run.revisedTaskCompletions.task3.releaseSha256 -or
        [long]$receipt.releaseBytes -ne [long]$run.revisedTaskCompletions.task3.releaseBytes -or
        [int]$receipt.releaseSubjectCount -ne 3555 -or $receipt.archiveHeaderEncrypted -ne $true -or
        [string]$receipt.encryptionKeyScope -ne 'WindowsCurrentUserDPAPI' -or
        [int]$receipt.keyEntropyBits -ne 512 -or $receipt.keyAcl.inheritanceDisabled -ne $true -or
        $receipt.keyAcl.currentUserFullControl -ne $true -or
        $receipt.keyAcl.pathOutsideRepositoryAndArtifacts -ne $true -or
        $receipt.archiveRoundTripVerified -ne $true -or $receipt.rawKeyPersisted -ne $false -or
        $receipt.rawKeyInCommandLine -ne $false -or $receipt.rawKeyInEnvironment -ne $false -or
        $receipt.providerAccessed -ne $false -or $receipt.schedulerAccessed -ne $false -or
        $receipt.ipcLane1Accessed -ne $false -or [int]$receipt.businessMutationStatements -ne 0 -or
        $receipt.sevenBackupTablesRetained -ne $true -or
        @(Compare-Object $expectedBackupTables @($receipt.backupTables | Sort-Object)).Count -ne 0) {
        throw 'D-03 encrypted local archive receipt is incomplete, stale or overclaims recovery.'
    }
    $receiptText = Get-Content -Raw -LiteralPath $Output
    foreach ($forbidden in @('rawKeyBase64','plaintextKey','providerObject','objectVersion','lockMode','legalHold')) {
        if ($receiptText -match ('(?i)"' + [regex]::Escape($forbidden) + '"')) {
            throw "D-03 receipt contains forbidden key/provider field: $forbidden"
        }
    }

    $archiveHash = Get-Sha256File $Output
    $archiveReceiptBytes = (Get-Item -LiteralPath $Output).Length
    $task4 = [ordered]@{
        status='PASS'; completedAtUtc=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        receiptPath=$Output; receiptSha256=$archiveHash; receiptBytes=$archiveReceiptBytes
        archiveReference=[string]$receipt.archiveReference; archiveSha256=[string]$receipt.archiveSha256
        archiveBytes=[long]$receipt.archiveBytes; innerManifestSha256=[string]$receipt.innerManifestSha256
        encryptionKeyReference=[string]$receipt.encryptionKeyReference
        recoveryClassification='ACCEPTED_LOCAL_ONLY_RISK'; mutationStatements=0
    }
    $run.revisedTaskCompletions | Add-Member -NotePropertyName task4 -NotePropertyValue $task4 -Force
    $run.status = 'AWAITING_LOCAL_ARCHIVE_RESTORE_APPROVAL'
    $run.currentTask = 5
    $run.currentTaskName = 'Approve exact local archive restore'
    $run.completedTasks = 4
    $run.resumeGuardrails.completedTasksPreserved = 4
    $run.resumeGuardrails.nextTask = 5
    $run.resumeGuardrails | Add-Member -NotePropertyName localArchiveMustRun -NotePropertyValue $false -Force
    $run.resumeGuardrails | Add-Member -NotePropertyName restoreApprovalRequired -NotePropertyValue $true -Force
    $resolvedManifest = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location) $Manifest }
    [System.IO.File]::WriteAllText(
        $resolvedManifest, ($run | ConvertTo-Json -Depth 30),
        (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-D03RestoreApproval {
    if ($Approval -ne 'd03-local-archive-restore') {
        throw 'Task 5 approval must be exactly d03-local-archive-restore.'
    }
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'Restore approval requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.planRevision -ne 'D03_D04_D05_8_TASK' -or
        [string]$run.status -ne 'AWAITING_LOCAL_ARCHIVE_RESTORE_APPROVAL' -or
        [int]$run.completedTasks -ne 4 -or [int]$run.currentTask -ne 5 -or
        [int]$run.totalTasks -ne 8 -or [string]$run.revisedTaskCompletions.task4.status -ne 'PASS') {
        throw 'Restore approval is not at the exact Task 5 checkpoint.'
    }
    $task4 = $run.revisedTaskCompletions.task4
    $archiveReceipt = Get-Content -Raw -LiteralPath ([string]$task4.receiptPath) | ConvertFrom-Json
    if ([string]$task4.archiveSha256 -ne 'EC5CEDEECE6C862A5B8EED630FE8CE8D59A81261117942D01FCF89393E70CBB3' -or
        [long]$task4.archiveBytes -ne 2952088 -or
        [string]$task4.innerManifestSha256 -ne 'D359AEC181B14BB7EAB22F3781B5542FCB583EE31877CF0C32AE3C7D8BEFC0CD' -or
        [string]$archiveReceipt.archiveSha256 -ne [string]$task4.archiveSha256 -or
        [long]$archiveReceipt.archiveBytes -ne [long]$task4.archiveBytes -or
        [string]$archiveReceipt.innerManifestSha256 -ne [string]$task4.innerManifestSha256 -or
        -not (Test-Path -LiteralPath ([string]$archiveReceipt.archivePath) -PathType Leaf) -or
        (Get-Sha256File ([string]$archiveReceipt.archivePath)) -ne [string]$task4.archiveSha256 -or
        [long](Get-Item -LiteralPath ([string]$archiveReceipt.archivePath)).Length -ne [long]$task4.archiveBytes) {
        throw 'Restore approval archive bytes do not match the exact reviewed checkpoint.'
    }
    Assert-D03Topology $archiveReceipt 'Task 5 approved archive'
    $restoreTarget = "ipc_restore_phase42_$RunId"
    if ($restoreTarget -ne 'ipc_restore_phase42_phase_04_2_execution') {
        throw 'Restore approval target is not the canonical run-owned target.'
    }
    $approvalReceipt = [ordered]@{
        schemaVersion=1; verifierVersion=$script:VerifierVersion; runId=$RunId; status='PASS'
        approval='d03-local-archive-restore'
        approvalReference='opaque:checkpoint:approve-phase42-local-archive-restore:2026-08-10'
        governanceApprovalIsRuntimeActorOrSignature=$false
        archiveReference=[string]$task4.archiveReference
        archiveSha256=[string]$task4.archiveSha256
        archiveBytes=[long]$task4.archiveBytes
        innerManifestSha256=[string]$task4.innerManifestSha256
        encryptionKeyReference=[string]$task4.encryptionKeyReference
        restoreTarget=$restoreTarget
        existingDatabaseRestoreAllowed=$false
        providerAccessAllowed=$false
        businessMutationAllowed=$false
        backupTableCleanupAllowed=$false
    }
    Write-Manifest $approvalReceipt
    $approvalHash = Get-Sha256File $Output
    $task5 = [ordered]@{
        status='PASS'; completedAtUtc=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        approvalReceiptPath=$Output; approvalReceiptSha256=$approvalHash
        approvalReference='opaque:checkpoint:approve-phase42-local-archive-restore:2026-08-10'
        archiveReference=[string]$task4.archiveReference; archiveSha256=[string]$task4.archiveSha256
        archiveBytes=[long]$task4.archiveBytes; innerManifestSha256=[string]$task4.innerManifestSha256
        restoreTarget=$restoreTarget; mutationStatements=0
    }
    $run.revisedTaskCompletions | Add-Member -NotePropertyName task5 -NotePropertyValue $task5 -Force
    $run.status = 'RESTORE_DRILL_PENDING'
    $run.currentTask = 6
    $run.currentTaskName = 'Restore only the approved archive and teardown'
    $run.completedTasks = 5
    $run.resumeGuardrails.completedTasksPreserved = 5
    $run.resumeGuardrails.nextTask = 6
    $run.resumeGuardrails.restoreApprovalRequired = $false
    $resolvedManifest = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location) $Manifest }
    [System.IO.File]::WriteAllText(
        $resolvedManifest, ($run | ConvertTo-Json -Depth 30),
        (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-D03RestoreDrill {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'd03-restore-drill requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.planRevision -ne 'D03_D04_D05_8_TASK' -or
        [string]$run.status -ne 'RESTORE_DRILL_PENDING' -or [int]$run.currentTask -ne 6 -or
        [int]$run.completedTasks -ne 5 -or [int]$run.totalTasks -ne 8 -or
        [string]$run.revisedTaskCompletions.task5.status -ne 'PASS') {
        throw 'D-03 restore drill is not at the exact approved Task 6 position.'
    }
    $task4 = $run.revisedTaskCompletions.task4
    $task5 = $run.revisedTaskCompletions.task5
    $archiveReceiptPath = [string]$task4.receiptPath
    $approvalReceiptPath = [string]$task5.approvalReceiptPath
    $releasePath = [string]$run.revisedTaskCompletions.task3.releasePath
    if (-not (Test-Path -LiteralPath $archiveReceiptPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $approvalReceiptPath -PathType Leaf) -or
        (Get-Sha256File $approvalReceiptPath) -ne [string]$task5.approvalReceiptSha256) {
        throw 'D-03 restore approval or archive receipt is missing or stale.'
    }
    $restoreTarget = [string]$task5.restoreTarget
    if ($restoreTarget -ne "ipc_restore_phase42_$RunId" -or
        $restoreTarget -in @('ipcmanagement','ipc_lane1','ipc_lane9','ipc_e2e_template')) {
        throw 'D-03 restore target is not the canonical run-owned target.'
    }
    $prefix = Join-Path $EvidenceRoot 'commands/06-restore-drill'
    $command = 'dotnet run --project backend/tools/IPCManagement.Phase42ArchiveTool/IPCManagement.Phase42ArchiveTool.csproj ' +
        '--no-restore -p:BaseOutputPath=backend/.artifacts/phase42-' + $RunId + '-restore-drill/ ' +
        '-p:EnableDefaultContentItems=false -p:UseAppHost=false -- ' +
        '--mode restore --settings "' + $Settings + '" --database ipcmanagement --run-id "' + $RunId +
        '" --release "' + $releasePath + '" --archive-receipt "' + $archiveReceiptPath +
        '" --approval-receipt "' + $approvalReceiptPath + '" --restore-target "' + $restoreTarget +
        '" --output "' + $Output + '"'
    $execution = Invoke-CapturedCommand $command $prefix
    if ($execution.ExitCode -ne 0) { throw (Protect-LogText $execution.StdErr) }
    if (-not (Test-Path -LiteralPath $Output -PathType Leaf)) { throw 'Restore drill did not create its receipt.' }
    $receipt = Get-Content -Raw -LiteralPath $Output | ConvertFrom-Json
    if ([string]$receipt.status -ne 'PASS' -or
        [string]$receipt.classification -ne 'ACCEPTED_LOCAL_ONLY_RISK' -or
        $receipt.approvedArchiveOnly -ne $true -or $receipt.allExactOraclesPass -ne $true -or
        $receipt.businessSourceUnchanged -ne $true -or $receipt.restoreDatabaseAbsent -ne $true -or
        $receipt.plaintextAbsent -ne $true -or $receipt.existingDatabaseTouched -ne $false -or
        $receipt.providerAccessed -ne $false -or $receipt.ipcLane1Accessed -ne $false -or
        [int]$receipt.businessMutationStatements -ne 0 -or
        [string]$receipt.archiveSha256 -ne [string]$task5.archiveSha256 -or
        [long]$receipt.archiveBytes -ne [long]$task5.archiveBytes -or
        [string]$receipt.innerManifestSha256 -ne [string]$task5.innerManifestSha256 -or
        [string]$receipt.restoreTarget -ne $restoreTarget -or
        [string]$receipt.releaseSha256 -ne [string]$run.revisedTaskCompletions.task3.releaseSha256 -or
        [int]$receipt.releaseSubjectCount -ne 3555) {
        throw 'D-03 restore drill receipt is incomplete, stale or unsafe.'
    }
    $task6 = [ordered]@{
        status='PASS'; completedAtUtc=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        receiptPath=$Output; receiptSha256=(Get-Sha256File $Output)
        archiveReference=[string]$receipt.archiveReference; archiveSha256=[string]$receipt.archiveSha256
        archiveBytes=[long]$receipt.archiveBytes; restoreTarget=$restoreTarget
        allExactOraclesPass=$true; businessSourceUnchanged=$true
        restoreDatabaseAbsent=$true; plaintextAbsent=$true; existingDatabaseTouched=$false
        mutationStatements=0
    }
    $run.revisedTaskCompletions | Add-Member -NotePropertyName task6 -NotePropertyValue $task6 -Force
    $run.status = 'SEVEN_TABLE_RETENTION_PENDING'
    $run.currentTask = 7
    $run.currentTaskName = 'Prove seven-table retention and destructive-path dormancy'
    $run.completedTasks = 6
    $run.resumeGuardrails.completedTasksPreserved = 6
    $run.resumeGuardrails.nextTask = 7
    $resolvedManifest = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location) $Manifest }
    [System.IO.File]::WriteAllText(
        $resolvedManifest, ($run | ConvertTo-Json -Depth 30),
        (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-D03SevenTableRetention {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'd03-seven-table-retention requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or [string]$run.status -ne 'SEVEN_TABLE_RETENTION_PENDING' -or
        [int]$run.currentTask -ne 7 -or [int]$run.completedTasks -ne 6 -or
        [string]$run.revisedTaskCompletions.task6.status -ne 'PASS') {
        throw 'D-03 retention proof is not at the exact Task 7 position.'
    }
    $archiveReceiptPath = [string]$run.revisedTaskCompletions.task4.receiptPath
    $restoreReceiptPath = [string]$run.revisedTaskCompletions.task6.receiptPath
    $releasePath = [string]$run.revisedTaskCompletions.task3.releasePath
    $prefix = Join-Path $EvidenceRoot 'commands/07-seven-table-retention'
    $command = 'dotnet run --project backend/tools/IPCManagement.Phase42ArchiveTool/IPCManagement.Phase42ArchiveTool.csproj ' +
        '--no-restore -p:BaseOutputPath=backend/.artifacts/phase42-' + $RunId + '-retention/ ' +
        '-p:EnableDefaultContentItems=false -p:UseAppHost=false -- ' +
        '--mode retention --settings "' + $Settings + '" --database ipcmanagement --run-id "' + $RunId +
        '" --release "' + $releasePath + '" --archive-receipt "' + $archiveReceiptPath +
        '" --restore-receipt "' + $restoreReceiptPath + '" --output "' + $Output + '"'
    $execution = Invoke-CapturedCommand $command $prefix
    if ($execution.ExitCode -ne 0) { throw (Protect-LogText $execution.StdErr) }
    $receipt = Get-Content -Raw -LiteralPath $Output | ConvertFrom-Json
    Assert-D03Topology $receipt 'DCR-09 retention proof'
    Assert-D03Retention $receipt 'DCR-09 retention proof'
    if ([string]$receipt.status -ne 'PASS' -or [int]$receipt.tablesPresentBefore -ne 7 -or
        [int]$receipt.tablesPresentAfter -ne 7 -or [int]$receipt.databaseConsumerCount -ne 0 -or
        [int]$receipt.productionConsumerCount -ne 0 -or
        [string]$receipt.businessMutationContract -ne 'SUPERSEDED_D05_NOT_APPLICABLE' -or
        [string]$receipt.businessRehearsal -ne 'NOT_RUN_D05' -or
        [string]$receipt.businessBasePromotion -ne 'NOT_RUN_D05' -or
        $receipt.providerAccessed -ne $false -or $receipt.ipcLane1Accessed -ne $false -or
        [int]$receipt.mutationStatements -ne 0) {
        throw 'D-03 seven-table retention receipt is incomplete or destructive.'
    }
    $task7 = [ordered]@{
        status='PASS'; completedAtUtc=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        receiptPath=$Output; receiptSha256=(Get-Sha256File $Output)
        tablesPresentBefore=7; tablesPresentAfter=7; retained=$true
        dropSqlStatus='DORMANT_FORBIDDEN_UNDER_D03'; destructiveExecutionCount=0
        businessMutationContract='SUPERSEDED_D05_NOT_APPLICABLE'; mutationStatements=0
    }
    $run.revisedTaskCompletions | Add-Member -NotePropertyName task7 -NotePropertyValue $task7 -Force
    $run.status = 'FINAL_AGGREGATE_PENDING'
    $run.currentTask = 8
    $run.currentTaskName = 'Run D-05/D-03 fail-fast aggregate'
    $run.completedTasks = 7
    $run.resumeGuardrails.completedTasksPreserved = 7
    $run.resumeGuardrails.nextTask = 8
    $resolvedManifest = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path (Get-Location) $Manifest }
    [System.IO.File]::WriteAllText(
        $resolvedManifest, ($run | ConvertTo-Json -Depth 30),
        (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-HygieneVerification {
    $findings = New-Object System.Collections.Generic.List[string]
    $manifestCandidate = if (-not [string]::IsNullOrWhiteSpace($Manifest) -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    } else { $null }
    $plan05Run = if ($null -ne $manifestCandidate -and [string]$manifestCandidate.planRevision -eq 'D03_D04_D05_8_TASK') {
        $manifestCandidate
    } else { $null }
    $gapRun = if ($null -ne $manifestCandidate -and [string]$manifestCandidate.planRevision -eq 'GAP_CLOSURE_TASKS_9_12') {
        $manifestCandidate
    } else { $null }
    $repoOwnedPaths = if ($null -ne $plan05Run -or $null -ne $gapRun) {
        @(
            'scripts/standardization/Invoke-Phase42AggregateVerification.ps1',
            'scripts/standardization/phase42-verification-gates.json',
            'scripts/run-frontend-unit-with-heap.mjs',
            'package.json',
            'backend/tools/IPCManagement.Phase42ArchiveTool/Program.cs',
            'backend/tests/IPCManagement.Api.Tests/Phase42AggregateVerificationTests.cs',
            'backend/tests/IPCManagement.Api.Tests/AsyncActionRoutingContractTests.cs'
        )
    } else {
        @(
            'scripts/standardization/Invoke-Phase42AggregateVerification.ps1',
            'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.cs',
            'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.Designer.cs',
            'tools/db/phase-04.2/backup-tables-preflight.sql',
            'tools/db/phase-04.2/backup-tables-drop.sql',
            'tools/db/phase-04.2/backup-tables-postflight.sql',
            'tools/db/phase-04.2/backup-tables-restore.sql'
        )
    }
    $ownedPaths = $repoOwnedPaths + @($AdditionalScanPath)
    foreach ($path in $ownedPaths | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $text = Get-Content -Raw -LiteralPath $path
        $stubText = if ($path -like '*Invoke-Phase42AggregateVerification.ps1') {
            (($text -split "`r?`n") | Where-Object { $_ -notmatch 'TODO' }) -join "`n"
        } elseif ($path -like '*Phase42AggregateVerificationTests.cs') {
            (($text -split "`r?`n") | Where-Object { $_ -notmatch 'File\.WriteAllText.*TODO' }) -join "`n"
        } else { $text }
        if ($stubText -match '(?i)\b(TODO|FIXME|coming\s+soon|not\s+available)\b') {
            $findings.Add("Stub marker in $path")
        }
        if ($text -match '(?is)(password|secret|api[-_]?key|connection[-_]?string)\s*[=:]\s*["''](?!\[?REDACTED|<required|design-time-only)[^"'']{4,}["'']') {
            $findings.Add("Secret-like value in $path")
        }
    }

    $evidenceRoots = @($EvidenceRoot)
    if ($null -ne $plan05Run -or $null -ne $gapRun) { $evidenceRoots += (Split-Path -Parent $Manifest) }
    $jsonFiles = @($evidenceRoots | Select-Object -Unique | Where-Object {
        Test-Path -LiteralPath $_ -PathType Container
    } | ForEach-Object {
        Get-ChildItem -LiteralPath $_ -Filter '*.json' -File -Recurse
    } | Sort-Object FullName -Unique)
    foreach ($file in $jsonFiles) {
        $text = Get-Content -Raw -LiteralPath $file.FullName
        if ($text -match '(?is)"(password|secret|apiKey|connectionString)"\s*:\s*"(?!\[REDACTED\]|<required)[^"]{4,}"') {
            $findings.Add("Secret-like value in evidence $($file.Name)")
        }
        if ($text -match '(?is)"actor(Id)?"\s*:\s*"(placeholder|test|demo|unknown|admin)"') {
            $findings.Add("Fabricated actor in evidence $($file.Name)")
        }
    }

    $d03Paths = if ($null -ne $gapRun) {
        [ordered]@{
            dcr07 = [string]$gapRun.archiveReceiptPath
            dcr08 = [string]$gapRun.restoreReceiptPath
            dcr09 = [string]$gapRun.retentionReceiptPath
        }
    } elseif ($null -ne $plan05Run) {
        [ordered]@{
            dcr07 = [string]$plan05Run.revisedTaskCompletions.task4.receiptPath
            dcr08 = [string]$plan05Run.revisedTaskCompletions.task6.receiptPath
            dcr09 = [string]$plan05Run.revisedTaskCompletions.task7.receiptPath
        }
    } else {
        [ordered]@{
            dcr07 = Join-Path $EvidenceRoot 'dcr-07-local-archive.json'
            dcr08 = Join-Path $EvidenceRoot 'dcr-08-approved-local-restore.json'
            dcr09 = Join-Path $EvidenceRoot 'dcr-09-seven-table-retention.json'
        }
    }
    foreach ($entry in $d03Paths.GetEnumerator()) {
        if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
            $findings.Add("Missing D-03 artifact: $($entry.Value)")
        }
    }
    if (@($findings | Where-Object { $_ -like 'Missing D-03*' }).Count -eq 0) {
        try {
            $archive = Get-Content -Raw -LiteralPath $d03Paths.dcr07 | ConvertFrom-Json
            $restore = Get-Content -Raw -LiteralPath $d03Paths.dcr08 | ConvertFrom-Json
            $retention = Get-Content -Raw -LiteralPath $d03Paths.dcr09 | ConvertFrom-Json
            Assert-D03Topology $archive 'DCR-07'
            if ($null -ne $plan05Run -or $null -ne $gapRun) {
                if ([string]$restore.classification -ne 'ACCEPTED_LOCAL_ONLY_RISK' -or
                    [string]$restore.archiveSha256 -ne [string]$archive.archiveSha256) {
                    throw 'DCR-08 is not bound to the accepted local-only archive.'
                }
            } else {
                Assert-D03Topology $restore 'DCR-08'
            }
            Assert-D03Topology $retention 'DCR-09'
            Assert-D03Retention $retention 'DCR-09'
            foreach ($activePath in @($d03Paths.dcr07, $d03Paths.dcr08, $d03Paths.dcr09)) {
                $activeText = Get-Content -Raw -LiteralPath $activePath
                if ($activeText -match '(?i)"(rawKey(?:Base64)?|keyMaterial|plaintextKey|keyBytes|keyBase64)"\s*:') {
                    $findings.Add("Raw key field in active D-03 evidence: $activePath")
                }
            }
            $expectedRestore = if ($null -ne $gapRun) {
                $approval = Get-Content -Raw -LiteralPath ([string]$gapRun.approvalReceiptPath) | ConvertFrom-Json
                if ((Get-Sha256File ([string]$gapRun.approvalReceiptPath)) -ne $script:ExpectedApprovalReceiptSha256) {
                    throw 'Gap approval receipt hash is stale.'
                }
                [string]$approval.restoreTarget
            } else { "ipc_restore_phase42_$RunId" }
            if ($restore.approvedArchiveOnly -ne $true -or $restore.restoreDatabaseAbsent -ne $true -or
                $restore.plaintextAbsent -ne $true -or $restore.existingDatabaseTouched -ne $false -or
                [string]$restore.restoreTarget -ne $expectedRestore) {
                $findings.Add('Invalid approved-local-archive restore or teardown proof.')
            }
        }
        catch {
            $findings.Add("Invalid D-03 evidence: $($_.Exception.Message)")
        }
    }

    $dirtyOwned = @((git status --porcelain -- $repoOwnedPaths) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $status = if ($findings.Count -eq 0) { 'PASS' } else { 'FAILED' }
    Write-Manifest ([ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        evidenceRunId = if ($null -ne $gapRun) { $RunId } else { $null }
        archiveRunId = if ($null -ne $gapRun) { $ArchiveRunId } else { $null }
        target = $Target
        migrationHead = $MigrationHead
        status = $status
        checks = [ordered]@{
            secretScan = if (@($findings | Where-Object { $_ -like 'Secret-*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            stubScan = if (@($findings | Where-Object { $_ -like 'Stub*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            rawKeyScan = if (@($findings | Where-Object { $_ -like 'Raw key*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            d03TopologyScan = if (@($findings | Where-Object { $_ -like '*D-03*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            destructiveDormancyScan = if (@($findings | Where-Object { $_ -like '*destructive*' -or $_ -like '*retention*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            fabricatedActorScan = if (@($findings | Where-Object { $_ -like 'Fabricated*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            teardownReconciliation = if (@($findings | Where-Object { $_ -like '*teardown*' -or $_ -like '*restore*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            dirtyOwnedPaths = $dirtyOwned
        }
        findings = @($findings | ForEach-Object { Protect-LogText $_ })
    })
    return $(if ($status -eq 'PASS') { 0 } else { 1 })
}

function Invoke-Phase42AggregateVerification {
    if (-not [string]::IsNullOrWhiteSpace($StopAfter) -and -not [string]::IsNullOrWhiteSpace($Only)) {
        throw '-StopAfter and -Only are mutually exclusive.'
    }
    $resolvedSpec = (Resolve-Path -LiteralPath $GateSpec).Path
    $spec = Get-Content -Raw -LiteralPath $resolvedSpec | ConvertFrom-Json
    $script:SelectorContract = if ($spec.PSObject.Properties.Name -contains 'selectorContract') {
        $spec.selectorContract
    } else {
        [pscustomobject]@{
            retiredSelectors = @()
            retiredFunctions = @()
            retiredAuthorityTokens = @()
            activeStopAfterSelectors = @()
            activeOnlySelectors = @()
        }
    }
    $retiredSelectors = @($script:SelectorContract.retiredSelectors | ForEach-Object { [string]$_ })
    if ($retiredSelectors -contains $StopAfter -or $retiredSelectors -contains $Only) {
        $script:SelectorRejected = $true
        throw 'SUPERSEDED_D05_NOT_APPLICABLE: aggregate selector is retired.'
    }
    if ([string]::IsNullOrWhiteSpace($Output) -and $Only -eq 'approval-check' -and
        -not [string]::IsNullOrWhiteSpace($Manifest)) {
        $Output = "$Manifest.restore-approval.json"
    }
    if ([string]::IsNullOrWhiteSpace($Output)) { throw '-Output is required.' }
    if (-not [string]::IsNullOrWhiteSpace($Database)) {
        if (-not [string]::IsNullOrWhiteSpace($Target) -and $Target -ne $Database) {
            throw '-Target and -Database must identify the same exact database.'
        }
        $Target = $Database
    }
    if ($Only -in @($script:SelectorContract.activeOnlySelectors) -and
        -not [string]::IsNullOrWhiteSpace($Manifest) -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        $manifestHeader = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($Target)) { $Target = [string]$manifestHeader.target }
        if ([string]::IsNullOrWhiteSpace($MigrationHead)) { $MigrationHead = [string]$manifestHeader.migrationHead }
    }
    $script:Target = $Target
    $specHash = Get-Sha256File $resolvedSpec
    $sourceCommit = (git rev-parse HEAD).Trim()
    $orders = @($spec.gates | ForEach-Object { [int]$_.order })
    if (($orders -join ',') -ne ((1..$orders.Count) -join ',')) { throw 'Gate order must be contiguous and start at one.' }
    if (@($spec.gates.id | Select-Object -Unique).Count -ne @($spec.gates).Count) { throw 'Gate IDs must be unique.' }

    if ($ContractOnly) {
        $contractGates = @($spec.gates | ForEach-Object { New-NotRunGate $_ $sourceCommit $specHash $true })
        Write-Manifest ([ordered]@{
            schemaVersion = 1
            verifierVersion = $script:VerifierVersion
            contractOnly = $true
            runId = '<required-at-execution>'
            target = '<required-at-execution>'
            sourceCommit = $sourceCommit
            status = 'NOT_RUN'
            requirementsPassed = 0
            requirementsTotal = [int]$spec.requirementsTotal
            gates = $contractGates
        })
        return 0
    }

    if ([string]::IsNullOrWhiteSpace($RunId) -or $RunId -notmatch '^[a-z0-9_]+$') { throw 'A lowercase run-owned -RunId is required.' }
    if ($Only -eq 'gap-source-contract') { return Invoke-GapSourceContract }
    if ([string]::IsNullOrWhiteSpace($Target)) { throw 'An explicit -Target is required.' }
    if ($Target -eq 'ipc_lane1' -or $Target -notmatch '^(ipcmanagement|ipc_rehearsal_phase42_[a-z0-9_]+|ipc_restore_phase42_[a-z0-9_]+)$') {
        throw "Aggregate target is forbidden: $Target"
    }
    if ($HygieneOnly) { return Invoke-HygieneVerification }
    if ($StopAfter -eq 'local-archive') { return Invoke-D03LocalArchive }
    if ($Only -eq 'd03-rebind-check') { return Invoke-D03RebindCheck }
    if ($Only -eq 'd04-role-rebind-check') { return Invoke-D04RoleRebindCheck }
    if ($Only -eq 'd05-evidence-release') { return Invoke-D05EvidenceRelease }
    if ($Only -eq 'approval-check') { return Invoke-D03RestoreApproval }
    if ($Only -eq 'd03-restore-drill') { return Invoke-D03RestoreDrill }
    if ($Only -eq 'd03-seven-table-retention') { return Invoke-D03SevenTableRetention }
    if ([string]::IsNullOrWhiteSpace($MigrationHead)) { throw 'An explicit -MigrationHead is required.' }
    if (-not [string]::IsNullOrWhiteSpace($StopAfter) -and
        @($script:SelectorContract.activeStopAfterSelectors) -notcontains $StopAfter -and
        @($spec.gates.id) -notcontains $StopAfter) {
        throw "Unknown -StopAfter selector: $StopAfter"
    }
    if (-not [string]::IsNullOrWhiteSpace($Only) -and
        @($script:SelectorContract.activeOnlySelectors) -notcontains $Only -and
        @($spec.gates.id) -notcontains $Only) {
        throw "Unknown -Only selector: $Only"
    }
    if (-not [string]::IsNullOrWhiteSpace($Manifest) -and -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw "Manifest is missing: $Manifest"
    }

    $gateResults = New-Object System.Collections.Generic.List[object]
    $failed = $false
    $stopped = $false
    foreach ($gate in $spec.gates) {
        if ($failed -or $stopped -or (-not [string]::IsNullOrWhiteSpace($Only) -and $gate.id -ne $Only)) {
            $gateResults.Add((New-NotRunGate $gate $sourceCommit $specHash $false))
            continue
        }
        $prefix = Join-Path $EvidenceRoot ("commands/{0:D2}-{1}" -f [int]$gate.order, $gate.id)
        $gateArtifact = "$prefix.result.json"
        $command = Resolve-CommandTokens $gate.command $gateArtifact
        $version = if ($gate.versionCommand -eq 'phase42-verifier --version') {
            $script:VerifierVersion
        } else {
            $versionResult = Invoke-CapturedCommand $gate.versionCommand "$prefix.version"
            if ($versionResult.ExitCode -eq 0) { $versionResult.StdOut.Trim() } else { 'VERSION_COMMAND_FAILED' }
        }
        $execution = if ($gate.kind -eq 'artifact') {
            Test-ArtifactGate $gate
        } else {
            Invoke-CapturedCommand $command $prefix
        }
        $combined = "$($execution.StdOut)`n$($execution.StdErr)"
        $status = if ($execution.ExitCode -eq 0) { 'PASS' } else { 'FAILED' }
        $artifactPath = if ($execution.PSObject.Properties.Name -contains 'ArtifactPath') { $execution.ArtifactPath } else { "$prefix.stdout.txt" }
        $result = [ordered]@{
            gateId = $gate.id
            requirementId = $gate.requirementId
            command = $command
            commandVersion = $version
            sourceCommit = $sourceCommit
            target = if ($gate.targetMode -eq 'explicit') { $Target } else { 'N/A' }
            migrationHead = $MigrationHead
            inputHashes = [ordered]@{ gateSpec = $specHash; artifact = Get-Sha256File $artifactPath }
            artifactPath = $artifactPath
            status = $status
            exitCode = [int]$execution.ExitCode
            counts = Get-CommandCounts $combined
            stdoutSha256 = Get-Sha256Text $execution.StdOut
            stderrSha256 = Get-Sha256Text $execution.StdErr
            redactedError = if ($execution.ExitCode -eq 0) { $null } else { Protect-LogText $execution.StdErr }
        }
        $gateResults.Add($result)
        if ($status -ne 'PASS') { $failed = $true }
        if (-not $failed -and -not [string]::IsNullOrWhiteSpace($StopAfter) -and $gate.id -eq $StopAfter) {
            $stopped = $true
        }
    }

    $requirements = @($spec.gates.requirementId | Where-Object { $null -ne $_ } | Select-Object -Unique)
    $requirementsPassed = @($requirements | Where-Object {
        $requirement = $_
        @($gateResults | Where-Object { $_.requirementId -eq $requirement -and $_.status -ne 'PASS' }).Count -eq 0
    }).Count
    $overallStatus = if ($failed) { 'FAILED' }
        elseif ($stopped) { 'STOPPED' }
        elseif (-not [string]::IsNullOrWhiteSpace($Only)) { 'PASS' }
        elseif ($requirementsPassed -eq [int]$spec.requirementsTotal) { 'PASS' }
        else { 'FAILED' }
    $report = [ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        contractOnly = $false
        runId = $RunId
        target = $Target
        migrationHead = $MigrationHead
        sourceCommit = $sourceCommit
        status = $overallStatus
        stoppedAfter = if ($stopped) { $StopAfter } else { $null }
        selectedOnly = if ([string]::IsNullOrWhiteSpace($Only)) { $null } else { $Only }
        manifest = if ([string]::IsNullOrWhiteSpace($Manifest)) { $null } else { $Manifest }
        failFast = $true
        requirementsPassed = $requirementsPassed
        requirementsTotal = [int]$spec.requirementsTotal
        gates = [object[]]$gateResults
    }
    $gapRun = if (-not [string]::IsNullOrWhiteSpace($Manifest) -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        $candidate = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
        if ([string]$candidate.planRevision -eq 'GAP_CLOSURE_TASKS_9_12') { $candidate } else { $null }
    } else { $null }
    if ($null -ne $gapRun) {
        $source = Get-Content -Raw -LiteralPath ([string]$gapRun.sourceContractPath) | ConvertFrom-Json
        $restore = Get-Content -Raw -LiteralPath ([string]$gapRun.restoreReceiptPath) | ConvertFrom-Json
        $repositoryIds = @($source.repositoryMigrationIds | ForEach-Object { [string]$_ })
        $archiveIds = @($source.archiveMigrationIds | ForEach-Object { [string]$_ })
        $restoreIds = @($restore.migrationIds | ForEach-Object { [string]$_ })
        $repositoryArchiveRestoreMigrationIdsExact =
            ($repositoryIds -join "`n") -eq ($archiveIds -join "`n") -and
            ($repositoryIds -join "`n") -eq ($restoreIds -join "`n")
        $rootGate = @($gateResults | Where-Object { $_.gateId -eq 'ver-03-root-verify' }) | Select-Object -First 1
        $report.evidenceRunId = $RunId
        $report.archiveRunId = $ArchiveRunId
        $report.expectedRestoreTargetSource = 'IMMUTABLE_APPROVAL_RECEIPT'
        $report.expectedRestoreTarget = [string]$source.expectedRestoreTarget
        $report.approvalReceiptSha256 = [string]$source.approvalReceiptSha256
        $report.approvalArchiveBindingExact = [bool]$source.approvalArchiveBindingExact
        $report.repositoryMigrationIds = $repositoryIds
        $report.repositoryMigrationCount = $repositoryIds.Count
        $report.repositoryMigrationHead = [string]$source.repositoryMigrationHead
        $report.repositoryArchiveRestoreMigrationIdsExact = $repositoryArchiveRestoreMigrationIdsExact
        $report.rootVerifyPass = $null -ne $rootGate -and [string]$rootGate.status -eq 'PASS'
        $report.restoreDatabaseAbsent = [bool]$restore.restoreDatabaseAbsent
        $report.plaintextAbsent = [bool]$restore.plaintextAbsent
        $report.baseMutationStatements = 0
        $report.ipcLane1Accessed = $false
        $report.providerAccessed = $false
    }
    Write-Manifest $report
    return $(if ($overallStatus -in @('PASS', 'STOPPED')) { 0 } else { 1 })
}

try {
    exit (Invoke-Phase42AggregateVerification)
}
catch {
    if (-not [string]::IsNullOrWhiteSpace($Output) -and
        [string]::IsNullOrWhiteSpace($Only) -and -not $script:SelectorRejected) {
        try {
            Write-Manifest ([ordered]@{
                schemaVersion = 1
                verifierVersion = $script:VerifierVersion
                contractOnly = [bool]$ContractOnly
                runId = $RunId
                target = $Target
                status = 'FAILED'
                requirementsPassed = 0
                requirementsTotal = 10
                redactedError = Protect-LogText $_.Exception.Message
                gates = @()
            })
        } catch { }
    }
    [Console]::Error.WriteLine((Protect-LogText $_.Exception.Message))
    exit 1
}
