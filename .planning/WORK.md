# Active work

Status: IDLE

### Greenfield Recovery Execution Record [COMPLETED]
- **Audit & Correction**: Báo cáo phản biện `audit-correction-report.md` đã rà soát 18 findings cũ (`GF-001 → GF-018`) và phát hiện 19 findings mới (`GF-019 → GF-037`).
- **Remediation Decisions Implemented**:
  - `D-01` (Option A): Sửa payload `approvalsApi.decide` gửi `{ status, decision, reason }` khớp DTO C# `ApprovalRequest` và `ApprovalDecision`.
  - `D-02` (Option A): Triệt tiêu mock string `NL-THIT-01`, `BG-260921-01` trong `WarehousePage.tsx` và `MaterialDemandView.tsx`, chuyển sang dynamic generation từ live data.
  - `D-03` (Option B): Sửa `WeeklyScheduleView.tsx` badge sang `"Trạng thái: Kế hoạch tuần"` và giữ 4 tabs phụ không lặp header.
  - `D-04` (Option B): Wire dynamic plan code và `window.print()` vào `[In lệnh sản xuất]`.
  - `D-05` (Option A): Chuẩn hóa công thức đối soát `variance = standardUsage - actualUsage` (BOM - thực tế) và màu sắc hiển thị (dương = tiết kiệm/xanh, âm = hao hụt/đỏ).
  - `D-06` (Option B): Bổ sung tham số `period` và `customerCode` vào `reportsApi` và kết nối động trong `ReportsPage.tsx`.
  - `D-07` (Option B): Nâng cấp `StateBoundary` hỗ trợ đủ 6 UI states (loading, empty, error, forbidden 403, conflict 409, partial data banner) kèm custom skeleton layout.
- **Phase P2: Containment & Security Hardening**:
  - Gated dev credentials behind `import.meta.env.DEV` trong `LoginPage.tsx`.
  - Loại bỏ backdoor mock JWT trong `authContext.tsx`, hỗ trợ `roleCode` / `roleName` case-insensitive.
  - Khôi phục đầy đủ `allowedRoles` cho 14 canonical routes trong `routeRegistry.ts` và bọc `RoleGuard` trong `App.tsx`.
  - Chuẩn hóa payload `createIssue` trong `warehouseApi.ts` khớp C# `CreateInventoryIssueRequest`.
- **Phase P3: API Contract Alignment & Vertical Slices**:
  - Đồng bộ hoá toàn bộ C# DTOs: `approvalsApi`, `warehouseApi`, `reconciliationApi`, `reportsApi`, `chefApi`.
  - Xóa bỏ logic tính suất chay hardcoded trong `MenuCostView.tsx`, đồng bộ suất theo `productionPlans`.
- **Phase P4: UI State, Loading & Design System Compliance**:
  - Thay thế generic spinner fallback bằng Geometric Table Skeleton trong `App.tsx` và `StateBoundary.tsx`.
  - Triệt tiêu Cumulative Layout Shift (CLS) trong `DashboardPage.tsx` với 5 metric skeleton cells.
  - Thêm cột đóng băng đầu tiên (`sticky left-0`) cho `DataGrid.tsx` (Rule T7).
  - Tích hợp bảo vệ form nháp (`isDirty`) trên `Modal.tsx` khi bấm Esc/backdrop/close.
  - Thay thế toàn bộ `window.alert()` bằng Confirmation Modals và Action Notifications trong `ApprovalPage.tsx` và `MealOrdersPage.tsx`.
- **Phase P5: Test Harness & Anti-Tautology Verification**:
  - 16/16 test files passed, 87/87 tests passed (0 failed, 0 skipped).
  - Khử bỏ mock rởm, tuân thủ nghiêm ngặt Rules TA-1 đến TA-5.
- **Phase P6: 11-Gate Verification Pipeline (`npm run verify`)**:
  - 100% 11 gates PASS GREEN (1.311 BE tests + 87 FE tests, 0 lint errors, 0 depcruise violations, 0 build errors).

---

### Sprint 1.2: Hardened Governance & Performance Optimization [COMPLETED]
1. **Rule D6 Typography Floor Enforcement**:
   - `WeeklyScheduleView.tsx`: `text-[11px]` -> `text-xs font-mono`.
   - `DashboardPage.tsx`: `text-[11px]` -> `text-xs`.
   - `LoginPage.tsx`: `text-[11px]` -> `text-xs`.
   - `AppShell.tsx`: `text-[11px]` -> `text-xs font-mono`.
   - `badge.tsx`: size `sm` nâng lên `text-xs`.
   - `identifier-text.tsx`: icon/tooltip copy nâng lên `text-xs`.
   - `tabs.tsx`: tab size `sm` và badge đếm nâng lên `text-xs`.
   - Quét kiểm tra tĩnh: `rg "text-\[1[01]px\]|text-\[9px\]|text-\[8px\]" frontend/src/` đạt **0 kết quả**.

2. **Rule D7 Single Primary Action on `/approvals`**:
   - `ApprovalPage.tsx`: Chuyển nút `Phê duyệt hồ sơ` ở cột chi tiết sang `variant="outline"`, duy trì duy nhất 1 nút Primary `Phê duyệt yêu cầu đang chọn` ở `WorkspaceHeader`.

3. **NFR-UI-05 Motion & Reduced Motion**:
   - `index.css`: Bổ sung `@media (prefers-reduced-motion: reduce)` tắt toàn bộ animation/transition khi người dùng kích hoạt reduced motion trên OS.
   - `AppShell.tsx`: Chuẩn hóa thời gian thu gọn/mở rộng sidebar sang `duration-150 ease-out`.

4. **NFR-PERF-01 Bundle Splitting & Lazy Loading**:
   - `App.tsx`: Chuyển đổi 12 routes vận hành sang `React.lazy()` bọc trong `<Suspense fallback={<WorkbenchLoadingFallback />}>`.
   - Tách bundle thành các chunk chuyên biệt: `WeeklyMenuPage`, `PurchasingPage`, `WarehousePage`, `ApprovalPage`...

5. **Test Hygiene & Cleanliness**:
   - `setup.ts`: Thiết lập `window.alert = vi.fn()` loại bỏ 100% thông báo `Not implemented: Window's alert() method`.

6. **Kết quả Verification 11 Cổng Kiểm tra (`npm run verify`)**:
   - `test:ignore-policy`: 2/2 PASS
   - `test:frontend-test-taxonomy`: 1/1 PASS
   - `test:frontend-unit-launcher`: 2/2 PASS
   - `test:architecture-growth`: 6/6 PASS
   - `check:architecture-growth`: PASS (0 debt)
   - `build:be`: PASS (C# .NET 9 Web API)
   - `test:be:ci`: 1.360/1.360 PASS (49 App Tests + 1.311 API Tests)
   - `lint:fe`: 0 errors, 0 warnings
   - `depcruise:fe`: 0 violations across 63 modules
   - `build:fe`: PASS (Production build không cảnh báo chunk)
   - `test:fe:unit`: 16/16 test files PASS (87/87 tests passed, 0 warnings)

4. **Bộ Test Chuẩn Hóa & Kết Quả Verification**:
   - 16 test files (87 tests) bao phủ DOM behavioral tests, mock tại network boundary với DTO backend C#, không tautological.
   - `test:fe:unit`: 16/16 files passed, 87/87 tests passed (0 failed, 0 skipped).
   - `test:be:ci`: 1311/1311 tests passed (0 failed, 0 skipped).
   - `npm run verify`: 100% PASS GREEN trên toàn bộ 11 cổng kiểm tra.
