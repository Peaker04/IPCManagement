---
phase: 27-warehouse-data-workspace-contract-pilot
plan: 01
subsystem: frontend-test-evidence
tags: [warehouse, playwright, ui-contract, evidence]
requires: [phase-26-source-ownership]
provides: [warehouse-local-contract, warehouse-ready-fixture, atomic-browser-capture]
affects: [27-02, 27-03, 27-04]
tech-stack:
  added: []
  patterns: [literal Warehouse-local contract, atomic schema-validated evidence record]
key-files:
  created:
    - frontend/tests/warehouseDataWorkspaceContract.ts
    - frontend/tests/warehouseDataWorkspaceFixture.ts
    - frontend/tests/warehouseEvidenceCollector.ts
    - frontend/tests/warehouseDataWorkspaceContract.test.ts
  modified:
    - frontend/tests/ui-audit.spec.ts
key-decisions:
  - "Keep schema-v1 UI audit reports unchanged and give Warehouse captures independent schemaVersion 2."
  - "Use the existing audit route/login/runtime-signal seam and the installed Playwright AI ARIA snapshot API."
metrics:
  duration: 8m
  completed: 2026-08-22
status: complete
actuals:
  tokens: 10400
  tasks: 2
  commits: 2
---

# Phase 27 Plan 01: Warehouse Contract Tracer Summary

A Warehouse-local Data Workspace contract with a frozen domain fixture and atomic Playwright ready/1920×1080 evidence record using AI-mode ARIA boxes.

## Accomplishments

- Declared the bounded three-region Warehouse contract, three-tab shell invariants, owner order, five desktop viewports, spacing tolerance, verdicts, and AI finding boundary.
- Added stable eight-row current-stock and movement fixtures plus two Warehouse documents and a mixed-empty invariant.
- Extended the existing UI audit runner with one read-only Warehouse tracer; the generated record validates composite identity, screenshot, ARIA, geometry, styles, focus/DOM data, ownership, fixture IDs, and runtime signals.
- Preserved historical schema-v1 reports, production source, package/config files, and all non-Warehouse scope.

## Task Commits

1. `2286ab6a` — capture Warehouse contract tracer evidence
2. `332a4c29` — freeze bounded Warehouse invariants

## Verification

- `npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts --maxWorkers=1` — 1 file, 5 tests passed.
- `npm exec -w frontend -- playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract tracer" --workers=1` — 1 passed.
- Evidence readback: identity `warehouse-data-workspace/v1/warehouse-ready/v1/warehouse-keeper/ready/1920x1080`; three regions; 18 fixture IDs; AI mode with boxes; zero console errors, page errors, and non-GET requests.
- `git diff --check HEAD~2..HEAD` — passed; scoped path inspection found no production, package, or Playwright-config change; scoped credential scan found no match.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected fixture workflow-document DTO shape**
- **Found during:** Task 1 browser verification
- **Issue:** The first fixture used rendered document fields rather than the API DTO expected by `workflowDocumentsApi`.
- **Fix:** Supplied synthetic `documentId`, `documentCode`, `documentType`, `documentDate`, `ownerLane`, and summary fields.
- **Files modified:** `frontend/tests/warehouseDataWorkspaceFixture.ts`
- **Commit:** `2286ab6a`

**2. [Rule 1 - Bug] Adapted runtime signal name at the collector seam**
- **Found during:** Task 1 browser verification
- **Issue:** Existing audit signals expose `nonReadRequests`; the new record intentionally calls the serialized field `nonGetRequests`.
- **Fix:** Mapped the existing signal to the schema-v2 field without changing schema-v1.
- **Files modified:** `frontend/tests/warehouseEvidenceCollector.ts`
- **Commit:** `2286ab6a`

## Known Stubs

None.

## Residual Risks

- This plan proves only the required ready/1920×1080 tracer. The 15-capture baseline and deterministic responsive evaluation belong to Plan 27-02.
- Current production `SplitWorkbench` is expected to remain stacked at wide width; this plan intentionally records facts and does not fabricate a responsive PASS or edit production.
- The literal plan command using `npm exec -w frontend playwright ...` is parsed incorrectly by npm 11 and ran the broader file; the equivalent npm-11-safe command inserts `--` before `playwright` and passed the focused tracer.

## Self-Check: PASSED

All five declared source/test files exist, both task commits exist, and the focused evidence record was read back successfully.
