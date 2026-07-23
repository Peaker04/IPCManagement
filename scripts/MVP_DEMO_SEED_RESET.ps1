param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$ServiceDate = "2026-06-18",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-DemoApi {
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
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }

    return Invoke-RestMethod `
        -Method $Method `
        -Uri $uri `
        -Headers $headers `
        -ContentType "application/json" `
        -Body ($Body | ConvertTo-Json -Depth 10)
}

Write-Host "Logging in to $BaseUrl as $Username..."
$login = Invoke-DemoApi -Method "POST" -Path "/api/auth/login" -Body @{
    username = $Username
    password = $Password
}

if (-not $login.success -or -not $login.data.accessToken) {
    throw "Login failed. Start the backend and verify demo credentials."
}

$token = $login.data.accessToken

Write-Host "Importing demo sample data..."
$sample = Invoke-DemoApi -Method "POST" -Path "/api/sample-data/import" -Token $token -Body @{
    dryRun = [bool]$DryRun
    maxRows = $null
}

if (-not $sample.success) {
    throw "Sample import failed: $($sample.message)"
}

$counts = $sample.data.counts
Write-Host "Sample data ready. Customers created/updated: $($counts.customersCreated)/$($counts.customersUpdated); dishes created/updated: $($counts.dishesCreated)/$($counts.dishesUpdated); current stock created/updated: $($counts.currentStockRowsCreated)/$($counts.currentStockRowsUpdated)."

if ($DryRun) {
    Write-Host "DryRun enabled. Skipping demand and purchase generation."
    exit 0
}

$shiftDefaults = @{
    MORNING = 840
    AFTERNOON = 870
}

foreach ($shiftName in @("MORNING", "AFTERNOON")) {
    Write-Host "Preparing manual meal quantity flow for $ServiceDate $shiftName..."
    $menus = Invoke-DemoApi -Method "GET" -Path "/api/coordination/menu-schedules?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
    if (-not $menus.success -or @($menus.data).Count -eq 0) {
        Write-Host "No menu schedule for $shiftName. Skipping manual quantity setup for this shift."
        continue
    }

    $orders = Invoke-DemoApi -Method "GET" -Path "/api/coordination/orders?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
    if (-not $orders.success -or @($orders.data).Count -eq 0) {
        $manual = Invoke-DemoApi -Method "POST" -Path "/api/coordination/meal-quantity-plans/manual" -Token $token -Body @{
            serviceDate = $ServiceDate
            shiftName = $shiftName
            defaultForecastServings = 0
        }

        if (-not $manual.success) {
            throw "Manual quantity plan creation failed for ${shiftName}: $($manual.message)"
        }

        Write-Host "Manual quantity plan ready for ${shiftName}: created=$($manual.data.linesCreated), reused=$($manual.data.linesReused)."
        $orders = Invoke-DemoApi -Method "GET" -Path "/api/coordination/orders?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
    }

    $plans = Invoke-DemoApi -Method "GET" -Path "/api/coordination/meal-quantity-plans?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
    $editablePlans = @($plans.data | Where-Object { $_.status -in @("DRAFT", "FORECASTED") })
    if ($editablePlans.Count -gt 0) {
        foreach ($order in @($orders.data)) {
            $targetServings = $shiftDefaults[$shiftName]
            if ($order.forecastQuantity -ne $targetServings) {
                $forecast = Invoke-DemoApi -Method "PATCH" -Path "/api/coordination/orders/$($order.quantityPlanLineId)/forecast" -Token $token -Body @{
                    servingsQuantity = $targetServings
                    reason = "Seed reset simulates manual serving entry for MVP workflow."
                }

                if (-not $forecast.success) {
                    throw "Manual serving entry failed for $($order.customerCode) ${shiftName}: $($forecast.message)"
                }
            }
        }

        $orders = Invoke-DemoApi -Method "GET" -Path "/api/coordination/orders?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
        $lock = Invoke-DemoApi -Method "POST" -Path "/api/coordination/orders/lock" -Token $token -Body @{
            serviceDate = $ServiceDate
            shiftName = $shiftName
            scope = $shiftName
            lines = @($orders.data | ForEach-Object {
                @{
                    quantityPlanLineId = $_.quantityPlanLineId
                    actualQuantity = $_.forecastQuantity
                }
            })
        }

        if (-not $lock.success) {
            throw "Lock failed for ${shiftName}: $($lock.message)"
        }

        Write-Host "Locked $($lock.data.lockedLineCount) manual quantity rows for $shiftName."
    }

    $plans = Invoke-DemoApi -Method "GET" -Path "/api/coordination/meal-quantity-plans?serviceDate=$ServiceDate&shiftName=$shiftName" -Token $token
    foreach ($plan in @($plans.data)) {
        if ($plan.status -in @("CONFIRMED", "ADJUSTED")) {
            $signedOff = Invoke-DemoApi -Method "POST" -Path "/api/coordination/orders/$($plan.quantityPlanId)/signoff" -Token $token -Body @{
                note = "Seed reset auto signoff after manual serving entry."
            }

            if (-not $signedOff.success) {
                throw "Signoff failed for $($plan.planCode): $($signedOff.message)"
            }

            Write-Host "Signed off $($plan.planCode): $($signedOff.data.oldStatus) -> $($signedOff.data.newStatus)."
        }
    }
}

Write-Host "Generating material demand for $ServiceDate..."
try {
    $demand = Invoke-DemoApi -Method "POST" -Path "/api/material-demand/generate" -Token $token -Body @{
        serviceDate = $ServiceDate
        scope = "FULLDAY"
    }
}
catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Demand already exists for $ServiceDate. Fetching existing demand..."
        $docs = Invoke-DemoApi -Method "GET" -Path "/api/workflow-reports/workflow-documents?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=10" -Token $token
        $existingDemand = @($docs.data | Where-Object { $_.documentCode -like "MR-*" -and $_.status -ne "CANCELLED" } | Select-Object -First 1)
        if ($existingDemand) {
            $demand = Invoke-DemoApi -Method "GET" -Path "/api/workflow-reports/ingredient-demand?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=500" -Token $token
            $demand = [PSCustomObject]@{
                success = $true
                data = [PSCustomObject]@{
                    materialRequestId = $existingDemand.documentId
                    requestCode = $existingDemand.documentCode
                    lines = @($demand.data | Where-Object { $_.materialRequestId -eq $existingDemand.documentId })
                }
            }
            Write-Host "Using existing demand: $($existingDemand.documentCode)"
        }
        else {
            throw "No valid demand found for $ServiceDate after conflict."
        }
    }
    else {
        throw $_
    }
}

if (-not $demand.success -or -not $demand.data.materialRequestId) {
    throw "Demand generation failed: $($demand.message)"
}

$shortageCount = @($demand.data.lines | Where-Object { $_.suggestedPurchaseQty -gt 0 }).Count
$missingBomCount = @($demand.data.missingBomDishes).Count
Write-Host "Demand ready: $($demand.data.requestCode), lines=$(@($demand.data.lines).Count), shortage=$shortageCount, missingBom=$missingBomCount."

if ($shortageCount -eq 0) {
    Write-Host "No shortage lines. Purchase request generation skipped."
}
else {
    Write-Host "Generating purchase request from demand..."
    $purchase = Invoke-DemoApi -Method "POST" -Path "/api/purchase-workflow/from-demand" -Token $token -Body @{
        materialRequestId = $demand.data.materialRequestId
    }

    if (-not $purchase.success -or -not $purchase.data.purchaseRequestId) {
        throw "Purchase generation failed: $($purchase.message)"
    }

    Write-Host "Purchase request ready: $($purchase.data.purchaseRequestCode), lines=$(@($purchase.data.lines).Count)."
}

Write-Host "Checking data quality..."
$quality = Invoke-DemoApi -Method "GET" -Path "/api/workflow-reports/data-quality?limit=20" -Token $token
if ($quality.success -and $quality.data) {
    Write-Host "Data quality: total=$($quality.data.totalIssues), errors=$($quality.data.errorCount), warnings=$($quality.data.warningCount), missingBom=$($quality.data.missingBomCount), negativeStock=$($quality.data.negativeStockCount), orphan=$($quality.data.orphanDocumentCount)."
}
else {
    Write-Host "Data quality report unavailable: $($quality.message)"
}

Write-Host "Demo reset/seed complete."
