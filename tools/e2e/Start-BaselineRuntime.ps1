[CmdletBinding()]
param(
    [int]$FrontendPort = 3037,
    [int]$ApiPort = 8037,
    [string]$Database = 'ipcmanagement',
    [string]$ArtifactRoot = '.artifacts/shipyard-live/ipcmanagement-baseline-runtime'
)

$ErrorActionPreference = 'Stop'
if ($Database -cne 'ipcmanagement') { throw "Baseline runtime may target exact ipcmanagement only." }

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$artifact = [IO.Path]::GetFullPath((Join-Path $root $ArtifactRoot))
[IO.Directory]::CreateDirectory($artifact) | Out-Null

foreach ($port in @($FrontendPort, $ApiPort)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use."
    }
}

$settings = Get-Content (Join-Path $root 'backend/src/IPCManagement.Api/appsettings.json') -Raw | ConvertFrom-Json
$connection = $settings.ConnectionStrings.DefaultConnection -replace '(?i)(Database|Initial Catalog)=[^;]*', "`$1=$Database"
if ($connection -notmatch '(?i)(Database|Initial Catalog)=ipcmanagement(?:;|$)') { throw 'Database fence failed.' }

$saved = @{
    connection = $env:ConnectionStrings__DefaultConnection
    environment = $env:ASPNETCORE_ENVIRONMENT
    urls = $env:ASPNETCORE_URLS
    proxy = $env:VITE_PROXY_TARGET
}

try {
    $env:ConnectionStrings__DefaultConnection = $connection
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$ApiPort"
    $api = Start-Process -FilePath (Get-Command dotnet).Source `
        -ArgumentList @('run', '--no-launch-profile', '--no-build') `
        -WorkingDirectory (Join-Path $root 'backend/src/IPCManagement.Api') `
        -RedirectStandardOutput (Join-Path $artifact 'api.out.log') `
        -RedirectStandardError (Join-Path $artifact 'api.err.log') `
        -WindowStyle Hidden -PassThru

    $env:VITE_PROXY_TARGET = "http://127.0.0.1:$ApiPort"
    $frontend = Start-Process -FilePath (Get-Command npm.cmd).Source `
        -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', $FrontendPort) `
        -WorkingDirectory (Join-Path $root 'frontend') `
        -RedirectStandardOutput (Join-Path $artifact 'frontend.out.log') `
        -RedirectStandardError (Join-Path $artifact 'frontend.err.log') `
        -WindowStyle Hidden -PassThru
}
finally {
    $env:ConnectionStrings__DefaultConnection = $saved.connection
    $env:ASPNETCORE_ENVIRONMENT = $saved.environment
    $env:ASPNETCORE_URLS = $saved.urls
    $env:VITE_PROXY_TARGET = $saved.proxy
}

$deadline = [datetime]::Now.AddSeconds(45)
$ready = $null
$frontendStatus = $null
do {
    try { $ready = Invoke-RestMethod "http://127.0.0.1:$ApiPort/health/ready" -TimeoutSec 2 } catch {}
    try { $frontendStatus = (Invoke-WebRequest "http://127.0.0.1:$FrontendPort/login" -UseBasicParsing -TimeoutSec 2).StatusCode } catch {}
    if ($ready -and $frontendStatus -eq 200) { break }
    Start-Sleep -Milliseconds 500
} while ([datetime]::Now -lt $deadline)

if (-not $ready -or $frontendStatus -ne 200) {
    foreach ($process in @($frontend, $api)) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    throw "Baseline runtime startup failed. Inspect $artifact."
}

$listeners = @(Get-NetTCPConnection -LocalPort $FrontendPort, $ApiPort -State Listen | Select-Object LocalPort, OwningProcess)
$receipt = [ordered]@{
    database = $Database
    frontendUrl = "http://127.0.0.1:$FrontendPort"
    apiUrl = "http://127.0.0.1:$ApiPort"
    startedAt = [datetimeoffset]::Now.ToString('o')
    startedProcesses = @(
        [ordered]@{ name = 'api-launcher'; pid = $api.Id }
        [ordered]@{ name = 'frontend'; pid = $frontend.Id }
    )
    listeners = $listeners
    readyStatus = $ready.status
    protectedLaneConnectionAttempts = 0
}
[IO.File]::WriteAllText((Join-Path $artifact 'runtime.json'), ($receipt | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$receipt | ConvertTo-Json -Depth 6
