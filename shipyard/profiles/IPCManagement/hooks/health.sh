#!/usr/bin/env bash
# health — wait for both lane services.
set -euo pipefail

for _ in $(seq 1 45); do
  if curl.exe -fsS "$API_BASE/" >/dev/null 2>&1 && curl.exe -fsS "$FE_URL/" >/dev/null 2>&1; then
    echo "harness: API and frontend healthy"
    exit 0
  fi
  sleep 1
done

die "health check timed out (api=$API_BASE frontend=$FE_URL)"
