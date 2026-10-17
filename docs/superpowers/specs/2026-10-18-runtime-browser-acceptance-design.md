# Runtime Browser Acceptance & End-to-End Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** Phase 4 Runtime Browser Acceptance across 14 Canonical Routes & 23 Workbench Surfaces, 200% Zoom WCAG 2.2 AA Verification, Triple-Layer RBAC Matrix, Operational Mode Switching (`DOM-MODE-1`), and Browser Back/Forward (`popstate`) Dirty Navigation Protection  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

While Phases 1 through 3 completed the 8 vertical capability conformance slices at the code, API mapper, and unit test boundaries (113/113 tests PASS, 28/28 conformance tests PASS), `AGENTS.md` mandates a strict governance invariant:
> **"Không coi unit-green là production readiness" (Unit-green is not production readiness).**

To claim true production readiness, the system requires **Runtime Browser Evidence** verified in an actual browser environment:
1. **Screen Geometry & Layout Shift (CLS <= 0.1):** Proving that the 3-Zone Flat Workbench (`WorkspaceHeader` 56px, `TelemetrySubbar` 44px, `DataGrid` 85% viewport) renders with zero layout shift during async data transitions across all canonical routes.
2. **WCAG 2.2 AA Accessibility & 200% Zoom:** Verifying that scaling the viewport to 200% zoom does not break text containers, truncate Vietnamese diacritics, or trap focus.
3. **Keyboard & Focus Navigation:** Ensuring a full Tab/Shift+Tab focus cycle with visible focus rings (`focus-visible:ring-2`), Enter/Space selection in interactive grids, and Escape dialog dismissal.
4. **Triple-Layer RBAC & Mode Isolation (`DOM-MODE-1`):** Verifying that actors without proper roles are redirected to `/forbidden`, unauthorized route links are filtered out of the sidebar, and mode-specific actions (e.g., MRX completion) are disabled outside `MATERIAL_RECONCILIATION`.
5. **Browser Back/Forward Dirty Navigation:** Intercepting browser `popstate` events in `DirtyNavigation.tsx` so that clicking the browser's Back/Forward buttons does not silently discard unpersisted user drafts.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Các thành phần sẵn có được kiểm chứng trong Runtime Suite:
- `AppShell`: Sidebar v2 với menu accordion và 14 canonical route links.
- `WorkspaceHeader`: Zone 1 56px với title, context selectors, và single primary button policy (`D7`).
- `TelemetrySubbar`: Zone 2 44px với inline telemetry pills và font `tabular-nums`.
- `DataGrid` & `SplitView`: Zone 3 với frozen table header (`T7`) và compact density 36–40px (`T8`).
- `StateBoundary` & `WorkbenchSkeleton`: Xử lý mượt mà 6 trạng thái UI mà không gây giật dịch chuyển layout.
- `DirtyNavigation`: Hộp thoại `alertdialog` xác nhận hủy thay đổi khi có bản nháp chưa lưu.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-AUTH`: Điều hướng 401 về `/login`, 403 về `/forbidden`, kiểm soát phiên JWT.
- `FR-DASH`: Bàn điều hành tổng quan hôm nay, 5 ô chỉ số phẳng.
- `FR-CAT` & `FR-ADMIN`: Danh mục nguyên liệu/món ăn, quy tắc duyệt, phân quyền nhân viên.
- `FR-MENU` & `FR-COORD`: Thực đơn tuần 4 views, điều phối đơn ăn theo ca.
- `FR-PUR` & `FR-APPR`: Thu mua đơn PO, hàng đợi phê duyệt tập trung.
- `FR-WH`: Kho nguyên liệu, phiếu xuất/nhập kho.
- `FR-CHEF`: KHSX ca bếp, phiếu xuất bàn giao.
- `FR-RECON`: Đối soát nguyên liệu MRX, chốt ca bất biến.
- `FR-REP`: Báo cáo nhu cầu, giá nhập, tồn kho.
- `FR-SYS`: Chuyển đổi chế độ vận hành `DEFAULT` vs `MATERIAL_RECONCILIATION` (`DOM-MODE-1`).

### Non-Functional Requirements (NFR-UI)
- `NFR-UI-01`: Table Scalability & Viewport.
- `NFR-UI-02`: Triple-Layer RBAC Defense (Route $\rightarrow$ Navigation $\rightarrow$ Action).
- `NFR-UI-03`: Strict Formatting Primitives (`<Num>`, `<IdentifierText>`, `dd/MM/yyyy`).
- `NFR-UI-04`: Accessibility WCAG 2.2 AA (Tỷ lệ tương phản $\ge 4.5:1$, zoom 200%).
- `NFR-UI-05`: Motion & Zero CLS (Transitions $\le 150ms$, CLS $\le 0.1$).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Layout).
- `UXR-02` (Operational Compact Density).
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`).
- `UXR-05` (Destructive & Terminal Guards).

