# Wave 7.3 — historical E2E/tooling audit

Date: 2026-09-24
Verdict: `AUDIT_PASS / DELETE_AWAITS_EXPLICIT_APPROVAL`

## Scope and method

- Inventoried all 76 tracked files under `tools/e2e/`.
- Scanned package scripts, CI, current docs, source, planning and evidence-index references.
- Recorded SHA-256, size, textual consumers and mutation-like commands for every file.
- Treated zero filename references as a signal, not sufficient proof, because compiled tools and provider hooks can be convention-owned.
- Did not execute any historical script because many hard-code old lanes, dates, ports and mutation operations.

## Result

| Disposition | Count | Meaning |
|---|---:|---|
| `KEEP_ACTIVE` | 5 | Current DEFAULT campaign or current Golden Demo preflight owner |
| `KEEP_EVIDENCE` | 4 | Hash-indexed fixtures or Phase 28 evidence-recovery owners; defer to W7.5 |
| `KEEP_FIXTURE_BUILDER` | 2 | Source used to reproduce the two indexed Golden workbooks |
| `DELETE_CANDIDATE` | 65 | Phase 05 one-off executor/probe with no active consumer and no indexed path ownership |

The 65 delete candidates total 478,981 bytes. Disk saving is small; the value is removing 65 misleading active-tool entries.

## Keep active

- `tools/e2e/Test-Phase05GoldenDemoScope.ps1`
- `tools/e2e/default-campaign-wave0.mjs`
- `tools/e2e/default-campaign-weekly-menu-happy.mjs`
- `tools/e2e/default-campaign-weekly-menu-readback.mjs`
- `tools/e2e/default-campaign-weekly-menu-worst.mjs`

## Keep for evidence/fixture lineage

- `tools/e2e/fixtures/phase05/weekly-menu-golden-ANV.xlsx` — hash-indexed fixture or Phase 28 evidence recovery owner; defer to W7.5
- `tools/e2e/fixtures/phase05/weekly-menu-golden-DAV.xlsx` — hash-indexed fixture or Phase 28 evidence recovery owner; defer to W7.5
- `tools/e2e/run-phase28-baseline-recovery.mjs` — hash-indexed fixture or Phase 28 evidence recovery owner; defer to W7.5
- `tools/e2e/run-phase28-remediation.mjs` — hash-indexed fixture or Phase 28 evidence recovery owner; defer to W7.5
- `tools/e2e/Phase05WeeklyMenuFixtureTool/Phase05WeeklyMenuFixtureTool.csproj` — reproduces the two hash-indexed Phase 05 workbooks
- `tools/e2e/Phase05WeeklyMenuFixtureTool/Program.cs` — reproduces the two hash-indexed Phase 05 workbooks

## High-confidence delete candidates

Every path below has zero active filename consumer, no direct `docs/EVIDENCE-INDEX.md` entry, and belongs to the completed Phase 05 campaign. Evidence outputs remain separately indexed. Deletion still requires an explicit destructive-action approval because several scripts contain mutation/cleanup commands.

