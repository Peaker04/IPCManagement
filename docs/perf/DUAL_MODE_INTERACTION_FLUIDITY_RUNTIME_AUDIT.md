---
title: Whole-project dual-mode interaction fluidity runtime audit
status: completed-evidence-ledger
owner: GSD
scope: DEFAULT-and-MATERIAL_RECONCILIATION-capability-routes
execution_plan: ../../.planning/notes/DUAL-MODE-INTERACTION-FLUIDITY-PLAN.md
---

# Dual-mode interaction fluidity runtime audit

## Claim boundary

Admin read-only runtime coverage on exact `ipc_lane7`, every navigation route and retained tab declared by authenticated capability responses in `DEFAULT` and `MATERIAL_RECONCILIATION`. Route-level desktop composition used `1366×768`, `1440×900`, `1920×1080`; detailed natural interactions used `1440×900`.

This is not all-role, mutation-lifecycle, field-CWV, mobile/tablet or production-p75 acceptance.

## Required reconciliation

| Mode | Route/view cells | Viewport cells | Excluded-route guards | Continuous cells | Required | PASS | FAIL/OPEN | NEEDS_EVIDENCE | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| DEFAULT | 37 | 33 | 1 | 8 | 79 | 79 | 0 | 0 | `PASS_BOUNDED_MODE` |
| MATERIAL_RECONCILIATION | 9 | 18 | 6 | 4 | 37 | 37 | 0 | 0 | `PASS_BOUNDED_MODE` |
| **Total** | **46** | **51** | **7** | **12** | **116** | **116** | **0** | **0** | `PASS_BOUNDED_DUAL_MODE` |

The matrix was generated from each authenticated capability response, not a hand-maintained subset. DEFAULT additionally proved `/reconciliation` unavailable. MRX proved Meal Orders, Approvals, Purchasing, Chef, Reports and Approval Rules unavailable and did not issue requests to their excluded API families.

## Natural interaction coverage

At primary viewport the runner exercised every naturally available inactive tab, search, combobox/filter, enabled pagination control and dialog trigger in an isolated browser context. It also ran 12 sequence cells (68 total actions): six true same-document alternating tab transitions on Approvals, Purchasing, Warehouse, Chef, Reports and Admin; Weekly Menu repeated route-state navigation where each `view` change remounts the document; plus one route/back/forward sequence per mode. Same-document repeated-tab cells had CLS `0`; navigation sequences report per-step elapsed URL evidence rather than falsely aggregating document metrics across navigations. Missing controls were `NOT_APPLICABLE`, not fabricated.

| Mode | Natural interactions PASS | NOT_APPLICABLE | Max interaction CLS | Max Event Timing | Max processing | Max interaction frame | Interaction LoAF |
|---|---:|---:|---:|---:|---:|---:|---:|
| DEFAULT | 107 | 78 | 0.01949 | 40ms | 21.2ms | 61.1ms | 1 |
| MATERIAL_RECONCILIATION | 23 | 22 | 0.04503 | 40ms | 26.3ms | 33.4ms | 0 |

The one repeated DEFAULT Admin BOM LoAF was re-run three times. Its 55.5–61.2ms frame intervals had zero blocking duration and zero script attribution; CDP found longest FunctionCall 12.205ms and Layout 5.713ms. It is `MEASURED_NOT_ACTIONABLE`, not a React/architecture optimization owner.

## Findings and fixes

| ID | Severity | Mode/cell | Before | Root owner | Change | After | Verdict |
|---|---|---|---|---|---|---|---|
| DM-001 | P1 | DEFAULT `/reports?view=audit` initial load | DEV CLS `0.3826/0.3826/0.1592`; preview CLS `0.3818/0.1592/0.3826` | `ServiceRunReportPanel` first page expanded above the already-visible audit table | Audit table is primary and renders first; ServiceRun initial loading feedback is `sr-only` until the first page is ready | Final full matrix max DEFAULT load CLS `0.04319`; Reports Audit cell under `0.1` | `PERSISTS_IN_PRODUCTION → PASS_FOCUSED` |
| DM-002 | P2 | DEFAULT Admin BOM filter + Contracts tab | 3 repeats with 55.5–61.2ms frame intervals | Browser/frame scheduling; no >16ms application task | No production optimization | Event processing <8ms; CDP FunctionCall 12.205ms, Layout 5.713ms | `MEASURED_NOT_ACTIONABLE` |

DM-001 regression paths:

- `frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx` locks audit-before-ServiceRun document order.
- `frontend/src/features/reports/pages/ServiceRunReportPanel.loading.test.tsx` locks geometry-free accessible initial loading feedback.
- Project rule `F30` in `docs/DASHBOARD-UI-RULES.md` prevents stacked async secondary sections from shifting a stable primary section.

## Route/load envelope

- DEFAULT maximum load CLS: `0.04319`; maximum DOM count: 1,272.
- MRX maximum load CLS: `0.03473`; maximum DOM count: 564.
- All 51 route/viewport cells had document overflow ≤1px, CLS ≤0.1 and zero page errors.
- All 46 route/view cells matched their requested route and selected retained tab.
- Operation mode was asserted before every cell.

## Mode restoration

- Authoritative run original: `DEFAULT / version 51`.
- Temporary MRX transition: public authenticated `PUT /api/system-operation-mode`, confirmed with expected version and audit reason.
- Final restored: `DEFAULT / version 53`, with DEFAULT capability response re-read.
- Mode switching created only the authorized system-operation audit/version transitions; no business workflow mutation, seed, schema or data rewrite occurred.

## Evidence

- Canonical summary: `.artifacts/perf/dual-mode-fluidity-20260916/summary.json`
- Full denominator: `.artifacts/perf/dual-mode-fluidity-20260916/report-final-authoritative2.json` (SHA-256 embedded in canonical summary).
- DM-001 DEV before: `.artifacts/perf/dual-mode-fluidity-20260916/reports-audit-dev-before.json`
- DM-001 preview before: `.artifacts/perf/dual-mode-fluidity-20260916/reports-audit-preview.json`
- DM-001 preview after: final matrix plus focused after artifacts.
- DM-002 repeats/pipeline: `.artifacts/perf/dual-mode-fluidity-20260916/admin-bom-interaction.json`, `admin-bom-pipeline.json`

## Residual authority boundaries

- Other business roles were not used; this is Admin full-access coverage, not all-role acceptance.
- Business mutation flows were intentionally not executed.
- Field CWV/RUM, production p75, deployment observability, mobile/tablet and supported-browser version-band acceptance remain separate authority/capability work.
