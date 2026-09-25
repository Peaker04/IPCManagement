---
quick_id: 260803-pwg
mode: quick-validate
status: complete
date: 2026-08-03
must_haves:
  truths:
    - Warehouse supplemental and return query failures never render false empty tables or zero pagination as authoritative.
    - Forbidden is distinct from retryable error, and refresh preserves ready rows.
    - Return-detail loading/error cannot expose a confirmable empty form.
  artifacts:
    - frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx
    - frontend/src/features/warehouse/WarehouseExceptionsWorkbench.test.tsx
  key_links:
    - All three query owners are classified with toLabeledQueryView.
    - QueryViewBoundary owns blocking and refresh presentation while existing mutations remain unchanged.
---

# Quick 260803-pwg — Warehouse exception query-state rollout

## Scope

Continue the adopted incremental standardization contract by migrating only the Warehouse exception workbench's supplemental list, pending-return list and selected-return detail queries. Do not change API contracts, mutation semantics, permissions, routes, pagination ownership, layout, database state or Phase 27.

## Tasks

### 1. Lock failing query-state behavior

- **Files:** `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.test.tsx`
- **Action:** Add component regressions for retryable failure, forbidden, stale-data refresh, ready-empty, and return-detail failure.
- **Verify:** At least the false-empty/error and refresh assertions fail against current manual flag handling for the expected reason.
- **Done:** Assertions exercise rendered behavior and retry ownership, not source-text snapshots.

### 2. Migrate three query owners

- **Files:** `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx`
- **Action:** Classify the two paged lists and selected-return detail through the existing labeled QueryView adapter and boundary; derive rows/counts only from ready data; retain controls, mutation state, source IDs and pagination callbacks.
- **Verify:** Focused workbench and shared QueryView tests pass.
- **Done:** Error/forbidden block false content, refresh preserves rows, ready-empty remains authoritative, and no new state algebra/component variant is introduced.

### 3. Verify and close rollout slice

- **Files:** standardization rollout documentation, `MEMORY.md`, `HISTORY.md`, GSD quick artifacts/state
- **Action:** Record the Warehouse slice only after source/full gates pass; keep all unrelated open items and Phase 27 unchanged.
- **Verify:** Architecture growth, UI completeness, full frontend/root verify, lint, dependency/build, secret/stub scan and `git diff --check` pass.
- **Done:** Two local atomic commits exist, no push/runtime/browser/database/GitNexus action occurs unless a gate proves it necessary.
