param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)][string]$AdminBearerToken
)
$ErrorActionPreference = 'Stop'
# The initializer is intentionally exposed only through the reviewed API host/service scope.
# This wrapper never chooses, creates, resets, or mutates a database lane directly.
$response = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/api/system-operation-mode/initialize" -Headers @{ Authorization = "Bearer $AdminBearerToken" }
$response | ConvertTo-Json -Depth 8
