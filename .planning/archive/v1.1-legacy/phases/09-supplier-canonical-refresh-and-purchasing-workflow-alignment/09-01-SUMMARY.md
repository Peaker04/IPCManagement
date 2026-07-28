---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 01
subsystem: phase-09-wave-0-safety
tags: [mysql, xlsx, gitnexus, xunit, playwright, tdd]
requires:
  - phase: 08-operational-page-feature-decomposition
    provides: decomposed operational routes and characterization baseline
provides:
  - reproducible 3,207-key workbook audit
  - exact disposable clone and restore fingerprint proof
  - backend and browser test seams for later Phase 09 plans
affects: [09-02, 09-03, 09-05, 09-07, 09-08, 09-10, 09-11, 09-14]
tech-stack:
  added: []
  patterns: [full-row SHA-256 fingerprint, plan-owned skipped RED seams, role-matrix fixtures]
key-files:
  created:
    - .planning/phases/09-supplier-canonical-refresh-and-purchasing-workflow-alignment/09-WAVE0-EVIDENCE.md
    - backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs
    - backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs
    - backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs
    - backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs
    - frontend/tests/phase9-purchasing-workflow.spec.ts
    - frontend/tests/phase9-snapshot-manifest.json
  modified:
    - backend/tools/IPCManagement.DatabaseTool/Program.cs
    - frontend/tests/route-smoke.spec.ts
    - frontend/tests/ui-audit.spec.ts
    - frontend/tests/visual-routes.spec.ts
key-decisions:
  - "Replace unsupported 3,209 with the reproduced 3,207 unique normalized delivery-date-plus-ingredient delta."
  - "Clone every column with an empty generation_expression; exclude only true computed expressions."
  - "Keep future behavior as explicit skipped RED seams whose owning Phase 09 plan is named."
patterns-established:
  - "Disposable fingerprints cover table inventory, schema, PK order, row counts, and sorted hex-serialized full rows."
  - "Wave 0 browser verification discovers suites and validates the snapshot registry without requiring PNG files."
requirements-completed: [SUP-01, SUP-02, SUP-03, SUP-04, PUR-01, PUR-02, PUR-03, PUR-04, PUR-05, WHR-01, PUI-01]
duration: 3h 24m
completed: 2026-07-22
---

# Phase 9 Plan 1: Wave 0 Safety and Test Seams Summary

**Reproducible XLSX provenance plus exact MySQL clone/restore fingerprints and discoverable backend/browser RED seams for the full purchasing workflow.**

## Performance

- **Duration:** 3h 24m, including two user decision checkpoints
- **Started:** 2026-07-22T01:56:51Z
- **Completed:** 2026-07-22T05:20:29Z
- **Tasks:** 2
- **Files changed or created:** 16

## Accomplishments

- Corrected the unsupported workbook invariant to an auditable `3,207` unique case-insensitive `delivery date + ingredient` delta and recorded the exact ZIP/XML algorithm, source hashes, sheet counts, and row boundaries.
- Fixed DatabaseTool cloning so MySQL `DEFAULT_GENERATED` temporal values are preserved. A 56-table, 54,039-row full fingerprint matched before mutation and after restore at `7813E4A8814A9DA4AAD8FA52D5EC3ED9868242950AD5DEB4BF45716FEBA25E41`.
- Added four backend suites with disposable-database and role-matrix checks plus nine explicitly owned future RED scenarios.
- Added the focused six-stage Phase 09 Playwright suite, discovery seams in route/UI/visual suites, and an exact eight-path snapshot manifest.

## Task Commits

1. **Task 1: Prove repository, workbook, and disposable restore baselines** — `e753fbe` (`fix`)
2. **Task 2 RED: Add failing reconciliation contract** — `77eca6a` (`test`)
3. **Task 2 GREEN: Establish Phase 09 workflow seams** — `82bb2d9` (`test`)

## Files Created/Modified

- `.planning/phases/09-supplier-canonical-refresh-and-purchasing-workflow-alignment/09-WAVE0-EVIDENCE.md` — source, GitNexus, workbook, protected-file, clone, mutation, and restore evidence.
- `backend/tools/IPCManagement.DatabaseTool/Program.cs` — copies default-generated temporal fields while excluding computed expressions.
- `backend/tests/IPCManagement.Api.Tests/*Phase 09*.cs` — reconciliation, approval, supplier-decision, and Warehouse receiving seams.
- `frontend/tests/phase9-purchasing-workflow.spec.ts` — six named workflow stages and four preserved routes.
- `frontend/tests/phase9-snapshot-manifest.json` — exact four Purchasing and four Warehouse snapshot paths.
- `frontend/tests/route-smoke.spec.ts`, `ui-audit.spec.ts`, `visual-routes.spec.ts` — discoverable Plan 09-14 seams.

