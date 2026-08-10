[CmdletBinding()]
param(
    [switch]$ContractOnly,
    [switch]$HygieneOnly,
    [switch]$FailFast,
    [string]$GateSpec = 'scripts/standardization/phase42-verification-gates.json',
    [string]$Output,
    [string]$RunId,
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
$script:VerifierVersion = '1.1.0'
$script:Plan05StopModes = @(
    'package-export', 'business-release-preflight', 'business-base-and-lock-preflight',
    'business-base-promotion', 'restore-preflight', 'cleanup-release-preflight',
    'cleanup-base-preflight', 'cleanup-base-promotion'
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
    $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/s', '/c', "`"$commandFile`"") `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -Wait -PassThru -NoNewWindow
    $stdout = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -Raw -LiteralPath $stdoutPath } else { '' }
    $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw -LiteralPath $stderrPath } else { '' }
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        StdOut = $stdout
        StdErr = $stderr
        StdOutPath = $stdoutPath
        StdErrPath = $stderrPath
    }
}

function Resolve-CommandTokens([string]$Command, [string]$GateArtifactPath) {
    $resolved = $Command.Replace('{runId}', $RunId).Replace('{target}', $Target)
    $resolved = $resolved.Replace('{migrationHead}', $MigrationHead).Replace('{evidenceRoot}', $EvidenceRoot)
    $resolved = $resolved.Replace('{artifactPath}', $GateArtifactPath)
    return $resolved
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

function Test-ArtifactGate($Gate) {
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

function Invoke-PackageExport {
    if ([string]::IsNullOrWhiteSpace($Output)) { throw '-Output is required for package-export.' }
    if ($Target -ne 'ipcmanagement') { throw "Package export target is forbidden: $Target" }
    if (-not (Test-Path -LiteralPath $Settings -PathType Leaf)) { throw "Settings file is missing: $Settings" }
    $prefix = Join-Path $EvidenceRoot 'commands/00-package-export'
    $command = 'dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj ' +
        '--no-restore -p:BaseOutputPath=backend/.artifacts/phase42-' + $RunId + '-export/ ' +
        '-p:EnableDefaultContentItems=false -p:UseAppHost=false -- business-evidence-export ' +
        '--settings "' + $Settings + '" --database "' + $Target + '" --output "' + $Output + '"'
    $execution = Invoke-CapturedCommand $command $prefix
    if ($execution.ExitCode -ne 0) { throw (Protect-LogText $execution.StdErr) }
    if (-not (Test-Path -LiteralPath $Output -PathType Leaf)) { throw 'Package exporter did not create its output.' }
    $sidecar = "$Output.sha256"
    if (-not (Test-Path -LiteralPath $sidecar -PathType Leaf)) { throw 'Package exporter did not create the exact-byte hash sidecar.' }
    $declared = (Get-Content -Raw -LiteralPath $sidecar).Trim()
    $actual = Get-Sha256File $Output
    if ($declared -ne $actual) { throw 'Package exact-byte SHA-256 sidecar does not match persisted UTF-8 bytes.' }
    return 0
}

function Invoke-AuthorityCheck {
    if ([string]::IsNullOrWhiteSpace($Manifest) -or -not (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        throw 'authority-check requires an existing -Manifest.'
    }
    $run = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
    if ($run.runId -ne $RunId -or $run.target -ne $Target) { throw 'Authority manifest run/target does not match.' }
    $packagePath = [string]$run.task1.packagePath
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { throw 'Signed business package is missing.' }
    $packageHash = Get-Sha256File $packagePath
    if ($packageHash -ne [string]$run.task1.packageSha256) { throw 'Signed business package digest is stale.' }

    $requiredBusinessSlots = @(
        'WAREHOUSE_SOURCE_OWNER', 'FINANCE_SOURCE_OWNER', 'COORDINATION_SOURCE_OWNER',
        'UNIT_SOURCE_OWNER', 'PURCHASING_SOURCE_OWNER', 'BOM_SOURCE_OWNER',
        'CATALOG_SOURCE_OWNER', 'WAREHOUSE_IMPACT_OWNER', 'PURCHASING_IMPACT_OWNER'
    )
    if ($run.PSObject.Properties.Name -notcontains 'authorityRecords' -or
        $null -eq $run.authorityRecords -or $null -eq $run.authorityRecords.business) {
        throw 'Authority records are not supplied.'
    }
    $records = @($run.authorityRecords.business)
    foreach ($slot in $requiredBusinessSlots) {
        $matches = @($records | Where-Object { $_.authoritySlot -eq $slot })
        if ($matches.Count -ne 1) { throw "Authority slot must occur exactly once: $slot" }
        $record = $matches[0]
        foreach ($field in @('actorReference', 'authorityReference', 'authoritySha256', 'signedAtUtc')) {
            if ([string]::IsNullOrWhiteSpace([string]$record.$field)) { throw "Authority $slot is missing $field." }
        }
        if ([string]$record.packageSha256 -ne $packageHash) { throw "Authority $slot signed a different package digest." }
        if ([string]$record.authoritySha256 -notmatch '^[A-Fa-f0-9]{64}$') { throw "Authority $slot has an invalid authority digest." }
        if ([string]$record.actorReference -match '(?i)^(placeholder|test|demo|unknown|admin)$') {
            throw "Authority $slot uses a fabricated actor reference."
        }
    }
    $warehouse = [string](@($records | Where-Object authoritySlot -eq 'WAREHOUSE_SOURCE_OWNER')[0].actorReference)
    $finance = [string](@($records | Where-Object authoritySlot -eq 'FINANCE_SOURCE_OWNER')[0].actorReference)
    if ($warehouse -eq $finance) { throw 'Warehouse and Finance source owners must be independent.' }

    $provider = $run.authorityRecords.provider
    foreach ($field in @(
        'providerReference', 'accountReference', 'containerReference', 'securityDomainReference',
        'rpo', 'rto', 'lockMode', 'retainUntilPolicyReference', 'legalHoldDecisionReference',
        'keyOwnerReference', 'keyCustodyReference', 'keyRecoveryReference',
        'credentialReference', 'legacyScheduleOverlapDecisionReference')) {
        if ([string]::IsNullOrWhiteSpace([string]$provider.$field)) { throw "Provider authority is missing $field." }
        if ([string]$provider.$field -match '(?i)(^[A-Z]:\\|^file:|^\\\\|placeholder|unknown|demo)') {
            throw "Provider authority $field is local or fabricated."
        }
    }
    $manifestText = Get-Content -Raw -LiteralPath $Manifest
    if ($manifestText -match '(?is)"(password|secret|token|apiKey|connectionString|keyMaterial)"\s*:') {
        throw 'Authority manifest contains a prohibited secret-value field.'
    }
    $receiptPath = "$Manifest.authority-check.json"
    $receipt = [ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        target = $Target
        packageSha256 = $packageHash
        businessAuthoritySlots = $requiredBusinessSlots
        providerAuthority = 'PASS'
        status = 'PASS'
        mutationStatements = 0
    }
    $json = $receipt | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $receiptPath), $json, (New-Object System.Text.UTF8Encoding($false)))
    return 0
}

function Invoke-HygieneVerification {
    $findings = New-Object System.Collections.Generic.List[string]
    $repoOwnedPaths = @(
        'scripts/standardization/Invoke-Phase42AggregateVerification.ps1',
        'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.cs',
        'backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.Designer.cs',
        'tools/db/phase-04.2/backup-tables-preflight.sql',
        'tools/db/phase-04.2/backup-tables-drop.sql',
        'tools/db/phase-04.2/backup-tables-postflight.sql',
        'tools/db/phase-04.2/backup-tables-restore.sql'
    )
    $ownedPaths = $repoOwnedPaths + @($AdditionalScanPath)
    foreach ($path in $ownedPaths | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $text = Get-Content -Raw -LiteralPath $path
        $stubText = if ($path -like '*Invoke-Phase42AggregateVerification.ps1') {
            (($text -split "`r?`n") | Where-Object { $_ -notmatch 'TODO' }) -join "`n"
        } else { $text }
        if ($stubText -match '(?i)\b(TODO|FIXME|coming\s+soon|not\s+available)\b') {
            $findings.Add("Stub marker in $path")
        }
        if ($text -match '(?is)(password|secret|api[-_]?key|connection[-_]?string)\s*[=:]\s*["'']?(?!\[?REDACTED|<required|design-time-only)[^\s;"'']{4,}') {
            $findings.Add("Secret-like value in $path")
        }
    }

    $jsonFiles = if (Test-Path -LiteralPath $EvidenceRoot -PathType Container) {
        @(Get-ChildItem -LiteralPath $EvidenceRoot -Filter '*.json' -File -Recurse)
    } else { @() }
    foreach ($file in $jsonFiles) {
        $text = Get-Content -Raw -LiteralPath $file.FullName
        if ($text -match '(?is)"(password|secret|apiKey|connectionString)"\s*:\s*"(?!\[REDACTED\]|<required)[^"]{4,}"') {
            $findings.Add("Secret-like value in evidence $($file.Name)")
        }
        if ($text -match '(?is)"actor(Id)?"\s*:\s*"(placeholder|test|demo|unknown|admin)"') {
            $findings.Add("Fabricated actor in evidence $($file.Name)")
        }
    }

    $providerPath = Join-Path $EvidenceRoot 'dcr-07-provider-object-receipt.json'
    if (-not (Test-Path -LiteralPath $providerPath -PathType Leaf)) {
        $findings.Add('Missing provider-object receipt.')
    } else {
        $providerText = Get-Content -Raw -LiteralPath $providerPath
        if ($providerText -match '(?i)"provider"\s*:\s*"(local|filesystem|file)') {
            $findings.Add('Local filesystem is not an off-site provider.')
        }
        if ($providerText -match '(?i)"(objectKey|offsite|destination)"\s*:\s*"([A-Z]:\\|file:|\\\\)') {
            $findings.Add('Local path is presented as off-site evidence.')
        }
    }

    foreach ($teardown in @(
        @{ File = 'dcr-08-remote-restore.json'; Prefix = 'ipc_restore_' },
        @{ File = 'dcr-09-cleanup-rehearsal-promotion.json'; Prefix = 'ipc_rehearsal_phase42_' }
    )) {
        $path = Join-Path $EvidenceRoot $teardown.File
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $findings.Add("Missing teardown artifact: $($teardown.File)")
            continue
        }
        try {
            $artifact = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
            $proof = $artifact.teardown
            $expected = "$($teardown.Prefix)$RunId"
            if ($proof.target -ne $expected -or $proof.runId -ne $RunId -or $proof.absentAfterTeardown -ne $true) {
                $findings.Add("Invalid run-owned teardown proof: $($teardown.File)")
            }
        } catch {
            $findings.Add("Invalid teardown JSON: $($teardown.File)")
        }
    }

    $dirtyOwned = @((git status --porcelain -- $repoOwnedPaths) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $status = if ($findings.Count -eq 0) { 'PASS' } else { 'FAILED' }
    Write-Manifest ([ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        runId = $RunId
        target = $Target
        migrationHead = $MigrationHead
        status = $status
        checks = [ordered]@{
            secretScan = if (@($findings | Where-Object { $_ -like 'Secret-*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            stubScan = if (@($findings | Where-Object { $_ -like 'Stub*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            localOffsiteScan = if (@($findings | Where-Object { $_ -like 'Local*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            fabricatedActorScan = if (@($findings | Where-Object { $_ -like 'Fabricated*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            teardownReconciliation = if (@($findings | Where-Object { $_ -like '*teardown*' }).Count -eq 0) { 'PASS' } else { 'FAILED' }
            dirtyOwnedPaths = $dirtyOwned
        }
        findings = @($findings | ForEach-Object { Protect-LogText $_ })
    })
    return $(if ($status -eq 'PASS') { 0 } else { 1 })
}

function Invoke-Phase42AggregateVerification {
    if ([string]::IsNullOrWhiteSpace($Output)) { throw '-Output is required.' }
    if (-not [string]::IsNullOrWhiteSpace($Database)) {
        if (-not [string]::IsNullOrWhiteSpace($Target) -and $Target -ne $Database) {
            throw '-Target and -Database must identify the same exact database.'
        }
        $Target = $Database
    }
    if ($StopAfter -eq 'package-export' -and [string]::IsNullOrWhiteSpace($Target)) {
        $Target = 'ipcmanagement'
    }
    if ($Only -in @('authority-check', 'approval-check') -and
        -not [string]::IsNullOrWhiteSpace($Manifest) -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
        $manifestHeader = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($Target)) { $Target = [string]$manifestHeader.target }
        if ([string]::IsNullOrWhiteSpace($MigrationHead)) { $MigrationHead = [string]$manifestHeader.migrationHead }
    }
    $script:Target = $Target
    if (-not [string]::IsNullOrWhiteSpace($StopAfter) -and -not [string]::IsNullOrWhiteSpace($Only)) {
        throw '-StopAfter and -Only are mutually exclusive.'
    }
    $resolvedSpec = (Resolve-Path -LiteralPath $GateSpec).Path
    $spec = Get-Content -Raw -LiteralPath $resolvedSpec | ConvertFrom-Json
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
    if ([string]::IsNullOrWhiteSpace($Target)) { throw 'An explicit -Target is required.' }
    if ($Target -eq 'ipc_lane1' -or $Target -notmatch '^(ipcmanagement|ipc_rehearsal_phase42_[a-z0-9_]+|ipc_restore_[a-z0-9_]+)$') {
        throw "Aggregate target is forbidden: $Target"
    }
    if ($HygieneOnly) { return Invoke-HygieneVerification }
    if ($StopAfter -eq 'package-export') { return Invoke-PackageExport }
    if ($Only -eq 'authority-check') { return Invoke-AuthorityCheck }
    if ([string]::IsNullOrWhiteSpace($MigrationHead)) { throw 'An explicit -MigrationHead is required.' }
    if (-not [string]::IsNullOrWhiteSpace($StopAfter) -and $script:Plan05StopModes -notcontains $StopAfter -and
        @($spec.gates.id) -notcontains $StopAfter) {
        throw "Unknown -StopAfter selector: $StopAfter"
    }
    if (-not [string]::IsNullOrWhiteSpace($StopAfter) -and $script:Plan05StopModes -contains $StopAfter) {
        throw "Plan 05 mode '$StopAfter' is declared but has no reviewed executor registered."
    }
    if (-not [string]::IsNullOrWhiteSpace($Only) -and @($spec.gates.id) -notcontains $Only) {
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
    Write-Manifest ([ordered]@{
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
    })
    return $(if ($overallStatus -in @('PASS', 'STOPPED')) { 0 } else { 1 })
}

try {
    exit (Invoke-Phase42AggregateVerification)
}
catch {
    if (-not [string]::IsNullOrWhiteSpace($Output) -and
        [string]::IsNullOrWhiteSpace($Only) -and $StopAfter -ne 'package-export') {
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
