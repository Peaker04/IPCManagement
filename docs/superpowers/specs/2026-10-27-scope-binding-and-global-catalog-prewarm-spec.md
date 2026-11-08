# Spec: Scope Binding Invariant, Auto-Select Entity & Global Catalog Pre-warm

- **Scope:** Complete 14 Canonical Routes & 25 Surfaces in IPCManagement
- **Objective:** Eliminate the initial-load "empty notice $\rightarrow$ date jump $\rightarrow$ table appearance" flicker by binding operational dates strictly to the batch's week, auto-selecting the first valid entity across master-detail views, and pre-warming customer catalogs globally at 0ms.
- **Standards:** SAP Fiori 3.0 / IBM Carbon / NN/g (150ms Doherty Threshold) / SWR 3-Level Refreshing / Zero-CLS Enterprise Design.
- **Architecture Limits:** Strictly $\le 600$ lines per FE source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).

---

## 1. Problem Statement & Functional Requirements

1. **Date Mismatch Flash (The Calendar Glitch):**
   When operators open an operational workbench without an explicit `?date=` query, components currently default to `todayInBusinessTimezone()` (e.g. `27/10/2026`). However, the existing active batch in the database was created for a past week (e.g. `14/09/2026`). On Render #1, the query fetches data for today, finds 0 lines, and flashes "Không có định lượng cho ngày đã chọn". Then, 80ms later, after the batch list resolves, the date input abruptly jumps from October to September, re-fetching and finally showing the table.
2. **Empty Master-Detail SplitView on First Load:**
   In `PurchasingPage.tsx`, the master list loads POs, but the detail panel on the right remains unselected and displays an empty placeholder ("Đơn PO này chưa có dòng nguyên liệu chi tiết") until the operator manually clicks a row.
3. **Repeated Per-Page Customer Catalog Waterfall:**
   `WeeklyMenuPage`, `MealOrdersPage`, `ChefDashboardPage`, and `ReconciliationPage` all run identical `useEffect` calls calling `weeklyMenuApi.getCustomers()`. This causes a 30ms–50ms bootstrap delay on every route entry before the initial customer is resolved.

---

## 2. Design Invariants & Contracts

### 2.1. Scope Binding Invariant
- For any workbench bound to a reconciliation batch or weekly schedule, `serviceDate` is NEVER defaulted to calendar today if today lies outside the week.
- Initial date resolution precedence:
  $$\text{URL date} > \text{matched date in batch.dates} > \text{batch.weekStartDate} > \text{sessionScope.serviceDate}$$
- When a batch is selected or switched, `workspaceSessionStore` atomically updates `{ batchId, serviceDate, weekStartDate }` to the batch's first valid service date.
- This guarantees Render #1 fetches the exact date where batch lines exist, completely eradicating the empty-state flash.

### 2.2. Auto-Select First Valid Entity
- In `PurchasingPage.tsx`: When `filteredOrders` is non-empty and no `selectedOrderId` is set, default `selectedOrderId` to `filteredOrders[0].purchaseOrderId` so the right detail panel renders immediately.
- In `MrxCookingWorkbench.tsx`: When batches load, default to the first batch with valid cooking data.

### 2.3. Global Catalog Pre-warming in `AuthProvider`
- In `authContext.tsx`, when an authenticated session is established, invoke `weeklyMenuApi.getCustomers()` and cache the result into `serverStateCache` backed by `sessionStorage` (`ipc_snapshot:catalog_customers`).
- Every workbench immediately reads `cachedCustomers` at Frame 0 (0ms), resolving `customerCode` / `customerId` synchronously without waiting for a per-page effect.

---

## 3. Verification Criteria

1. Zero occurrences of date jumping from today to a past month on first load.
2. Zero flashes of "Không có định lượng cho ngày đã chọn" on `/warehouse?view=mrx-daily`.
3. Purchasing detail panel immediately populates on `/purchasing` without requiring manual click.
4. All 24 Vitest test files pass 100%.
5. All 63 Playwright browser tests pass 100%.
6. All 1,419 Backend C# tests pass 100%.
7. 0 files $> 600$ lines.
