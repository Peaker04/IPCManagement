function Get-TableChecksumValue([object[]]$Rows) {
    if ($Rows.Count -ne 1) { throw 'Expected exactly one CHECKSUM TABLE row.' }
    $columns = [string]$Rows[0] -split "`t"
    if ($columns.Count -ne 2 -or $columns[1] -notmatch '^\d+$') {
        throw 'Invalid CHECKSUM TABLE result.'
    }
    return $columns[1]
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
