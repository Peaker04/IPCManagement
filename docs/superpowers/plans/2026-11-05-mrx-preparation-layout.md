# MRX Preparation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the owner-approved compact layout only for `/warehouse?view=mrx-preparation`.

**Architecture:** Keep the existing workbench, request owners, issue selection and allocation table. Remove the duplicate telemetry row, bound customer selection height and move the existing supplier-only Excel controls beside their download action. No shared component redesign.

**Tech Stack:** Existing React/TypeScript, Tailwind utilities and IPC workbench/UI primitives.

**Spec:** Approved design in conversation and `.planning/WORK.md`, section “Warehouse preparation layout — owner targeted complaint”: primary confirmation in header; compact date/selected counts and bounded customer selection; supplier field beside Excel; local search immediately above unchanged allocation table.

## Global Constraints
- Only this MRX route; preserve DEFAULT/MRX isolation, guards, pending/unknown-result locks, drafts, request payloads, precision and export scope.
- Preserve existing labels and explanatory export text except redundant date repetition.
- D6 >=12px, D7 one primary, T7 frozen table/header, T8 compact density, M1.2 one blocking modal, N6 sidebar unchanged.
- No installation, delegation, DB operations, service replacement, staging or commits. WORK is the only live task-state owner.

## Review Focus
- Multiple/long customer names: bounded selectable region, labels and status remain readable.
- Zero selected batches: existing empty message and disabled issue/export remain.
- Supplier text and local search: supplier affects Excel only; search affects displayed rows only.
- Pending issue/unknown result: existing date/selection/issue safety retained.
- Narrow viewport: Excel controls wrap as a meaningful group without document overflow.

### Task 1: Recompose the existing route and verify
**Files:**
- Modify `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`: remove repeated telemetry, pass unchanged export callback and availability to allocations branch.
- Modify `frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx`: keep date and primary issue action; remove export-only props/button now owned beside supplier field.
- Modify `frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx`: bounded customer grid and selected/ingredient counts; colocated supplier/export controls; existing local find and DataGrid unchanged.
- Verify existing `frontend/src/__tests__/Warehouse.test.tsx`; do not add tests that merely pin DOM wrappers/classes.

**Interfaces:** Parent retains `supplierFilter`, `canExport`, all request construction and existing callback. Allocations branch receives `activeBatchesCount: number`, `canExport: boolean`, `onDownloadXlsx: () => void`. Header no longer consumes export props. No new public/test-only exports.

- [ ] Confirm existing preparation tests exercise selection, supplier export scope, date and unknown-result behavior; run focused baseline.
- [ ] Make the three-owner layout change without changing request/quantity/state logic.
- [ ] Run existing Warehouse tests, scoped lint and build. Legacy named contract test files are absent; never report them passing.
- [ ] Batch dedicated headed final-bundle screenshots for1366/1024 with small and many-customer fixtures; verify selection and local search/export availability without live writes.
- [ ] One bounded correction pass if needed; scoped source review, detector, diffcheck; record limits and close WORK to IDLE.
