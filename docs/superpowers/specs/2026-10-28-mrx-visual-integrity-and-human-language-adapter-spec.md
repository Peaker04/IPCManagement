# Spec: MRX Visual Integrity, Header Geometry & Human-Language Adapter Architecture

**Date:** 2026-10-28  
**Subsystem:** Material Reconciliation Subsystem (`FR-RECON`, `FR-MENU`, `FR-WH`, `FR-CHEF`)  
**Scope:** Header Geometry, Layer Cake Elimination, Domain Data Mapping (Anti-Enum Leak), Contextual Empty States, and Typography Casing (`DOM-MODE-1`)

---

## 1. Problem Statement & Audit Evidence

Based on live physical browser inspection across 8 visual evidence captures:
1. **Date Input Truncation**: Across all reconciliation stations, the year is squished and truncated (`21/09/202` instead of `21/09/2026`), and selecting "Cả tuần" pushes the raw string `'ALL'` into a numeric date input field.
2. **Layer Cake Duplicate Sub-Headers**: In `reconciliation` subviews (`variances`, `transactions`, `audit`), a second stacked sub-header bar repeats the exact same title already displayed in `TelemetrySubbar`, wasting 40px of vertical viewport and creating a cluttered "layer cake" appearance.
3. **Raw Enums & C# Technical Leaks**:
   - `MrxBatchDishesModal.tsx` renders raw backend exception `KITCHEN_FROZEN_LINEAGE_MISSING` in a red box.
   - `ReconciliationVariancesBranch.tsx` exposes internal enum `WEEK_COMPLETE`.
   - `ReconciliationTransactionsBranch.tsx` exposes raw English enums `SUPPLEMENTAL_ISSUE` and raw unit string `Kilogram`.
   - `ReconciliationAuditBranch.tsx` exposes raw user GUID `10000000-0000-0000-0000-000000000001`, raw English area `Coordination`, and raw C# class/method names `MealQuantityPlan / QuickCompleteServings`.
4. **False Empty State & Zombie Buttons**: In `MrxDailyIssueWorkbench.tsx`, when selecting a day with 0 lines, the page shows a `SearchX` icon (even though no search was performed) and leaves disabled "Điền đủ" and "Xác nhận xuất kho" buttons in the header.
5. **Inconsistent Typography Casing**: Material names display erratic lowercase/uppercase casing ("xương ống", "chà cua" vs "Da heo", "Bí đao").

---

## 2. Invariants & Architecture Specifications

- **`INV-ZERO-DATE-TRUNCATION`**: `VietnameseDateInput` must maintain an un-squishable width of `min-w-[160px] w-40 shrink-0` across all viewports. When `activeDate === 'ALL'`, the input must gracefully display the formatted week start date (or be locked as week reference).
- **`INV-SINGLE-SUBBAR-RULE`**: Every station has exactly ONE Subbar (Zone 2, fixed 44px). No branch component may render a secondary stacked title bar. All CSV download triggers and sub-tabs must integrate into `TelemetrySubbar`.
- **`INV-HUMAN-LANGUAGE-ADAPTER`**: No raw backend enum, C# class name, or technical GUID may ever leak into production UI text:
  - `INITIAL_ISSUE` $\rightarrow$ `Xuất ban đầu`
  - `SUPPLEMENTAL_ISSUE` $\rightarrow$ `Xuất bổ sung`
  - `RETURN` $\rightarrow$ `Hoàn trả`
  - `Kilogram` $\rightarrow$ `kg`, `Gram` $\rightarrow$ `g`, `Piece` $\rightarrow$ `cái`
  - `Coordination` $\rightarrow$ `Điều phối`, `Reconciliation` $\rightarrow$ `Đối soát`, `Warehouse` $\rightarrow$ `Kho`
  - `MealQuantityPlan` $\rightarrow$ `Kế hoạch suất ăn`, `QuickCompleteServings` $\rightarrow$ `Chốt số suất ca`
  - `10000000-0000-0000-0000-000000000001` $\rightarrow$ `Quản trị viên (Admin)`
- **`INV-INTELLIGENT-ACTIONS`**: In `MrxDailyHeaderBranch.tsx`, issue action buttons ("Điền đủ", "Xác nhận xuất kho") must only render when `lines.length > 0 && !isWeeklyAll`. Empty days must display a calm notice.
- **`INV-TITLE-CASE-MATERIALS`**: All ingredient names must pass through a title-casing formatter (`formatMaterialName`) ensuring the first letter is capitalized consistently.

---

## 3. Structural Implementation Contracts

### 3.1 Date Geometry in `ReconciliationHeaderBranch.tsx` & `MrxDailyHeaderBranch.tsx`
Ensure container uses `flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-x-auto no-scrollbar` and `VietnameseDateInput` has `shrink-0 min-w-[160px]`.

### 3.2 Subbar Integration in `ReconciliationReportTables.tsx`
Remove local secondary header divs from:
- `ReconciliationVariancesBranch.tsx`
- `ReconciliationTransactionsBranch.tsx`
- `ReconciliationAuditBranch.tsx`
Pass CSV download handlers to `TelemetrySubbar` directly.

### 3.3 Human-Language Formatters (`frontend/src/utils/formatters.ts`)
```ts
export function formatTransactionType(type: string): string;
export function formatAuditActor(actorId?: string | null): string;
export function formatAuditEntity(entityName?: string | null): string;
export function formatAuditArea(area?: string | null): string;
export function formatMaterialName(name?: string | null): string;
```

---

## 4. Verification Criteria

1. **Date Field Pixel Inspection**: The year is fully visible (`2026`) across all 10 MRX routes with zero truncation.
2. **Layer Cake Verification**: Report subviews have exactly one 44px Subbar; 0 duplicate title divs.
3. **Zero Raw Token Leak**: Playwright audit reports 0 raw enums, 0 GUIDs, and 0 C# class names.
4. **Pre-commit Gate**: 100% PASS on `npm run precommit:verify` (221+ Vitest tests).
5. **Playwright E2E**: 63/63 tests PASS.
