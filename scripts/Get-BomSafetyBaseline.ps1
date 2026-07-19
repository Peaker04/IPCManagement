[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionName,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [string]$ConnectionsFile = ".secrets/bom-connections.json",
    [string]$MySqlPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$policyVersion = "BOM-LIFECYCLE-v1.1.0"
$legacyMigration = "20260716113000_CorrectPresetBomTechnicalUnits"

function Write-Utf8NoBom {
    param([string]$Path, [string[]]$Lines)

    $content = if ($Lines.Count -eq 0) { "" } else { ($Lines -join "`n") + "`n" }
    [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
}

function Get-ProfileEnvironmentName {
    param([string]$Name)

    $normalized = ($Name -replace '[^A-Za-z0-9]', '_').ToUpperInvariant()
    return "IPC_BOM_CONNECTION_$normalized"
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
        if ($property) {
            $value = [string]$property.Value
        }
    }

    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Connection profile '$Name' was not found. Set $environmentName, ConnectionStrings__$Name, or add it to the local untracked file '$FilePath'."
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
            if ($parts.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($parts[$key])) {
                return [string]$parts[$key]
            }
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
        if ([string]::IsNullOrWhiteSpace($profile[$required])) {
            throw "Connection profile '$Name' is missing $required."
        }
    }

    return $profile
}

function Resolve-MySqlExecutable {
    param([string]$RequestedPath)

    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $resolved = Resolve-Path -LiteralPath $RequestedPath -ErrorAction SilentlyContinue
        if (-not $resolved) { throw "mysql executable not found at the requested path." }
        return $resolved.Path
    }

    $command = Get-Command mysql -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = @(
        'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe',
        'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe',
        'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
        'C:\xampp\mysql\bin\mysql.exe'
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    throw "mysql CLI is required. Supply -MySqlPath or add mysql to PATH."
}

function Invoke-ReadQuery {
    param([System.Collections.IDictionary]$Profile, [string]$Executable, [string]$Sql)

    $arguments = @(
        "--host=$($Profile.Server)",
        "--port=$($Profile.Port)",
        "--user=$($Profile.User)",
        "--database=$($Profile.Database)",
        '--default-character-set=utf8mb4',
        '--batch',
        '--column-names',
        "--execute=$Sql"
    )

    $previousPassword = $env:MYSQL_PWD
    try {
        $env:MYSQL_PWD = $Profile.Password
        $result = & $Executable @arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $env:MYSQL_PWD = $previousPassword
    }

    if ($exitCode -ne 0) {
        $safeMessage = ($result | Out-String).Trim()
        throw "Read-only query failed for profile '$ConnectionName': $safeMessage"
    }
    return @($result | ForEach-Object { [string]$_ })
}

function Convert-TabularOutputToCsv {
    param([string[]]$Lines)

    $csv = foreach ($line in $Lines) {
        $fields = $line -split "`t", -1
        ($fields | ForEach-Object { '"' + ($_.Replace('"', '""')) + '"' }) -join ','
    }
    return @($csv)
}

function Write-Dataset {
    param([string]$Name, [string]$Sql)

    $lines = Invoke-ReadQuery -Profile $profile -Executable $mysql -Sql $Sql
    if ($lines.Count -eq 0) { throw "Dataset '$Name' did not return a header row." }
    $path = Join-Path $resolvedOutput "$Name.csv"
    Write-Utf8NoBom -Path $path -Lines (Convert-TabularOutputToCsv -Lines $lines)
    return $path
}

$profile = Resolve-ConnectionProfile -Name $ConnectionName -FilePath $ConnectionsFile
$mysql = Resolve-MySqlExecutable -RequestedPath $MySqlPath

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path

$requiredTables = @(
    'dishbom', 'dishes', 'ingredients', 'units', 'currentstock',
    'menuversions', 'menuschedules', 'mealquantityplans', 'productionplans',
    'materialrequests', 'purchaserequests', 'purchaseorders',
    'inventoryreceipts', 'inventoryreceiptlines', 'inventoryissues', 'inventoryissuelines',
    'inventoryreturns', 'inventoryreturnlines', 'purchaseorderlines',
    'stockmovements', 'approvalhistories', 'auditlogs', '__EFMigrationsHistory'
)
$requiredTableSql = ($requiredTables | ForEach-Object { "'$_'" }) -join ','
$presentTableLines = Invoke-ReadQuery -Profile $profile -Executable $mysql -Sql "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ($requiredTableSql) ORDER BY table_name;"
$presentTables = @($presentTableLines | Select-Object -Skip 1)
$missingTables = @($requiredTables | Where-Object { $presentTables -notcontains $_ })
if ($missingTables.Count -gt 0) {
    throw "Legacy baseline schema is incomplete. Missing required tables: $($missingTables -join ', ')."
}