### Design System & Table Rules
- `D6`: Typography scale $\ge 12px$, hỗ trợ dấu tiếng Việt.
- `D7`: Single Primary button per zone.
- `D8`: Viền hairline 1px `border-slate-200`.
- `T1–T3`: Căn phải số lượng/tiền tệ với font `tabular-nums`.
- `T7`: Frozen header cố định khi cuộn dọc.
- `T8`: Chiều cao dòng chuẩn 36–40px.
- `N6`: URL query leaf views (`?view=...`).
- `M1.2`: Tối đa 1 modal overlay chặn tại một thời điểm.

---

## 4. Technical Ground Truth (Browser Automation Architecture)

### A. Popstate Dirty Navigation Interception (`frontend/src/components/workbench/DirtyNavigation.tsx`)
- **Hiện trạng:** `DirtyNavigation` lắng nghe sự kiện click trên các thẻ `<a>` của `AppShell` và sự kiện `beforeunload` của trình duyệt. Tuy nhiên, khi người dùng bấm nút **Back / Forward** của trình duyệt (`popstate`), lịch sử duyệt web bị thay đổi trực tiếp mà không hiện cảnh báo.
- **Sửa đúng:** Bổ sung listener sự kiện `popstate` trên `window`:
  - Khi có draft đang dirty (`isDirty() === true`): ngăn chặn navigation bằng cách `window.history.pushState(null, '', window.location.href)`, mở modal `DirtyNavigationModal`, và lưu trữ pending navigation destination.
  - Khi người dùng xác nhận "Hủy thay đổi": dọn sạch dirty registry và thực hiện `window.history.back()` hoặc navigate tới trang đích.

### B. Playwright Browser Conformance Suite (`frontend/tests/browser/conformance-runtime.spec.ts`)
Tạo bộ kiểm thử browser chuẩn mực không dùng dữ liệu giả lập trong production code, kiểm tra 5 trụ cột:
1. **Route Navigation Smoke**: Kiểm tra 14 routes canonical tải thành công, hiển thị đúng tiêu đề tiếng Việt trong `WorkspaceHeader`, không văng lỗi console `Uncaught Exception`.
2. **3-Zone Geometry & CLS Verification**: Đo lường chiều cao thực tế của `WorkspaceHeader` ($56px \pm 1px$) và `TelemetrySubbar` ($44px \pm 1px$), kiểm tra DataGrid chiếm trọn chiều cao còn lại.
3. **Zoom 200% Accessibility Audit**: Thiết lập viewport `scale: 2.0` (hoặc zoom 200%), kiểm tra không xuất hiện thanh cuộn ngang ngoài ý muốn trên khung nhìn chính và văn bản tiếng Việt hiển thị đầy đủ.
4. **Triple-Layer RBAC Matrix**:
   - Tài khoản `beptruong` chỉ thấy các menu: Bàn điều hành, Thực đơn tuần, Bếp trưởng.
   - Truy cập trực tiếp vào `/settings/advanced` hoặc `/admin-data` bị chuyển hướng về `/forbidden` (hoặc chặn bởi `RoleGuard`).
5. **Operational Mode Switching (`DOM-MODE-1`)**:
   - Truy cập `/settings/advanced?view=mode` bằng tài khoản Admin.
   - Chuyển chế độ sang `MATERIAL_RECONCILIATION` $\rightarrow$ Điều hướng sang `/reconciliation` $\rightarrow$ Nút "Chốt đối soát ca" được kích hoạt (`enabled`).
   - Chuyển chế độ về `DEFAULT` $\rightarrow$ Điều hướng sang `/reconciliation` $\rightarrow$ Nút "Chốt đối soát ca" bị vô hiệu hóa (`disabled`) kèm thông điệp giải thích.

---

## 5. Verification & Test Audit Strategy

- **Rule TA-1**: Fixture và dữ liệu kiểm thử bám sát 100% C# Backend schema.
- **Rule TA-2**: Test trên cây DOM thật của trình duyệt Chromium qua Playwright.
- **Rule TA-4**: Bao phủ đầy đủ các trạng thái tải, dữ liệu rỗng, điều hướng, và phân quyền.
- **Rule TA-5**: Không dùng dummy fallback trong mã nguồn production.

---

## 6. What is Left to the Builder

The builder (executing agent) will:
1. Update `DirtyNavigation.tsx` to handle `popstate` (Browser Back/Forward button interception) with comprehensive test coverage.
2. Author `frontend/tests/browser/conformance-runtime.spec.ts` covering the 5 runtime browser pillars.
3. Run the complete verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
4. Apply the 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record in `.planning/WORK.md`.
