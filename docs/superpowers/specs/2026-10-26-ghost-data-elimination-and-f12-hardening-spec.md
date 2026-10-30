# Đặc Tả Kỹ Thuật Khóa Cứng: Triệt Tiêu Lỗi Dữ Liệu Ma, Dọn Sạch Báo Cáo Cũ & Chuẩn Hóa Khóa React F12

> **Mã đặc tả:** `SPEC-GHOST-DATA-ELIMINATION-F12-HARDENING-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Kiến trúc 5 tầng, tính trung thực dữ liệu, không bằng chứng giả) & `docs/DOMAIN.md`  
> **Mục tiêu tối thượng:**  
> 1. Triệt tiêu 100% lỗi dữ liệu ma: Tuyệt đối không để Header hiển thị `(Chưa có lô đối soát)` nhưng bảng bên dưới lại hiển thị 67 dòng nguyên liệu của một lô cũ từ tháng 9.  
> 2. Dọn sạch bộ nhớ báo cáo đối soát khi chưa chọn lô, bảo đảm các tab Lịch sử kho và Sổ chênh lệch hiển thị Empty State trung thực.  
> 3. Xóa sạch 399 cảnh báo trùng React key trên F12 Console bằng cơ chế định danh duy nhất cho từng dòng giao dịch kho.

---

## 1. CÁC QUY TẮC BẮT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Ràng Buộc Tính Hợp Lệ Của Lô Đối Soát (`RULE-BATCH-VALIDITY-01`)
- Tại `ReconciliationPage.tsx`, giá trị `batchId` **BẮT BUỘC** phải được kiểm tra xác thực đối chiếu với mảng kết quả `page.items` (danh sách lô thực tế thuộc về Khách hàng và Tuần đang chọn).
- Nếu `page.items` rỗng (`[]`) hoặc `batchId` hiện tại không thuộc `page.items`:
  + `selected` bắt buộc phải là `page.items[0]?.batchId || ''`.
  + Nếu `!selected`: Lập tức gọi `setData(null)`, `setIsLoading(false)`, và đồng bộ `workspaceSessionStore.setScope({ batchId: '' })`.
- Tuyệt đối cấm giữ lại `batchId` cũ của tuần trước hoặc khách hàng trước để render đè lên tuần chưa có lô.

### 1.2. Khóa Cứng: Xóa Sạch Báo Cáo Trong Bộ Nhớ Khi ID Lô Rỗng (`RULE-REPORTS-CLEANUP-01`)
- Tại hook `useReconciliationReports.ts`, khi `!batchId && activeReportTab !== 'completed'`:
  + Lập tức reset toàn bộ các state báo cáo về `null`:
    `setVariancesReport(null)`, `setTransactionsReport(null)`, `setAuditReport(null)`, `setSourceChanges(null)`.
  + Đặt `isReportLoading = false` trong 0ms.
- Bảo đảm khi người dùng xem một tuần chưa có lô, các tab báo cáo không bao giờ hiển thị phiếu xuất hay chênh lệch của một lô cũ khác.

### 1.3. Khóa Cứng: Định Danh Khóa React Duy Nhất Cho Từng Dòng Giao Dịch Kho (`RULE-F12-UNIQUE-KEYS-01`)
- Tại `ReconciliationReportTables.tsx`, hàm `keyExtractor` của bảng Lịch sử kho (Transactions) không được phép chỉ dùng `row.documentCode` (vì một phiếu xuất kho có thể chứa tới hàng chục dòng nguyên liệu cùng chung một mã chứng từ).
- Định dạng key chuẩn bắt buộc:
  `keyExtractor={(row, idx) => `${row.documentCode}-${row.movementType}-${row.ingredientName || idx}`}`
- Xóa sạch 100% các cảnh báo trùng key trên Chrome DevTools Console.

---

## 2. GIỚI HẠN DÒNG CODE VẬT LÝ (< 600 DÒNG)

Toàn bộ các file Frontend được tinh chỉnh bắt buộc tuân thủ nghiêm ngặt giới hạn dòng:
- `ReconciliationPage.tsx`: < 595 dòng (Hiện tại: 596 dòng).
- `ReconciliationReportTables.tsx`: < 470 dòng (Hiện tại: 465 dòng).
- `useReconciliationReports.ts`: < 90 dòng (Hiện tại: 83 dòng).

Bản đặc tả kỹ thuật này là căn cứ khóa cứng tối cao cho quá trình thực thi native tiếp theo.
