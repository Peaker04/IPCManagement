param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(25000, 30000, 34000)]
    [int]$PriceTierAmount,
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [string]$CustomerCode = "ANV",
    [string]$CustomerId = "",
    [string]$WeekStartDate = "2026-07-20",
    [string]$FilePath = "C:\Users\Administrator\Downloads\weekly-menu-template-ANV-2026-07-20.xlsx"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
    throw "Không tìm thấy file template: $FilePath"
}

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" -Body (@{
    username = $Username
    password = $Password
} | ConvertTo-Json)
$token = $login.data.accessToken
if ([string]::IsNullOrWhiteSpace($token)) {
    throw "Đăng nhập thất bại hoặc response không có access token."
}

if ([string]::IsNullOrWhiteSpace($CustomerId)) {
    $customers = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/coordination/customers" -Headers @{
        Authorization = "Bearer $token"
    }
    $customer = @($customers.data | Where-Object { $_.customerCode -eq $CustomerCode }) | Select-Object -First 1
    if ($null -eq $customer) {
        throw "Không tìm thấy khách hàng đang hoạt động có mã '$CustomerCode'."
    }
    $CustomerId = $customer.customerId
}

$responseText = & curl.exe -sS --fail-with-body -X POST `
    -H "Authorization: Bearer $token" `
    -F "file=@$FilePath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
    -F "customerId=$CustomerId" `
    -F "weekStartDate=$WeekStartDate" `
    -F "priceTierAmount=$PriceTierAmount" `
    "$BaseUrl/api/coordination/weekly-menu/import/commit"
if ($LASTEXITCODE -ne 0) {
    throw "Commit import thất bại (curl exit $LASTEXITCODE): $responseText"
}

$responseText | ConvertFrom-Json | ConvertTo-Json -Depth 20
