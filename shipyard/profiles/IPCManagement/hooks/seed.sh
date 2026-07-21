#!/usr/bin/env bash
# seed — the verified template already contains deterministic local users/data.
set -euo pipefail

echo "harness: seed skipped; $DB_NAME is restored from ipc_e2e_template"
