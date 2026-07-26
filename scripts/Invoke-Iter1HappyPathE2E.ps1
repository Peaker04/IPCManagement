param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$ServiceDate = "2026-06-18",
    [string]$CustomerCode = "ANV",
    [decimal]$PriceTierAmount = 25000,
    [string]$WeeklyMenuTemplatePath = "C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx",
    [string]$OutputRoot = ".artifacts/e2e",
    [switch]$SkipSeedReset,
    [switch]$SkipWeeklyMenuImport
)

$ErrorActionPreference = "Stop"

function Write-E2ELog {
    param([string]$Message)

    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Output $line
    Add-Content -Path $script:LogPath -Value $line
}

function Invoke-E2EApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = ""
    )

    $headers = @{}
    if ($Token) {
        $headers.Authorization = "Bearer $Token"
    }

    $uri = "$BaseUrl$Path"
    try {
        if ($null -eq $Body) {
            return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
        }

        return Invoke-RestMethod `
            -Method $Method `
            -Uri $uri `
            -Headers $headers `
            -ContentType "application/json" `
            -Body ($Body | ConvertTo-Json -Depth 40)
    }
    catch {
        $response = $_.Exception.Response
        if ($response) {
            $reader = New-Object IO.StreamReader($response.GetResponseStream())
            $text = $reader.ReadToEnd()
            throw "HTTP $($response.StatusCode) $Method $Path :: $text"
        }

        throw
    }
}

function Invoke-E2EMultipart {
    param(
        [string]$Path,
        [string]$FilePath,
        [hashtable]$Fields,
        [string]$Token
    )

    Add-Type -AssemblyName System.Net.Http
    $client = New-Object System.Net.Http.HttpClient
    $content = New-Object System.Net.Http.MultipartFormDataContent
    $stream = $null
    try {
        $client.DefaultRequestHeaders.Authorization =
            New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)
        $stream = [IO.File]::OpenRead($FilePath)
        $fileContent = New-Object System.Net.Http.StreamContent($stream)
        $content.Add($fileContent, "file", [IO.Path]::GetFileName($FilePath))
        foreach ($entry in $Fields.GetEnumerator()) {
            $content.Add((New-Object System.Net.Http.StringContent([string]$entry.Value)), [string]$entry.Key)
        }

        $response = $client.PostAsync("$BaseUrl$Path", $content).GetAwaiter().GetResult()
        $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            throw "HTTP $([int]$response.StatusCode) POST $Path :: $text"
        }

        return $text | ConvertFrom-Json
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
        $content.Dispose()
        $client.Dispose()
    }
}

function Assert-Success {
    param(
        [object]$Response,
        [string]$Step
    )

    if ($null -eq $Response -or $Response.success -ne $true) {
        throw "$Step failed."
    }
}

function Get-First {
    param(
        [object[]]$Items,
        [string]$Message
    )

    if ($Items.Count -eq 0) {
        throw $Message
    }

    return $Items[0]
}

function Normalize-Status {
    param([string]$Status)
    if ($null -eq $Status) {
        return ""
    }

    return $Status.Trim().ToUpperInvariant()
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$script:LogPath = Join-Path $outputDir "happy-path-e2e.log"
$summaryPath = Join-Path $outputDir "happy-path-e2e-summary.md"
New-Item -ItemType File -Force -Path $script:LogPath | Out-Null

Write-E2ELog "Iter1 happy path E2E started. BaseUrl=$BaseUrl ServiceDate=$ServiceDate SkipSeedReset=$SkipSeedReset"

if (-not $SkipSeedReset) {
    Write-E2ELog "Running DemoReset seed mode."
    & powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1SeedMode.ps1 `
        -Mode DemoReset `
        -BaseUrl $BaseUrl `
        -Username $Username `
        -Password $Password `
        -ServiceDate $ServiceDate 2>&1 | ForEach-Object { Write-E2ELog $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "Seed reset failed with exit code $LASTEXITCODE"
    }
}

