#!/usr/bin/env bash
# e2e — run e2e against the running stack, under the e2e lock
# Usage: with-lock.sh e2e -- <cmd>
set -euo pipefail

E2E_SCRIPT="$LANE_DIR/scripts/Invoke-Iter1HappyPathE2E.ps1"
if [ ! -f "$E2E_SCRIPT" ] && [ -n "${SOURCE_REPO:-}" ]; then
  E2E_SCRIPT="$SOURCE_REPO/scripts/Invoke-Iter1HappyPathE2E.ps1"
fi

if [ -f "$E2E_SCRIPT" ]; then
  echo "harness: running E2E tests..."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$E2E_SCRIPT" \
    -BaseUrl "${API_BASE}" \
    -OutputRoot "$LANE_DIR/.artifacts/e2e" \
    -SkipSeedReset
else
  die "E2E script not found in lane or source repo"
fi

if [ "$#" -gt 0 ]; then
  PLAYWRIGHT_ARGS=("$@")
  if [[ "${PLAYWRIGHT_ARGS[0]}" != tests/* ]]; then
    PLAYWRIGHT_ARGS[0]="tests/${PLAYWRIGHT_ARGS[0]}"
  fi

  echo "harness: running scoped Playwright tests against $FE_URL..."
  (
    cd "$LANE_DIR/frontend"
    PHASE09_REAL_STACK=1 \
      PHASE09_FE_URL="$FE_URL" \
      PHASE09_API_BASE="$API_BASE" \
      npm exec -- playwright test "${PLAYWRIGHT_ARGS[@]}"
  )
fi

BRANCH_NAME="$(git -C "$LANE_DIR" branch --show-current)"
FEATURE_SLUG="$(printf '%s' "${BRANCH_NAME:-ipc-e2e}" | sed -E 's#[^A-Za-z0-9._-]+#-#g; s#^-+##; s#-+$##')"
[ -n "$FEATURE_SLUG" ] || FEATURE_SLUG="ipc-e2e"

export IPC_E2E_ARTIFACT_ROOT="$LANE_DIR/.artifacts/e2e"
export IPC_E2E_REPORT_DIR="$LANE_DIR/.playwright-mcp/proof/$FEATURE_SLUG/ticket"
powershell.exe -NoProfile -Command '
  $summary = Get-ChildItem -LiteralPath $env:IPC_E2E_ARTIFACT_ROOT -Filter "happy-path-e2e-summary.md" -Recurse |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if ($null -eq $summary) { throw "E2E summary artifact was not created." }

  New-Item -ItemType Directory -Force -Path $env:IPC_E2E_REPORT_DIR | Out-Null
  $body = [System.Net.WebUtility]::HtmlEncode((Get-Content -LiteralPath $summary.FullName -Raw))
  $html = "<!doctype html><html lang=`"vi`"><head><meta charset=`"utf-8`"><title>IPCManagement E2E</title><style>body{font:15px/1.55 ui-monospace,Consolas,monospace;max-width:1100px;margin:32px auto;padding:0 24px;color:#e5e7eb;background:#111827}pre{white-space:pre-wrap;background:#1f2937;padding:24px;border-radius:12px}</style></head><body><pre>$body</pre></body></html>"
  Set-Content -LiteralPath (Join-Path $env:IPC_E2E_REPORT_DIR "REPORT.html") -Value $html -Encoding utf8
'
unset IPC_E2E_ARTIFACT_ROOT IPC_E2E_REPORT_DIR

echo "harness: e2e complete"
