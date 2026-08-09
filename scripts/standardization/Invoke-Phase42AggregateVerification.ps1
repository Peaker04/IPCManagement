[CmdletBinding()]
param(
    [switch]$ContractOnly,
    [switch]$HygieneOnly,
    [string]$GateSpec = 'scripts/standardization/phase42-verification-gates.json',
    [string]$Output,
    [string]$RunId,
    [string]$Target,
    [string]$MigrationHead,
    [string]$EvidenceRoot = '.artifacts/shipyard-live/phase-04.2'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$script:VerifierVersion = '1.0.0'

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
    $resolved = $resolved.Replace('{evidenceRoot}', $EvidenceRoot).Replace('{artifactPath}', $GateArtifactPath)
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

function Invoke-HygieneVerification {
    throw 'Hygiene verification requires the complete Plan 04 reconciliation implementation.'
}

function Invoke-Phase42AggregateVerification {
    if ([string]::IsNullOrWhiteSpace($Output)) { throw '-Output is required.' }
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

    if ($HygieneOnly) { return Invoke-HygieneVerification }
    if ([string]::IsNullOrWhiteSpace($RunId) -or $RunId -notmatch '^[a-z0-9_]+$') { throw 'A lowercase run-owned -RunId is required.' }
    if ([string]::IsNullOrWhiteSpace($Target)) { throw 'An explicit -Target is required.' }
    if ($Target -eq 'ipc_lane1' -or $Target -notmatch '^(ipcmanagement|ipc_rehearsal_phase42_[a-z0-9_]+|ipc_restore_[a-z0-9_]+)$') {
        throw "Aggregate target is forbidden: $Target"
    }
    if ([string]::IsNullOrWhiteSpace($MigrationHead)) { throw 'An explicit -MigrationHead is required.' }

    $gateResults = New-Object System.Collections.Generic.List[object]
    $failed = $false
    foreach ($gate in $spec.gates) {
        if ($failed) {
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
    }

    $requirements = @($spec.gates.requirementId | Where-Object { $null -ne $_ } | Select-Object -Unique)
    $requirementsPassed = @($requirements | Where-Object {
        $requirement = $_
        @($gateResults | Where-Object { $_.requirementId -eq $requirement -and $_.status -ne 'PASS' }).Count -eq 0
    }).Count
    $overallStatus = if (-not $failed -and $requirementsPassed -eq [int]$spec.requirementsTotal) { 'PASS' } else { 'FAILED' }
    Write-Manifest ([ordered]@{
        schemaVersion = 1
        verifierVersion = $script:VerifierVersion
        contractOnly = $false
        runId = $RunId
        target = $Target
        migrationHead = $MigrationHead
        sourceCommit = $sourceCommit
        status = $overallStatus
        requirementsPassed = $requirementsPassed
        requirementsTotal = [int]$spec.requirementsTotal
        gates = [object[]]$gateResults
    })
    return $(if ($overallStatus -eq 'PASS') { 0 } else { 1 })
}

try {
    exit (Invoke-Phase42AggregateVerification)
}
catch {
    if (-not [string]::IsNullOrWhiteSpace($Output)) {
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