$login = Invoke-E2EApi -Method "POST" -Path "/api/auth/login" -Body @{
    username = $Username
    password = $Password
}
Assert-Success $login "Login"
$token = $login.data.accessToken
Write-E2ELog "Logged in as $Username."

$customers = Invoke-E2EApi -Method "GET" -Path "/api/coordination/customers" -Token $token
Assert-Success $customers "Customer lookup"
$customer = @($customers.data | Where-Object { $_.customerCode -eq $CustomerCode }) | Select-Object -First 1
if ($null -eq $customer) {
    throw "Customer $CustomerCode was not found."
}

if (-not $SkipWeeklyMenuImport) {
    if (-not (Test-Path -LiteralPath $WeeklyMenuTemplatePath -PathType Leaf)) {
        throw "Weekly menu template not found: $WeeklyMenuTemplatePath"
    }

    $menuFields = @{
        customerId = $customer.customerId
        weekStartDate = $ServiceDate
        priceTierAmount = $PriceTierAmount
    }
    $preview = Invoke-E2EMultipart `
        -Path "/api/coordination/weekly-menu/import/preview" `
        -FilePath $WeeklyMenuTemplatePath `
        -Fields $menuFields `
        -Token $token
    Assert-Success $preview "Weekly menu preview"
    if ($preview.data.validation.hasCriticalErrors -or $preview.data.rows.Count -eq 0) {
        throw "Weekly menu preview is not committable."
    }
    Write-E2ELog "Weekly menu preview passed: rows=$($preview.data.rows.Count), tier=$PriceTierAmount."

    $committedMenu = Invoke-E2EMultipart `
        -Path "/api/coordination/weekly-menu/import/commit" `
        -FilePath $WeeklyMenuTemplatePath `
        -Fields $menuFields `
        -Token $token
    Assert-Success $committedMenu "Weekly menu commit"
    Write-E2ELog "Weekly menu committed: version=$($committedMenu.data.menuVersionNo), status=$($committedMenu.data.menuVersionStatus)."
}
else {
    Write-E2ELog "Weekly menu import skipped; reusing the menu already published for this week."
}

