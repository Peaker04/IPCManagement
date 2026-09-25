# Quick 260802-qdk — Audit and remediate every Shipyard page/tab

## Normalized request

Audit the current synchronized frontend/backend on Shipyard with the existing rich `ipc_lane1` data, inspect visual and runtime evidence for every canonical page/tab, fix only evidence-confirmed UI/UX defects, and rerun the affected state plus the complete browser matrix after each remediation set.

## Hard boundaries

- Work inline in the main chat; do not open a roadmap phase or long GSD wave.
- Do not reset, seed, import, restore, or otherwise mutate `ipc_lane1`.
- Do not change business behavior, policy, API, cache, lifecycle, or route access.
- Do not push.
- Preserve unrelated user changes.
- Browser evidence uses headed Google Chrome at 1920x1080, 1440x900, 1366x768, 1365x900, and 1280x900.

## Evidence gates

1. Establish FE/BE/runtime synchronization and read-only database lineage before remediation.
2. Cover all 50 canonical states across all five viewports (250 cells).
3. For every state, inspect screenshot and telemetry for layout shift/jank, tab latency, loading/badge delay, table overflow, missing controls, errors, and long tasks.
4. Record each candidate as confirmed, intentional, or not reproducible; never infer a defect from a screenshot count alone.
5. For every production edit, complete branch-aware two-way GitNexus impact and preserve all contracts/actions.
6. Run focused tests and rerun affected headed-browser states after each remediation set.
7. Run full frontend tests, lint, dependency checks, build, then repeat the complete 250-cell audit.
8. Close only when before/after evidence proves the defect is gone without new console/page/request errors, CLS, long tasks, duplicate GETs, escaped mutations, or missing controls.

## Current evidence-backed ledger

| Surface | Finding | Baseline evidence | Status / acceptance |
|---|---|---|---|
| Reports / Audit | Seven-column audit table is 1532px inside a 966px owner at 1280px; new value is pushed 566px off-screen and raw values are unbounded. | `after-probe/screenshots/1280x900--reports--reports-audit.png`, probe JSON | Confirmed. Keep all seven fields, make old/new/reason readable, minimize local horizontal overflow. |
| Warehouse / Demand | `DemandSummary` and `RoleInbox` render two consecutive identical empty messages. | `after-probe/screenshots/1440x900--warehouse--warehouse-demand.png` | Confirmed. Preserve both data concepts but render one contextual empty state when both collections are empty. |
| Admin Data / BOM current | Eight-column fixed table is 1038px inside a 629px owner at 1280px; later columns/actions require large local scroll. | `after-probe/screenshots/1280x900--admin-data--bom-current.png`, probe JSON | Candidate. Compress only if edit/stop controls and all values remain accessible and readable. |
| Weekly Menu / Demand | Probe reports a 219px panel gap while the source reserves a 560px spreadsheet workspace. | probe JSON and contact sheet | Needs classification; do not shrink without proving unintended blank space. |
| Chef / Production | Empty table plus operational guidance creates a large vertical region. | `after-probe/screenshots/1280x900--chef-dashboard--chef-production.png` | Needs classification; guidance appears semantically distinct, so no edit without stronger evidence. |

## Done definition

The quick task is done only when the final full audit covers 250/250 cells, all confirmed defects have explicit before/after evidence, performance/error/control-completeness gates remain green, GSD state/evidence docs are synchronized, GitNexus final detect is reconciled, and planning artifacts are committed without push.
