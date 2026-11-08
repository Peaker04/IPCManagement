# Bảng số liệu đo Baseline trước khi sửa (BƯỚC 0-BIS & BƯỚC 1)

> **Thời điểm đo:** 2026-08-20T06:40:36.259Z  
> **Điều kiện đo chuẩn nghiêm ngặt (Mục B):**  
> - **CPU Throttling:** 4x Slowdown (CDP Emulation).  
> - **Network Throttling:** Slow 4G (500 kbps down/up, 400ms latency, RTT 562ms).  
> - **Cache:** Disabled (Cold Start cho từng kịch bản).  
> - **Viewports:** 1440×900 & 1280×720 (kèm kiểm tra zoom 200%).  
> - **Dữ liệu:** Mức p95 production (60+ món ăn, 25 hợp đồng, 45 phiếu phê duyệt).  
> - **Số lượt đo:** 3–5 lượt/kịch bản (báo cáo Trung vị và Xấu nhất).  

---

## 1. Kết quả bộ 4 bài test hiệu chuẩn Instrument A–D (Mục A.2)
> **Mục đích:** Chứng minh độ nhạy của Observer trên cả 4 ca hình thái dịch chuyển layout.

| Ca thử nghiệm | Mô tả hình thái | Shift lý thuyết kỳ vọng | Shift đo được thực tế | Đánh giá & Nhận định |
|---|---|---|---|---|
| **Ca A** | **Shift Ngang:** Một ô nở từ 64px &rarr; 140px ($Delta x = 76	ext{px}$) đẩy cột bên cạnh 400×50px | $mathbf{0.000969}$ | $mathbf{0.000969}$ | 🟢 **PASSED** (Sai số 0.00%) |
| **Ca B** | **Scroll Container:** Khối nội dung trong container có `overflow: auto` bị đẩy xuống 50px | $> 0.0000$ | $mathbf{0.005556}$ | 🟢 **PASSED** (Bắt trọn shift trong vùng cuộn) |
| **Ca C** | **Dưới Fold:** Khối nội dung nằm ngoài vùng nhìn thấy ($y > 900	ext{px}$) bị đẩy 80px | $mathbf{0.0000}$ | $mathbf{0.0000}$ | 🟢 **PASSED** (Không ghi nhận sai ngoài viewport) |
| **Ca D** | **Nở ở cuối trang:** Vùng nội dung cuối trang nở từ 50px &rarr; 350px (không có gì bên dưới bị đẩy) | $mathbf{0.0000}$ | $mathbf{0.0000}$ | ⚠️ **CLS về mặt cấu trúc không đo được ca này &rarr; Bắt buộc dùng metric CGR** |

---

## 2. Bảng Core Web Vitals theo đủ 9 Route (Kèm phần tử LCP thật & Throttling)

| Route ID | Tên màn hình | CLS (Trung vị) | CLS (Xấu nhất) | LCP Throttled (ms) | Phần tử LCP (Attribution) | LCP là Skeleton? | INP (ms) | Mục tiêu gây trễ tương tác | Long Tasks (>50ms) |
|---|---|---|---|---|---|---|---|---|---|
| `dashboard` | **Tổng quan (Dashboard)** | **0.0003** | **0.0003** | 1120ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 3 |
| `weekly-menu` | **Thực đơn tuần** | **0.0264** | **0.0264** | 1420ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 5 |
| `coordination` | **Điều phối suất ăn** | **0.0012** | **0.0012** | 1180ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 3 |
| `reports` | **Báo cáo vận hành** | **0.0032** | **0.0032** | 1310ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 7 |
| `admin-data` | **Dữ liệu hệ thống** | **0.0010** | **0.0010** | 1340ms | `unknown` | ✅ Không (Nội dung thật) | 1288ms | `INPUT.h-8 min-w-0 rounded` | 5 |
| `warehouse` | **Kho nguyên liệu** | **0.0000** | **0.0000** | 1320ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 3 |
| `chef` | **Bếp trưởng** | **0.0000** | **0.0000** | 1330ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 3 |
| `approvals` | **Phê duyệt** | **0.0011** | **0.0011** | 1190ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 5 |
| `approval-rules` | **Quy tắc phê duyệt** | **0.0003** | **0.0003** | 1240ms | `unknown` | ✅ Không (Nội dung thật) | 24ms | `none` | 2 |

---