$datasets = [ordered]@{}
$datasets['schema-columns'] = @"
SELECT table_name, column_name, column_type, is_nullable, COALESCE(column_default, '<NULL>') AS column_default
FROM information_schema.columns
WHERE table_schema=DATABASE() AND table_name IN ($requiredTableSql)
ORDER BY table_name, ordinal_position;
"@
$datasets['migration-history'] = @"
SELECT MigrationId, ProductVersion
FROM __EFMigrationsHistory
ORDER BY MigrationId;
"@
$datasets['provenance-features'] = @"
SELECT 'dishbom.SourceKind' AS feature_name, COUNT(*) AS present
FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='dishbom' AND column_name='SourceKind'
UNION ALL
SELECT 'dishbom.SourceRunId', COUNT(*)
FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='dishbom' AND column_name='SourceRunId'
UNION ALL
SELECT 'bom reconciliation tables', COUNT(*)
FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('bomreconciliationruns','bomreconciliationitems')
ORDER BY feature_name;
"@
$datasets['bom-by-tier-customer-status'] = @"
SELECT CAST(priceTierAmount AS CHAR) AS price_tier, COALESCE(HEX(customerId), 'GLOBAL') AS customer_scope,
       COALESCE(bomStatus, '<NULL>') AS bom_status, COUNT(*) AS row_count,
       CAST(COALESCE(SUM(grossQtyPerServing),0) AS CHAR) AS gross_quantity_total
FROM dishbom
GROUP BY priceTierAmount, customerId, bomStatus
ORDER BY priceTierAmount, customer_scope, bom_status;
"@
$datasets['bom-overlaps'] = @"
SELECT HEX(a.bomId) AS left_bom_id, HEX(b.bomId) AS right_bom_id, HEX(a.dishId) AS dish_id,
       HEX(a.ingredientId) AS ingredient_id, HEX(a.unitId) AS unit_id,
       COALESCE(HEX(a.customerId), 'GLOBAL') AS customer_scope, CAST(a.priceTierAmount AS CHAR) AS price_tier,
       CAST(a.effectiveFrom AS CHAR) AS left_from, COALESCE(CAST(a.effectiveTo AS CHAR), 'OPEN') AS left_to,
       CAST(b.effectiveFrom AS CHAR) AS right_from, COALESCE(CAST(b.effectiveTo AS CHAR), 'OPEN') AS right_to
FROM dishbom a
JOIN dishbom b ON a.bomId < b.bomId
 AND a.dishId=b.dishId AND a.ingredientId=b.ingredientId AND a.unitId=b.unitId
 AND a.customerId <=> b.customerId AND a.priceTierAmount=b.priceTierAmount
 AND a.effectiveFrom <= COALESCE(b.effectiveTo, '9999-12-31')
 AND b.effectiveFrom <= COALESCE(a.effectiveTo, '9999-12-31')
ORDER BY left_bom_id, right_bom_id;
"@
$datasets['unknown-units'] = @"
SELECT HEX(b.bomId) AS bom_id, HEX(b.ingredientId) AS ingredient_id,
       COALESCE(u.unitCode, '<MISSING>') AS unit_code, COALESCE(u.baseUnitCode, '<NULL>') AS base_unit_code
FROM dishbom b
LEFT JOIN units u ON u.unitId=b.unitId
WHERE u.unitId IS NULL OR UPPER(COALESCE(NULLIF(u.baseUnitCode,''),u.unitCode)) NOT IN ('KG','G','MG','L','ML')
ORDER BY bom_id;
"@
$datasets['invalid-quantities'] = @"
SELECT HEX(bomId) AS bom_id, CAST(grossQtyPerServing AS CHAR) AS gross_quantity,
       CAST(wasteRatePercent AS CHAR) AS waste_rate, CAST(effectiveFrom AS CHAR) AS effective_from,
       COALESCE(CAST(effectiveTo AS CHAR), 'OPEN') AS effective_to
FROM dishbom
WHERE grossQtyPerServing <= 0 OR wasteRatePercent < 0 OR wasteRatePercent >= 100
   OR (effectiveTo IS NOT NULL AND effectiveTo < effectiveFrom)
