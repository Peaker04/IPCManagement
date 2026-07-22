#!/usr/bin/env bash
# boot — build and start the API and Vite frontend, then return immediately.
set -euo pipefail

source "$PROFILE_DIR/hooks/database-env.sh"
NO_BUILD="${1:-}"

if [ "$NO_BUILD" != "--no-build" ]; then
  ( cd "$LANE_DIR/backend" && dotnet build IPCManagement.slnx -c Release --no-restore )
  ( cd "$LANE_DIR/frontend" && npm run build )
fi

harness_spawn api "$LANE_DIR" \
  dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj \
    -c Release --no-build --urls "http://0.0.0.0:$API_PORT"
harness_spawn frontend "$LANE_DIR/frontend" \
  env VITE_API_BASE_URL="$API_BASE" npm run dev -- --host 0.0.0.0 --port "$FE_PORT"

echo "harness: boot complete"