## Decisions Made

- Corrected `3,209` to `3,207` because no generating command existed for the former and the approved case-insensitive normalized projection reproduced `14,532` legacy versus `17,739` current keys.
- Used `generation_expression = ''` as the writable-column rule. This retains audit/business timestamps and excludes only `inventoryreceiptlines.amount`, whose computed value remains covered by the final full-row fingerprint.
- Kept later behavior red but skipped with explicit owner plans so Wave 0 stays green without silently weakening future expectations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved MySQL default-generated temporal data during clone**
- **Found during:** Task 1
- **Issue:** `extra NOT LIKE '%GENERATED%'` reset 21 temporal columns across 16 tables, preventing exact restoration.
- **Fix:** Filtered only non-empty `generation_expression` columns and proved complete source/clone equality.
- **Files modified:** `backend/tools/IPCManagement.DatabaseTool/Program.cs`
- **Commit:** `e753fbe`

**2. [Rule 3 - Blocking] Replaced physical CHECKSUM with deterministic logical fingerprint**
- **Found during:** Task 1
- **Issue:** MySQL table checksums differed after clone despite equal row counts and are storage-layout dependent.
- **Fix:** Hashed ordered schema, PKs, counts, and sorted null-marked hex rows.
- **Files modified:** `09-WAVE0-EVIDENCE.md`
- **Commit:** Evidence remains on disk under the repository's ignored `.planning` policy.

**3. [Rule 3 - Blocking] Added missing test namespace imports**
- **Found during:** Task 2 GREEN
- **Issue:** The new reconciliation suite initially lacked the `Regex`/assertion namespaces.
- **Fix:** Simplified the fixture to exercise `DatabaseClonePolicy` directly and added only the required imports.
- **Files modified:** `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`
- **Commit:** `82bb2d9`

### User-approved Plan Correction

- Replaced every Phase 09 `3,209` reference with the approved `3,207` invariant before implementation continued. The reason and algorithm are recorded in CONTEXT and Wave 0 evidence.

## Verification

- GitNexus index current at `82bb2d9`; staged/task scope and `main` comparison both reported LOW risk and zero affected execution processes.
- Focused backend characterization: **139 passed, 9 skipped, 0 failed** (148 total).
- Playwright discovery: Phase 09 workflow 7, route smoke 18, UI audit 7, visual routes 22.
- Snapshot manifest: exactly 8 ordered paths.
- DatabaseTool focused policy tests: 7 passed.
- Package manifests/project references unchanged.
- Protected SQL remained untracked with SHA-256 `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.

## Known Stubs

All stubs are intentional RED seams and do not block this Wave 0 goal:

- `PurchaseHistoryReconciliationTests.cs:41,47,53` — parser/ambiguity behavior owned by Plan 09-02; immutable apply/replay owned by Plan 09-05.
- `MaterialDemandAndPriceExceptionApprovalTests.cs:21,27` — demand approval owned by Plan 09-07; exception approval owned by Plan 09-10.
- `SupplierDecisionWorkflowTests.cs:17,23` — supplier evidence owned by Plan 09-08; price routing owned by Plan 09-10.
- `WarehousePurchaseReceivingTests.cs:17,23` — Warehouse transaction and authorization owned by Plan 09-11.
- `phase9-purchasing-workflow.spec.ts:6-30` — six-stage flow and preserved routes owned by Plan 09-14.
- `route-smoke.spec.ts:1460`, `ui-audit.spec.ts:381`, `visual-routes.spec.ts:267` — executable route, accessibility, overflow, and PNG assertions owned by Plan 09-14.

## Next Phase Readiness

- Plan 09-02 can consume the exact workbook identity/key contract and remove its parser RED markers.
- Later database-mutating plans can cite the exact disposable backup/restore proof and fingerprint definition.
- Plans 09-07 through 09-14 have named role, orchestration, route, accessibility, and visual seams ready to turn green.

## Self-Check: PASSED

- All nine representative created/modified files exist on disk.
- Task commits `e753fbe`, `77eca6a`, and `82bb2d9` exist in Git history.
