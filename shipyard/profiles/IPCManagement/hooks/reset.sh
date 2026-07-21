#!/usr/bin/env bash
# reset — restore the lane database from the verified E2E template.
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

echo "harness: restoring $DB_NAME from $TEMPLATE_DB..."
dotnet run --project "$TOOL_PROJECT" -c Release -- \
  clone --settings "$SETTINGS_FILE" --source "$TEMPLATE_DB" --target "$DB_NAME"
echo "harness: lane database restored and verified"
