# Specification: MRX Subsystem Adversarial Integrity & Persistence Hardening

**Date:** 2026-10-30  
**Status:** Approved  
**Scope:** MRX Subsystem (Planning, Warehouse, Chef, Reconciliation, Coordination)

---

## 1. Problem Statement

During deep adversarial lifecycle auditing, four critical vulnerabilities and workflow discrepancies were identified:
1. **Silent Schedule Drift (Vulnerability 1)**: When an MRX reconciliation batch has been transferred to warehouse or is in progress (`TRANSFERRED`, `IN_PROGRESS`, `COMPLETED`), the Coordinator can still click "Chỉnh sửa lịch tuần" and edit servings/dishes in `WeeklyScheduleEditorModal`. This mutates `mealquantityplans` in the background while the frozen batch lines (`reconciliationbatchlines`, `reconciliationbatchdailylines`) remain static, producing an unflagged divergence between Kitchen cooking orders, Warehouse issue records, and Coordinator planning facts.
2. **Opaque Inventory Auto-Adjustment (Vulnerability 2)**: In `ReconciliationInventoryIssueCreator.cs`, when warehouse physical stock is insufficient (`StockShortageException`), the system automatically invokes `_stockLedgerService.AddStockAsync` with reason *"Bảo đảm đủ tồn kho cho chế độ đối chiếu nguyên liệu"*. While this maintains reconciliation issuing capability, it is not surfaced transparently on the warehouse UI or in receipt details, obscuring the adjustment from warehouse staff.
3. **Fragile Return Lineage Mapping (Vulnerability 3)**: When a source change reduction creates a `RETURN` delta in `reconciliationsourcedeltas`, `MrxSourceDeltaWorkbench.tsx` relies on a brittle single-issue line match. If an ingredient has multiple issues on the same date, or if lineage matching fails, an uncaught error is thrown and the delta remains stuck in `PENDING`.
4. **Stale Disposition Race Condition (Vulnerability 4)**: If a manager opens `ReconciliationDispositionModal` to accept a variance, but the warehouse concurrently submits a supplemental issue for that ingredient, the net issued quantity changes. Saving the disposition without re-checking the underlying net issued quantity creates a stale disposition accepted against obsolete figures.

---

## 2. Requirements & Invariant Rules

### Invariant 1: Batch Immutability & Schedule Edit Lockdown
- **BR-MRX-LOCK-1**: If an MRX batch for a given customer and week has status $\in$ `['TRANSFERRED', 'IN_PROGRESS', 'COMPLETED']`:
  - Frontend: The `[Chỉnh sửa lịch tuần]` button on `MrxBatchWorkbench.tsx` MUST be disabled with a descriptive tooltip or inline indicator: *"Lô đối soát đã bàn giao sang Kho / Đang đối chiếu. Mọi thay đổi số suất ăn phải thực hiện qua chức năng 'Điều chỉnh nguồn MRX'."*
  - Backend: In `MealQuantityPlansController.cs` / `MealQuantityPlanService.cs`, `UpsertQuickServingsAsync` MUST query if a `ReconciliationBatch` exists for the target customer and service date with status $\in$ `['TRANSFERRED', 'IN_PROGRESS', 'COMPLETED']`. If found, it MUST reject the direct quick servings mutation with HTTP 409 Conflict.

### Invariant 2: Transparent Inventory Auto-Adjustment Surfacing
- **BR-MRX-STOCK-1**: Whenever `ReconciliationInventoryIssueCreator` automatically adjusts stock due to shortage:
  - The created issue result DTO MUST include auto-adjustment metadata or an audit note indicating that auto-adjustment occurred.
  - In `MrxDailyIssueWorkbench.tsx` and `ReconciliationIssueDetailModal.tsx`, affected ingredients MUST display an amber badge: `[Đã tự động bù tồn kho: +X kg]` so warehouse staff and managers are fully informed.

### Invariant 3: Robust Multi-Issue Return Lineage Mapping
- **BR-MRX-RETURN-1**: In `MrxSourceDeltaWorkbench.tsx`:
  - When processing a `RETURN` delta, the lookup across `mrxApi.getIssues(delta.batchId)` MUST aggregate available issued quantities across all issues of that day matching `reconciliationBatchDailyLineId`.
  - It MUST select the appropriate issue line with sufficient issued balance to fulfill the return, preventing uncaught errors and ensuring delta transitions cleanly to `RESOLVED`.

### Invariant 4: Freshness Check on Daily Line Dispositions
- **BR-MRX-DISP-1**: In `ReconciliationActualService.SetDailyDispositionAsync`:
  - When saving a daily line disposition, verify that the net issued quantity (`issuedQty - returnedQty`) has not changed since the client loaded the row (using `ExpectedVersion` or validating net issued balance).
  - If a concurrent supplemental issue was committed in the interim, return HTTP 409 Conflict: *"Số lượng xuất kho đã thay đổi do có phiếu xuất phát sinh mới. Vui lòng làm mới để xem số liệu mới nhất."*

---

## 3. Verification Criteria
1. **Unit & Integration Tests**:
   - `WeeklyMenu.test.tsx`: Test that "Chỉnh sửa lịch tuần" is disabled when `batch.status === 'TRANSFERRED'`.
   - `MealQuantityPlansControllerTests.cs`: Test that `UpsertQuickServings` returns 409 when batch is in `TRANSFERRED` or `IN_PROGRESS`.
   - `Warehouse.test.tsx`: Test return delta handling with multi-issue lookup and auto-adjustment badges.
   - `Reconciliation.test.tsx`: Test concurrent issue detection during disposition.
2. **Quality Gates**:
   - `npm run precommit:verify`: 100% PASS on all 5 gates.
   - `npm run test:e2e:mrx`: 13/13 PASS on dedicated sandbox.
   - `scripts/run-mrx-live-e2e-mutation-lifecycle.mjs`: Complete 28-step browser execution with direct MySQL row validation.