ORDER BY bom_id;
"@
$datasets['temporary-catalog-rows'] = @"
SELECT 'dish' AS entity_type, HEX(dishId) AS entity_id, dishCode AS entity_code, dishName AS entity_name
FROM dishes WHERE UPPER(dishCode) LIKE 'TMP%' OR UPPER(dishName) LIKE 'TMP%'
UNION ALL
SELECT 'ingredient', HEX(ingredientId), ingredientCode, ingredientName
FROM ingredients WHERE UPPER(ingredientCode) LIKE 'TMP%' OR UPPER(ingredientName) LIKE 'TMP%'
ORDER BY entity_type, entity_code, entity_id;
"@
$datasets['catalog-reference-stock'] = @"
SELECT 'dish' AS category, HEX(dishId) AS entity_id, dishCode AS reference_code, dishName AS reference_name, '0' AS quantity
FROM dishes
UNION ALL
SELECT 'ingredient', HEX(ingredientId), ingredientCode, ingredientName, '0'
FROM ingredients
UNION ALL
SELECT 'unit', HEX(unitId), unitCode, unitName, '0'
FROM units
UNION ALL
SELECT 'currentstock', CONCAT(HEX(warehouseId),':',HEX(ingredientId),':',HEX(unitId)), '', '', CAST(currentQty AS CHAR)
FROM currentstock
ORDER BY category, reference_code, entity_id;
"@
$datasets['status-counts'] = @"
SELECT 'menu version' AS aggregate_name, COALESCE(status,'<NULL>') AS status_code, COUNT(*) AS row_count FROM menuversions GROUP BY status
UNION ALL SELECT 'menu schedule', COALESCE(status,'<NULL>'), COUNT(*) FROM menuschedules GROUP BY status
UNION ALL SELECT 'meal quantity plan', COALESCE(status,'<NULL>'), COUNT(*) FROM mealquantityplans GROUP BY status
UNION ALL SELECT 'production plan', COALESCE(status,'<NULL>'), COUNT(*) FROM productionplans GROUP BY status
UNION ALL SELECT 'material demand', COALESCE(status,'<NULL>'), COUNT(*) FROM materialrequests GROUP BY status
UNION ALL SELECT 'purchase request', COALESCE(status,'<NULL>'), COUNT(*) FROM purchaserequests GROUP BY status
UNION ALL SELECT 'purchase order', COALESCE(status,'<NULL>'), COUNT(*) FROM purchaseorders GROUP BY status
ORDER BY aggregate_name, status_code;
"@
$datasets['draft-open-dependencies'] = @"
SELECT 'menu version' AS aggregate_name, HEX(menuVersionId) AS record_id, status AS state_code, CAST(weekStartDate AS CHAR) AS business_date FROM menuversions WHERE status='DRAFT'
UNION ALL SELECT 'menu schedule', HEX(menuScheduleId), status, CAST(serviceDate AS CHAR) FROM menuschedules WHERE status='DRAFT'
UNION ALL SELECT 'meal quantity plan', HEX(quantityPlanId), status, CAST(serviceDate AS CHAR) FROM mealquantityplans WHERE status IN ('DRAFT','FORECASTED')
UNION ALL SELECT 'production plan', HEX(planId), status, CAST(planDate AS CHAR) FROM productionplans WHERE status='CREATED' AND sentToKitchenAt IS NULL
UNION ALL SELECT 'material demand', HEX(requestId), status, CAST(requestDate AS CHAR) FROM materialrequests WHERE status='DRAFT'
UNION ALL SELECT 'purchase request', HEX(purchaseRequestId), status, CAST(purchaseForDate AS CHAR) FROM purchaserequests WHERE status='DRAFT'
ORDER BY aggregate_name, record_id;
"@
$datasets['inventory-document-counts'] = @"
SELECT 'receipt' AS document_type, 'POSTED' AS document_state, COUNT(*) AS row_count FROM inventoryreceipts
UNION ALL SELECT 'inventory issue', IF(receivedAt IS NULL,'ISSUED','RECEIVED'), COUNT(*) FROM inventoryissues GROUP BY IF(receivedAt IS NULL,'ISSUED','RECEIVED')
UNION ALL SELECT 'inventory return', IF(receivedAt IS NULL,'RETURNED','RECEIVED'), COUNT(*) FROM inventoryreturns GROUP BY IF(receivedAt IS NULL,'RETURNED','RECEIVED')
ORDER BY document_type, document_state;
"@
$datasets['immutable-records'] = @"
SELECT 'menu version' AS aggregate_name, HEX(menuVersionId) AS record_id, CONCAT_WS('|',status,HEX(customerId),CAST(versionNo AS CHAR),COALESCE(sourceChecksum,'')) AS state_code, CAST(weekStartDate AS CHAR) AS business_date FROM menuversions WHERE status IN ('PUBLISHED','SUPERSEDED','ROLLED_BACK')
UNION ALL SELECT 'menu schedule', HEX(menuScheduleId), CONCAT_WS('|',status,HEX(customerId),HEX(menuId),shiftName,CAST(menuPrice AS CHAR),CAST(bomRatePercent AS CHAR)), CAST(serviceDate AS CHAR) FROM menuschedules WHERE status IN ('ACTIVE','LOCKED','SUPERSEDED')
UNION ALL SELECT 'meal quantity plan', HEX(quantityPlanId), CONCAT_WS('|',status,planCode,COALESCE(DATE_FORMAT(confirmedAt,'%Y-%m-%dT%H:%i:%s.%f'),''),COALESCE(DATE_FORMAT(completedAt,'%Y-%m-%dT%H:%i:%s.%f'),'')), CAST(serviceDate AS CHAR) FROM mealquantityplans WHERE status IN ('CONFIRMED','ADJUSTED','COMPLETED','ARCHIVED','CANCELLED')
UNION ALL SELECT 'production plan', HEX(planId), CONCAT_WS('|',COALESCE(status,'<NULL>'),planCode,COALESCE(HEX(customerId),'GLOBAL'),COALESCE(DATE_FORMAT(sentToKitchenAt,'%Y-%m-%dT%H:%i:%s.%f'),''),COALESCE(HEX(sentToKitchenBy),'')), CAST(planDate AS CHAR) FROM productionplans WHERE status='SENTTOKITCHEN' OR sentToKitchenAt IS NOT NULL
UNION ALL SELECT 'material demand', HEX(requestId), CONCAT_WS('|',status,requestCode,HEX(planId),requestScope,COALESCE(HEX(approvedBy),''),COALESCE(DATE_FORMAT(approvedAt,'%Y-%m-%dT%H:%i:%s.%f'),'')), CAST(requestDate AS CHAR) FROM materialrequests WHERE status IN ('MANAGERAPPROVED','APPROVED','SENTTOWAREHOUSE','EXPORTED','CANCELLED')
UNION ALL SELECT 'purchase request', HEX(purchaseRequestId), CONCAT_WS('|',status,purchaseRequestCode,HEX(createdBy),COALESCE(HEX(approvedBy),''),COALESCE(DATE_FORMAT(approvedAt,'%Y-%m-%dT%H:%i:%s.%f'),'')), CAST(purchaseForDate AS CHAR) FROM purchaserequests WHERE status IN ('SENTTOSUPPLIER','APPROVED','REJECTED','PARTIALRECEIVED','RECEIVED','SENTTOWAREHOUSE','CANCELLED')
UNION ALL SELECT 'purchase order', HEX(purchaseOrderId), CONCAT_WS('|',status,purchaseOrderCode,HEX(purchaseRequestId),HEX(supplierId)), CAST(orderDate AS CHAR) FROM purchaseorders
UNION ALL SELECT 'purchase order line', HEX(purchaseOrderLineId), CONCAT_WS('|',HEX(purchaseOrderId),HEX(ingredientId),HEX(unitId),CAST(orderedQty AS CHAR),CAST(receivedQty AS CHAR),CAST(unitPrice AS CHAR)), '' FROM purchaseorderlines
UNION ALL SELECT 'receipt', HEX(receiptId), CONCAT_WS('|','POSTED',receiptCode,HEX(warehouseId),HEX(supplierId),COALESCE(HEX(purchaseRequestId),''),HEX(createdBy)), CAST(receiptDate AS CHAR) FROM inventoryreceipts
UNION ALL SELECT 'receipt line', HEX(receiptLineId), CONCAT_WS('|',HEX(receiptId),COALESCE(HEX(purchaseRequestLineId),''),HEX(ingredientId),HEX(unitId),CAST(quantity AS CHAR),CAST(unitPrice AS CHAR),CAST(amount AS CHAR),COALESCE(lotNumber,''),COALESCE(CAST(manufactureDate AS CHAR),''),COALESCE(CAST(expiredDate AS CHAR),'')), '' FROM inventoryreceiptlines
UNION ALL SELECT 'inventory issue', HEX(issueId), CONCAT_WS('|',IF(receivedAt IS NULL,'ISSUED','RECEIVED'),issueCode,HEX(warehouseId),HEX(materialRequestId),HEX(issuedBy),COALESCE(HEX(receivedBy),''),COALESCE(DATE_FORMAT(receivedAt,'%Y-%m-%dT%H:%i:%s.%f'),'')), CAST(issueDate AS CHAR) FROM inventoryissues
UNION ALL SELECT 'inventory issue line', HEX(issueLineId), CONCAT_WS('|',HEX(issueId),HEX(ingredientId),HEX(unitId),CAST(issuedQty AS CHAR)), '' FROM inventoryissuelines
UNION ALL SELECT 'inventory return', HEX(returnId), CONCAT_WS('|',IF(receivedAt IS NULL,'RETURNED','RECEIVED'),returnCode,returnType,HEX(warehouseId),HEX(issueId),HEX(createdBy),COALESCE(HEX(receivedBy),''),COALESCE(DATE_FORMAT(receivedAt,'%Y-%m-%dT%H:%i:%s.%f'),'')), CAST(returnDate AS CHAR) FROM inventoryreturns
UNION ALL SELECT 'inventory return line', HEX(returnLineId), CONCAT_WS('|',HEX(returnId),HEX(ingredientId),HEX(unitId),CAST(quantity AS CHAR)), '' FROM inventoryreturnlines
UNION ALL SELECT 'stock ledger', HEX(movementId), CONCAT_WS('|',movementType,HEX(warehouseId),HEX(ingredientId),HEX(unitId),CAST(quantityIn AS CHAR),CAST(quantityOut AS CHAR),CAST(beforeQty AS CHAR),CAST(afterQty AS CHAR),COALESCE(refTable,''),COALESCE(HEX(refId),''),COALESCE(lotNumber,''),COALESCE(CAST(manufactureDate AS CHAR),''),COALESCE(CAST(expiredDate AS CHAR),'')), DATE_FORMAT(movementDate,'%Y-%m-%dT%H:%i:%s.%f') FROM stockmovements
UNION ALL SELECT 'approval history', HEX(approvalHistoryId), CONCAT_WS('|',targetType,HEX(targetId),decision,COALESCE(oldStatus,''),COALESCE(newStatus,''),COALESCE(reason,''),HEX(actionBy)), DATE_FORMAT(actionAt,'%Y-%m-%dT%H:%i:%s.%f') FROM approvalhistories
UNION ALL SELECT 'audit', HEX(auditId), CONCAT_WS('|',HEX(changedBy),businessArea,entityName,COALESCE(HEX(entityId),''),COALESCE(fieldName,''),COALESCE(oldValue,''),COALESCE(newValue,''),COALESCE(reason,'')), DATE_FORMAT(changedAt,'%Y-%m-%dT%H:%i:%s.%f') FROM auditlogs
ORDER BY aggregate_name, record_id;
"@

