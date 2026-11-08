# Kế Hoạch Triển Khai: Khóa Cứng Quy Chuẩn Nghiệp Vụ, An Toàn Trạng Thái 5 Tầng & Kiểm Toán Toàn Diện Chế Độ MRX (MRX Exhaustive Hardening & Rules Lock Plan)

> **Dành cho kỹ sư/agent thực thi:** BẮT BUỘC TUÂN THỦ: Sử dụng kỹ năng `test-audit`, `ipc-test-audit` và `executing-plans` để thực thi từng bước trong kế hoạch này. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Khắc phục triệt để và khóa cứng toàn bộ 5 cụm lỗi đã được xác định qua kiểm toán chuyên sâu: sửa lỗi bảo mật tải file 401, sửa lỗi phân lập chế độ và điều hướng DOM-MODE-1, triệt tiêu lỗi chớp nháy bảng rỗng (Flash Empty State) và stale preview token, bảo vệ bất biến đồng thời trong bulk disposition, chuẩn hóa kiểm thử theo Rule TA-1 đến TA-5 của `test-audit`.

**Kiến trúc:** 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`), helper tải file an toàn có token JWT, bộ điều hướng sạch không cướp quyền, bộ nhớ đệm trạng thái 5 tầng Zero-CLS.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright, ASP.NET Core Kestrel.

**Đặc tả kỹ thuật:** `docs/superpowers/specs/2026-10-24-mrx-exhaustive-hardening-and-rules-lock-spec.md`

## Các Ràng Buộc Toàn Cục Khóa Cứng (Global Constraints)

- **Nguyên tắc Cách ly Chế độ (`DOM-MODE-1`):** Tuyệt đối không gọi API của DEFAULT khi ở chế độ `MATERIAL_RECONCILIATION`.
- **Giới hạn số dòng tệp:** Mọi tệp nguồn Frontend bắt buộc duy trì strictly `< 600 dòng` (`check-architecture-growth.mjs`).
- **Bảo toàn Trạm Bếp trưởng:** `/chef?view=mrx-cooking` giữ nguyên là phiếu nấu đông cứng chỉ đọc kèm xuất file an toàn, không có thao tác nhận hàng hay hoàn trả.
- **Thẩm quyền Tạo kiểu Duy nhất:** Toàn bộ CSS thông qua semantic tokens tại `frontend/src/styles/index.css` và Tailwind primitives. Không dùng inline style hay hex colors tự do.
- **Quy chuẩn Kiểm toán Kiểm thử (Rules TA-1 đến TA-5):** Fixture bám sát C# DTO thật 100%, mock ở ranh giới mạng `apiClient`/HTTP, bao phủ đủ 4 kịch bản hành vi.

## Trọng Tâm Rà Soát (Review Focus)

1. **Bảo mật Tải file**: Không còn bất kỳ lệnh `window.open` không xác thực nào; mọi file tải về đều mang header `Authorization: Bearer <token>`.
2. **Flash Empty State**: Khi chuyển tab báo cáo đối soát, người dùng không bao giờ nhìn thấy bảng rỗng xuất hiện trước khi dữ liệu về.
3. **Stale Token**: Khi đổi tuần hoặc khách hàng trong `MrxBatchWorkbench`, nút "Tạo lô nháp" bị vô hiệu hóa cho đến khi người dùng chạy kiểm tra định lượng mới.
4. **Bulk Concurrency Safety**: Thử lại giải trình hàng loạt sau khi gặp lỗi không bao giờ bị văng 409 conflict ở các dòng đã thành công trước đó.
5. **Điều hướng Chuẩn**: Vào `/weekly-menu` ở mode MRX tự động redirect sang `?view=mrx-batch`; vào `/warehouse?view=mrx-daily&date=...` không bị cướp quyền sang trạm chuẩn bị.

---

### Nhiệm Vụ 1: Xây Dựng Helper Tải File Xác Thực Token & Loại Bỏ Hoàn Toàn 401 (`RULE-MRX-SEC-01`)

**Tệp tin:**
- Tạo mới: `frontend/src/utils/fileDownload.ts`
- Chỉnh sửa: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Chỉnh sửa: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Chỉnh sửa: `frontend/src/features/chef/MrxCookingWorkbench.tsx`

- [ ] **Bước 1.1**: Tạo tệp `frontend/src/utils/fileDownload.ts` chứa hàm `downloadAuthenticatedFile(url: string, filename: string): Promise<void>`.
  - Lấy JWT token từ `localStorage.getItem('ipc_v3_token')`.
  - Thực hiện gọi `fetch(url, { headers: { Authorization: \`Bearer \${token}\` } })`.
  - Bắt lỗi khi `!res.ok`, ném Error có mô tả mã lỗi HTTP.
  - Tạo `Blob`, kích hoạt tải file ngầm bằng `<a download>`, thu hồi object URL an toàn.
- [ ] **Bước 1.2**: Trong `ReconciliationReportTables.tsx`, thay thế toàn bộ 4 vị trí gọi `window.open(...)` bằng `downloadAuthenticatedFile(...)`:
  - `Sổ theo dõi chênh lệch` $\rightarrow$ `downloadAuthenticatedFile(\`/api/reconciliation/reports/variance-register/csv?batchId=\${batchId}\`, \`so-chenh-lech-\${batchId.slice(0, 8)}.csv\`)`.
  - `Lịch sử giao dịch kho` $\rightarrow$ `downloadAuthenticatedFile(\`/api/reconciliation/reports/transactions-history/csv?batchId=\${batchId}\`, \`lich-su-kho-\${batchId.slice(0, 8)}.csv\`)`.
  - `Nhật ký kiểm toán` $\rightarrow$ `downloadAuthenticatedFile(\`/api/reconciliation/reports/audit-trail/csv?batchId=\${batchId}\`, \`audit-trail-\${batchId.slice(0, 8)}.csv\`)`.
  - `Danh bạ hoàn tất` $\rightarrow$ `downloadAuthenticatedFile('/api/reconciliation/reports/completed-register/csv', 'danh-ba-hoan-tat.csv')`.
- [ ] **Bước 1.3**: Trong `MrxMultiCustomerPreparationWorkbench.tsx`, thay thế `window.open(url, '_blank')` tại nút "Xuất Excel chuẩn bị" bằng `downloadAuthenticatedFile`.
- [ ] **Bước 1.4**: Trong `MrxCookingWorkbench.tsx`, cập nhật nút "Tải CSV" và "Tải Excel" sử dụng `downloadAuthenticatedFile`.
- [ ] **Bước 1.5**: Kiểm tra build, lint, và xác nhận không còn bất kỳ lệnh `window.open` nội bộ nào.

---

### Nhiệm Vụ 2: Khắc Phục Lỗi Điều Hướng & Cách Ly Chế Độ Vận Hành DOM-MODE-1 (`RULE-MRX-NAV-01`)

**Tệp tin:**
- Chỉnh sửa: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`
- Chỉnh sửa: `frontend/src/features/warehouse/WarehousePage.tsx`

- [ ] **Bước 2.1**: Trong `WeeklyMenuPage.tsx`:
  - Bổ sung kiểm tra `operationalMode === 'MATERIAL_RECONCILIATION'`.
  - Nếu đang ở chế độ MRX và tham số `view !== 'mrx-batch'`, tự động thực hiện:
    `<Navigate to="/weekly-menu?view=mrx-batch" replace />`.
  - Ngăn chặn hoàn toàn việc mount `DefaultWeeklyMenuPage` và gọi các API DEFAULT khi ở mode MRX.
- [ ] **Bước 2.2**: Trong `WarehousePage.tsx`:
  - Sửa nhánh điều hướng tại dòng 35–43:
    Khi `view === 'mrx-daily'`, **LUÔN LUÔN** trả về `<MrxDailyIssueWorkbench batchId={batchId || ''} serviceDate={serviceDate || ''} />`.
    Xóa bỏ điều kiện `if (serviceDate) return <MrxMultiCustomerPreparationWorkbench ... />` gây cướp quyền route.
- [ ] **Bước 2.3**: Kiểm tra lại toàn bộ liên kết điều hướng tại các thanh Subbar và Breadcrumb để đảm bảo tính nhất quán.

---

### Nhiệm Vụ 3: Triệt Tiêu Flash Empty State & Khóa Chặt Kiến Trúc Trạng Thái 5 Tầng (`RULE-MRX-STATE-01`)

**Tệp tin:**
- Chỉnh sửa: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Chỉnh sửa: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Chỉnh sửa: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Chỉnh sửa: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`
- Chỉnh sửa: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Chỉnh sửa: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`

- [ ] **Bước 3.1**: Triệt tiêu Flash Empty State trong `ReconciliationPage.tsx` & `ReconciliationReportTables.tsx`:
  - Thêm state `isReportLoading: boolean` trong `ReconciliationPage.tsx`.
  - Khi người dùng chuyển tab sang `variances`, `transactions`, `audit`, hoặc `completed`: Bật `isReportLoading(true)` trước khi gửi request, và tắt trong `finally`.
  - Truyền `isReportLoading` vào `ReconciliationReportTables.tsx`.
  - Trong `ReconciliationReportTables.tsx`: Nếu `isReportLoading === true`, hiển thị skeleton hoặc trạng thái mờ đang tải, **TUYỆT ĐỐI KHÔNG** hiển thị thông báo rỗng cho đến khi API phản hồi xong.
- [ ] **Bước 3.2**: Khắc phục lỗi Stale Preview Token trong `MrxBatchWorkbench.tsx`:
  - Trong `useEffect` xử lý `[customerId, weekStartDate, refreshTrigger]`: Gọi `setPreview(null)` ngay dòng đầu tiên khi người dùng đổi khách hàng hoặc đổi ngày tuần.
  - Đảm bảo nút "Tạo lô nháp" chỉ kích hoạt khi có preview tương ứng với đúng tuần và khách hàng đang chọn.
- [ ] **Bước 3.3**: Khắc phục lỗi Concurrency Deadlock trong `ReconciliationDispositionModal.tsx`:
  - Trong hàm `handleSave`, lưu lại danh sách các `dailyLineId` đã xử lý thành công (`succeededIds = new Set<string>()`).
  - Nếu một dòng bị lỗi giữa chừng, cập nhật `targetLines = targetLines.filter(l => !succeededIds.has(l.dailyLineId))`.
  - Khi người dùng bấm thử lại, hệ thống chỉ gửi tiếp các dòng còn lại, không gọi lại các dòng đã tăng `version`.
- [ ] **Bước 3.4**: Bổ sung `isFetching` và bắt lỗi `403/409` vào `StateBoundary` của các trạm:
  - `MrxSourceDeltaWorkbench.tsx`: Bổ sung `emptyScenario="filter-empty"`, `isFetching`, bắt lỗi 409 khi version delta bị lệch.
  - `MrxMultiCustomerPreparationWorkbench.tsx`: Bổ sung `isFetching`, bắt lỗi 403.
  - `MrxBatchWorkbench.tsx`: Bổ sung `isFetching`, bắt lỗi 409 khi commit/ready/transfer bị xung đột phiên bản.

---

### Nhiệm Vụ 4: Tối Ưu Hóa Hình Học Bảng Điều Khiển Queue Cards & Đảm Bảo Responsive (`RULE-MRX-GEO-01`)

**Tệp tin:**
- Chỉnh sửa: `frontend/src/features/reconciliation/ReconciliationQueueCards.tsx`

- [ ] **Bước 4.1**: Trong `ReconciliationQueueCards.tsx`:
  - Thay thế grid ép cứng 5 cột bằng responsive container: Trên màn hình `>= 1280px` hiển thị 5 cột đều; trên màn hình `< 1280px` cho phép cuộn ngang có snap (`overflow-x-auto no-scrollbar flex md:grid`) hoặc co chữ `text-[11px]`.
  - Đảm bảo các nhãn *"Sai lệch chưa giải trình"*, *"Đổi nguồn chờ duyệt"* không bao giờ bị cắt cụt mất chữ.
- [ ] **Bước 4.2**: Chạy kiểm tra đo lường subpixel trên 5 kích thước màn hình qua kịch bản Playwright probe.

---

### Nhiệm Vụ 5: Chuẩn Hóa Bộ Kiểm Thử Theo Đúng Quy Chuẩn `test-audit` (Rules TA-1 đến TA-5)

**Tệp tin:**
- Chỉnh sửa: `frontend/src/test/fixtures.ts`
- Chỉnh sửa: `frontend/src/__tests__/Warehouse.test.tsx`
- Chỉnh sửa: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Chỉnh sửa: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Bước 5.1**: Rà soát lại toàn bộ `fixtures.ts`:
  - Đảm bảo 100% dữ liệu mock của MRX đều xuất phát từ C# DTO (`ReconciliationBatchDto`, `ReconciliationLineDto`, `InventoryIssueDto`).
- [ ] **Bước 5.2**: Trong `Warehouse.test.tsx`:
  - Bổ sung test kiểm thử kịch bản cách ly state: Chuyển ngày từ Monday sang Tuesday xác nhận quantities được làm mới hoàn toàn.
  - Bổ sung test kiểm thử lỗi 409 xung đột xuất kho.
- [ ] **Bước 5.3**: Trong `WeeklyMenu.test.tsx`:
  - Bổ sung test kiểm thử tự động redirect sang `?view=mrx-batch` khi ở mode MRX.
  - Bổ sung test kiểm thử vô hiệu hóa preview khi đổi ngày tuần.
- [ ] **Bước 5.4**: Chạy `npm run test:fe:unit` đảm bảo toàn bộ 169+ tests đều PASS.

---

### Nhiệm Vụ 6: Nghiệm Thu Toàn Trình & Khóa Cứng Production

- [ ] **Bước 6.1**: Chạy `npm run lint:fe && npm run depcruise:fe && npm run build:fe`.
- [ ] **Bước 6.2**: Chạy `npm run check:architecture-growth && npm run check:conformance-contracts`.
- [ ] **Bước 6.3**: Chạy kịch bản Playwright Conformance Suite (`conformance-runtime.spec.ts`).
- [ ] **Bước 6.4**: Chạy kịch bản toàn trình 7 ngày 4 tác tử trên database sandbox cô lập (`run-mrx-full-path-lifecycle-test.mjs`).
- [ ] **Bước 6.5**: Cập nhật `.planning/WORK.md` và đồng bộ git commit.
