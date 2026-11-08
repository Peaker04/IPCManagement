# ĐẶC TẢ KỸ THUẬT & QUẢN TRỊ KIẾN TRÚC TOÀN DIỆN (HARDENED SPECIFICATION)
## DỰ ÁN: IPCMANAGEMENT — HỆ THỐNG ĐIỀU HÀNH BẾP ĂN CÔNG NGHIỆP v3.0
**Mã tài liệu**: `SPEC-HARDENED-GOVERNANCE-v3.2`  
**Đường dẫn lưu trữ**: `docs/SPEC-HARDENED-GOVERNANCE.md`  
**Nhánh áp dụng**: `feature/greenfield-fe-3zone-workbench`  
**Cơ sở thẩm quyền**: Kết quả kiểm toán sâu từ `test-audit` · `ipc-test-audit` · `impeccable` · `taste` · `ipc-ui-review`  
**Tiêu chuẩn bắt buộc**: `AGENTS.md` (5-Layer Governance) · `docs/DOMAIN.md` · `docs/DESIGN.md` · `docs/ENGINEERING.md`

---

## 1. MỤC TIÊU & TẦM NHÌN KIẾN TRÚC (ARCHITECTURAL VISION)

Hệ thống Frontend IPCManagement được xây dựng và hoàn thiện theo chuẩn mực **3-Zone Flat Workbench** không nợ kỹ thuật, loại bỏ 100% "AI-slop", card lồng card và dữ liệu giả lập. Bản đặc tả này đóng vai trò là hợp đồng kỹ thuật tối thượng, chuẩn hóa toàn diện 6 khía cạnh:
1. **Chức năng (FR-AUTH đến FR-SYS)**: 14 Routes ánh xạ 1:1 với 12 Phân hệ Backend C#.
2. **Phi chức năng (NFR)**: Bảo mật phân quyền 3 lớp (`NFR-SEC-01`), Microcopy & Định dạng chuẩn Việt Nam (`NFR-I18N-01`), Toàn vẹn giao dịch (`NFR-REL-01`).
3. **Hiệu năng (Performance)**: Phân tách gói bundle (`React.lazy`), triệt tiêu Race Condition (`AbortController`), ổn định hình học (`tabular-nums`, CLS <= 0.1).
4. **Chuyển động (Motion — `NFR-UI-05`)**: Thời gian chuyển động <= 150ms, bắt buộc hỗ trợ `@media (prefers-reduced-motion: reduce)`.
5. **Trợ năng & Đồ họa (A11y & Craft Floor)**: Khóa sàn Typography >= 12px (`Rule D6`), chuẩn hóa 1 nút Primary duy nhất mỗi view (`Rule D7`), tương phản >= 4.5:1.
6. **Kiểm thử (Test Integrity — `Rule TA-1` đến `TA-5`)**: Fixture bám sát C# DTO, kiểm tra ranh giới mạng thật, log kiểm thử sạch 100%.

---

## 2. MA TRẬN YÊU CẦU CHỨC NĂNG (13 FRs <-> 14 ROUTES)

