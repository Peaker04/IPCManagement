---
quick_id: phase-27-current-stock-label-correction
status: planned
date: 2026-08-22
type: execute
autonomous: true
files_modified:
  - frontend/tests/warehouseDataWorkspaceFixture.ts
  - frontend/tests/warehouseDataWorkspaceContract.test.ts
  - frontend/tests/ui-audit.spec.ts
  - frontend/test-results/warehouse-data-workspace/after/captures/ready/*/record.json
  - frontend/test-results/warehouse-data-workspace/after/captures/ready/*/*.png
  - frontend/test-results/warehouse-data-workspace/after/manifest.json
  - frontend/test-results/warehouse-data-workspace/after/deterministic-findings.json
  - frontend/test-results/warehouse-data-workspace/after/selection-manifest.json
  - .planning/quick/<generated-quick-id>/*-PLAN.md
  - .planning/quick/<generated-quick-id>/*-SUMMARY.md
  - .planning/STATE.md
requirements: [UIC-02, UIC-03, WHP-02, WHP-04]
must_haves:
  truths:
    - Current-stock fixture rows conform to the production CurrentStockSummaryDto field names and retain IDs, quantity, and timestamp.
    - Mapping fixture rows through production mapCurrentStock yields meaningful warehouse, ingredient, and unit labels rather than technical-ID fallbacks.
    - Fresh selected ready-state evidence proves the primary current-stock dataset renders meaningful labels.
    - No production, route, authorization, Admin Data, Purchasing, API, configuration, baseline, or threshold file changes.
  artifacts:
    - frontend/tests/warehouseDataWorkspaceFixture.ts
    - frontend/tests/warehouseDataWorkspaceContract.test.ts
    - frontend/tests/ui-audit.spec.ts
    - frontend/test-results/warehouse-data-workspace/after/selection-manifest.json
  key_links:
    - frontend/tests/warehouseDataWorkspaceFixture.ts currentStockRows -> frontend/src/api/reportsApiMappers.ts mapCurrentStock DTO input
    - frontend/tests/ui-audit.spec.ts current-stock/page stub -> fresh ready capture record ariaSnapshot
---

# Phase 27 current-stock evidence fixture DTO label correction

## Objective

Correct only the Phase 27 Warehouse current-stock evidence fixture contract so the existing production mapper receives `warehouseName`, `ingredientName`, and `unitName` and fresh selected evidence displays meaningful primary current-stock labels.

**Done means:** a mapper-level regression test locks the DTO names, a newly generated selected ready record proves human-readable labels, and the final diff stays inside the explicit fixture/test/evidence/quick-artifact allowlist.

## Findings driving this quick plan

- **High — `frontend/tests/warehouseDataWorkspaceFixture.ts`:** `currentStockRows` currently supplies rendered-model keys `warehouse`, `ingredient`, and `unit`, while `frontend/src/api/reportsApiMappers.ts:101` reads DTO keys `warehouseName`, `ingredientName`, and `unitName`. The mapper therefore falls back to `warehouseId`/`ingredientId` and an empty unit.
- **High — `frontend/tests/warehouseDataWorkspaceContract.test.ts:44`:** the existing fixture contract assertion maps only movement rows, so it did not detect the current-stock DTO mismatch.
- **High — `frontend/test-results/warehouse-data-workspace/after/ai-rereview.json:19`:** fresh review marks `phase27-baseline-operational-data-presented-as-technical-placeholders` as `STILL_FAILING`; selected records expose `warehouse-phase27-main` and `ingredient-phase27-*` as primary labels.

## Scope guard

Allowed behavior-bearing edits are limited to:

1. `frontend/tests/warehouseDataWorkspaceFixture.ts`
2. `frontend/tests/warehouseDataWorkspaceContract.test.ts`
3. focused assertions in `frontend/tests/ui-audit.spec.ts`
4. freshly regenerated Warehouse `after` evidence needed by those focused assertions
5. this quick task's PLAN/SUMMARY and `.planning/STATE.md` closeout bookkeeping

Do **not** modify production files, `mapCurrentStock`, forbidden-route/H1 behavior, RoleGuard, Admin Data, Purchasing, APIs, routes, package/config files, baseline evidence, snapshots, thresholds, or unrelated Phase 27 findings. Do not run GitNexus.

## Tasks

<task type="tracer" tdd="true">
  <name>Task 1: Lock and correct the current-stock DTO fixture contract</name>
  <files>frontend/tests/warehouseDataWorkspaceFixture.ts, frontend/tests/warehouseDataWorkspaceContract.test.ts</files>
  <behavior>
    - Every current-stock fixture row has `warehouseId`, `warehouseName`, `ingredientId`, `ingredientName`, `unitId`, `unitName`, `currentQty`, and `lastUpdated`.
    - Mapping all fixture rows with the existing production `mapCurrentStock` yields non-empty human-readable warehouse, ingredient, and unit values.
    - Mapped warehouse and ingredient labels differ from their corresponding technical IDs; quantity is finite and timestamp remains present.
  </behavior>
  <action>First extend the existing representative-fixture contract test to import and run `mapCurrentStock` from the same mapper seam used by the reports API. Make it fail against the current shape. Then rename only the three presentation-shaped current-stock keys to DTO keys `warehouseName`, `ingredientName`, and `unitName`, add the required stable `unitId`, and update internal fixture references such as movement `ingredientName` to read the renamed field. Preserve all existing row IDs, warehouse/ingredient IDs, quantities, timestamps, row counts, mixed-empty composition, movement rows, and documents. Do not add compatibility aliases because they would allow the wrong DTO contract to survive.</action>
  <verify>
    <automated>npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts --maxWorkers=1</automated>
  </verify>
  <done>The focused contract test passes and would fail if current-stock names reverted to `warehouse`/`ingredient`/`unit` or if mapped primary labels fell back to fixture IDs.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Regenerate focused Warehouse evidence and prove selected primary labels</name>
  <files>frontend/tests/ui-audit.spec.ts, frontend/test-results/warehouse-data-workspace/after/captures/ready/*/record.json, frontend/test-results/warehouse-data-workspace/after/captures/ready/*/*.png, frontend/test-results/warehouse-data-workspace/after/manifest.json, frontend/test-results/warehouse-data-workspace/after/deterministic-findings.json, frontend/test-results/warehouse-data-workspace/after/selection-manifest.json</files>
  <behavior>
    - A fresh ready-state run produces new capture identities and a selected ready record.
    - The selected record's ARIA evidence contains known human-readable current-stock labels such as `Kho chính`, an ingredient name, and `kg`.
    - The primary current-stock region does not expose `warehouse-phase27-main` or `ingredient-phase27-*` as displayed row labels.
  </behavior>
  <action>Add a focused assertion to the existing fresh post-refactor Warehouse evidence test after deterministic selection: resolve at least one selected ready capture record and assert its primary current-stock evidence contains known fixture display names and excludes the matching technical warehouse/ingredient IDs as rendered labels. Regenerate only the Warehouse `after` evidence through the existing focused Playwright flow with a new run identity. Keep baseline artifacts immutable and do not update screenshots, baselines, or thresholds. Do not rerun or alter the forbidden-route H1 finding or AI verdict as part of this correction; report it separately as an unchanged out-of-scope blocker.</action>
  <verify>
    <automated>npm exec -w frontend playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract fresh post-refactor evidence" --workers=1</automated>
  </verify>
  <done>A fresh selected ready record and screenshot exist, the focused browser assertion proves meaningful primary current-stock labels, and no technical fixture ID is promoted as the warehouse or ingredient label.</done>
</task>

<task type="auto">
  <name>Task 3: Close the quick task without widening Phase 27 scope</name>
  <files>.planning/quick/&lt;generated-quick-id&gt;/*-SUMMARY.md, .planning/STATE.md</files>
  <action>Run focused unit/browser checks, lint only the three touched TypeScript test files if supported, and hygiene/scope checks. Record the exact generated evidence paths and fresh run identity in the quick SUMMARY. Update STATE only to mark this current-stock label correction complete while preserving the separate duplicate-H1 blocker and Plan 27 closeout state. Confirm no staged files and no forbidden path changed. Stop without production cleanup or adjacent remediation.</action>
  <verify>
    <automated>npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts --maxWorkers=1 &amp;&amp; npm exec -w frontend playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract fresh post-refactor evidence" --workers=1 &amp;&amp; npm exec -w frontend eslint tests/warehouseDataWorkspaceFixture.ts tests/warehouseDataWorkspaceContract.test.ts tests/ui-audit.spec.ts &amp;&amp; git diff --check</automated>
  </verify>
  <done>The quick SUMMARY cites passing DTO and fresh selected-record proof; STATE preserves unrelated blockers; the diff contains only allowed files; and `git status --short` shows no staged files.</done>
</task>

## Verification and scope assertions

- Inspect `git diff --name-only` and fail if any changed path is outside the allowlist above.
- Inspect `git diff --cached --name-only`; it must be empty.
- Verify `frontend/tests/warehouseDataWorkspaceFixture.ts` uses all three DTO name keys and does not retain the old current-stock presentation keys.
- Verify fresh selected evidence is from the new run identity, not the previous `phase27-after-20260822T131341Z` records.
- Preserve the existing duplicate forbidden-route H1 as an explicit residual risk; it is not evidence that this label correction failed.

## Residual risks

- The separate `phase27-baseline-forbidden-duplicate-h1` finding remains unresolved and continues to block full Phase 27 closeout; this quick task must not touch its shared owner.
- Fresh screenshots are reviewer artifacts only. The automated selected-record ARIA/DTO assertions are the pass/fail oracle for this correction.
- Regenerating the configured Playwright output can remove prior `after` artifacts; execution must constrain regeneration to the focused Warehouse lane and verify the resulting allowlist before closeout.
