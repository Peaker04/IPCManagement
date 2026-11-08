# Đặc Tả Kỹ Thuật Khóa Cứng: Cầu Nối Ngữ Cảnh Vận Hành Toàn Cục & Khóa Chặt 5 Tầng Chế Độ MRX

> **Mã đặc tả:** `SPEC-MRX-WORKSPACE-SCOPE-5LAYER-BRIDGE-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Bất biến `DOM-MODE-1`, Kiến trúc quản trị 5 tầng) & `docs/DOMAIN.md`  
> **Mục tiêu tối thượng:**  
> 1. Dập tắt hoàn toàn hiện tượng chớp nháy Skeleton khi chuyển giữa 10 view MRX bằng cơ chế nạp đồng bộ Render 0 qua `WorkspaceSessionStore`.  
> 2. Đồng bộ chuỗi bộ lọc 3 cấp nhất quán xuyên suốt 4 trạm nghiệp vụ (Khách hàng $\rightarrow$ Ngày/Tuần $\rightarrow$ Lô đối soát).  
> 3. Khóa cứng hình học ô ngày `VietnameseDateInput` chống co rút Flexbox đè icon lên chữ số.

---

## 1. CÁC QUY TẮC BẮT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Đồng Bộ Ngữ Cảnh Vận Hành Render 0 (`RULE-RENDER0-SCOPE-01`)
- Mọi Workbench trong chế độ MRX (`MrxBatchWorkbench`, `MrxDailyIssueWorkbench`, `MrxCookingWorkbench`, `ReconciliationPage`) **BẮT BUỘC** khởi tạo state `customerId`, `weekStartDate`, `serviceDate`, `batchId` đồng bộ tại Render 0 từ `workspaceSessionStore`.
- Khi người dùng bấm chuyển trang trên Sidebar (nơi URL không chứa query params), trang đích kế thừa ngay `activeCustomerId` và `activeDate` từ session store mà không phải chờ API `getCustomers()` hay `getBatchPage()` mạng trả về.
- SWR Cache `serverStateCache.get(...)` tra cứu trúng đích ngay ở miligiây đầu tiên $\rightarrow$ `isLoading` khởi tạo là `false` $\rightarrow$ **TRIỆT TIÊU 100% SKELETON FLASH KHI CHUYỂN TRANG**.

### 1.2. Khóa Cứng: Chuỗi Bộ Lọc 3 Cấp Thống Nhất Xuyên Suốt 4 Trạm (`RULE-UNIFIED-FILTER-01`)
- Bổ sung dropdown chọn Khách hàng đồng bộ vào Header của Trạm Kho (`MrxDailyIssueWorkbench.tsx`) và Trạm Bếp (`MrxCookingWorkbench.tsx`).
- Chuỗi lọc tuân thủ nghiêm ngặt mô hình thực thể C# Backend:
  $$\text{Khách hàng (Customer)} \longrightarrow \text{Ngày / Tuần (Service Date)} \longrightarrow \text{Lô đối soát (Reconciliation Batch)}$$
- Khi đổi Khách hàng ở bất kỳ trạm nào, toàn bộ hệ thống cập nhật đồng bộ sang khách hàng đó. Danh sách lô tự động lọc theo đúng khách hàng và ngày đã chọn, không bao giờ tự ý nhảy sang lô của khách hàng khác từ tháng trước.

### 1.3. Khóa Cứng: Hình Học Chống Co Rút Ô Ngày (`RULE-DATE-CONTAINER-01`)
- Thẻ bao bọc ngoài của `VietnameseDateInput.tsx` phải được khóa cứng:
  `<div className="relative inline-flex items-center shrink-0 w-40 min-w-[160px]">`
- Thuộc tính `shrink-0` và `min-w-[160px]` ngăn chặn 100% hành vi của trình duyệt tự ý bóp nghẹt thẻ bọc ô ngày khi Header bị hạn chế chiều rộng. Icon lịch luôn nằm cố định độc lập tại lề phải, số ngày `26/10/2026` luôn có đủ không gian hiển thị rộng rãi, không bao giờ bị đè lấn.

### 1.4. Khóa Cứng: Triệt Tiêu Vòng Lặp Loading Báo Cáo (`RULE-REPORT-EMPTY-01`)
- Tại `useReconciliationReports.ts` & `ReconciliationReportTables.tsx`, nếu `!batchId && activeReportTab !== 'completed'`:
  - `isReportLoading` lập tức trả về `false` trong 0ms.
  - Render Empty State với icon `FileText` và thông báo chuẩn: *"Chưa chọn lô đối soát"*. Tuyệt đối không để spinner quay nhấp nháy vô tận.

---

## 2. MA TRẬN 5 TẦNG KIẾN TRÚC & GIỚI HẠN VẬT LÝ (< 600 DÒNG)

Toàn bộ các file Frontend được tinh chỉnh bắt buộc tuân thủ nghiêm ngặt giới hạn dòng:
- `workspaceSessionStore.ts`: Module mới < 120 dòng (`src/store/workspaceSessionStore.ts`).
- `MrxBatchWorkbench.tsx`: < 520 dòng (Hiện tại: 508 dòng).
- `MrxDailyIssueWorkbench.tsx`: < 595 dòng (Hiện tại: 593 dòng).
- `MrxCookingWorkbench.tsx`: < 360 dòng (Hiện tại: 354 dòng).
- `ReconciliationPage.tsx`: < 595 dòng (Hiện tại: 592 dòng).
- `VietnameseDateInput.tsx`: < 220 dòng (Hiện tại: 211 dòng).
- `ReconciliationReportTables.tsx`: < 470 dòng (Hiện tại: 465 dòng).

Bản đặc tả kỹ thuật này là căn cứ khóa cứng tối cao cho toàn bộ quá trình thực thi tiếp theo.