| Mã FR | Route & Feature Frontend | Endpoint C# Backend thật | Primary Work Object & Giao dịch Nghiệp vụ |
|---|---|---|---|
| `FR-AUTH` | `/login`, `/forbidden`<br>(`features/auth/`) | `POST /api/auth/login`<br>`GET /api/auth/profile` | Xác thực 6 tài khoản MySQL thật: `admin`, `quanly`, `dieuphoi`, `beptruong`, `thukho`, `thumua` (Mật khẩu: `Admin@123456`). Điều hướng 401 về Login, 403 về Forbidden. |
| `FR-DASH` | `/`<br>(`features/dashboard/`) | `GET /api/workflow-reports/operational-kpis`<br>`GET /api/production-plans/filter` | `WorkspaceHeader` (56px) + 5 ô KPI phẳng 56px + `SplitView` (Danh sách việc cần làm bên trái, Stepper 4 công đoạn ca nấu bên phải). |
| `FR-CAT` | `/admin-data`<br>(`features/admin/`) | `GET /api/ingredients`<br>`GET /api/dishes`<br>`POST /api/ingredients` | `DataGrid`: Quản lý danh mục 20 nguyên liệu và 20 món ăn tiêu chuẩn HACCP từ database; modal thêm nguyên liệu mới có kiểm tra trùng mã. |
| `FR-ADMIN`| `/settings/approval-rules`<br>`/settings/advanced`<br>(`features/admin/`) | `GET/POST /api/approval-rules`<br>`GET/PUT /api/system-operation-mode` | Ma trận quy tắc duyệt tự động theo giá trị và SLA; bảng chuyển đổi chế độ vận hành `DEFAULT` vs `MRX` (`DOM-MODE-1`). |
| `FR-MENU` | `/weekly-menu`<br>(`features/weekly-menu/`) | `GET /api/coordination/customers`<br>`GET /api/coordination/weekly-menu`<br>`GET /api/production-plans/filter`<br>`GET /api/dishes/{id}/bom`<br>`POST /api/material-demand/generate` | Cây điều hướng Sidebar v2 (`Rule N6`) gồm 4 views con:<br>1. `schedule`: Ma trận món mặn/chay 6 ngày, xóa chữ rác `Suất: 25k BOM: Đạt chuẩn`.<br>2. `demand`: DataGrid 6 cột, tabs chuyển bảng chính thay `<details>`, nút tính lại nhu cầu.<br>3. `production-plan`: Lệnh KHSX ca nấu, format ngày `dd/MM/yyyy`.<br>4. `cost`: Bảng trái hiển thị món ngày chọn; Bảng phải Tab 1 gộp BOM theo `ingredientId` duy nhất + đủ 5 cột gồm Đơn giá; Tab 2 tính tổng nguyên liệu ngày.<br>**Header Primary đổi linh hoạt theo view con (`Rule D7`)**. |
| `FR-COORD`| `/meal-orders`<br>(`features/coordination/`) | `GET /api/coordination/orders`<br>`POST /api/coordination/orders/lock`<br>`PATCH /api/coordination/orders/{id}/servings` | `DataGrid`: Tabs chọn ca nấu, pills lệch suất, modal điều chỉnh số lượng suất ăn sau chốt bắt buộc nhập lý do (`BR-GLOBAL-03`). |
| `FR-CHEF` | `/chef`<br>(`features/chef/`) | `GET /api/production-plans/filter`<br>`POST /api/production-plans/daily/send-to-kitchen` | `DataGrid`: KHSX ca ngày, checklist nhận vật tư có Checkbox tương tác thực tế, bảng ghi nhận trả hàng thừa, modal xác nhận hoàn tất ca. |
| `FR-APPR` | `/approvals`<br>(`features/approvals/`) | `GET /api/approvals/inbox`<br>`POST /api/approvals/{targetType}/{id}` | `SplitView`: Thẩm định 16 hồ sơ chờ duyệt thật; hiển thị thời gian `dd/MM/yyyy HH:mm`; từ chối bắt buộc nhập lý do; **Duy nhất 1 nút Primary trên Header (`Rule D7`)**. |
| `FR-PUR`  | `/purchasing`<br>(`features/purchasing/`) | `GET /api/purchase-orders`<br>`GET /api/suppliers`<br>`POST /api/purchase-orders` | `SplitView`: 35 nhà cung cấp thật, 8 đơn PO thật, độ rộng cột an toàn `min-w-[210px]`, tiền tệ VND làm tròn số nguyên, empty state khi PO chưa có dòng chi tiết. |
| `FR-WH`   | `/warehouse`<br>(`features/warehouse/`) | `GET /api/warehouses`<br>`GET /api/inventory-receipts`<br>`GET /api/inventory-issues`<br>`POST /api/inventory-issues` | `DataGrid`: 7 kho thật, 20 phiếu nhập nghiệm thu từ PO, phiếu xuất bàn giao bếp, thẻ kho đối soát tồn cuối ngày. Modal xuất kho bắt buộc căn cứ xuất. |
| `FR-RECON`| `/reconciliation`<br>(`features/reconciliation/`) | `GET /api/reconciliation/batches`<br>`POST /api/reconciliation/batches/{id}/complete` | `DataGrid`: Bảng đối chiếu sai lệch ca 9 cột (Định mức, Xuất thực tế, Bếp dùng, Sai lệch, Hao hụt %); modal chốt sổ bắt buộc ghi chú đối soát. |
| `FR-REP`  | `/reports`<br>(`features/reports/`) | `GET /api/workflow-reports/current-stock`<br>`GET /api/workflow-reports/receipt-price-variance`<br>`GET /api/workflow-reports/ingredient-demand` | `DataGrid`: Báo cáo 100 dòng tồn kho thật, 100 dòng biến động giá mua thực tế so với kế hoạch, phân tích Food Cost %. |
| `FR-SYS`  | `/settings/advanced`<br>(`features/system-operation/`) | `GET/PUT /api/system-operation-mode` | `SplitView`: Phân lập tuyệt đối giữa chế độ `DEFAULT` và `MATERIAL_RECONCILIATION` (`DOM-MODE-1`), công cụ xóa cache phiên làm việc. |

