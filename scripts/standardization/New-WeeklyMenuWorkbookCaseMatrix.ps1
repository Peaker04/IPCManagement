param(
    [string]$SourceWorkbook = 'C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx',
    [string]$OutputDirectory = '.artifacts/shipyard-live/standardization-phase6-20260803/workbooks'
)

$ErrorActionPreference = 'Stop'
$expectedSourceHash = 'A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01'
$fixedZipTimestamp = [DateTimeOffset]::new(2026, 8, 3, 0, 0, 0, [TimeSpan]::Zero)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-Sha256([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Update-ZipTextEntry(
    [string]$WorkbookPath,
    [string]$EntryPath,
    [scriptblock]$Transform
) {
    $archive = [System.IO.Compression.ZipFile]::Open(
        $WorkbookPath,
        [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        $entry = $archive.GetEntry($EntryPath)
        if (-not $entry) { throw "Workbook entry not found: $EntryPath" }
        $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
        try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $entry.Delete()
        $replacement = $archive.CreateEntry(
            $EntryPath,
            [System.IO.Compression.CompressionLevel]::Optimal)
        $replacement.LastWriteTime = $fixedZipTimestamp
        $writer = [System.IO.StreamWriter]::new(
            $replacement.Open(),
            [System.Text.UTF8Encoding]::new($false))
        try { $writer.Write((& $Transform $content)) } finally { $writer.Dispose() }
    }
    finally {
        $archive.Dispose()
    }
}

function Set-FutureWeek([string]$WorkbookPath) {
    Update-ZipTextEntry $WorkbookPath 'xl/sharedStrings.xml' {
        param($xml)
        $xml = $xml.Replace('01/07/2026', '12/01/2030')
        $dateMap = [ordered]@{
            '27/07/2026' = '07/01/2030'
            '28/07/2026' = '08/01/2030'
            '29/07/2026' = '09/01/2030'
            '30/07/2026' = '10/01/2030'
            '31/07/2026' = '11/01/2030'
        }
        foreach ($pair in $dateMap.GetEnumerator()) {
            $xml = $xml.Replace($pair.Key, $pair.Value)
        }
        $xml
    }
    Update-ZipTextEntry $WorkbookPath 'xl/worksheets/sheet1.xml' {
        param($xml)
        $updated = [regex]::Replace(
            $xml,
            '(<c r="I7"[^>]*>.*?<v>)[^<]+(</v>)',
            '${1}47495${2}',
            [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($updated -eq $xml) { throw 'Saturday date cell I7 was not found.' }
        $updated
    }
}

$sourcePath = (Resolve-Path -LiteralPath $SourceWorkbook).Path
$sourceHashBefore = Get-Sha256 $sourcePath
if ($sourceHashBefore -ne $expectedSourceHash) {
    throw "Source workbook hash drifted: expected $expectedSourceHash, got $sourceHashBefore"
}

$outputPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null
$validAnv = Join-Path $outputPath 'valid-anv-2030-01-07.xlsx'
$validDav = Join-Path $outputPath 'valid-dav-2030-01-07.xlsx'
$malformed = Join-Path $outputPath 'malformed-not-xlsx.xlsx'
$mismatch = Join-Path $outputPath 'mismatched-after-preview.xlsx'

Copy-Item -LiteralPath $sourcePath -Destination $validAnv -Force
Set-FutureWeek $validAnv

Copy-Item -LiteralPath $validAnv -Destination $validDav -Force
Update-ZipTextEntry $validDav 'xl/workbook.xml' {
    param($xml)
    $xml.Replace('ANV ', 'DAV ')
}
Update-ZipTextEntry $validDav 'xl/sharedStrings.xml' {
    param($xml)
    $xml.Replace('AMANN', 'DAV')
}

[System.IO.File]::WriteAllBytes(
    $malformed,
    [System.Text.Encoding]::UTF8.GetBytes('IPC-WBQA-MALFORMED-NOT-AN-XLSX'))
Copy-Item -LiteralPath $validAnv -Destination $mismatch -Force
$appendStream = [System.IO.File]::Open($mismatch, [System.IO.FileMode]::Append)
try {
    $marker = [System.Text.Encoding]::UTF8.GetBytes('IPC-WBQA-CHECKSUM-MISMATCH')
    $appendStream.Write($marker, 0, $marker.Length)
}
finally {
    $appendStream.Dispose()
}

$sourceHashAfter = Get-Sha256 $sourcePath
if ($sourceHashAfter -ne $sourceHashBefore) {
    throw "Source workbook changed during case generation: $sourceHashBefore -> $sourceHashAfter"
}

$cases = @(
    [ordered]@{ id = 'valid-anv'; path = $validAnv; sha256 = Get-Sha256 $validAnv; expected = 'preview-valid' },
    [ordered]@{ id = 'valid-dav'; path = $validDav; sha256 = Get-Sha256 $validDav; expected = 'preview-valid' },
    [ordered]@{ id = 'malformed'; path = $malformed; sha256 = Get-Sha256 $malformed; expected = 'domain-validation-invalid-no-db-delta' },
    [ordered]@{ id = 'mismatched-token'; path = $mismatch; sha256 = Get-Sha256 $mismatch; expected = 'domain-http-400-no-db-delta' },
    [ordered]@{ id = 'two-customer-atomic'; paths = @($validAnv, $validDav); expected = 'both-commit-or-zero' }
)
$manifest = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    source = [ordered]@{ path = $sourcePath; sha256Before = $sourceHashBefore; sha256After = $sourceHashAfter; unchanged = $true }
    weekStartDate = '2030-01-07'
    priceTierAmount = 25000
    cases = $cases
}
$manifestPath = Join-Path $outputPath 'workbook-case-matrix.json'
[System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json -Depth 8),
    [System.Text.UTF8Encoding]::new($false))

Write-Output "MATRIX=$manifestPath"
Write-Output "SOURCE_SHA256_BEFORE=$sourceHashBefore"
Write-Output "SOURCE_SHA256_AFTER=$sourceHashAfter"
Write-Output "CASES=$($cases.Count)"
Write-Output 'VERIFY=PASS'
