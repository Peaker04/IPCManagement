function Get-RequiredSingleMySqlRow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Rows,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($Rows.Count -ne 1) {
        throw "$Label must return exactly one row; received $($Rows.Count)."
    }
    return [string]$Rows[0]
}

function Get-TableChecksumValue([object[]]$Rows) {
    if ($Rows.Count -ne 1) { throw 'Expected exactly one CHECKSUM TABLE row.' }
    $columns = [string]$Rows[0] -split "`t"
    if ($columns.Count -ne 2 -or $columns[1] -notmatch '^\d+$') {
        throw 'Invalid CHECKSUM TABLE result.'
    }
    return $columns[1]
}

function Assert-MrxRestoreOracle([object]$Expected, [object]$Actual) {
    if ($null -eq $Expected -or $null -eq $Actual) {
        throw 'MRX restore oracle is missing.'
    }
    foreach ($field in @('counts', 'digests')) {
        $expectedJson = $Expected.$field | ConvertTo-Json -Depth 10 -Compress
        $actualJson = $Actual.$field | ConvertTo-Json -Depth 10 -Compress
        if ($expectedJson -ne $actualJson) { throw "MRX restore oracle mismatch: $field" }
    }
}

function Assert-RestoreOracle([object]$Expected, [object]$Actual) {
    foreach ($field in @('migrationIds', 'migrationHead', 'tableDefinitions', 'foreignKeyDefinitions',
            'triggerDefinitions', 'rowCounts', 'rowDigests', 'dcrClosureBaseline')) {
        $expectedJson = $Expected.$field | ConvertTo-Json -Depth 20 -Compress
        $actualJson = $Actual.$field | ConvertTo-Json -Depth 20 -Compress
        if ($expectedJson -ne $actualJson) { throw "Restore oracle mismatch: $field" }
    }
}

function Assert-RecoveryProvenance([object]$Manifest) {
    if ($null -eq $Manifest.gtidExecuted -or $null -eq $Manifest.binaryLogChain) {
        throw 'Recovery provenance is missing.'
    }
}