---

## 3. ĐẶC TẢ CHI TIẾT CÁC QUY TẮC SỬA LỖI & CHUẨN HÓA

### 3.1. Khóa Sàn Typography `Rule D6` (Font Floor >= 12px)
- **Quy tắc bắt buộc**: Không một phần tử nào trên toàn bộ giao diện sản phẩm được phép có kích thước chữ nhỏ hơn `12px` (`text-xs`).
- **Danh mục 9 điểm sửa đổi bắt buộc**:
  1. `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx:64`: Thay `text-[11px]` bằng `text-xs font-mono`.
  2. `frontend/src/features/dashboard/DashboardPage.tsx:120`: Thay `text-[11px]` bằng `text-xs font-mono`.
  3. `frontend/src/features/dashboard/DashboardPage.tsx:229`: Thay `text-[11px]` bằng `text-xs`.
  4. `frontend/src/features/auth/LoginPage.tsx:134`: Thay `text-[11px]` bằng `text-xs`.
  5. `frontend/src/components/workbench/AppShell.tsx:273`: Thay `text-[11px]` bằng `text-xs font-mono`.
  6. `frontend/src/components/ui/badge.tsx:21`: Cỡ `sm` nâng từ `text-[11px]` lên `text-xs px-2 py-0.5`.
  7. `frontend/src/components/ui/identifier-text.tsx:50`: Nút sao chép nâng từ `text-[10px]` lên `text-xs`.
  8. `frontend/src/components/ui/tabs.tsx:67`: Tab size `sm` nâng từ `text-[11px]` lên `text-xs`.
  9. `frontend/src/components/ui/tabs.tsx:78`: Badge đếm trên tab nâng từ `text-[10px]` lên `text-xs`.

---

### 3.2. Chuẩn hóa Single Primary Action `Rule D7` (Duy nhất 1 Nút Primary màu đậm)
- **Quy tắc bắt buộc**: Mỗi màn hình/view con chỉ tồn tại duy nhất 1 nút Primary màu đậm (`variant="default"` với `bg-slate-900 text-white`), ưu tiên đặt tại `WorkspaceHeader`. Mọi nút thao tác khác trong cùng một khung nhìn bắt buộc phải là `variant="outline"` hoặc `variant="secondary"`.
- **Khắc phục vi phạm tại `ApprovalPage.tsx`**:
  - Giữ nút tại `WorkspaceHeader` (dòng 206) làm Primary duy nhất: `[Phê duyệt yêu cầu đang chọn]` (`variant="default"`).
  - Đổi nút trong Panel chi tiết bên phải (dòng 358) từ `variant="default"` thành `variant="outline"`:
    ```tsx
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleDecision('APPROVE')}
      className="font-semibold text-xs border-slate-300 hover:bg-slate-100"
    >
      Phê duyệt hồ sơ
    </Button>
    ```

---

