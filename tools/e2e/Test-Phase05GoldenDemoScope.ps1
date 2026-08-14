[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$WeekStartDate,
    [string]$Database = 'ipc_lane7',
    [string]$OutputPath = '.artifacts/shipyard-live/phase05-golden-demo-scope.json',
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

if ($Database -cne 'ipc_lane7') {
    throw 'Golden demo scope may target exact disposable ipc_lane7 only.'
}

$week = [datetime]::MinValue
if (-not [datetime]::TryParseExact($WeekStartDate, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$week)) {
    throw 'WeekStartDate must use yyyy-MM-dd.'
}
if ($week.DayOfWeek -ne [DayOfWeek]::Monday) {
    throw 'WeekStartDate must be a Monday.'
}

if ($ValidateOnly) {
    Write-Host 'PASS golden demo scope contract; no database connection was attempted.'
    return
}

if ([string]::IsNullOrWhiteSpace($env:IPC_MYSQL_PASSWORD)) {
    throw 'IPC_MYSQL_PASSWORD is missing from the process environment.'
}

$mysqlCandidates = @(
    'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Workbench 8.0 CE\mysql.exe'
)
$mysql = $mysqlCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $mysql) { throw 'mysql.exe was not found in the approved paths.' }

$weekEnd = $week.AddDays(5).ToString('yyyy-MM-dd')
$weekText = $week.ToString('yyyy-MM-dd')
$query = @"
SELECT JSON_OBJECT(
  'database', DATABASE(),
  'weekStartDate', '$weekText',
  'weekEndDate', '$weekEnd',
  'customerCount', (SELECT COUNT(*) FROM customers WHERE customerCode IN ('ANV','DAV')),
  'menuVersions', (SELECT COUNT(*) FROM menuversions mv JOIN customers c ON c.customerId=mv.customerId WHERE c.customerCode IN ('ANV','DAV') AND mv.weekStartDate='$weekText'),
  'menuSchedules', (SELECT COUNT(*) FROM menuschedules ms JOIN customers c ON c.customerId=ms.customerId WHERE c.customerCode IN ('ANV','DAV') AND ms.weekStartDate='$weekText'),
  'productionPlans', (SELECT COUNT(*) FROM productionplans pp JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.weekStartDate='$weekText'),
  'materialRequests', (SELECT COUNT(*) FROM materialrequests mr JOIN productionplans pp ON pp.planId=mr.planId JOIN customers c ON c.customerId=pp.customerId WHERE c.customerCode IN ('ANV','DAV') AND pp.weekStartDate='$weekText'),
  'serviceRuns', (SELECT COUNT(*) FROM serviceruns sr JOIN customers c ON c.customerId=sr.customerId WHERE c.customerCode IN ('ANV','DAV') AND sr.serviceDate BETWEEN '$weekText' AND '$weekEnd'),
  'inventoryIssues', (SELECT COUNT(*) FROM inventoryissues WHERE issueDate BETWEEN '$weekText' AND '$weekEnd'),
  'protectedLaneConnectionAttempts', 0
);
"@

$previousMysqlPwd = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = $env:IPC_MYSQL_PASSWORD
    $raw = & $mysql --user=root --host=127.0.0.1 --port=3306 --batch --raw --skip-column-names --database=$Database --execute=$query
    if ($LASTEXITCODE -ne 0) { throw "mysql preflight failed with exit code $LASTEXITCODE." }
}
finally {
    $env:MYSQL_PWD = $previousMysqlPwd
}

$counts = $raw | ConvertFrom-Json
$countKeys = @('menuVersions', 'menuSchedules', 'productionPlans', 'materialRequests', 'serviceRuns', 'inventoryIssues')
$dirty = @($countKeys | Where-Object { [int]$counts.$_ -ne 0 })
$verdict = if ([int]$counts.customerCount -eq 2 -and $dirty.Count -eq 0) { 'CLEAN_SCOPE_PASS' } else { 'DIRTY_SCOPE_BLOCKED' }
$receipt = [ordered]@{
    schemaVersion = 1
    verdict = $verdict
    lane = $counts.database
    weekStartDate = $counts.weekStartDate
    weekEndDate = $counts.weekEndDate
    customers = @('ANV', 'DAV')
    counts = [ordered]@{}
    databaseFence = [ordered]@{ protectedLaneConnectionAttempts = 0 }
    mutationAttempted = $false
    checkedAt = [datetimeoffset]::Now.ToString('o')
}
foreach ($key in $countKeys) { $receipt.counts[$key] = [int]$counts.$key }

$resolvedOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
[IO.File]::WriteAllText($resolvedOutput, ($receipt | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))

if ($verdict -ne 'CLEAN_SCOPE_PASS') {
    throw "Golden demo scope is blocked because data already exists: $($dirty -join ', '). Receipt: $resolvedOutput"
}

Write-Host "PASS clean Golden demo scope $weekText on exact $Database. Receipt: $resolvedOutput"
