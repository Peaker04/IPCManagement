param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$ServiceDate = "2026-07-20",
    [string]$OutputRoot = ".artifacts/e2e-business-matrix/api"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Invoke-JsonRequest {
    param([string]$Method, [string]$Path, [object]$Body = $null, [string]$Token = "")
    $client = [System.Net.Http.HttpClient]::new()
    try {
        if ($Token) { $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token) }
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$BaseUrl$Path")
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Depth 30 -Compress
            $request.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, "application/json")
        }
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        [pscustomobject]@{ Status = [int]$response.StatusCode; Text = $text; Json = if ($text) { $text | ConvertFrom-Json } else { $null } }
    }
    finally { $client.Dispose() }
}

function Get-Token {
    param([string]$Username, [string]$Password)
    $response = Invoke-JsonRequest POST "/api/auth/login" @{ username = $Username; password = $Password }
    if ($response.Status -ne 200 -or -not $response.Json.data.accessToken) { throw "Login failed for ${Username}: HTTP $($response.Status)" }
    $response.Json.data.accessToken
}

$results = [Collections.Generic.List[object]]::new()
function Test-Case {
    param(
        [string]$Category,
        [string]$Area,
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [string]$Token,
        [int[]]$ExpectedStatus,
        [string]$ExpectedText = ""
    )
    $response = Invoke-JsonRequest $Method $Path $Body $Token
    $statusPass = $ExpectedStatus -contains $response.Status
    $textPass = -not $ExpectedText -or $response.Text -match $ExpectedText
    $results.Add([pscustomobject]@{
        category = $Category; area = $Area; scenario = $Name; method = $Method; path = $Path
        expectedStatus = $ExpectedStatus; actualStatus = $response.Status
        expectedText = $ExpectedText; passed = $statusPass -and $textPass
        response = $response.Text.Substring(0, [Math]::Min(1200, $response.Text.Length))
    })
}

$admin = Get-Token admin admin
$purchasing = Get-Token thumua thumua
$chef = Get-Token beptruong beptruong
$warehouse = Get-Token thukho thukho

$customers = Invoke-JsonRequest GET "/api/coordination/customers" $null $admin
$anv = @($customers.Json.data | Where-Object customerCode -eq "ANV")[0]
if (-not $anv) { throw "ANV customer was not found." }
$documents = Invoke-JsonRequest GET "/api/workflow-reports/workflow-documents?dateFrom=$ServiceDate&dateTo=$ServiceDate&limit=100" $null $admin
$demand = @($documents.Json.data | Where-Object { $_.documentCode -like "MR-*" })[0]
$orders = Invoke-JsonRequest GET "/api/purchase-orders/page?pageNumber=1&pageSize=100" $null $purchasing
$receivedOrder = @($orders.Json.data.items | Where-Object status -eq "RECEIVED")[0]

Test-Case negative auth "Invalid password does not create a session" POST "/api/auth/login" @{ username = "admin"; password = "wrong-password" } "" @(401)
Test-Case permission auth "Profile requires an access token" GET "/api/auth/profile" $null "" @(401)
Test-Case permission demand "Purchasing cannot generate material demand" POST "/api/material-demand/generate" @{ serviceDate = $ServiceDate; scope = "FULLDAY" } $purchasing @(403)
Test-Case permission purchase "Warehouse cannot generate purchase requests" POST "/api/purchase-workflow/from-demand" @{ materialRequestId = $demand.documentId } $warehouse @(403)
Test-Case negative coordination "Negative servings are rejected" POST "/api/coordination/meal-quantity-plans/quick-servings" @{ customerId = $anv.customerId; serviceDate = $ServiceDate; shiftName = "MORNING"; servings = -1; complete = $false } $admin @(400)
Test-Case negative coordination "Unknown shift is rejected" POST "/api/coordination/meal-quantity-plans/quick-servings" @{ customerId = $anv.customerId; serviceDate = $ServiceDate; shiftName = "NIGHT"; servings = 1; complete = $false } $admin @(400)
Test-Case boundary demand "Unscheduled Sunday does not create demand" POST "/api/material-demand/generate" @{ serviceDate = "2026-07-26"; scope = "FULLDAY" } $admin @(404)
Test-Case negative demand "Invalid date format is rejected" POST "/api/material-demand/generate" @{ serviceDate = "20-07-2026"; scope = "FULLDAY" } $admin @(400)
Test-Case regression demand "Terminal demand cannot be overwritten" POST "/api/material-demand/generate" @{ serviceDate = $ServiceDate; scope = "FULLDAY" } $admin @(409)
Test-Case regression approval "Terminal demand cannot be approved again" POST "/api/material-demand/$($demand.documentId)/approve" @{ reason = "exception audit" } $admin @(400)
Test-Case negative purchase "Unknown demand ID does not create a PR" POST "/api/purchase-workflow/from-demand" @{ materialRequestId = "00000000-0000-0000-0000-000000000000" } $purchasing @(400,404)
if ($receivedOrder) {
    Test-Case regression purchase "Received PO cannot be cancelled" POST "/api/purchase-orders/$($receivedOrder.purchaseOrderId)/cancel" @{} $purchasing @(400)
}
Test-Case negative warehouse "Issue missing warehouse demand and lines is rejected" POST "/api/inventory-issues" @{ issueDate = $ServiceDate; warehouseId = ""; materialRequestId = ""; lines = @() } $warehouse @(400)
Test-Case negative chef "Unknown issue cannot be confirmed" POST "/api/inventory-issues/00000000-0000-0000-0000-000000000000/confirm-receipt" @{ hasDiscrepancy = $false } $chef @(404)
Test-Case negative chef "Incomplete supplemental request is rejected" POST "/api/supplemental-material-requests" @{ issueId = ""; issueLineId = ""; requestedQty = 0; reason = "" } $chef @(400)
Test-Case negative chef "Return without lines is rejected" POST "/api/inventory-returns" @{ returnDate = $ServiceDate; warehouseId = ""; issueId = ""; lines = @() } $chef @(400)
Test-Case boundary reports "Invalid pagination is normalized without server failure" GET "/api/purchase-orders/page?pageNumber=-10&pageSize=99999" $null $purchasing @(200)

$passed = @($results | Where-Object passed).Count
$failed = $results.Count - $passed
$state = [pscustomobject]@{ generatedAt = (Get-Date).ToString("O"); total = $results.Count; passed = $passed; failed = $failed; results = $results }
$state | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $outputDir "exception-api-state.json") -Encoding UTF8

$lines = @("# Exception-path real-stack E2E", "", "- Total: $($results.Count)", "- Passed: $passed", "- Failed: $failed", "", "| Category | Area | Scenario | HTTP | Result |", "|---|---|---|---:|---|")
foreach ($item in $results) { $lines += "| $($item.category) | $($item.area) | $($item.scenario) | $($item.actualStatus) | $(if ($item.passed) { 'PASS' } else { 'FAIL' }) |" }
$lines | Set-Content (Join-Path $outputDir "exception-api-summary.md") -Encoding UTF8
Write-Output "scenarios=$($results.Count) passed=$passed failed=$failed output=$outputDir"
if ($failed -gt 0) { exit 1 }
