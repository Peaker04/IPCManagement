#!/usr/bin/env bash
# Source from hooks that need the per-lane .NET connection string.

SETTINGS_FILE="$LANE_DIR/backend/src/IPCManagement.Api/appsettings.json"
[ -f "$SETTINGS_FILE" ] || die "appsettings not found: $SETTINGS_FILE"
[ -n "${DB_NAME:-}" ] || die "DB_NAME is required"

export IPC_LANE_SETTINGS="$SETTINGS_FILE"
export IPC_LANE_DATABASE="$DB_NAME"
ConnectionStrings__DefaultConnection="$(powershell.exe -NoProfile -Command '
  $config = Get-Content -LiteralPath $env:IPC_LANE_SETTINGS -Raw | ConvertFrom-Json
  $value = $config.ConnectionStrings.DefaultConnection
  if ([string]::IsNullOrWhiteSpace($value)) { throw "DefaultConnection is missing" }
  $value = [regex]::Replace($value, "(?i)(Database|Initial Catalog)=[^;]*", "Database=$env:IPC_LANE_DATABASE")
  [Console]::Out.Write($value)
')"
export ConnectionStrings__DefaultConnection
export ASPNETCORE_ENVIRONMENT="Development"
unset IPC_LANE_SETTINGS IPC_LANE_DATABASE
