#!/usr/bin/env bash
# create-template — snapshot the clean lane database for deterministic E2E resets.
set -euo pipefail

TEMPLATE_DB="ipc_e2e_template"
TOOL_PROJECT="$LANE_DIR/backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj"
SETTINGS_FILE="${IPC_SETTINGS_FILE:-$LANE_DIR/backend/src/IPCManagement.Api/appsettings.json}"
if [ ! -f "$SETTINGS_FILE" ] && [ -n "${SOURCE_REPO:-}" ]; then
  SETTINGS_FILE="$SOURCE_REPO/backend/src/IPCManagement.Api/appsettings.json"
fi

[ -n "${DB_NAME:-}" ] || die "DB_NAME is required"
[ -f "$TOOL_PROJECT" ] || die "database tool not found: $TOOL_PROJECT"
[ -f "$SETTINGS_FILE" ] || die "appsettings not found: $SETTINGS_FILE"

echo "harness: creating template $TEMPLATE_DB from $DB_NAME..."
dotnet run --project "$TOOL_PROJECT" -c Release -- \
  clone --settings "$SETTINGS_FILE" --source "$DB_NAME" --target "$TEMPLATE_DB"
echo "harness: template database verified"
