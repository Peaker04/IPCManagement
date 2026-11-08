# MRX Test-Audit, Platform Invariants & Responsive Architecture Specification

> **Status:** Approved  
> **Authority:** `.pi/skills/ipc-test-audit/SKILL.md` (Rules TA-1 to TA-5), `C:\Users\Administrator\.pi\agent\skills\test-audit\SKILL.md`, `docs/domain/material-reconciliation.md`  
> **Scope:** `MATERIAL_RECONCILIATION` subsystem exclusively. Chef view (`/chef?view=mrx-cooking`) is strictly preserved as-is.

---

## 1. Problem Statement & Objectives

The previous implementation suffered from four classes of defects identified in the technical review:
1. **Critical Platform Defects (P0)**:
   - Dual API authority between `frontend/src/api/reconciliationApi.ts` and `frontend/src/api/mrxApi.ts`.
   - Cross-date state contamination in `MrxDailyIssueWorkbench.tsx` where entering quantities on one date polluted other dates' dictionaries.
   - Zero-CLS violation in `ReconciliationPage.tsx` where errors called `setData(null)`, destroying working context.
2. **Major Test-Audit Violations (P1 - Rules TA-1 to TA-5)**:
   - Synthetic fixtures in `frontend/src/test/fixtures.ts` (`MOCK_RECONCILIATION`) invented client-only fields (`materialCode`, `materialName`, `unit`, `notes`) instead of mirroring C# backend DTOs (`BatchLineId`, `IngredientCode`, `IngredientName`, `CanonicalUnitName`, `IssueNotes`).
   - Tautological test mocking in `frontend/src/__tests__/Reconciliation.test.tsx` spying on `reconciliationApi.getReconciliationSummary` instead of testing at the network boundary (`apiClient`).
   - Incomplete 4-scenario coverage (missing explicit `prerequisite-blocked` and HTTP 403 authorization failure tests).
3. **Moderate Responsive Layout Violations (P2)**:
   - Hiding scrollbars via `.no-scrollbar` hid overflowing interactive buttons from mouse users on screens `< 1366px`.
   - Over-wide fixed controls (`w-64`, `w-72`) in `WorkspaceHeader` and `TelemetrySubbar` caused overflow on 1024px and 1280px screens.
   - Hardcoded `min-w-[800px]` in `DataGrid.tsx` forced inner scrollbars inside SplitView master columns.
4. **Minor Requirements Gaps (P3)**:
   - `MrxSupplementalIssueModal.tsx` allowed only single-ingredient issuing rather than multi-line supplemental packages.

---

## 2. Technical Contracts

### 2.1. Rule TA-1 & TA-2 Backend Grounding Contract
- All mock fixtures for reconciliation batch endpoints MUST match `ReconciliationBatchDto` and `ReconciliationLineDto` from `backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs`:
  ```typescript
  interface ReconciliationBatchDto {
    batchId: string;
    menuVersionId: string;
    quantityImportBatchId: string;
    status: string;
    version: number;
    createdAt: string;
    readyAt?: string;
    completedAt?: string;
    customerId?: string;
    customerName?: string;
    customerCode?: string;
    weekStartDate?: string;
    weekEndDate?: string;
    dailyReview?: {
      weeklyStatus: string;
      lines: ReconciliationLineDto[];
    };
    lines: ReconciliationLineDto[];
  }
  ```
- All test mocks MUST mock `apiClient` calls rather than spying on internal helper/transform methods.

### 2.2. Single API Authority Contract
- Consolidate reconciliation queries and mutations into `frontend/src/api/mrxApi.ts`.
- `ReconciliationPage.tsx` will query `mrxApi.getBatch(batchId)` directly using the authoritative C# DTO shape and derive daily review lines from `batch.dailyReview?.lines`.

### 2.3. Zero-CLS & Date State Isolation Contract
- In `MrxDailyIssueWorkbench.tsx`, the `quantities` and `reasons` state MUST be scoped strictly to `activeDate`:
  ```typescript
  // When activeDate changes, quantities reset to that specific date's required values:
  setQuantities(Object.fromEntries((selected?.lines ?? []).map(l => [l.dailyLineId, String(l.requiredQuantity)])));
  setReasons({});
  ```
- In `ReconciliationPage.tsx`, errors MUST retain existing data and set `hasExistingData={true}` with visible `isFetching` indicator, NEVER calling `setData(null)`.

### 2.4. Responsive Layout Contract
- Screen widths `>= 1440px`: Full inline horizontal layout.
- Screen widths `< 1440px`: Context selectors scale responsively (`w-40 sm:w-48 lg:w-56`), allow controlled flex wrapping when necessary, and ensure all buttons remain 100% visible and clickable without trackpad horizontal swipes.

---

## 3. Verification & Acceptance Criteria

1. `ZeroFakeApiAndTestAuditGuard.test.ts` passes with zero banned fake patterns.
2. `Reconciliation.test.tsx` passes with 100% network-boundary mocking (`apiClient`) against C# grounded DTOs.
3. All 18 frontend unit test files pass (167+ tests).
4. Automated 5-viewport Playwright probe (1920, 1440, 1366, 1280, 1024) confirms 0 window horizontal overflow and 0 clipped buttons.
5. 7-day 4-actor full-path operational lifecycle test passes 100% on isolated sandbox database.
6. Every frontend source file remains strictly `< 600 lines`.
