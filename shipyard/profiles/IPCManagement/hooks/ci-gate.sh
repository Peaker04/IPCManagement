#!/usr/bin/env bash
# ci-gate — backend, frontend and profile contract tests.
set -euo pipefail

( cd "$LANE_DIR/backend" && dotnet test IPCManagement.slnx -c Release --no-restore )
( cd "$LANE_DIR/frontend" && NODE_OPTIONS="--max-old-space-size=1024" npm run test:unit -- --maxWorkers=2 )

echo "harness: ci-gate passed"