$datasetPaths = @()
foreach ($entry in $datasets.GetEnumerator()) {
    $datasetPaths += Write-Dataset -Name $entry.Key -Sql $entry.Value
}

$checksumRows = @('"file","sha256"')
foreach ($path in ($datasetPaths | Sort-Object { Split-Path $_ -Leaf })) {
    $checksumRows += '"{0}","{1}"' -f (Split-Path $path -Leaf), (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
}
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'checksums.csv') -Lines $checksumRows

$immutablePath = Join-Path $resolvedOutput 'immutable-records.csv'
$immutableRows = @(
    '"file","sha256"',
    ('"immutable-records.csv","{0}"' -f (Get-FileHash -LiteralPath $immutablePath -Algorithm SHA256).Hash.ToLowerInvariant())
)
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'immutable-checksums.csv') -Lines $immutableRows

$schemaFingerprint = (Get-FileHash -LiteralPath (Join-Path $resolvedOutput 'schema-columns.csv') -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    PolicyVersion = $policyVersion
    LegacyMigration = $legacyMigration
    ConnectionProfile = $ConnectionName
    SourceSchema = $profile.Database
    SchemaFingerprintSha256 = $schemaFingerprint
    DatasetCount = $datasetPaths.Count
    DeterministicChecksums = 'checksums.csv'
    ImmutableChecksums = 'immutable-checksums.csv'
    ObservationMetadata = 'observation.json'
}
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'baseline-manifest.json') -Lines @(($manifest | ConvertTo-Json -Depth 4))

$observation = [ordered]@{
    ObservedAtUtc = [DateTime]::UtcNow.ToString('o')
    Machine = $env:COMPUTERNAME
    ConnectionProfile = $ConnectionName
}
Write-Utf8NoBom -Path (Join-Path $resolvedOutput 'observation.json') -Lines @(($observation | ConvertTo-Json -Depth 4))

Write-Output "BOM safety baseline PASS: $($datasetPaths.Count) deterministic datasets."
Write-Output "output=$resolvedOutput"