$schedules = Invoke-E2EApi `
    -Method "GET" `
    -Path "/api/coordination/menu-schedules?customerId=$($customer.customerId)&dateFrom=$ServiceDate&dateTo=$ServiceDate" `
    -Token $token
Assert-Success $schedules "Menu schedule lookup"
$serviceSchedules = @($schedules.data | Where-Object { $_.serviceDate -eq $ServiceDate })
$publishSchedule = Get-First -Items $serviceSchedules -Message "No menu schedule found for $ServiceDate."
if (-not $SkipWeeklyMenuImport) {
    $published = Invoke-E2EApi `
        -Method "PATCH" `
        -Path "/api/coordination/menu-schedules/$($publishSchedule.menuScheduleId)/version" `
        -Token $token `
        -Body @{
            status = "ACTIVE"
            reason = "E2E publishes the committed ANV 25k weekly menu before locking servings."
        }
    Assert-Success $published "Weekly menu publish"
    Write-E2ELog "Weekly menu published: version=$($published.data.menuVersionNo), status=$($published.data.menuVersionStatus)."
}

$serviceDateValue = [DateTime]::ParseExact($ServiceDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$dayKeys = @("cn", "t2", "t3", "t4", "t5", "t6", "t7")
$dayOfWeek = $dayKeys[[int]$serviceDateValue.DayOfWeek]
$defaultServingsByShift = @{ MORNING = 840; AFTERNOON = 870 }
foreach ($scheduleShift in @($serviceSchedules.shiftName | Sort-Object -Unique)) {
    $normalizedShift = Normalize-Status $scheduleShift
    if (-not $defaultServingsByShift.ContainsKey($normalizedShift)) {
        throw "No E2E servings fixture is defined for shift $scheduleShift."
    }
    $forecast = Invoke-E2EApi -Method "POST" -Path "/api/coordination/meal-quantity-plans/quick-servings" -Token $token -Body @{
        customerId = $customer.customerId
        serviceDate = $ServiceDate
        shiftName = $normalizedShift
        servings = $defaultServingsByShift[$normalizedShift]
        complete = $false
    }
    Assert-Success $forecast "Quick servings forecast $normalizedShift"
    Write-E2ELog "Serving forecast created: shift=$normalizedShift, servings=$($defaultServingsByShift[$normalizedShift])."
}
$locked = Invoke-E2EApi -Method "POST" -Path "/api/coordination/orders/lock" -Token $token -Body @{
    serviceDate = $ServiceDate
    dayOfWeek = $dayOfWeek
    shiftName = "MORNING"
    scope = "FULLDAY"
    lines = @()
}
Assert-Success $locked "Full-day servings lock"
Write-E2ELog "Serving plans locked: scope=$($locked.data.scope), shifts=$($locked.data.lockedShiftNames -join ','), lines=$($locked.data.lockedLineCount)."

foreach ($lockedShift in @($locked.data.lockedShiftNames)) {
    $signedOff = Invoke-E2EApi -Method "POST" -Path "/api/coordination/orders/signoff" -Token $token -Body @{
        serviceDate = $ServiceDate
        dayOfWeek = $dayOfWeek
        shiftName = $lockedShift
        scope = "SHIFT"
        note = "ANV 25k E2E completes servings before material demand generation."
    }
    Assert-Success $signedOff "Coordination signoff $lockedShift"
    Write-E2ELog "Coordination shift signed off: shift=$lockedShift, status=$($signedOff.data.newStatus), plans=$($signedOff.data.affectedPlanCount)."
}

$documents = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/workflow-documents?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=100" -Token $token
Assert-Success $documents "Workflow document lookup"
$existingDemand = @($documents.data | Where-Object {
    $_.documentCode -like "MR-*"
}) | Select-Object -First 1
if ($null -eq $existingDemand) {
    $demand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/generate" -Token $token -Body @{
        serviceDate = $ServiceDate
        scope = "FULLDAY"
    }
    Assert-Success $demand "Demand generation"
}
else {
    $demandLines = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/ingredient-demand?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=500" -Token $token
    Assert-Success $demandLines "Existing demand lines"
    $demand = [pscustomobject]@{
        success = $true
        data = [pscustomobject]@{
            materialRequestId = $existingDemand.documentId
            requestCode = $existingDemand.documentCode
            status = $existingDemand.status
            lines = @($demandLines.data | Where-Object { $_.materialRequestId -eq $existingDemand.documentId })
        }
    }
}
$materialRequestId = $demand.data.materialRequestId
Write-E2ELog "Demand ready: $($demand.data.requestCode), status=$($demand.data.status), lines=$(@($demand.data.lines).Count)."

# Check if we need to create a new demand (DRAFT → approved) or regenerate if CANCELLED
$demandStatus = Normalize-Status $demand.data.status
if ($demandStatus -eq "CANCELLED") {
    Write-E2ELog "Existing demand is CANCELLED. Creating new demand for same date."
    $demand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/generate" -Token $token -Body @{
        serviceDate = $ServiceDate
        scope = "FULLDAY"
    }
    Assert-Success $demand "Demand regeneration after cancellation"
    $materialRequestId = $demand.data.materialRequestId
    $demandStatus = Normalize-Status $demand.data.status
    Write-E2ELog "New demand created: $($demand.data.requestCode), status=$demandStatus."
}

if ($demandStatus -eq "DRAFT") {
    $approvedDemand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/$materialRequestId/approve" -Token $token -Body @{
        reason = "Iter1 happy path E2E approves material demand."
    }
    Assert-Success $approvedDemand "Demand approval"
    Write-E2ELog "Demand approved: $($approvedDemand.data.requestCode) $($approvedDemand.data.oldStatus)->$($approvedDemand.data.newStatus)."
    $demandStatus = Normalize-Status $approvedDemand.data.newStatus
}
else {
    Write-E2ELog "Demand approval skipped; current status=$($demand.data.status)."
}

$purchaseRequestCode = "PR-$($ServiceDate.Replace('-', ''))-FULLDAY"
$purchaseList = Invoke-E2EApi -Method "GET" -Path "/api/purchase-requests?dateFrom=$ServiceDate&dateTo=$ServiceDate&pageSize=100" -Token $token
Assert-Success $purchaseList "Purchase request lookup"
$existingPurchase = @($purchaseList.data | Where-Object { $_.purchaseRequestCode -eq $purchaseRequestCode }) | Select-Object -First 1

# Check if existing PR is valid for workflow or needs regeneration
$existingPurchaseStatus = Normalize-Status $existingPurchase.status
if ($null -ne $existingPurchase -and $existingPurchaseStatus -eq "CANCELLED") {
    Write-E2ELog "Existing purchase request is CANCELLED. Creating new PR from demand."
    $purchase = Invoke-E2EApi -Method "POST" -Path "/api/purchase-workflow/from-demand" -Token $token -Body @{
        materialRequestId = $materialRequestId
    }
    Assert-Success $purchase "Purchase request regeneration"
}
elseif ($null -eq $existingPurchase) {
    $purchase = Invoke-E2EApi -Method "POST" -Path "/api/purchase-workflow/from-demand" -Token $token -Body @{
        materialRequestId = $materialRequestId
    }
    Assert-Success $purchase "Purchase request generation"
}
else {
    $purchase = [pscustomobject]@{ data = $existingPurchase }
}

$purchaseRequestId = $purchase.data.purchaseRequestId
Write-E2ELog "Purchase request ready: $($purchase.data.purchaseRequestCode), status=$($purchase.data.status), lines=$(@($purchase.data.lines).Count)."

$purchaseStatus = Normalize-Status $purchase.data.status
if ($purchaseStatus -eq "DRAFT") {
    $suppliers = Invoke-E2EApi -Method "GET" -Path "/api/suppliers" -Token $token
    Assert-Success $suppliers "Supplier lookup"
    $supplier = Get-First -Items @($suppliers.data) -Message "No supplier found for E2E quotations."
    $deliveryDate = $serviceDateValue.AddDays(1).ToString("yyyy-MM-dd")
    $quotationEffectiveTo = $serviceDateValue.AddDays(30).ToString("yyyy-MM-dd")

    foreach ($line in @($purchase.data.lines)) {
        $evidencePath = "/api/purchase-workflow/requests/$purchaseRequestId/lines/$($line.purchaseRequestLineId)/supplier-evidence"
        $evidence = Invoke-E2EApi -Method "GET" -Path $evidencePath -Token $token
        Assert-Success $evidence "Supplier evidence lookup"
        $candidate = @($evidence.data.candidates) | Select-Object -First 1
        if ($null -eq $candidate) {
            $quotation = Invoke-E2EApi -Method "POST" -Path "/api/supplier-quotations" -Token $token -Body @{
                supplierId = $supplier.supplierId
                ingredientId = $line.ingredientId
                unitPrice = 10000
                effectiveFrom = $ServiceDate
                effectiveTo = $quotationEffectiveTo
                note = "ANV 25k E2E quotation for $ServiceDate."
            }
            Assert-Success $quotation "Supplier quotation creation"
            $evidence = Invoke-E2EApi -Method "GET" -Path $evidencePath -Token $token
            Assert-Success $evidence "Supplier evidence reload"
            $candidate = @($evidence.data.candidates) | Select-Object -First 1
        }
        if ($null -eq $candidate) {
            throw "No supplier evidence candidate for $($line.ingredientName)."
        }

        $decision = Invoke-E2EApi `
            -Method "POST" `
            -Path "/api/purchase-workflow/requests/$purchaseRequestId/lines/$($line.purchaseRequestLineId)/supplier-decision" `
            -Token $token `
            -Body @{
                evidenceType = $candidate.evidenceType
                evidenceId = $candidate.evidenceId
                supplierId = $candidate.supplierId
                proposedUnitPrice = $candidate.unitPrice
                proposedDeliveryDate = $deliveryDate
                expectedDecisionVersion = 0
                note = "ANV 25k E2E supplier decision."
            }
        Assert-Success $decision "Supplier decision"
    }
    Write-E2ELog "Supplier evidence confirmed for $(@($purchase.data.lines).Count) purchase lines."

    $submitted = Invoke-E2EApi -Method "POST" -Path "/api/purchase-workflow/requests/$purchaseRequestId/submit" -Token $token
    Assert-Success $submitted "Purchase request submit"
    Write-E2ELog "Purchase request submitted: $($submitted.data.purchaseRequestCode), status=$($submitted.data.status)."
    $purchaseStatus = Normalize-Status $submitted.data.status
    $purchase = $submitted
}

if ($purchaseStatus -eq "SENTTOSUPPLIER") {
    $inbox = Invoke-E2EApi -Method "GET" -Path "/api/approvals/inbox?limit=100" -Token $token
    Assert-Success $inbox "Approval inbox"
    $inboxItems = if ($null -ne $inbox.data.items) { @($inbox.data.items) } else { @($inbox.data) }
    $approvalItem = @($inboxItems | Where-Object {
        $_.targetType -eq "purchase-request" -and $_.targetId -eq $purchaseRequestId
    }) | Select-Object -First 1
    if ($null -eq $approvalItem) {
        throw "No purchase approval inbox item found for $purchaseRequestId."
    }

    $approvedPurchase = Invoke-E2EApi -Method "POST" -Path "/api/approvals/$($approvalItem.targetType)/$($approvalItem.targetId)" -Token $token -Body @{
        status = 0
        reason = "Iter1 happy path E2E approves purchase request."
    }
    Assert-Success $approvedPurchase "Purchase approval"
    Write-E2ELog "Purchase request approved: $($approvedPurchase.data.oldStatus)->$($approvedPurchase.data.newStatus)."
    $purchase = [pscustomobject]@{
        data = [pscustomobject]@{
            purchaseRequestId = $purchaseRequestId
            purchaseRequestCode = $purchaseRequestCode
            status = $approvedPurchase.data.newStatus
            lines = @()
        }
    }
}
else {
    Write-E2ELog "Purchase approval skipped; current status=$($purchase.data.status)."
}

$existingOrdersResponse = Invoke-E2EApi -Method "GET" -Path "/api/purchase-orders" -Token $token
Assert-Success $existingOrdersResponse "Purchase order lookup"
$orders = @($existingOrdersResponse.data | Where-Object { $_.purchaseRequestId -eq $purchaseRequestId })
if ($orders.Count -eq 0) {
    $ordersResponse = Invoke-E2EApi -Method "POST" -Path "/api/purchase-orders/from-request/$purchaseRequestId" -Token $token
    Assert-Success $ordersResponse "Purchase order creation"
    $orders = @($ordersResponse.data)
}
Write-E2ELog "Purchase orders ready: count=$($orders.Count)."

$warehouses = Invoke-E2EApi -Method "GET" -Path "/api/Warehouses?pageNumber=1&pageSize=10" -Token $token
Assert-Success $warehouses "Warehouse lookup"
$warehouse = Get-First -Items @($warehouses.data.items) -Message "No warehouse found for E2E receipt/issue."

$receivedOrder = @($orders | Where-Object {
    (Normalize-Status $_.status) -eq "RECEIVED"
}) | Select-Object -First 1

if ($null -eq $receivedOrder) {
    $orderedOrder = Get-First -Items @($orders | Where-Object { (Normalize-Status $_.status) -eq "ORDERED" -or (Normalize-Status $_.status) -eq "PARTIALLY_RECEIVED" }) -Message "No purchase order available for receipt."
    $receiptSequence = 0
    foreach ($lineToReceive in @($orderedOrder.lines | Where-Object { $_.orderedQty -gt $_.receivedQty })) {
        $receiptSequence++
        $receipt = Invoke-E2EApi `
            -Method "POST" `
            -Path "/api/warehouse/purchase-orders/$($orderedOrder.purchaseOrderId)/receipts" `
            -Token $token `
            -Body @{
                purchaseOrderId = $orderedOrder.purchaseOrderId
                idempotencyKey = "e2e-$($orderedOrder.purchaseOrderId)-$receiptSequence"
                warehouseId = $warehouse.warehouseId
                receiptDate = $ServiceDate
                lines = @(
                    @{
                        purchaseOrderLineId = $lineToReceive.purchaseOrderLineId
                        actualQuantity = $lineToReceive.orderedQty - $lineToReceive.receivedQty
                        actualUnitId = $lineToReceive.unitId
                        actualUnitPrice = $lineToReceive.unitPrice
                        lotNumber = "E2E-$($ServiceDate.Replace('-', ''))-$receiptSequence"
                        manufactureDate = $serviceDateValue.AddDays(-1).ToString("yyyy-MM-dd")
                        expiryDate = $serviceDateValue.AddDays(7).ToString("yyyy-MM-dd")
                    }
                )
            }
        Assert-Success $receipt "Warehouse purchase receipt line $receiptSequence"
    }

    $ordersAfterReceipt = Invoke-E2EApi -Method "GET" -Path "/api/purchase-orders" -Token $token
    Assert-Success $ordersAfterReceipt "Purchase order reload after receipt"
    $receivedOrder = @($ordersAfterReceipt.data | Where-Object {
        $_.purchaseOrderId -eq $orderedOrder.purchaseOrderId
    }) | Select-Object -First 1
    if ($null -eq $receivedOrder -or (Normalize-Status $receivedOrder.status) -ne "RECEIVED") {
        throw "Purchase order did not reach RECEIVED after all lines were recorded."
    }
    Write-E2ELog "Purchase order received line-by-line through warehouse API: $($receivedOrder.purchaseOrderCode), status=$($receivedOrder.status)."
}
else {
    Write-E2ELog "Purchase receipt skipped; existing received order=$($receivedOrder.purchaseOrderCode)."
}

$dailyPlan = Invoke-E2EApi -Method "POST" -Path "/api/production-plans/daily/send-to-kitchen" -Token $token -Body @{
    serviceDate = $ServiceDate
    shiftName = "MORNING"
    reason = "ANV 25k E2E sends the locked production plan to kitchen."
}
Assert-Success $dailyPlan "Send daily production plan to kitchen"
if ($dailyPlan.data.sentPlans -ne $dailyPlan.data.totalPlans) {
    throw "Not all production plans were sent to kitchen."
}
Write-E2ELog "Production plan sent to kitchen: $($dailyPlan.data.sentPlans)/$($dailyPlan.data.totalPlans)."

$existingKitchenIssues = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/kitchen-issues?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=500" -Token $token
Assert-Success $existingKitchenIssues "Existing kitchen issue lookup"
$requestKitchenIssues = @($existingKitchenIssues.data | Where-Object { $_.materialRequestId -eq $materialRequestId })
$confirmedIssues = @()
foreach ($issueGroup in @($requestKitchenIssues | Group-Object issueId)) {
    $issueRow = $issueGroup.Group | Select-Object -First 1
    if (@($issueGroup.Group | Where-Object { -not $_.isReceivedByKitchen }).Count -gt 0) {
        $confirmation = Invoke-E2EApi -Method "POST" -Path "/api/inventory-issues/$($issueRow.issueId)/confirm-receipt" -Token $token -Body @{
            hasDiscrepancy = $false
        }
        Assert-Success $confirmation "Existing kitchen receipt confirmation"
        $confirmedIssues += $confirmation.data
        Write-E2ELog "Kitchen confirmed existing issue: $($confirmation.data.issueCode)."
    }
    else {
        $confirmedIssues += $issueRow
    }
}

$demandReport = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/ingredient-demand?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=500" -Token $token
Assert-Success $demandReport "Persisted demand report"
$persistedDemandLines = @($demandReport.data | Where-Object {
    $_.materialRequestId -eq $materialRequestId -and [decimal]$_.totalRequiredQty -gt 0
})
if ($persistedDemandLines.Count -eq 0) {
    throw "Persisted demand has no positive lines to issue."
}

$demandByItem = @{}
foreach ($line in $persistedDemandLines) {
    $key = "$($line.ingredientId)|$($line.unitId)"
    if (-not $demandByItem.ContainsKey($key)) {
        $demandByItem[$key] = [pscustomobject]@{
            ingredientId = $line.ingredientId
            unitId = $line.unitId
            requiredQty = [decimal]0
        }
    }
    $demandByItem[$key].requiredQty += [decimal]$line.totalRequiredQty
}

$issuedByItem = @{}
foreach ($line in $requestKitchenIssues) {
    $key = "$($line.ingredientId)|$($line.unitId)"
    if (-not $issuedByItem.ContainsKey($key)) { $issuedByItem[$key] = [decimal]0 }
    $issuedByItem[$key] += [decimal]$line.issuedQty
}

$remainingByItem = @{}
foreach ($key in $demandByItem.Keys) {
    $issuedQty = if ($issuedByItem.ContainsKey($key)) { [decimal]$issuedByItem[$key] } else { [decimal]0 }
    $remainingQty = [decimal]$demandByItem[$key].requiredQty - $issuedQty
    if ($remainingQty -gt [decimal]0.000001) {
        $remainingByItem[$key] = [pscustomobject]@{
            ingredientId = $demandByItem[$key].ingredientId
            unitId = $demandByItem[$key].unitId
            remainingQty = $remainingQty
        }
    }
}

$createdIssues = @()
if ($remainingByItem.Count -gt 0) {
    $stockGroups = @()
    foreach ($allocationWarehouse in @($warehouses.data.items)) {
        $stockResponse = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/current-stock?warehouseId=$($allocationWarehouse.warehouseId)&limit=-1" -Token $token
        Assert-Success $stockResponse "Current stock allocation lookup for $($allocationWarehouse.warehouseCode)"
        $stockGroups += [pscustomobject]@{
            Name = $allocationWarehouse.warehouseId
            Group = @($stockResponse.data | Where-Object { [decimal]$_.currentQty -gt 0 })
        }
    }

    foreach ($stockGroup in $stockGroups) {
        $availableByItem = @{}
        foreach ($stockRow in $stockGroup.Group) {
            $key = "$($stockRow.ingredientId)|$($stockRow.unitId)"
            if (-not $availableByItem.ContainsKey($key)) { $availableByItem[$key] = [decimal]0 }
            $availableByItem[$key] += [decimal]$stockRow.currentQty
        }

        $issueLines = @()
        foreach ($key in @($remainingByItem.Keys)) {
            if (-not $availableByItem.ContainsKey($key)) { continue }
            $quantity = [decimal][Math]::Min(
                [decimal]$remainingByItem[$key].remainingQty,
                [decimal]$availableByItem[$key]
            )
            if ($quantity -le [decimal]0.000001) { continue }
            $issueLines += @{
                ingredientId = $remainingByItem[$key].ingredientId
                unitId = $remainingByItem[$key].unitId
                requestedQty = $quantity
                issuedQty = $quantity
            }
        }

        if ($issueLines.Count -eq 0) { continue }

        $issue = Invoke-E2EApi -Method "POST" -Path "/api/inventory-issues" -Token $token -Body @{
            issueDate = $ServiceDate
            shiftName = "MORNING"
            warehouseId = $stockGroup.Name
            materialRequestId = $materialRequestId
            lines = $issueLines
        }
        Assert-Success $issue "Inventory issue for warehouse $($stockGroup.Name)"
        $createdIssues += $issue.data
        Write-E2ELog "Inventory issue created: $($issue.data.issueCode), warehouse=$($stockGroup.Name), lines=$($issueLines.Count)."

        foreach ($line in $issueLines) {
            $key = "$($line.ingredientId)|$($line.unitId)"
            $remainingByItem[$key].remainingQty -= [decimal]$line.issuedQty
            if ($remainingByItem[$key].remainingQty -le [decimal]0.000001) {
                $remainingByItem.Remove($key)
            }
        }

        $kitchen = Invoke-E2EApi -Method "POST" -Path "/api/inventory-issues/$($issue.data.issueId)/confirm-receipt" -Token $token -Body @{
            hasDiscrepancy = $false
        }
        Assert-Success $kitchen "Kitchen receipt confirmation"
        $confirmedIssues += $kitchen.data
        Write-E2ELog "Kitchen confirmed issue: $($kitchen.data.issueCode), receivedAt=$($kitchen.data.receivedAt)."
    }
}

if ($remainingByItem.Count -gt 0) {
    $unallocated = @($remainingByItem.Values | ForEach-Object { "$($_.ingredientId):$($_.remainingQty)" }) -join ", "
    throw "Warehouse allocation could not cover all remaining demand: $unallocated"
}

$issueCandidatesAfterExport = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/material-request-candidates/page?purpose=issue&dateFrom=$ServiceDate&dateTo=$ServiceDate&pageNumber=1&pageSize=100" -Token $token
Assert-Success $issueCandidatesAfterExport "Issue candidate reload after allocation"
if (@($issueCandidatesAfterExport.data.items | Where-Object { $_.materialRequestId -eq $materialRequestId }).Count -gt 0) {
    throw "Material request is still actionable after all inventory issues were created."
}

$issueCodes = @($confirmedIssues | ForEach-Object { $_.issueCode } | Select-Object -Unique)
$lastConfirmedIssue = $confirmedIssues | Select-Object -Last 1
Write-E2ELog "Inventory allocation completed across $($issueCodes.Count) warehouse issue(s); demand is no longer actionable."

$reports = @(
    @{ Name = "purchase-demand"; Path = "/api/workflow-reports/purchase-demand?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=20" },
    @{ Name = "stock-movements"; Path = "/api/workflow-reports/stock-movements?dateFrom=$ServiceDate&dateTo=$(Get-Date -Format 'yyyy-MM-dd')&limit=20" },
    @{ Name = "kitchen-issues"; Path = "/api/workflow-reports/kitchen-issues?dateFrom=$ServiceDate&dateTo=$(Get-Date -Format 'yyyy-MM-dd')&limit=20" },
    @{ Name = "audit-changes"; Path = "/api/workflow-reports/audit-changes?limit=20" }
)

$reportResults = @()
foreach ($report in $reports) {
    $response = Invoke-E2EApi -Method "GET" -Path $report.Path -Token $token
    Assert-Success $response "Report $($report.Name)"
    $count = @($response.data).Count
    if ($count -eq 0) {
        throw "Report $($report.Name) returned no rows."
    }

    Write-E2ELog "Report $($report.Name) returned $count rows."
    $reportResults += "$($report.Name): $count rows"
}

$summary = @(
    "# Iter1 Happy Path E2E",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | PASS |",
    "| Base URL | $BaseUrl |",
    "| Service date | $ServiceDate |",
    "| Material request | $($demand.data.requestCode) |",
    "| Purchase request | $($purchase.data.purchaseRequestCode) |",
    "| Purchase order | $($receivedOrder.purchaseOrderCode) |",
    "| Inventory issues | $($issueCodes -join ', ') |",
    "| Kitchen received at | $($lastConfirmedIssue.receivedAt) |",
    "| Reports | $($reportResults -join '; ') |",
    "| Log | $script:LogPath |"
)

Set-Content -Path $summaryPath -Value $summary
Write-E2ELog "Summary written to $summaryPath"
Write-Output "summary=$summaryPath"
