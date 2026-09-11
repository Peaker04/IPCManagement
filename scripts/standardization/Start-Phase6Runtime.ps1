param(
    [string]$Database = 'ipc_e2e_template',
    [int]$ApiPort = 8010,
    [int]$FrontendPort = 3010,
    [string]$ArtifactDirectory = '.artifacts/shipyard-live/standardization-phase6-20260803/runtime'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$settingsPath = Join-Path $root 'backend\src\IPCManagement.Api\appsettings.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$output = [System.IO.Path]::GetFullPath((Join-Path $root $ArtifactDirectory))
[System.IO.Directory]::CreateDirectory($output) | Out-Null

foreach ($port in @($ApiPort, $FrontendPort)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. Refusing to stop an unowned process."
    }
}

$env:ConnectionStrings__DefaultConnection = [regex]::Replace(
    $settings.ConnectionStrings.DefaultConnection,
    '(?i)(Database|Initial Catalog)=[^;]*',
    "Database=$Database")
$env:JwtSettings__SecretKey = $settings.JwtSettings.SecretKey
$env:JwtSettings__Issuer = $settings.JwtSettings.Issuer
$env:JwtSettings__Audience = $settings.JwtSettings.Audience
$env:ASPNETCORE_ENVIRONMENT = 'Development'

$api = Start-Process dotnet -ArgumentList @(
    'run', '--project', 'backend/src/IPCManagement.Api/IPCManagement.Api.csproj',
    '--no-build', '--urls', "http://0.0.0.0:$ApiPort"
) -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $output 'api.out.log') `
    -RedirectStandardError (Join-Path $output 'api.err.log') -PassThru

$env:VITE_PROXY_TARGET = "http://localhost:$ApiPort"
$frontend = Start-Process npm.cmd -ArgumentList @(
    'run', 'dev', '--', '--host', '0.0.0.0', '--port', $FrontendPort
) -WorkingDirectory (Join-Path $root 'frontend') -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $output 'frontend.out.log') `
    -RedirectStandardError (Join-Path $output 'frontend.err.log') -PassThru

$deadline = (Get-Date).AddSeconds(30)
do {
    Start-Sleep -Milliseconds 250
    $apiListener = Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $frontendListener = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
} until (($apiListener -and $frontendListener) -or (Get-Date) -ge $deadline)
if (-not $apiListener -or -not $frontendListener) {
    throw 'Runtime did not open both configured ports within 30 seconds.'
}

$runtime = [ordered]@{
    database = $Database
    apiPort = $ApiPort
    frontendPort = $FrontendPort
    apiPid = $api.Id
    frontendPid = $frontend.Id
    apiListenerPid = $apiListener.OwningProcess
    frontendListenerPid = $frontendListener.OwningProcess
    startedAt = (Get-Date).ToUniversalTime().ToString('o')
}
[System.IO.File]::WriteAllText(
    (Join-Path $output 'runtime.json'),
    ($runtime | ConvertTo-Json),
    [System.Text.UTF8Encoding]::new($false))
$runtime | ConvertTo-Json -Compress
