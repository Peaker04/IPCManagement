# Active work

Status: IDLE (Sprint 1.2 Complete: Hardened Governance, Rule D6/D7 Enforced, NFR-UI-05 Reduced Motion, Route Code Splitting — 100% Verified)

### Summary of System Delivery
Toàn bộ hệ thống quản lý bếp ăn công nghiệp IPCManagement đã hoàn tất khóa sổ toàn diện trên nhánh `feature/greenfield-fe-3zone-workbench`:
- **Đặc tả & Kiểm toán Kỹ thuật**: `docs/SPEC-HARDENED-GOVERNANCE.md` và `docs/superpowers/plans/2026-10-15-hardened-governance-plan.md`.
- **Khóa Sàn Typography (Rule D6)**: Xóa sổ 100% các class `text-[11px]` và `text-[10px]` trên toàn bộ 9 vị trí giao diện; toàn bộ text >= `12px` (`text-xs`).
- **Chuẩn hóa Single Primary Action (Rule D7)**: Trang `/approvals` chỉ giữ duy nhất 1 nút Primary màu đậm (`bg-slate-900`) trên `WorkspaceHeader`; nút trong detail panel chuyển sang `variant="outline"`.
- **Trợ năng Chuyển động (NFR-UI-05)**: Tích hợp `@media (prefers-reduced-motion: reduce)` trong `index.css`; toàn bộ transition chuyển động chuẩn hóa thời lượng <= `150ms`.
- **Tối ưu hóa Hiệu năng & Bundle (NFR-PERF-01)**: Áp dụng `React.lazy()` và `<Suspense>` cho 12 routes vận hành; hạ kích thước entry bundle từ `540.85 kB` xuống `288.26 kB` (gzip: `92.05 kB`), loại bỏ hoàn toàn cảnh báo Vite chunk warning.
- **Log Kiểm thử Sạch sẽ (Test Hygiene)**: Mock `window.alert` trong `src/test/setup.ts`, triệt tiêu 100% cảnh báo JSDOM trong khi 16/16 test files pass 87/87 tests.
- **Toàn vẹn Dữ liệu Backend (Rule TA-5)**: 100% kết nối ASP.NET Core Kestrel thật, 0 dữ liệu mock giả.

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
