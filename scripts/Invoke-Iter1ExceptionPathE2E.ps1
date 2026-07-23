param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$ServiceDate = "2026-06-18",
    [string]$OutputRoot = ".artifacts/e2e",
    [switch]$SkipSeedReset,
    [switch]$RunRecoveryHappyPath
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
            -Body ($Body | ConvertTo-Json -Depth 50)
    }
    catch {
        $response = $_.Exception.Response
        if ($response) {
            $reader = New-Object IO.StreamReader($response.GetResponseStream())
            $text = $reader.ReadToEnd()
            throw "HTTP $([int]$response.StatusCode) $Method $Path :: $text"
        }

        throw
    }
}

function Invoke-ExpectedE2EFailure {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = "",
        [int]$ExpectedStatus
    )

    $headers = @{}
    if ($Token) {
        $headers.Authorization = "Bearer $Token"
    }

    $uri = "$BaseUrl$Path"
    try {
        if ($null -eq $Body) {
            $null = Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
        }
        else {
            $null = Invoke-RestMethod `
                -Method $Method `
                -Uri $uri `
                -Headers $headers `
                -ContentType "application/json" `
                -Body ($Body | ConvertTo-Json -Depth 50)
        }

        throw "Expected HTTP $ExpectedStatus for $Method $Path but the call succeeded."
    }
    catch {
        $response = $_.Exception.Response
        if (-not $response) {
            throw
        }

        $reader = New-Object IO.StreamReader($response.GetResponseStream())
        $text = $reader.ReadToEnd()
        $status = [int]$response.StatusCode
        if ($status -ne $ExpectedStatus) {
            throw "Expected HTTP $ExpectedStatus for $Method $Path but got HTTP $status :: $text"
        }

        $json = $null
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            try {
                $json = $text | ConvertFrom-Json
            }
            catch {
                $json = $null
            }
        }

        return [pscustomobject]@{
            StatusCode = $status
            Body = $text
            Json = $json
        }
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

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
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

function Get-IssueCategoryCounts {
    param([object[]]$Issues)

    $counts = @{}
    foreach ($issue in $Issues) {
        $category = [string]$issue.category
        if ([string]::IsNullOrWhiteSpace($category)) {
            $category = "unknown"
        }

        if (-not $counts.ContainsKey($category)) {
            $counts[$category] = 0
        }

        $counts[$category] += 1
    }

    return ($counts.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$script:LogPath = Join-Path $outputDir "exception-path-e2e.log"
$summaryPath = Join-Path $outputDir "exception-path-e2e-summary.md"
New-Item -ItemType File -Force -Path $script:LogPath | Out-Null

Write-E2ELog "Iter1 exception path E2E started. BaseUrl=$BaseUrl ServiceDate=$ServiceDate SkipSeedReset=$SkipSeedReset RunRecoveryHappyPath=$RunRecoveryHappyPath"

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

$demand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/generate" -Token $token -Body @{
    serviceDate = $ServiceDate
    scope = "FULLDAY"
}
Assert-Success $demand "Demand generation"
$materialRequestId = $demand.data.materialRequestId
Write-E2ELog "Demand ready: $($demand.data.requestCode), status=$($demand.data.status), lines=$(@($demand.data.lines).Count)."

$staleness = Invoke-E2EApi -Method "GET" -Path "/api/material-demand/staleness?serviceDate=$ServiceDate&scope=FULLDAY" -Token $token
Assert-Success $staleness "Demand staleness"
Assert-True ($staleness.data.hasExistingPlan -eq $true) "Expected an existing material demand plan for stale-demand check."
Assert-True ($staleness.data.isStale -eq $true) "Expected stale demand signal after DemoReset workflow seed."
Write-E2ELog "Stale demand detected: reasons=$(@($staleness.data.reasons) -join ' | ')."

$dataQuality = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/data-quality?limit=200" -Token $token
Assert-Success $dataQuality "Data quality report"
$issues = @($dataQuality.data.issues)
$missingBomIssues = @($issues | Where-Object { $_.category -eq "missing_bom" })
Assert-True ($missingBomIssues.Count -gt 0 -or $dataQuality.data.missingBomCount -gt 0) "Expected at least one missing BOM data-quality issue."
$missingBomIssue = Get-First -Items $missingBomIssues -Message "Data-quality missing BOM count is positive but no issue row was returned in the limited result set."
Write-E2ELog "Missing BOM detected: $($missingBomIssue.entityCode) / route=$($missingBomIssue.route)."

$demandStatus = Normalize-Status $demand.data.status
if ($demandStatus -eq "DRAFT") {
    $approvedDemand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/$materialRequestId/approve" -Token $token -Body @{
        reason = "Iter1 exception E2E approves demand so shortage issue can be exercised."
    }
    Assert-Success $approvedDemand "Demand approval"
    Write-E2ELog "Demand approved: $($approvedDemand.data.oldStatus)->$($approvedDemand.data.newStatus)."
    $demandStatus = Normalize-Status $approvedDemand.data.newStatus
}

Assert-True ($demandStatus -in @("MANAGERAPPROVED", "APPROVED", "SENTTOWAREHOUSE")) "Demand must be approved before shortage issue check. Current status=$demandStatus"

$shortageLine = Get-First -Items @($demand.data.lines | Where-Object { $_.suggestedPurchaseQty -gt 0 }) -Message "No demand line with shortage was found."
$warehouses = Invoke-E2EApi -Method "GET" -Path "/api/Warehouses?pageNumber=1&pageSize=20" -Token $token
Assert-Success $warehouses "Warehouse lookup"
$warehouse = Get-First -Items @($warehouses.data.items) -Message "No warehouse found for shortage issue check."

$shortageFailure = Invoke-ExpectedE2EFailure -Method "POST" -Path "/api/inventory-issues" -Token $token -ExpectedStatus 409 -Body @{
    issueDate = $ServiceDate
    shiftName = "MORNING"
    warehouseId = $warehouse.warehouseId
    materialRequestId = $materialRequestId
    lines = @(
        @{
            ingredientId = $shortageLine.ingredientId
            unitId = $shortageLine.unitId
            requestedQty = $shortageLine.totalRequiredQty
            issuedQty = $shortageLine.totalRequiredQty
        }
    )
}
$shortageDetails = $shortageFailure.Json.details
if ($null -eq $shortageDetails) {
    $shortageDetails = $shortageFailure.Json.errors
}
Assert-True ($null -ne $shortageDetails -and @($shortageDetails.lines).Count -gt 0) "Expected stock-shortage details in 409 response."
Write-E2ELog "Stock shortage rejected issue as expected: ingredient=$($shortageDetails.lines[0].ingredientName), suggestedAction=$($shortageDetails.suggestedAction)."

$mealPlans = Invoke-E2EApi -Method "GET" -Path "/api/coordination/meal-quantity-plans?serviceDate=$ServiceDate" -Token $token
Assert-Success $mealPlans "Meal quantity plan lookup"
$lockedPlan = Get-First -Items @($mealPlans.data | Where-Object { (Normalize-Status $_.status) -in @("COMPLETED", "ADJUSTED") -and @($_.lines).Count -gt 0 }) -Message "No locked meal quantity plan found for rejected approval check."
$quantityLine = Get-First -Items @($lockedPlan.lines | Where-Object { $_.finalServings -ge 0 }) -Message "Locked meal quantity plan has no adjustable lines."
$relockedPlan = Invoke-E2EApi -Method "POST" -Path "/api/coordination/orders/lock" -Token $token -Body @{
    serviceDate = $ServiceDate
    scope = "FULLDAY"
    lines = @(
        @{
            quantityPlanLineId = $quantityLine.quantityPlanLineId
            finalServings = $quantityLine.finalServings
        }
    )
}
Assert-Success $relockedPlan "Meal quantity plan relock"
$adjustment = Invoke-E2EApi -Method "POST" -Path "/api/coordination/orders/adjust" -Token $token -Body @{
    orderId = $quantityLine.quantityPlanLineId
    quantityPlanLineId = $quantityLine.quantityPlanLineId
    field = "finalServings"
    newValue = $quantityLine.finalServings + 1
    reason = "Iter1 exception E2E creates an approval request that QA will reject."
}
Assert-Success $adjustment "Order adjustment create"
Assert-True ($adjustment.data.requiresApproval -eq $true) "Expected order adjustment to require approval."
$rejectedApproval = Invoke-E2EApi -Method "POST" -Path "/api/approvals/$($adjustment.data.approvalTargetType)/$($adjustment.data.approvalTargetId)" -Token $token -Body @{
    status = 1
    reason = "Iter1 exception E2E rejects the adjustment and records a user-visible reason."
}
Assert-Success $rejectedApproval "Order adjustment reject"
Assert-True ($rejectedApproval.data.status -eq "REJECT") "Expected rejected approval decision."
Write-E2ELog "Rejected approval verified through order adjustment: $($adjustment.data.approvalTargetId), $($rejectedApproval.data.oldStatus)->$($rejectedApproval.data.newStatus)."

$stockShortageReport = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/data-quality?limit=200" -Token $token
Assert-Success $stockShortageReport "Data quality after shortage"
$stockShortageIssues = @($stockShortageReport.data.issues | Where-Object { $_.category -eq "stock_shortage" })
Assert-True ($stockShortageIssues.Count -gt 0) "Expected stock_shortage data-quality issue after shortage branch."
$stockShortageIssue = Get-First -Items $stockShortageIssues -Message "No stock_shortage issue found after shortage branch."
$remediation = Invoke-E2EApi -Method "POST" -Path "/api/workflow-reports/data-quality/issues/remediation" -Token $token -Body @{
    issueId = $stockShortageIssue.issueId
    action = "resolve"
    note = "Iter1 exception E2E documents fix: create PR/replenish stock, then rerun happy path."
}
Assert-Success $remediation "Stock shortage remediation"
Assert-True ($remediation.data.remediationStatus -eq "resolved") "Expected stock shortage issue remediation status resolved."
Write-E2ELog "Shortage remediation recorded: issue=$($remediation.data.issueId), status=$($remediation.data.remediationStatus)."

$plansAfterReject = Invoke-E2EApi -Method "GET" -Path "/api/coordination/meal-quantity-plans?serviceDate=$ServiceDate" -Token $token
Assert-Success $plansAfterReject "Meal quantity plan recovery lookup"
foreach ($plan in @($plansAfterReject.data | Where-Object { (Normalize-Status $_.status) -in @("CONFIRMED", "ADJUSTED") })) {
    $signoff = Invoke-E2EApi -Method "POST" -Path "/api/coordination/orders/$($plan.quantityPlanId)/signoff" -Token $token -Body @{
        note = "Iter1 exception E2E restores completed quantity plan after rejected adjustment."
    }
    Assert-Success $signoff "Meal quantity plan recovery signoff"
    Write-E2ELog "Recovery signoff completed: $($plan.planCode) $($signoff.data.oldStatus)->$($signoff.data.newStatus)."
}

$continuedDemand = Invoke-E2EApi -Method "POST" -Path "/api/material-demand/generate" -Token $token -Body @{
    serviceDate = $ServiceDate
    scope = "FULLDAY"
}
Assert-Success $continuedDemand "Recovery demand regeneration"
$continuedPurchase = Invoke-E2EApi -Method "POST" -Path "/api/purchase-workflow/from-demand" -Token $token -Body @{
    materialRequestId = $continuedDemand.data.materialRequestId
}
Assert-Success $continuedPurchase "Recovery purchase workflow"
$recoverySummary = "Demand $($continuedDemand.data.requestCode) regenerated; purchase $($continuedPurchase.data.purchaseRequestCode) status=$($continuedPurchase.data.status)"
Write-E2ELog "Recovery continuation verified: $recoverySummary."

if ($RunRecoveryHappyPath) {
    Write-E2ELog "Running optional recovery happy-path E2E after exception checks."
    $happyOutput = & powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1HappyPathE2E.ps1 `
        -BaseUrl $BaseUrl `
        -Username $Username `
        -Password $Password `
        -ServiceDate $ServiceDate 2>&1
    $happyOutput | ForEach-Object { Write-E2ELog $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "Recovery happy-path E2E failed with exit code $LASTEXITCODE"
    }

    $summaryLine = @($happyOutput | Where-Object { $_ -like "summary=*" } | Select-Object -Last 1)
    if ($summaryLine.Count -gt 0) {
        $recoverySummary = $summaryLine[-1].Substring("summary=".Length)
    }
    else {
        $recoverySummary = "PASS (summary path not emitted)"
    }
}

$finalQuality = Invoke-E2EApi -Method "GET" -Path "/api/workflow-reports/data-quality?limit=200" -Token $token
Assert-Success $finalQuality "Final data quality"
$categoryCounts = Get-IssueCategoryCounts -Issues @($finalQuality.data.issues)

$summary = @(
    "# Iter1 Exception Path E2E",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | PASS |",
    "| Base URL | $BaseUrl |",
    "| Service date | $ServiceDate |",
    "| Stale demand | isStale=$($staleness.data.isStale); reasons=$(@($staleness.data.reasons) -join '; ') |",
    "| Missing BOM | $($missingBomIssue.entityCode) / $($missingBomIssue.suggestedAction) |",
    "| Shortage | HTTP $($shortageFailure.StatusCode); ingredient=$($shortageDetails.lines[0].ingredientName); action=$($shortageDetails.suggestedAction) |",
    "| Rejected approval | $($adjustment.data.approvalTargetType)/$($adjustment.data.approvalTargetId) -> $($rejectedApproval.data.status) |",
    "| Remediation | $($remediation.data.issueId) -> $($remediation.data.remediationStatus) |",
    "| Recovery happy path | $recoverySummary |",
    "| Final data-quality categories | $categoryCounts |",
    "| Log | $script:LogPath |"
)

Set-Content -Path $summaryPath -Value $summary
Write-E2ELog "Summary written to $summaryPath"
Write-Output "summary=$summaryPath"
