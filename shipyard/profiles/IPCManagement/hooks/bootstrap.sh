#!/usr/bin/env bash
# bootstrap — install IPCManagement dependencies in a lane clone.
set -euo pipefail

( cd "$LANE_DIR/backend" && dotnet restore IPCManagement.slnx )

if [ -f "$LANE_DIR/frontend/package-lock.json" ]; then
  ( cd "$LANE_DIR/frontend" && npm ci )
elif [ -f "$LANE_DIR/frontend/package.json" ]; then
  ( cd "$LANE_DIR/frontend" && npm install )
fi

echo "harness: bootstrap complete for lane $LANE"
