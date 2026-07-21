#!/usr/bin/env bash
# migrate — apply EF Core migrations to this lane's MySQL database.
set -euo pipefail

source "$PROFILE_DIR/hooks/database-env.sh"
( cd "$LANE_DIR/backend/src/IPCManagement.Api" && dotnet ef database update --no-build -c Release )
echo "harness: migrations complete for $DB_NAME"