- `tools/e2e/Extract-Phase05CurrentWeekCommitReceipt.mjs`
- `tools/e2e/Probe-Phase05StickyMenuHeader.mjs`
- `tools/e2e/Read-Phase05CurrentWeekMenuImport.mjs`
- `tools/e2e/Run-Phase05CanonicalMenuImport.mjs`
- `tools/e2e/Run-Phase05CanonicalMenuReadback.mjs`
- `tools/e2e/Run-Phase05CanonicalMenuUiGate.mjs`
- `tools/e2e/Run-Phase05CurrentWeekMenuImport.mjs`
- `tools/e2e/Run-Phase05Exceptions.ps1`
- `tools/e2e/Run-Phase05GoldenPath.ps1`
- `tools/e2e/Run-Phase05Task0UiCorrections.mjs`
- `tools/e2e/Run-Phase05WeekStartNormalizationGate.mjs`
- `tools/e2e/Start-BaselineRuntime.ps1`
- `tools/e2e/Start-GoldenDemoRuntime.ps1`
- `tools/e2e/Test-Phase05HeadedControl.ps1`
- `tools/e2e/phase05-aggregate-golden-viewports.mjs`
- `tools/e2e/phase05-amendment-ui-probe.mjs`
- `tools/e2e/phase05-build-golden-manifest.mjs`
- `tools/e2e/phase05-build-quality-isolation-manifest.mjs`
- `tools/e2e/phase05-chef-checklist-visual-probe.mjs`
- `tools/e2e/phase05-cls-attribution.mjs`
- `tools/e2e/phase05-demand-tab-probe.mjs`
- `tools/e2e/phase05-exception-ambiguous-lineage-readback.mjs`
- `tools/e2e/phase05-exception-excess-disposition.mjs`
- `tools/e2e/phase05-exception-excess-negative.mjs`
- `tools/e2e/phase05-exception-kitchen-discrepancy.mjs`
- `tools/e2e/phase05-exception-retry-matrix-continuation.mjs`
- `tools/e2e/phase05-exception-retry-matrix.mjs`
- `tools/e2e/phase05-exception-return-receipt.mjs`
- `tools/e2e/phase05-exception-service-runs.mjs`
- `tools/e2e/phase05-exception-shared-shortage-blocked-allocation.mjs`
- `tools/e2e/phase05-exception-supplemental-partial.mjs`
- `tools/e2e/phase05-exception-waste.mjs`
- `tools/e2e/phase05-finalize-excess-disposition.mjs`
- `tools/e2e/phase05-finalize-return-receipt.mjs`
- `tools/e2e/phase05-finalize-supplemental-partial.mjs`
- `tools/e2e/phase05-finalize-supplemental-route.mjs`
- `tools/e2e/phase05-golden-approve-demands.mjs`
- `tools/e2e/phase05-golden-approve-purchase-requests.mjs`
- `tools/e2e/phase05-golden-create-issues.mjs`
- `tools/e2e/phase05-golden-create-purchase-orders.mjs`
- `tools/e2e/phase05-golden-create-purchase-requests.mjs`
- `tools/e2e/phase05-golden-create-receipts.mjs`
- `tools/e2e/phase05-golden-five-viewports.mjs`
- `tools/e2e/phase05-golden-kitchen-acknowledgement.mjs`
- `tools/e2e/phase05-golden-receipt-lifecycle.mjs`
- `tools/e2e/phase05-golden-service-runs.mjs`
- `tools/e2e/phase05-golden-stage1-diagnostic.mjs`
- `tools/e2e/phase05-golden-stage1.mjs`
- `tools/e2e/phase05-golden-supplier-decisions.mjs`
- `tools/e2e/phase05-manager-service-run-probe.mjs`
- `tools/e2e/phase05-menu-amendment-correction.mjs`
- `tools/e2e/phase05-menu-amendment-create.mjs`
- `tools/e2e/phase05-menu-amendment-readback.mjs`
- `tools/e2e/phase05-purchasing-tab-split.mjs`
- `tools/e2e/phase05-quality-isolation-approve.mjs`
- `tools/e2e/phase05-quality-isolation-order.mjs`
- `tools/e2e/phase05-quality-isolation-partial.mjs`
- `tools/e2e/phase05-quality-isolation-read-probe.mjs`
- `tools/e2e/phase05-quality-isolation-readback.mjs`
- `tools/e2e/phase05-quality-isolation-receipt.mjs`
- `tools/e2e/phase05-quality-isolation-supplier.mjs`
- `tools/e2e/phase05-readback-kitchen-discrepancy.mjs`
- `tools/e2e/phase05-readback-supplemental-partial.mjs`
- `tools/e2e/phase05-supplemental-clean-dav.mjs`
- `tools/e2e/phase05-weekly-menu-fulfillment-readback.mjs`

## Other script families

- `frontend/scripts/`: 7/7 have active package/config consumers; keep.
- `backend/tools/`: compiled source is convention-owned by SDK project globbing; filename-reference counts are not deletion evidence. Keep.
- `shipyard/`: hooks/profile files are provider-manifest/convention inputs. Keep until a separate Shipyard retirement decision.
- root `scripts/`: 13 files have zero current filename reference, but several are PowerShell entry points or standardization harnesses. They need a separate source/command-contract audit; no delete verdict in this wave.

## Evidence files

- `wave-7-e2e-reference-inventory.json` — raw textual reference inventory.
- `wave-7-e2e-characteristics.csv` — hard-coded dates/ports/lanes/artifact roots and mutation terms.
- `wave-7-e2e-disposition.csv` — per-file disposition, SHA-256 and reason.
- `wave-7-other-script-reference-inventory.json` — broader scripts/frontend/backend-tools/shipyard reference scan.

## Next action

With owner approval, delete exactly the 65 `DELETE_CANDIDATE` paths from the CSV in one bounded batch, then run reference scan, docs links, relevant source contracts, frontend build and `git diff --check`. Do not delete fixtures, fixture builder, DEFAULT campaign, Golden Demo preflight or Phase 28 recovery runners.
