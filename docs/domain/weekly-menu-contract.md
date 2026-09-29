# Weekly Menu Feature Business & UI Contract

**Status:** Adopted Domain Contract
**Owner:** Weekly Menu & Central Kitchen Domain
**Target Routes:** `/weekly-menu` (DEFAULT & MATERIAL_RECONCILIATION)
**Last Updated:** 2026-09-30

---

## 1. Domain Calculations & Arithmetic Truth

1. **BOM 6-Decimal Place Precision ("Định mức theo món"):**
   Raw ingredient BOM normatives must be calculated and preserved up to **6 decimal places** in kilograms/portion (e.g. `0.064777 kg`).
   - Financial calculation rule: Unit prices are multiplied by the exact unrounded BOM quantity before rounding total currency amounts to whole Vietnamese Đồng (VND).
   - *Example:* $0.064777\text{ kg} \times 12,000\text{ đ} = 777.324\text{ đ} \implies \mathbf{777\text{ đ}}$ (never round quantity to $0.065\text{ kg} \times 12,000\text{ đ} = 780\text{ đ}$).
   - BOM display precision: Quantity columns display up to 6 decimal places when source data warrants it; currency amounts round to whole VND.

2. **Dietary Variant Split Ratio (Chay vs. Mặn):**
   When importing menu plans with savory (Mặn) and vegetarian (Chay) variants:
   - For planned shifts with locked headcounts (e.g. 120 portions/shift), headcounts split strictly by contract ratio: **85% Savory (102 portions)** and **15% Vegetarian (18 portions)**.
   - For ad-hoc or uncommitted imported menus without locked shift plans, imported variant counts apply directly (e.g., Savory 840/870, Vegetarian 150).
   - Food costs are calculated separately per variant group before aggregating into daily menu totals. Estimated BOM cost does not constitute proof of warehouse issue or purchase receipt.

---

## 2. Shell & Workspace Navigation Architecture

1. **Persistent Scope & Shared Coordinates:**
   Customer selector (`CustomerSelect`), Week picker (`WeekPicker`), and pricing tier context represent shared business coordinates. In the target reconstructed architecture, these coordinates persist across workspace routes via URL Search Parameters (`?customerId=...&weekStartDate=...&pricingTier=...`) and global workspace context, eliminating reliance on client `localStorage` for business truth.
2. **Migration from In-Page Tabs to Sidebar Workspaces (PO Authoritative Decision):**
   The 6 functional views of Weekly Menu migrate from the legacy monolithic route with in-page tab navigation to independent workspace routes under the `Kế hoạch & Điều phối` module group in the application sidebar:
   1. `Kế hoạch tuần` (Weekly Schedule Matrix)
   2. `Định mức theo món` (Dish BOM Formulation & Tray Cost)
   3. `Kế hoạch sản xuất` (Kitchen Production Orders)
   4. `Nhu cầu nguyên liệu` (Material Demand Workbench)
   5. `Giá vốn tuần` (Food Cost & Margin Audit)
   6. `Bàn giao tuần` (Kitchen Handover & Warehouse Dispatch Summary)
   *Bất biến loại trừ nhân bản:* Khi chuyển lên Sidebar, các trang con **tuyệt đối không giữ lại thanh tab ngang 6 mục cũ**. Cấm mô hình lặp lại thanh tab ngang gồm đúng các workspace đã có trên sidebar.
3. **Scope Guard & Prerequisite State:**
   Workspace routes remain navigable even when no customer is selected. When unselected, the active workspace owns its explanatory prerequisite state card, preventing un-scoped data leakage.
4. **Authorized Commands ("Thao tác tuần") & Conditions ("Điều kiện"):**
   Authorized weekly commands (Import, Matrix Editor, Publish, Export) and 4 named prerequisite checkpoints (Customer, Week, Menu Items, Plan) are displayed directly with their respective permission guards within their relevant workspaces. Do not collapse weekly commands under a single ambiguous dropdown.

---

## 3. "Nhu Cầu" (Material Demand) Workspace Composition Contract

1. **Single Operational Surface:**
   The `/weekly-menu` "Nhu cầu" tab is the sole authorized demand workbench. (The historical experimental `/demand-preview` route was retired on 2026-09-29).
2. **Daily Workbench Grain:**
   The workspace operates on **one selected service day**. Day selector, approval code, handover counters, warnings, and document rails derive strictly from the active service date and do not leak across days.
3. **State-Aware Workspace Ordering (2026-09-29 Canon):**
   Universal ordering is prohibited. The layout dynamically adapts to data readiness:
   - **Case A: Day with Generated Material Rows:**
     Lead with the generated Material Demand Worklist table immediately below the operational header. The underlying KHSX (Production Plan) source disclosure defaults to **collapsed/closed**, but remains openable for audit or adjustments.
   - **Case B: Day without Material Rows & Incomplete Shifts:**
     Lead with the open, interactive KHSX shift serving editor, followed by an explanatory material empty state. Guarded shift completion controls sit above KHSX rows to avoid bottom scrolling.
   - **Case C: Day without Material Rows but Completed Shifts:**
     Lead with a compact explanatory material state and a prominent "Tính nhu cầu" action, followed by collapsed KHSX disclosure.
4. **Shift-Level Headcount Editing:**
   KHSX editing operates at the **shift grain** (one input per shift for Savory, one for Vegetarian). Do not duplicate inputs per dish row.
5. **No Cross-Role CTAs:**
   Material rows in the demand view display read-only requirements. Generic cross-role action columns (e.g. "Hướng xử lý") are omitted in this multi-actor view; procurement and warehouse actions are performed in their respective workbenches.
6. **Unified Document Rail:**
   The daily document rail provides a single scope switch between Day and Week. A draft KHSX document remains day-only; weekly scope lists finalized backend documents.

---

## 4. Query Recovery & Permission Integrity

1. **Serving Query Error Recovery:**
   If the meal-plan query returns an HTTP error (500/503), an inline retry banner mounts in normal flow above the readiness checkpoint. Readiness marks serving counts as unverified (`danger`), preventing false "ready" badges. Upon successful retry, cached warnings clear.
2. **Kế hoạch sản xuất 403 Forbidden State:**
   When an actor lacks `production.read` permission and the API returns 403, the UI must render an explicit permission denial notice. It must **never** render a false "Chưa có kế hoạch" (No plan found) empty state or display active day filters.
3. **KHSX Empty State Copy:**
   When an authorized actor accesses a valid customer/week that has zero plans, the empty state must state clearly: *"Chưa có kế hoạch sản xuất trong tuần đã chọn"*. It must **not** instruct the user to re-select the already-selected customer or week.
