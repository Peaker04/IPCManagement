#!/usr/bin/env bash
# health — wait for both lane services.
# /health/ready chạm MySQL thật, nên MySQL chết là hook này đỏ (trước đây "/" luôn xanh).
set -euo pipefail

for _ in $(seq 1 45); do
  if curl.exe -fsS "$API_BASE/health/ready" >/dev/null 2>&1 && curl.exe -fsS "$FE_URL/" >/dev/null 2>&1; then
    echo "harness: API (readiness incl. database) and frontend healthy"
    exit 0
  fi
  sleep 1
done

# Phân biệt "API chưa lên" với "API lên nhưng DB chết" để khỏi phải đoán khi hook đỏ.
if curl.exe -fsS "$API_BASE/health/live" >/dev/null 2>&1; then
  die "API alive but not ready — kiểm tra MySQL (api=$API_BASE/health/ready frontend=$FE_URL)"
fi

die "health check timed out (api=$API_BASE/health/ready frontend=$FE_URL)"
