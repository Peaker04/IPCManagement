---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 14
subsystem: frontend-warehouse-context
status: complete
tags: [react, passive-context, fail-closed, rtk-query]
requires: [28-13]
provides: [passive purchasing context, passive warehouse context, invalid-cardinality mutation blocks]
affects: [28-15]
tech-stack:
  added: []
  patterns: [exact array cardinality, passive context, server-authoritative command identity]
key-files:
  modified:
    - frontend/src/features/purchasing/PurchaseDecisionPanel.tsx
    - frontend/src/features/purchasing/purchasingModel.ts
    - frontend/src/features/warehouse/pages/WarehousePage.tsx
    - frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx
    - frontend/src/features/warehouse/WarehouseBatchPurchaseReceiptDialog.tsx
decisions:
  - Selector data is valid only at exact cardinality one and is displayed once as passive context.
  - Zero or multiple rows disable affected mutations instead of choosing by index, preference, or state.
metrics:
  duration: 18m
  completed: 2026-08-24
actuals:
  tokens: 12500
  tasks: 2
  commits: 2
---

# Phase 28 Plan 14: Frontend Passive Warehouse Context Summary

Purchasing, inventory issue, and purchase receipt workflows now display one passive operational warehouse context and fail closed for invalid selector cardinality while retaining technical IDs in commands and allocation grain.

## Accomplishments

- Removed supplier-decision, issue, single-receipt, and batch-receipt warehouse selection.
- Removed preferred/default and stale selected warehouse state.
- Kept one RTK Query API slice and existing cache identity.
- Disabled affected commands when selector data contains zero or multiple rows.

## Verification

- Focused purchasing/model tests: 32/32 passed.
- Focused warehouse/dialog/allocation tests: 30/30 passed.
- TypeScript no-emit check passed.
- `git diff --check` passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing dialog behavior tests for passive context**
- Existing tests asserted the removed selector and preferred warehouse behavior.
- Assertions now verify no combobox, passive name rendering, and blocked invalid cardinality.
- Commits: `ca0152d6`, `34bb647b`

## Known Stubs

None.

## Self-Check: PASSED

All listed files and commits exist.
