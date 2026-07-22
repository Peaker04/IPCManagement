param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$ServiceDate = "2026-06-18",
    [string]$OutputRoot = ".artifacts/e2e",
    [switch]$SkipSeedReset
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
elseif ($demandStatus -eq "DRAFT") {
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
    @($_.lines | Where-Object { $_.receivedQty -gt 0 }).Count -gt 0
}) | Select-Object -First 1

if ($null -eq $receivedOrder) {
    $orderedOrder = Get-First -Items @($orders | Where-Object { (Normalize-Status $_.status) -eq "ORDERED" -or (Normalize-Status $_.status) -eq "PARTIALLY_RECEIVED" }) -Message "No purchase order available for receipt."
    $lineToReceive = Get-First -Items @($orderedOrder.lines | Where-Object { $_.orderedQty -gt $_.receivedQty }) -Message "No purchase order line has remaining quantity."
    $receipt = Invoke-E2EApi -Method "POST" -Path "/api/purchase-orders/$($orderedOrder.purchaseOrderId)/receive" -Token $token -Body @{
        warehouseId = $warehouse.warehouseId
        lines = @(
            @{
                purchaseOrderLineId = $lineToReceive.purchaseOrderLineId
                receivedQty = $lineToReceive.orderedQty - $lineToReceive.receivedQty
            }
        )
    }
    Assert-Success $receipt "Purchase order receipt"
    $receivedOrder = $receipt.data
    Write-E2ELog "Purchase order received: $($receivedOrder.purchaseOrderCode), status=$($receivedOrder.status)."
}
else {
    Write-E2ELog "Purchase receipt skipped; existing received order=$($receivedOrder.purchaseOrderCode)."
}

$receivedLine = Get-First -Items @($receivedOrder.lines | Where-Object { $_.receivedQty -gt 0 }) -Message "No received line available for issue."
$demandLine = Get-First -Items @($demand.data.lines | Where-Object { $_.ingredientId -eq $receivedLine.ingredientId }) -Message "No demand line matches the received purchase order line."
$existingKitchenIssues = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/kitchen-issues?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=500" -Token $token
$alreadyIssuedQty = [decimal](
    @($existingKitchenIssues.data | Where-Object { $_.ingredientId -eq $demandLine.ingredientId } | ForEach-Object { [decimal]$_.issuedQty }) |
        Measure-Object -Sum
).Sum
$remainingDemandQty = [decimal]$demandLine.totalRequiredQty - $alreadyIssuedQty
if ($remainingDemandQty -le 0) {
    $existingReceivedIssue = @($existingKitchenIssues.data | Where-Object {
        $_.ingredientId -eq $demandLine.ingredientId -and $_.isReceivedByKitchen
    }) | Select-Object -First 1
    if ($null -eq $existingReceivedIssue) {
        throw "No remaining demand quantity or confirmed issue for ingredient $($demandLine.ingredientName)."
    }

    $issue = [pscustomobject]@{ data = $existingReceivedIssue }
    $kitchen = [pscustomobject]@{ data = $existingReceivedIssue }
    Write-E2ELog "Inventory issue retry skipped; existing confirmed issue=$($existingReceivedIssue.issueCode)."
}
else {
    $issueQty = [decimal][Math]::Min(1, [double]$remainingDemandQty)

    $issue = Invoke-E2EApi -Method "POST" -Path "/api/inventory-issues" -Token $token -Body @{
        issueDate = $ServiceDate
        shiftName = "MORNING"
        warehouseId = $warehouse.warehouseId
        materialRequestId = $materialRequestId
        lines = @(
            @{
                ingredientId = $demandLine.ingredientId
                unitId = $demandLine.unitId
                requestedQty = $issueQty
                issuedQty = $issueQty
            }
        )
    }
    Assert-Success $issue "Inventory issue"
    Write-E2ELog "Inventory issue created: $($issue.data.issueCode)."

    $kitchen = Invoke-E2EApi -Method "POST" -Path "/api/inventory-issues/$($issue.data.issueId)/confirm-receipt" -Token $token -Body @{
        hasDiscrepancy = $false
    }
    Assert-Success $kitchen "Kitchen receipt confirmation"
    Write-E2ELog "Kitchen confirmed issue: $($kitchen.data.issueCode), receivedAt=$($kitchen.data.receivedAt)."
}

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
    "| Inventory issue | $($issue.data.issueCode) |",
    "| Kitchen received at | $($kitchen.data.receivedAt) |",
    "| Reports | $($reportResults -join '; ') |",
    "| Log | $script:LogPath |"
)

Set-Content -Path $summaryPath -Value $summary
Write-E2ELog "Summary written to $summaryPath"
Write-Output "summary=$summaryPath"
