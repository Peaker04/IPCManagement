Set-StrictMode -Version Latest

function Assert-ProviderReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object]$Receipt
    )

    $required = @(
        'provider', 'accountSecurityDomain', 'objectKey', 'objectVersion',
        'archiveSha256', 'archiveBytes', 'encryptionKeyReference', 'lockMode',
        'lockState', 'retainUntilUtc', 'legalHoldState', 'uploadRequestId',
        'metadataRequestId', 'downloadRequestId'
    )
    foreach ($field in $required) {
        if ($null -eq $Receipt.$field -or [string]::IsNullOrWhiteSpace([string]$Receipt.$field)) {
            throw "Provider receipt is missing required field: $field"
        }
    }

    if ([string]$Receipt.archiveSha256 -notmatch '^[A-Fa-f0-9]{64}$') {
        throw 'Provider receipt archiveSha256 must be a SHA-256 value.'
    }
    if ([long]$Receipt.archiveBytes -le 0) {
        throw 'Provider receipt archiveBytes must be positive.'
    }
    if ([string]$Receipt.lockMode -notin @('COMPLIANCE', 'GOVERNANCE')) {
        throw 'Provider receipt lockMode is not allowed.'
    }
    if ([string]$Receipt.lockState -notin @('LOCKED', 'RETAINED')) {
        throw 'Provider receipt lockState does not prove immutability.'
    }
    if ([string]$Receipt.legalHoldState -notin @('ON', 'OFF')) {
        throw 'Provider receipt legalHoldState is invalid.'
    }
    [DateTimeOffset]$retainUntil = $Receipt.retainUntilUtc
    if ($retainUntil -le [DateTimeOffset]::UtcNow) {
        throw 'Provider receipt retainUntilUtc has expired.'
    }
    return $Receipt
}

function Get-LiveImmutableObjectMetadata {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object]$Receipt,
        [Parameter(Mandatory = $true)][scriptblock]$ProviderAdapter
    )

    if ($null -eq $ProviderAdapter) {
        throw 'Provider adapter is not configured; live object proof is required.'
    }
    $live = & $ProviderAdapter -Receipt $Receipt
    if ($null -eq $live) {
        throw 'Provider adapter returned no live metadata.'
    }
    return $live
}

function Publish-ImmutableObjectVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ArchivePath,
        [Parameter(Mandatory = $true)][string]$ObjectKey,
        [Parameter(Mandatory = $true)][string]$EncryptionKeyReference,
        [Parameter(Mandatory = $true)][scriptblock]$ProviderAdapter
    )

    if ($null -eq $ProviderAdapter) {
        throw 'Provider adapter is not configured; immutable upload is required.'
    }
    if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
        throw 'Encrypted archive does not exist.'
    }
    $receipt = & $ProviderAdapter -ArchivePath $ArchivePath -ObjectKey $ObjectKey `
        -EncryptionKeyReference $EncryptionKeyReference
    Assert-ProviderReceipt $receipt | Out-Null
    return $receipt
}

function Assert-LiveRetentionMatchesReceipt {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object]$Receipt,
        [Parameter(Mandatory = $true)][object]$LiveMetadata
    )

    Assert-ProviderReceipt $Receipt | Out-Null
    foreach ($field in @(
            'provider', 'accountSecurityDomain', 'objectKey', 'objectVersion',
            'archiveSha256', 'archiveBytes', 'encryptionKeyReference', 'lockMode',
            'lockState', 'retainUntilUtc', 'legalHoldState')) {
        if ([string]$Receipt.$field -ne [string]$LiveMetadata.$field) {
            throw "Live provider metadata mismatch: $field"
        }
    }
    foreach ($field in @('uploadRequestId', 'metadataRequestId')) {
        if ([string]$LiveMetadata.$field -ne [string]$Receipt.$field) {
            throw "Live provider audit metadata mismatch: $field"
        }
    }
    return $true
}

function Receive-ImmutableObjectVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object]$Receipt,
        [Parameter(Mandatory = $true)][scriptblock]$ProviderAdapter,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if ($null -eq $ProviderAdapter) {
        throw 'Provider adapter is not configured; remote download is required.'
    }
    Assert-ProviderReceipt $Receipt | Out-Null
    $result = & $ProviderAdapter -Receipt $Receipt -Destination $Destination
    if ($null -eq $result -or [string]::IsNullOrWhiteSpace([string]$result.archivePath)) {
        throw 'Provider adapter returned no downloaded archive.'
    }
    return $result
}

function Assert-NewRestoreTarget {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][scriptblock]$TestDatabaseExists
    )

    if ($DatabaseName -notmatch '^ipc_restore_[a-z0-9_]+$') {
        throw 'Restore target must match ^ipc_restore_[a-z0-9_]+$.'
    }
    if ($DatabaseName -in @('ipcmanagement', 'ipc_lane1', 'ipc_lane9', 'ipc_e2e_template')) {
        throw 'Restore target cannot be a base, lane or template database.'
    }
    if (& $TestDatabaseExists -DatabaseName $DatabaseName) {
        throw "Restore target already exists: $DatabaseName"
    }
    return $true
}

function Test-DatabaseExists {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object]$Connection,
        [Parameter(Mandatory = $true)][string]$DatabaseName
    )

    throw 'Database existence adapter is not configured; refusing to restore an existing target.'
}

function Remove-RunOwnedRestoreDatabase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DatabaseName,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$OwnerRunId,
        [Parameter(Mandatory = $true)][scriptblock]$DropDatabase
    )

    Assert-NewRestoreTarget -DatabaseName $DatabaseName -TestDatabaseExists { param($DatabaseName) $false } | Out-Null
    if ($RunId -ne $OwnerRunId) {
        throw 'Teardown is allowed only for the run that owns the target.'
    }
    & $DropDatabase -DatabaseName $DatabaseName
}
