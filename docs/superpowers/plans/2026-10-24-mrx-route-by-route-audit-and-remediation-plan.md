# Kế Hoạch Thực Thi: Thẩm Định Toàn Diện & Xử Lý Điểm Nghẽn Từng Route MRX (`MATERIAL_RECONCILIATION`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thẩm định và xử lý toàn diện từng Route đơn lẻ trong chu trình Đối soát nguyên liệu (MRX), kiểm chứng đủ 6 chiều (Actions, 6 States, URL Sync, Dirty Draft, RBAC/Mode, Next CTA), loại bỏ triệt để mọi lỗi đứt gãy luồng và ngõ cụt người dùng.

**Architecture:** Tiếp cận từng route theo thứ tự User Journey (từ Login → Điều phối → Kho 3 trạm → Bếp → Quản lý đối soát). Kiểm tra từng tương tác thực tế, viết test chứng minh lỗi trước (RED), sửa code tại đúng file sở hữu (GREEN), kiểm chứng DOM và network thật mà không tin vào output pass giả định.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright Chromium, ASP.NET Core 9, MySQL.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-route-by-route-audit-and-remediation-design.md`

## Global Constraints

- **Single Route Focus**: Mỗi task CHỈ can thiệp vào đúng 1 Route và các test của route đó; không sửa lan man sang route khác.
- **`DOM-MODE-1`**: Giữ nguyên tính cách ly tuyệt đối giữa `DEFAULT` và `MATERIAL_RECONCILIATION`.
- **Zero Synthetic Evidence**: Tuyệt đối không tạo mock giả định, không bỏ qua lỗi, không dùng `test.skip`.
- **3-Zone Flat Workbench**: Tuân thủ nghiêm ngặt Header 48px/56px, Subbar 40px/44px, DataGrid $\ge 85\%$ dvh, font $\ge 12$px (`D6`), tối đa 1 nút primary (`D7`), dòng cao 36–40px (`T8`).

## Review Focus

1. **Đồng bộ URL khi F5 (Persistence)**: Đang ở `batchId` hoặc `serviceDate` cụ thể mà F5 thì dữ liệu vẫn nạp đúng lô và ngày đó, không bị văng về trắng trang.
2. **Bảo vệ bản nháp chưa lưu (Dirty Draft)**: Đang nhập dở số suất/lý do/số lượng xuất kho mà bấm link khác phải hiện `alertdialog` cảnh báo.
3. **Validation & Disabled states**: Nút bấm phải bị vô hiệu hóa khi thiếu điều kiện (ví dụ: lý do từ chối rỗng, số lượng $\le 0$).
4. **Phản hồi lỗi 403/409**: Gặp xung đột phiên bản 409 phải có nút tải lại dữ liệu mới nhất; gặp 403 phải giải thích rõ quyền.
5. **Chuyển giao trạm (Handoff)**: Hoàn tất công đoạn ở trạm này phải có nút dẫn trực tiếp sang trạm tiếp theo của luồng.

---

### Task 1: Route 2 (`/weekly-menu?view=mrx-batch`) — Trạm Điều Phối Viên

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- URL query: `?view=mrx-batch&customerId={id}&weekStartDate={date}`.
- Actions: Nhập Excel, Kiểm tra định lượng, Tạo lô nháp, Đóng băng, Chuyển Kho, Điều chỉnh nguồn.
- CTA: Nút `[Mở trạm Kho xuất ngày]` sau khi chuyển giao lô.

- [ ] **Step 1: Write failing test in `WeeklyMenu.test.tsx` for URL persistence and error feedback**

```tsx
it('Route 2: persists customer and weekStartDate in URL and handles empty/error states with retry', async () => {
  // test asserting customerId and weekStartDate stay in sync with URL
  // test asserting diagnostic error alert when BOM is missing
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement route hardening in `MrxBatchWorkbench.tsx` & `WeeklyMenuImportModal.tsx`**

- Đồng bộ 2 chiều giữa URL searchParams (`customerId`, `weekStartDate`) và state.
- Bắt lỗi tải file Excel nếu file sai định dạng hoặc không có món ăn, hiển thị inline alert rõ ràng.
- Đảm bảo `publishMenu` và `checkQuantities` tự động sinh `quick-servings` hoàn tất.
- Đảm bảo nút CTA `[Mở trạm Kho xuất ngày]` hiển thị nổi bật trên banner.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/weekly-menu/ frontend/src/__tests__/WeeklyMenu.test.tsx
git commit -m "feat(route2): harden mrx batch workbench with url persistence, error feedback and handoff cta"
```

---

### Task 2: Route 3 (`/warehouse?view=mrx-daily`) — Trạm Kho: Định Lượng Xuất Ngày & Bổ Sung

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- URL query: `?view=mrx-daily&batchId={id}&date={date}`.
- Actions: Chọn lô, Chọn ngày, Xuất lần đầu (validate số lượng + lý do vượt), Xuất bổ sung ca (modal chọn nguyên liệu + lý do).
- Handoff CTA: Lối tắt sang `Hàng đợi thay đổi nguồn` (`mrx-issues`) và `Chuẩn bị phối hợp` (`mrx-preparation`).

- [ ] **Step 1: Write failing test in `Warehouse.test.tsx` for URL persistence and supplemental issue validation**

```tsx
it('Route 3: keeps batchId and date in URL search params and validates supplemental issue inputs', async () => {
  // test asserting F5 reload keeps batchId and date
  // test asserting supplemental modal requires positive quantity and non-empty reason
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement route hardening in `MrxDailyIssueWorkbench.tsx`**

- Đồng bộ URL searchParams: Khi đổi batch hoặc ngày, cập nhật `?batchId=&date=`. Khi F5 tải lại, đọc từ URL trước.
- Validation trong modal Xuất bổ sung: Khóa nút khi `quantity <= 0` hoặc `reason.trim().length === 0`.
- Hiển thị đầy đủ thông tin lịch sử các phiếu xuất đã tạo cho lô/ngày ở phần chân trang.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx frontend/src/__tests__/Warehouse.test.tsx
git commit -m "feat(route3): harden warehouse daily issue workbench with url persistence and supplemental validation"
```

---

### Task 3: Route 4 & 5 (`/warehouse?view=mrx-preparation` & `mrx-issues`) — Trạm Kho Phối Hợp & Delta

**Files:**
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- `mrx-preparation`: Date selector, toggle batch, filter supplier, submit coordinated issue, render `PreparationGroupId`.
- `mrx-issues`: Delta queue, process modal (supplemental issue vs physical return).

- [ ] **Step 1: Write failing test in `Warehouse.test.tsx` for preparation and delta error handling**

```tsx
it('Route 4 & 5: validates coordinated preparation and delta execution with conflict recovery', async () => {
  // test asserting preparation group ID banner
  // test asserting delta return executes return and confirm
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement hardening in `MrxMultiCustomerPreparationWorkbench.tsx` & `MrxSourceDeltaWorkbench.tsx`**

- Đồng bộ date trên URL của `mrx-preparation` (`?view=mrx-preparation&date=...`).
- Xử lý lỗi 409 xung đột phiên bản delta kèm nút thử lại.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/warehouse/ frontend/src/__tests__/Warehouse.test.tsx
git commit -m "feat(route4-5): harden multi-customer preparation and delta workbenches"
```

---

### Task 4: Route 6 (`/chef?view=mrx-cooking`) — Trạm Bếp Trưởng

**Files:**
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

**Interfaces:**
- URL query: `?view=mrx-cooking&batchId={id}&date={date}`.
- Actions: Chọn lô, Chọn ngày, In phiếu nấu A4 (`window.print()`), Xuất CSV/Excel.
- Guard: Pure Read-Only, zero mutations.

- [ ] **Step 1: Write failing test in `Chef.test.tsx` for cooking card details and URL sync**

```tsx
it('Route 6: persists cooking batch/date in URL, renders print button and enforces pure read-only', async () => {
  // test asserting zero mutation buttons exist
  // test asserting print and excel export work correctly
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Chef.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement hardening in `MrxCookingWorkbench.tsx`**

- Đồng bộ `batchId` và `date` trên URL query params.
- Đảm bảo in phiếu nấu định dạng A4 sạch sẽ bằng `@media print`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Chef.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chef/MrxCookingWorkbench.tsx frontend/src/__tests__/Chef.test.tsx
git commit -m "feat(route6): harden chef mrx cooking workbench with url persistence and print fidelity"
```

---

### Task 5: Route 7 (`/reconciliation`) — Trạm Quản Lý Đối Soát

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationBlockerStrip.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- URL query: `?view=lines|variances|transactions|audit|completed&batchId={id}&date={date}`.
- Actions: 5 queue metric cards, xử lý chênh lệch 2 chiều, chốt đối soát tuần, tải CSV sổ sách.
- Blocker: Thẻ cảnh báo điểm tắc luồng hiển thị chi tiết nguyên nhân khi tuần chưa đạt `WEEK_COMPLETE`.

- [ ] **Step 1: Write failing test in `Reconciliation.test.tsx` for URL view synchronization and blocker details**

```tsx
it('Route 7: synchronizes tabs with ?view= query param, renders blocker details, and exports CSV', async () => {
  // test asserting view switching updates URL
  // test asserting blocker strip lists missing dates
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement hardening in `ReconciliationPage.tsx` & `ReconciliationBlockerStrip.tsx`**

- Đồng bộ tab `view` với URL searchParams (`?view=variances`, `?view=transactions`...).
- Bổ sung danh sách ngày chưa xuất kho cụ thể vào `ReconciliationBlockerStrip`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/reconciliation/ frontend/src/__tests__/Reconciliation.test.tsx
git commit -m "feat(route7): harden reconciliation control tower with view url sync and detailed blocker evidence"
```

---

### Task 6: Route 1 (`/login`) & Landing Resolution by Role × Mode

**Files:**
- Modify: `frontend/src/features/auth/LoginPage.tsx`
- Modify: `frontend/src/routes/navigationEligibility.ts`
- Test: `frontend/src/__tests__/Auth.test.tsx`

**Interfaces:**
- Action: Đăng nhập tài khoản thật, nạp role và permissions.
- Routing: Tự động điều hướng về đúng trạm MRX theo vai trò.

- [ ] **Step 1: Write failing test in `Auth.test.tsx` for MRX role landing resolution**

```tsx
it('Route 1: resolves exact MRX landing page for Manager, Coordinator, Warehouse, and Chef', () => {
  // test asserting Manager goes to /reconciliation
  // test asserting Coordinator goes to /weekly-menu?view=mrx-batch
  // test asserting Warehouse goes to /warehouse?view=mrx-daily
  // test asserting Chef goes to /chef?view=mrx-cooking
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Auth.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement landing resolver hardening in `navigationEligibility.ts`**

- Đảm bảo `resolveLandingPath` trả về đúng URL view lá N6 cho từng vai trò ở chế độ MRX.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Auth.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/navigationEligibility.ts frontend/src/__tests__/Auth.test.tsx
git commit -m "feat(route1): verify and harden mrx role landing resolution"
```

---

### Task 7: Full Multi-Route Verification & Live Browser Headed E2E Integration Run

**Files:**
- Execute: `npm run verify`
- Execute: `cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts`
- Execute: `node scripts/run-mrx-e2e-mutation-test.mjs`
- Documentation update: `.planning/WORK.md` and `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Run full verification suite**

Run: `npm run verify`
Expected: ALL 12 gates PASS

- [ ] **Step 2: Run Playwright Conformance Runtime Suite**

Run: `cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts`
Expected: 10/10 PASS on live Chromium

- [ ] **Step 3: Run Headed E2E Mutation Test Suite on Sandbox DB**

Run: `node scripts/run-mrx-e2e-mutation-test.mjs`
Expected: 8/8 stages PASS in under 40 seconds on live Chromium

- [ ] **Step 4: Update documentation and ledger**

Update `.planning/WORK.md` and `docs/handoff/HANDOFF.md` recording complete single-route audit and return to `IDLE`.

- [ ] **Step 5: Commit & Push**

```bash
git add .planning/WORK.md docs/handoff/HANDOFF.md
git commit -m "chore(release): complete single-route deep dive audit and workflow unblocking"
git push origin feature/greenfield-fe-3zone-workbench
```
