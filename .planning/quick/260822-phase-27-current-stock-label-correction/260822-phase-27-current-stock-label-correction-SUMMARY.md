---
quick_id: phase-27-current-stock-label-correction
status: complete
completed: 2026-08-22
subsystem: ui-evidence
tags: [warehouse, fixture, dto, playwright]
key-files:
  modified:
    - frontend/tests/warehouseDataWorkspaceFixture.ts
    - frontend/tests/warehouseDataWorkspaceContract.test.ts
    - frontend/tests/ui-audit.spec.ts
    - frontend/test-results/warehouse-data-workspace/after/manifest.json
    - frontend/test-results/warehouse-data-workspace/after/selection-manifest.json
commits:
  - ab9578fc
---

# Quick Summary: Phase 27 Current-Stock Fixture Label Correction

Corrected the test-owned current-stock fixture to use the production `CurrentStockSummaryDto` label fields while preserving stable warehouse, ingredient, row and unit IDs internally.

## Changes

- Renamed only the fixture presentation-shaped keys to `warehouseName`, `ingredientName` and `unitName`, and added stable `unitId`.
- Added a mapper-level regression through production `mapCurrentStock` proving human-readable non-ID labels, finite quantity and retained timestamp.
- Added a selected-record ARIA assertion proving ready evidence renders `Kho chính`, `Gạo tẻ` and `kg`, without rendering `warehouse-phase27-main` or `ingredient-phase27-*` as primary current-stock labels.
- Regenerated the complete focused 15-capture `after` matrix with fresh run identity `phase27-after-20260822T204000Z`; baseline evidence, thresholds and production code were not changed.

## Verification

- Focused Vitest: 1 file / 12 tests passed.
- Headed focused Playwright: 1 test passed; fresh 15-capture manifest and six-record selection generated.
- Scoped ESLint: passed for the three touched TypeScript test files.
- `git diff --check`: passed.
- Scoped secret scan: passed.
- Selected ready-record machine check: passed.

## Scope

No production, route, API, authorization, configuration, baseline, threshold, Admin Data or Purchasing file changed.

## Residual Risk

`phase27-baseline-forbidden-duplicate-h1` remains unresolved and continues to block full Phase 27 closeout. This quick correction did not alter or claim resolution of that separate finding.

## Deviations from Plan

None in implementation scope. The first Playwright invocation used incorrect `npm exec` argument separation and unintentionally ran the broader file; its generated baseline/deleted auxiliary artifacts were restored before the authoritative focused rerun and commit.

## Self-Check: PASSED

Commit `ab9578fc` exists, fresh selected ready evidence contains human-readable current-stock labels, and no staged files remain after closeout.