### 3.3. Đặc tả Chuyển động & Trợ năng Chuyển động (`NFR-UI-05` & `impeccable`)
- **Quy tắc 1 (Prefers Reduced Motion)**: Bổ sung bắt buộc vào `frontend/src/styles/index.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *,
    ::before,
    ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- **Quy tắc 2 (Motion Duration Floor)**: Mọi hiệu ứng chuyển động trong hệ thống có thời lượng tối đa `150ms`.
  - Trong `frontend/src/components/workbench/AppShell.tsx:107`: Sửa `transition-all duration-200` thành `transition-all duration-150 ease-out`.
  - Icon mũi tên accordion trong sidebar: `transition-transform duration-150 ease-out`.

---

### 3.4. Đặc tả Hiệu năng & Tải gói Bundle (`NFR-PERF-01`, `F1–F6`)
- **Quy tắc 1 (Route-level Code Splitting)**:
  - Trong `frontend/src/App.tsx`, thay thế các import tĩnh của 12 routes vận hành bằng `React.lazy()`:
    ```tsx
    const DashboardPage = React.lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
    const WeeklyMenuPage = React.lazy(() => import('./features/weekly-menu/WeeklyMenuPage').then(m => ({ default: m.WeeklyMenuPage })));
    // ... áp dụng cho toàn bộ 12 routes
    ```
  - Bọc cấu trúc routes trong `<React.Suspense fallback={<WorkbenchLoadingFallback />}>` để hiển thị khung xương skeleton chuẩn ERP trong thời gian tải chunk, hạ kích thước entry bundle xuống dưới **250 kB**.
- **Quy tắc 2 (Request Cancellation & Race Condition Guard)**:
  - Cập nhật hàm `apiClient` trong `src/api/client.ts` để nhận tham số tùy chọn `signal?: AbortSignal`.
  - Truyền `signal` vào lệnh `fetch(url, { ...options, signal, headers })`.

---

### 3.5. Làm sạch Log Kiểm thử (Log Hygiene & `test-audit`)
- **Hiện tượng**: JSDOM in cảnh báo `Not implemented: Window's alert() method` khi chạy các bài test `WeeklyMenu.test.tsx`, `MealOrders.test.tsx`, `Chef.test.tsx`...
- **Khắc phục**: Trong `frontend/src/test/setup.ts`, bổ sung spy toàn cục:
  ```ts
  beforeAll(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });
  ```

---

## 4. TIÊU CHÍ NGHIỆM THU ĐẠT CHUẨN HOÀN TOÀN (ACCEPTANCE CRITERIA)

- [ ] **AC-1 (Spec Storage)**: Đặc tả kỹ thuật này được lưu trữ chính thức tại `docs/SPEC-HARDENED-GOVERNANCE.md`.
- [ ] **AC-2 (Rule D6 Zero Violation)**: Lệnh `rg "text-\[1[01]px\]|text-\[9px\]|text-\[8px\]" frontend/src/` trả về **0 kết quả**. 100% văn bản có kích thước >= `12px` (`text-xs`).
- [ ] **AC-3 (Rule D7 Single Primary)**: Trang `/approvals` chỉ hiển thị duy nhất 1 nút Primary màu đậm (`bg-slate-900`) trên `WorkspaceHeader`; nút trong detail panel là `variant="outline"`.
- [ ] **AC-4 (NFR-UI-05 Reduced Motion)**: Tệp `frontend/src/styles/index.css` chứa đầy đủ truy vấn `@media (prefers-reduced-motion: reduce)`.
- [ ] **AC-5 (Motion Duration <= 150ms)**: Toàn bộ transition class của Sidebar và UI components đều có thời lượng <= `150ms`.
- [ ] **AC-6 (Code Splitting & Bundle Size)**: `App.tsx` sử dụng `React.lazy()` và `<Suspense>`; Vite build không còn cảnh báo chunk đơn lẻ vượt quá 500 kB.
- [ ] **AC-7 (Clean Test Logs)**: Chạy `npm run test:fe:unit` không xuất hiện bất kỳ dòng cảnh báo `Not implemented: Window's alert() method`.
- [ ] **AC-8 (Zero Fake API Guard)**: Cổng canh gác `ZeroFakeApiAndTestAuditGuard.test.ts` (Rule TA-5) đạt 100% PASS.
- [ ] **AC-9 (Pipeline Verification)**: Lệnh `npm run verify` vượt qua 100% trên toàn bộ 11 cổng kiểm tra (1.360 test Backend, ESLint, depcruise, build, 87 test Frontend).