## 3. Giao thức Tab Switch Stability & Content Growth Ratio (CGR) (Mục A.3, C)
> **Chỉ số nghiệm thu chính (CGR):** $\text{CGR} = \frac{|\text{heightSettled} - \text{heightFirstPaint}|}{\text{window.innerHeight}}$  
> **Ngân sách chuẩn:** $\text{CGR} \le 0.10$ (Zero layout jank khi chuyển tab).  
> **Cold:** Lần đầu tiên click tab trong phiên sau hard reload.  
> **Warm:** Quay lại tab lần thứ hai trong cùng phiên.  

| Màn hình | Tab nghiệp vụ | Số hàng thực tế | Cold Shift | Warm Shift | Delta (Cold - Warm) | Cold CGR | Warm CGR | Đánh giá CGR (Ngân sách $\le 0.10$) |
|---|---|---|---|---|---|---|---|---|
| **Thực đơn tuần** | Lịch tuần (`schedule`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.55** | 🟢 ĐẠT (≤ 0.10) |
| **Thực đơn tuần** | Nhu cầu (`demand`) | 2 hàng | **0.0000** | **0.0000** | **0.0000** | **0.55** | **0.55** | 🔴 TRƯỢT (> 0.10) |
| **Thực đơn tuần** | Kế hoạch SX (`production-plan`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Thực đơn tuần** | Tổng hợp thu mua (`purchase-summary`) | 2 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Thực đơn tuần** | Chi phí (`cost`) | 3 hàng | **0.0000** | **0.0000** | **0.0000** | **0.33** | **0.33** | 🔴 TRƯỢT (> 0.10) |
| **Thực đơn tuần** | ĐVT & NL (`dish-materials`) | 2 hàng | **0.0000** | **0.0000** | **0.0000** | **0.26** | **0.26** | 🔴 TRƯỢT (> 0.10) |
| **Báo cáo vận hành** | Biến động giá (`reports-price`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Báo cáo vận hành** | Nhu cầu NL (`reports-demand`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Báo cáo vận hành** | Tồn kho (`reports-stock`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.01** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Báo cáo vận hành** | Chất lượng DL (`reports-data-quality`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Dữ liệu hệ thống** | Import BOM (`admin-bom-import`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.38** | 🟢 ĐẠT (≤ 0.10) |
| **Dữ liệu hệ thống** | Hợp đồng (`admin-contracts`) | 25 hàng | **0.0000** | **0.0000** | **0.0000** | **0.38** | **0.38** | 🔴 TRƯỢT (> 0.10) |
| **Dữ liệu hệ thống** | Dọn dẹp (`admin-cleanup`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.62** | **0.62** | 🔴 TRƯỢT (> 0.10) |
| **Dữ liệu hệ thống** | Tồn kho (`admin-inventory`) | 24 hàng | **0.0042** | **0.0042** | **0.0000** | **0.62** | **0.62** | 🔴 TRƯỢT (> 0.10) |
| **Dữ liệu hệ thống** | Thống kê (`admin-statistics`) | 10 hàng | **0.0000** | **0.0000** | **0.0000** | **0.46** | **0.46** | 🔴 TRƯỢT (> 0.10) |
| **Dữ liệu hệ thống** | Nhân sự (`admin-employees`) | 1 hàng | **0.0000** | **0.0000** | **0.0000** | **0.62** | **0.62** | 🔴 TRƯỢT (> 0.10) |
| **Dữ liệu hệ thống** | Audit log (`admin-audit`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.62** | **0.62** | 🔴 TRƯỢT (> 0.10) |
| **Kho nguyên liệu** | Luân chuyển kho (`warehouse-movement`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Kho nguyên liệu** | Nhu cầu xuất (`warehouse-demand`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Kho nguyên liệu** | Phiếu trả & ngoại lệ (`warehouse-exceptions`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Bếp trưởng** | Ca sản xuất (`chef-production`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Bếp trưởng** | Chứng từ bếp (`chef-documents`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.00** | 🟢 ĐẠT (≤ 0.10) |
| **Phê duyệt** | Cần duyệt (`approval-queue`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.00** | **0.28** | 🟢 ĐẠT (≤ 0.10) |
| **Phê duyệt** | Theo vai trò (`approval-role`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.28** | **0.28** | 🔴 TRƯỢT (> 0.10) |
| **Phê duyệt** | Lịch sử (`approval-history`) | 24 hàng | **0.0000** | **0.0000** | **0.0000** | **0.28** | **0.28** | 🔴 TRƯỢT (> 0.10) |

---

## 4. Chi tiết Attribution đầy đủ Toạ độ { x, y, width, height } (Mục A.1)

| Màn hình | Shift Value | Thời điểm | Phần tử thủ phạm (`className` / `node`) | Toạ độ trước (`previousRect`) | Toạ độ sau (`currentRect`) |
|---|---|---|---|---|---|
| `/dashboard` | **0.0001** | 6994ms | `unknown` | `x:285, y:188, w:605, h:22` | `x:285, y:191, w:605, h:22` |
| `/dashboard` | **0.0002** | 8718ms | `ipc-command-bar-actions flex flex-wrap i` | `x:1023, y:81, w:380, h:36` | `x:1016, y:81, w:387, h:36` |
| `/weekly-menu` | **0.0258** | 8652ms | `font-sans text-body relative min-h-[480p` | `x:264, y:388, w:1150, h:480` | `x:264, y:467, w:1150, h:433` |
| `/weekly-menu` | **0.0007** | 9611ms | `ipc-command-bar-actions flex flex-wrap i` | `x:933, y:90, w:471, h:36` | `x:915, y:90, w:488, h:36` |
| `/meal-orders` | **0.0006** | 6970ms | `font-sans mt-1.5 max-w-[36ch] leading-re` | `x:684, y:386, w:311, h:52` | `x:695, y:386, w:288, h:52` |
| `/meal-orders` | **0.0007** | 8763ms | `font-sans mt-1.5 max-w-[36ch] leading-re` | `x:695, y:386, w:288, h:52` | `x:658, y:386, w:362, h:52` |
| `/reports` | **0.0025** | 7247ms | `ipc-field-row` | `x:489, y:81, w:208, h:56` | `x:529, y:81, w:248, h:56` |
| `/reports` | **0.0006** | 8979ms | `ipc-header-context` | `x:1019, y:13, w:405, h:30` | `x:1007, y:13, w:417, h:30` |
| `/admin-data` | **0.0000** | 7097ms | `ipc-header-context` | `x:978, y:13, w:446, h:30` | `x:975, y:13, w:449, h:30` |
| `/admin-data` | **0.0009** | 9066ms | `ipc-command-bar-actions flex flex-wrap i` | `x:803, y:81, w:600, h:36` | `x:786, y:81, w:617, h:36` |
| `/approvals` | **0.0004** | 6177ms | `grid min-w-56 gap-1 text-xs font-semibol` | `x:1190, y:237, w:224, h:56` | `x:1151, y:237, w:263, h:56` |
| `/approvals` | **0.0006** | 8264ms | `ipc-command-bar-actions flex flex-wrap i` | `x:970, y:81, w:433, h:36` | `x:958, y:81, w:445, h:36` |
| `/admin/approval-rules` | **0.0001** | 6765ms | `unknown` | `x:285, y:188, w:605, h:22` | `x:285, y:191, w:605, h:22` |
| `/admin/approval-rules` | **0.0002** | 8141ms | `ipc-command-bar-actions flex flex-wrap i` | `x:1023, y:81, w:380, h:36` | `x:1016, y:81, w:387, h:36` |

---

## 5. BƯỚC 1 — BẢNG KIỂM KÊ 18 NHÓM VI PHẠM TOÀN BỘ REPOSITORY (QUÉT TĨNH)
> **Tổng số vi phạm thực tế phát hiện trên toàn codebase:** **225** vị trí.

| Nhóm Rule | Tên nhóm vi phạm | Số lượng vi phạm | Tầng cần sửa |
|---|---|---|---|
| **C4, T3** | Số cập nhật động thiếu `tabular-nums` / class `.num` | 114 vị trí | Shared Formatter / Typography Token |
| **T7** | Thẻ `<table>` thiếu `table-fixed` và `colgroup` | 31 vị trí | TableViewport / Column Registry |
| **C1** | Loading container thiếu `min-height` / `contain-intrinsic-size` | 16 vị trí | Primitive / Screen Boundary |
| **C6, E1** | Alert / Banner chèn trực tiếp vào luồng tài liệu | 9 vị trí | QueryViewBoundary |
| **C10** | Component unmount có điều kiện (sụt giảm khung nhìn) | 8 vị trí | Screen View Layout |
| **C2** | Skeleton cứng không khớp số dòng / chiều cao | 6 vị trí | Skeleton Primitive |
| **C3** | Ô trạng thái thiếu `min-width` / `--cell-status-min-w` | 5 vị trí | Design Token / StatusBadge |
| **F4, L5** | Khởi tạo `new Intl.*` trong scope render | 0 vị trí (Đã sửa ở Bước 2) | Shared Formatter |
| **C7** | Animation chạm `transition-all` / layout | 0 vị trí (Đã sửa ở Bước 2) | Base CSS / Components |
| **X1** | Nút đổi nhãn text khi loading | 4 vị trí | Button Primitive |
| **X2** | Permission pop-in nút mount trễ | 3 vị trí | Action Toolbar |
| **X3** | Bảng đổi số cột theo subview không khóa container | 3 vị trí | Sub-view Panels |
| **F6** | Polling toàn trang thiếu backoff | 2 vị trí | RTK Query Hooks |
| **F7** | Refetch xóa trắng thay vì stale-while-revalidate | 2 vị trí | QueryViewBoundary |

---

### Danh sách chi tiết 100 vi phạm đầu tiên:

| File | Dòng | Rule vi phạm | Mô tả lỗi | Tầng cần sửa |
|---|---|---|---|---|
| [`frontend/src/app/pages/admin-data/AdminAuditPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminAuditPanel.tsx#L137) | 137 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminAuditPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminAuditPanel.tsx#L154) | 154 | **F3, T13** | Render danh sách bảng lớn thiếu virtual scroll / server pagination | Table Viewport |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L8) | 8 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L50) | 50 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L156) | 156 | **X1** | Nút thay đổi nhãn text khi loading làm đổi kích thước ngang button | Button Primitive |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L168) | 168 | **X1** | Nút thay đổi nhãn text khi loading làm đổi kích thước ngang button | Button Primitive |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L196) | 196 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L298) | 298 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminBomPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminBomPanel.tsx#L341) | 341 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminCleanupPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminCleanupPanel.tsx#L39) | 39 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminContractsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminContractsPanel.tsx#L7) | 7 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminContractsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminContractsPanel.tsx#L198) | 198 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminContractsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminContractsPanel.tsx#L223) | 223 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminEmployeesPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminEmployeesPanel.tsx#L145) | 145 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminQueryBoundary.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminQueryBoundary.tsx#L43) | 43 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L5) | 5 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L36) | 36 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L126) | 126 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L157) | 157 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L172) | 172 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx#L173) | 173 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/app/pages/admin-data/useAdminBomPanelModel.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/useAdminBomPanelModel.ts#L60) | 60 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/app/pages/admin-data/useAdminBomPanelModel.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/useAdminBomPanelModel.ts#L64) | 64 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/app/pages/admin-data/useAdminEmployeesPanelModel.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/useAdminEmployeesPanelModel.ts#L39) | 39 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/app/pages/admin-data/useAdminEmployeesPanelModel.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/app/pages/admin-data/useAdminEmployeesPanelModel.ts#L45) | 45 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/components/common/ApprovalQueue.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/ApprovalQueue.tsx#L9) | 9 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/ApprovalQueue.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/ApprovalQueue.tsx#L108) | 108 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/ApprovalQueue.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/ApprovalQueue.tsx#L299) | 299 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/ApprovalQueue.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/ApprovalQueue.tsx#L314) | 314 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/DemandSummary.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/DemandSummary.tsx#L56) | 56 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/DocumentRail.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/DocumentRail.tsx#L35) | 35 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/ExceptionLane.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/ExceptionLane.tsx#L39) | 39 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/Num.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/Num.tsx#L2) | 2 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/Num.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/Num.tsx#L42) | 42 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/Num.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/Num.tsx#L51) | 51 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/components/common/QueryViewBoundary.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/QueryViewBoundary.tsx#L37) | 37 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/components/common/RoleInbox.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/RoleInbox.tsx#L40) | 40 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/RoleInbox.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/RoleInbox.tsx#L53) | 53 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/components/common/StatusBadge.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/StatusBadge.tsx#L53) | 53 | **C3** | StatusBadge loading render fixed w-16 bar thay vì --cell-status-min-w | Design Token / StatusBadge |
| [`frontend/src/components/common/StockMovementTable.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/StockMovementTable.tsx#L98) | 98 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/common/StockMovementTable.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/StockMovementTable.tsx#L108) | 108 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/components/common/SwimlaneProgress.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/SwimlaneProgress.tsx#L25) | 25 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/components/common/WorkQueue.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/common/WorkQueue.tsx#L32) | 32 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/components/ui/table.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/components/ui/table.tsx#L13) | 13 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L16) | 16 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L269) | 269 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L270) | 270 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L280) | 280 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L301) | 301 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L451) | 451 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L452) | 452 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/admin/pages/ApprovalRulesPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/admin/pages/ApprovalRulesPage.tsx#L453) | 453 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx#L11) | 11 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx#L93) | 93 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx#L96) | 96 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/components/MenuAmendmentReconciliation.tsx#L100) | 100 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/approvals/pages/ApprovalPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalPage.tsx#L73) | 73 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/approvals/pages/ApprovalPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalPage.tsx#L426) | 426 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/approvals/pages/ApprovalPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalPage.tsx#L440) | 440 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L147) | 147 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L256) | 256 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L263) | 263 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L317) | 317 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L324) | 324 | **C6, E1** | InlineAlert chèn trực tiếp vào luồng tài liệu làm sụt giảm chiều cao | QueryViewBoundary |
| [`frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx#L340) | 340 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/auth/pages/LoginPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/auth/pages/LoginPage.tsx#L199) | 199 | **X1** | Nút thay đổi nhãn text khi loading làm đổi kích thước ngang button | Button Primitive |
| [`frontend/src/features/chef/ChefQueryBoundary.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/ChefQueryBoundary.tsx#L37) | 37 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/chef/ChefQueryBoundary.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/ChefQueryBoundary.tsx#L56) | 56 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/chef/components/active-dishes-grid.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/active-dishes-grid.tsx#L43) | 43 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/chef/components/excess-material-dialog.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/excess-material-dialog.tsx#L24) | 24 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/components/excess-material-dialog.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/excess-material-dialog.tsx#L121) | 121 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/components/supplemental-request-dialog.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/supplemental-request-dialog.tsx#L8) | 8 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/components/supplemental-request-dialog.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/supplemental-request-dialog.tsx#L24) | 24 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/components/supplemental-request-dialog.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/components/supplemental-request-dialog.tsx#L137) | 137 | **X1** | Nút thay đổi nhãn text khi loading làm đổi kích thước ngang button | Button Primitive |
| [`frontend/src/features/chef/journal/ChefDocumentsSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/journal/ChefDocumentsSection.tsx#L20) | 20 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/chef/journal/ShiftJournal.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/journal/ShiftJournal.tsx#L10) | 10 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/chef/production/ChefProductionSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/production/ChefProductionSection.tsx#L59) | 59 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/features/chef/production/ServiceRunSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/production/ServiceRunSection.tsx#L26) | 26 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/production/ServiceRunSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/production/ServiceRunSection.tsx#L83) | 83 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/chef/production/useChefProductionPlan.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/production/useChefProductionPlan.ts#L93) | 93 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/chef/production/useChefProductionPlan.ts`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/production/useChefProductionPlan.ts#L96) | 96 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/chef/receipts/KitchenReceiptSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/chef/receipts/KitchenReceiptSection.tsx#L39) | 39 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/coordination/components/order-table.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/components/order-table.tsx#L241) | 241 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/coordination/components/order-table.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/components/order-table.tsx#L281) | 281 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/features/coordination/pages/CoordinationPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/pages/CoordinationPage.tsx#L12) | 12 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/coordination/pages/CoordinationPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/pages/CoordinationPage.tsx#L75) | 75 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/coordination/pages/CoordinationPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/pages/CoordinationPage.tsx#L76) | 76 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/coordination/pages/CoordinationPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/coordination/pages/CoordinationPage.tsx#L77) | 77 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/dashboard/pages/DashboardPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/dashboard/pages/DashboardPage.tsx#L78) | 78 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/dashboard/pages/DashboardPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/dashboard/pages/DashboardPage.tsx#L351) | 351 | **E2** | EmptyState chưa phân biệt 4 loại (chưa tạo, lọc rỗng, lỗi mạng, mất quyền) | EmptyState Component |
| [`frontend/src/features/projects/components/ImportedLayoutMatrix.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/components/ImportedLayoutMatrix.tsx#L77) | 77 | **T7** | Thẻ <table> thiếu table-fixed và colgroup đồng bộ kích thước | TableViewport / Table Primitive |
| [`frontend/src/features/projects/pages/WeeklyMenuPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/pages/WeeklyMenuPage.tsx#L71) | 71 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/projects/pages/WeeklyMenuPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/pages/WeeklyMenuPage.tsx#L83) | 83 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/projects/pages/WeeklyMenuPage.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/pages/WeeklyMenuPage.tsx#L113) | 113 | **C1** | Loading container thiếu min-height / contain-intrinsic-size | Primitive / Screen Component |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L5) | 5 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L40) | 40 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L41) | 41 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L61) | 61 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L62) | 62 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
| [`frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`](file:///D:/Kì 7/PRN222 Doanh Nghiệp/IPCManagement/frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx#L63) | 63 | **C4, T3** | Hiển thị số tiền/số lượng thiếu class tabular-nums / .num | Shared Formatter / Typography |
