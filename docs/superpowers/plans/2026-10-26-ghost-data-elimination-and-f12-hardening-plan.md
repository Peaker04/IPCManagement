# Kế Hoạch Triển Khai Chi Tiết: Triệt Tiêu Lỗi Dữ Liệu Ma, Dọn Sạch Báo Cáo Cũ & Chuẩn Hóa Khóa React F12

> **Mã kế hoạch:** `PLAN-GHOST-DATA-ELIMINATION-F12-HARDENING-20261026-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-26-ghost-data-elimination-and-f12-hardening-spec.md`  
> **Phương thức thực hiện:** NATIVE INLINE EXECUTION (Thực thi trực tiếp, kiểm chứng qua F12 Chrome DevTools và Pre-commit Gate).

---

### Task 1: Ràng Buộc Xác Thực `batchId` Hợp Lệ Tại `ReconciliationPage.tsx`
- **Mục tiêu**: Xóa bỏ vĩnh viễn lỗi dữ liệu ma (Header báo `Chưa có lô đối soát` nhưng bên dưới hiện 67 dòng nguyên liệu cũ).
- **Thực hiện**:
  1. Mở `frontend/src/features/reconciliation/ReconciliationPage.tsx`:
  2. Tại `useEffect` nạp `getBatchPage`:
     ```tsx
     const isBatchInPage = page.items.some((b) => b.batchId === batchId);
     const selected = isBatchInPage ? batchId : (page.items[0]?.batchId || '');
     setBatchId(selected);
     if (!selected) {
       setData(null);
       setIsLoading(false);
       workspaceSessionStore.setScope({ batchId: '' });
     }
     ```
  3. Đảm bảo nếu tuần đó chưa có lô, `data` lập tức được reset về `null` và hiển thị Empty State trung thực.
  4. Giữ file strictly < 595 dòng.
- **Xác minh**: Chạy test kiểm tra khi chọn tuần chưa có lô, bảng không render dữ liệu của lô cũ.

---

### Task 2: Dọn Sạch Báo Cáo Trong Bộ Nhớ Tại `useReconciliationReports.ts`
- **Mục tiêu**: Khi không có lô được chọn, các báo cáo chênh lệch và lịch sử giao dịch phải được làm sạch, không để phiếu xuất cũ từ tháng 9 tồn đọng trong RAM.
- **Thực hiện**:
  1. Mở `frontend/src/features/reconciliation/useReconciliationReports.ts`:
  2. Tại nhánh `if (activeReportTab !== 'completed' && !batchId)`:
     - Gọi:
       ```ts
       setIsReportLoading(false);
       setVariancesReport(null);
       setTransactionsReport(null);
       setAuditReport(null);
       setSourceChanges(null);
       ```
  3. Giữ file strictly < 90 dòng.
- **Xác minh**: Chạy test kiểm tra khi `batchId = ''`, `transactionsReport` và `variancesReport` trả về `null`.

---

### Task 3: Triệt Tiêu 399 Cảnh Báo Trùng Key Tại `ReconciliationReportTables.tsx`
- **Mục tiêu**: Xóa sạch 100% cảnh báo `Encountered two children with the same key` trên Chrome F12 Console.
- **Thực hiện**:
  1. Mở `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`:
  2. Tại bảng Lịch sử kho (`activeTab === 'transactions'`):
     - Sửa hàm `keyExtractor`:
       ```tsx
       keyExtractor={(row, idx) => `${row.documentCode}-${row.movementType}-${row.ingredientName || idx}`}
       ```
  3. Giữ file strictly < 470 dòng.
- **Xác minh**: Kiểm tra nhật ký console khi render bảng lịch sử kho.

---

### Task 4: Kiểm Soát Giới Hạn Tăng Trưởng Kiến Trúc (< 600 Dòng)
- **Mục tiêu**: Đảm bảo 100% file tuân thủ trần kiến trúc của IPCManagement.
- **Thực hiện**:
  - Chạy `wc -l` kiểm tra các file đã chỉnh sửa.

---

### Task 5: Kiểm Chứng Trực Tiếp Bằng Chrome F12 DevTools (`f12-dev-tools-audit.mjs`)
- **Mục tiêu**: Chứng minh bằng số liệu thực nghiệm:
  - F12 Console Errors giảm từ 399 xuống **0**.
  - Ảnh chụp màn hình tại `/reconciliation` khi chọn `ANV` tuần `26/10` hiển thị Empty State trung thực, không còn 67 dòng ma.
- **Thực hiện**:
  - Chạy `node scripts/f12-dev-tools-audit.mjs`.

---

### Task 6: Chạy Toàn Bộ 5 Cổng Pre-Commit Kiểm Toán Doanh Nghiệp
- **Mục tiêu**: Bảo đảm không có hồi quy, 100% tests PASS.
- **Thực hiện**:
  - Chạy `npm run precommit:verify` (Gates A-E, 227+ tests).

---

Bắt đầu thực thi trực tiếp từ Task 1 ngay sau đây.
