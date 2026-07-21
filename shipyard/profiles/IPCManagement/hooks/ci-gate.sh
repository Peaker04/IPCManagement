#!/usr/bin/env bash
# ci-gate — backend, frontend and profile contract tests.
set -euo pipefail

( cd "$LANE_DIR/backend" && dotnet test IPCManagement.slnx -c Release --no-restore )
( cd "$LANE_DIR/frontend" && npm run test:unit )

echo "harness: ci-gate passed"
