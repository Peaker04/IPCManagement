param(
    [string]$BaseUrl = "http://localhost:5262",
    [string]$Username = "",
    [string]$Password = "",
    [string]$WeekStartDate = "2026-07-20",
    [string]$CustomerCode = "ANV",
    [decimal]$PriceTierAmount = 25000,
    [string]$WeeklyMenuTemplatePath = "",
    [string]$OutputRoot = ".artifacts/e2e",
    [switch]$SkipSeedReset,
    [switch]$SkipInitialWeeklyMenuImport
)

$ErrorActionPreference = "Stop"

# Thông tin đăng nhập lấy từ tham số hoặc biến môi trường. Mật khẩu tài khoản demo đã xoay
# ngày 26/07/2026 nên không được hardcode trong repo.
if ([string]::IsNullOrWhiteSpace($Username)) {
    $Username = if ($env:IPC_E2E_USERNAME) { $env:IPC_E2E_USERNAME } else { "admin" }
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    $Password = $env:IPC_E2E_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Chua co mat khau E2E. Dat bien moi truong IPC_E2E_PASSWORD hoac truyen -Password. Mat khau tai khoan demo da duoc xoay ngay 26/07/2026 nen khong con la 'admin'."
}

# Template workbook: uu tien tham so -> bien moi truong -> ban mac dinh trong repo.
# Ban happy-path baseline dang dung nam ngoai repo va KHAC ban trong repo; set IPC_E2E_TEMPLATE_PATH de tai lap dung baseline do.
if ([string]::IsNullOrWhiteSpace($WeeklyMenuTemplatePath)) {
    $WeeklyMenuTemplatePath = if ($env:IPC_E2E_TEMPLATE_PATH) {
        $env:IPC_E2E_TEMPLATE_PATH
    } else {
        Join-Path $PSScriptRoot "..\backend\src\IPCManagement.Api\Resources\Templates\weekly-menu-template-ANV-default.xlsx"
    }
}
$dailyRunner = Join-Path $PSScriptRoot "Invoke-Iter1HappyPathE2E.ps1"
$weekStart = [DateTime]::ParseExact($WeekStartDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$weekEndDate = $weekStart.AddDays(6).ToString("yyyy-MM-dd")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
$weeklyOutputDir = Join-Path $OutputRoot "weekly-$timestamp"
$dayOutputRoot = Join-Path $weeklyOutputDir "days"
New-Item -ItemType Directory -Force -Path $dayOutputRoot | Out-Null

function Invoke-DailyLifecycle {
    param(
        [string]$Date,
        [switch]$ReusePublishedMenu,
        [switch]$PreserveDatabase
    )

    $arguments = @{
        BaseUrl = $BaseUrl
        Username = $Username
        Password = $Password
        ServiceDate = $Date
        CustomerCode = $CustomerCode
        PriceTierAmount = $PriceTierAmount
        WeeklyMenuTemplatePath = $WeeklyMenuTemplatePath
        OutputRoot = $dayOutputRoot
        SkipSeedReset = $SkipSeedReset -or $PreserveDatabase
        SkipWeeklyMenuImport = $ReusePublishedMenu
    }
    & $dailyRunner @arguments
    if (-not $?) {
        throw "Daily E2E lifecycle failed for $Date."
    }
}

Invoke-DailyLifecycle -Date $WeekStartDate -ReusePublishedMenu:$SkipInitialWeeklyMenuImport

$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" -Body (@{
    username = $Username
    password = $Password
} | ConvertTo-Json)
if ($login.success -ne $true) { throw "Weekly runner could not authenticate after the first day." }

$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
$customers = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/coordination/customers" -Headers $headers
$customer = @($customers.data | Where-Object customerCode -eq $CustomerCode) | Select-Object -First 1
if ($null -eq $customer) { throw "Customer $CustomerCode was not found." }

$scheduleResponse = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/coordination/menu-schedules?customerId=$($customer.customerId)&dateFrom=$WeekStartDate&dateTo=$weekEndDate" -Headers $headers
$serviceDates = @($scheduleResponse.data | ForEach-Object serviceDate | Sort-Object -Unique)
if ($serviceDates.Count -eq 0) { throw "The imported template created no schedules for $WeekStartDate..$weekEndDate." }
if ($serviceDates -notcontains $WeekStartDate) { throw "The imported template did not create a schedule for week start $WeekStartDate." }

foreach ($serviceDate in @($serviceDates | Where-Object { $_ -ne $WeekStartDate })) {
    Invoke-DailyLifecycle -Date $serviceDate -ReusePublishedMenu -PreserveDatabase
}

$daySummaries = @(Get-ChildItem -LiteralPath $dayOutputRoot -Filter "happy-path-e2e-summary.md" -Recurse | Sort-Object FullName)
if ($daySummaries.Count -ne $serviceDates.Count) {
    throw "Expected $($serviceDates.Count) daily summaries but found $($daySummaries.Count)."
}

$weeklySummaryPath = Join-Path $weeklyOutputDir "weekly-happy-path-e2e-summary.md"
$summary = @(
    "# Weekly Happy Path E2E",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Status | PASS |",
    "| Week | $WeekStartDate .. $weekEndDate |",
    "| Scheduled service days | $($serviceDates.Count) |",
    "| Service dates | $($serviceDates -join ', ') |",
    "| Customer / tier | $CustomerCode / $PriceTierAmount |",
    "",
    "## Daily evidence",
    ""
)
foreach ($daySummary in $daySummaries) {
    $summary += "- $($daySummary.FullName)"
}
Set-Content -LiteralPath $weeklySummaryPath -Value $summary -Encoding utf8
Write-Output "summary=$weeklySummaryPath"
