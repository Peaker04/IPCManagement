# Đặc Tả Kỹ Thuật: Kiến Trúc Phân Tầng Trạng Thái 4 Cấp Độ & Triệt Tiêu Nháy Giật Layout Shift (4-Tier State & Feedback Architecture Design)

**Dự án:** [Peaker04/IPCManagement (`feature/greenfield-fe-3zone-workbench`)](https://github.com/Peaker04/IPCManagement/tree/feature/greenfield-fe-3zone-workbench)  
**Ngày lập:** 2026-10-24  
**Chủ đề:** Khóa cứng kiến trúc phân tầng trạng thái phản hồi 4 cấp độ (4-Tier Feedback Architecture), loại bỏ triệt để việc lạm dụng Skeleton gây chớp nháy (Strobe Effect) và giật bố cục (Layout Shift), xóa bỏ các lệnh `setData(null)` xóa trắng dữ liệu, và đảm bảo chỉ số CLS $\le 0.05$ xuyên suốt toàn bộ các tương tác trên 14 routes.

---

## 1. Bối Cảnh & Vấn Đề Trải Nghiệm Người Dùng (The Strobe / Flicker Problem)

Trong các phiên bản trước, giao diện gặp phải lỗi phản trực giác (UX Anti-Pattern):
- Khi người dùng bấm **Trang sau**, đổi **Dropdown Khách hàng**, bấm **Chuyển ngày** `[<] 21/09 [>]`, hoặc bấm **Nút lưu**, màn hình lập tức xóa sạch bảng dữ liệu cũ và văng ra một bảng Skeleton xám xịt nhấp nháy.
- Khoảng 200–300ms sau khi API phản hồi, Skeleton bị gỡ bỏ và bảng dữ liệu thật xuất hiện.
- **Hệ quả:** Mắt người dùng bị giật nảy liên tục (chớp nháy mành 2 lần trong 1 giây), mất tiêu điểm đọc, chỉ số Cumulative Layout Shift (CLS) tăng cao, và tạo cảm giác phần mềm chạy rất chậm và không ổn định.

---

## 2. Bốn Cấp Độ Phản Hồi Trạng Thái Khóa Cứng (4-Tier Feedback Rules)

Hệ thống khóa cứng 4 quy tắc phân tầng trạng thái sau đây trên toàn bộ 14 routes:

### `RULE-FEEDBACK-01` (Cấp Độ 1: Initial Fresh Mount — Lần Đầu Mở Trang)
* **Ngữ cảnh áp dụng:** Khi người dùng mới vào URL lần đầu hoặc F5 tải lại trang khi trong bộ nhớ hoàn toàn chưa có bất kỳ dữ liệu nào (`!hasExistingData && isLoading`).
* **Cơ chế:** Render **Full Geometric Skeleton (`WorkbenchSkeleton`)**.
* **Ràng buộc:** 
  - Khung xương phải có đúng số cột, đúng chiều cao dòng (`36px–40px` theo `Rule T8`).
  - Thanh Header (Zone 1) và Subbar (Zone 2) phải đứng im, không được nhấp nháy.
  - Chỉ số dịch chuyển bố cục bắt buộc **$\text{CLS} \le 0.05$**.

### `RULE-FEEDBACK-02` (Cấp Độ 2: Pagination — Phân Trang Trang Trước / Trang Sau)
* **Ngữ cảnh áp dụng:** Khi người dùng bấm nút chuyển trang trong bảng dữ liệu (`PaginationBar`, nút Trang trước / Trang sau).
* **Cơ chế:** **Stale-While-Revalidate (Keep Previous Data) + Làm mờ nhẹ & Thanh tiến trình đỉnh bảng**.
* **CẤM TUYỆT ĐỐI:** Cấm render `WorkbenchSkeleton` hoặc xóa bảng dữ liệu cũ.
* **BẮT BUỘC THỰC THI:**
  - Giữ nguyên 100% dòng dữ liệu trang cũ trên màn hình.
  - Phủ một lớp làm mờ nhẹ (`opacity-60 transition-opacity duration-150`) lên phần thân bảng `<tbody>`.
  - Hiển thị thanh tiến trình mỏng `h-0.5` màu xanh navy ở đỉnh bảng (`top-0 z-20 animate-pulse`).
  - Khi dữ liệu trang mới tải về xong: Thay thế tức thì nội dung các dòng dữ liệu (Instant Swap) và gỡ bỏ lớp làm mờ. Zero FOUC, Zero Layout Shift.

### `RULE-FEEDBACK-03` (Cấp Độ 3: In-Page Filter & Scope Change — Đổi Ngày / Khách Hàng / Bộ Lọc)
* **Ngữ cảnh áp dụng:** Khi người dùng đổi bộ chọn trên Header (Chọn khách hàng, nhập ngày phục vụ, đổi ca, lọc trạng thái).
* **Cơ chế:** **Targeted Subbar Refetch Indicator**.
* **CẤM TUYỆT ĐỐI:** Cấm gọi các lệnh `setData(null)` hoặc `setItems([])` tự tay xóa trắng dữ liệu trước khi API mới trả về.
* **BẮT BUỘC THỰC THI:**
  - Giữ nguyên bảng dữ liệu hiện tại để người dùng tiếp tục đọc trong khi request mới đang bay trên mạng.
  - Hiển thị micro-indicator trên `TelemetrySubbar` (thanh hairline 2px hoặc icon refresh xoay nhẹ).
  - Chỉ khi API mới phản hồi thành công hoặc trả về rỗng thì mới cập nhật dữ liệu mới hoặc hiển thị Empty State bằng hiệu ứng chuyển cảnh mượt mà (`duration-150`).

### `RULE-FEEDBACK-04` (Cấp Độ 4: Mutations & Form Submissions — Ghi Dữ Liệu & Chốt Sổ)
* **Ngữ cảnh áp dụng:** Khi người dùng bấm nút thực thi ghi dữ liệu (Xuất kho, Xuất bổ sung, Phê duyệt, Từ chối, Chốt đối soát tuần).
* **Cơ chế:** **Local Button Busy State & Modal Spinner**.
* **CẤM TUYỆT ĐỐI:** Cấm biến cả trang thành skeleton; cấm đóng modal khi gặp lỗi 400/409 làm mất công gõ của người dùng.
* **BẮT BUỘC THỰC THI:**
  - Nút bấm trực tiếp chuyển sang trạng thái bận: đổi nhãn (ví dụ: `"Xác nhận xuất kho"` $\rightarrow$ `"Đang ghi..."`), hiển thị micro-spinner 14px, vô hiệu hóa nút (`disabled`).
  - Gặp lỗi xung đột 409: Giữ nguyên dữ liệu người dùng đang nhập trong modal/form, hiển thị cảnh báo xung đột ngay tại chỗ kèm nút `[Tải lại dữ liệu mới nhất]`.
  - Khi mutation thành công: Đóng modal, hiển thị Toast hoặc inline notification, và kích hoạt refetch ngầm trong nền (background revalidation).

---

## 3. Kiến Trúc Sửa Đổi Kỹ Thuật (Component Architecture)

1. **`StateBoundary.tsx` (`frontend/src/components/workbench/StateBoundary.tsx`):**
   - Đảm bảo điều kiện skeleton strictly scoped: `if (isLoading && !hasExistingData)`.
   - Khi `isFetching && hasExistingData`: bọc `children` trong container có `className="opacity-60 transition-opacity duration-150 relative pointer-events-none"` và thanh tiến trình `h-0.5 bg-blue-600/80 animate-pulse absolute top-0 left-0 right-0 z-30`.
2. **Rà soát & Xóa bỏ toàn bộ `setData(null)` / `setItems([])` mồ côi:**
   - Trong `ChefDashboardPage.tsx`: gỡ bỏ `setData(null)` khi đổi ngày/ca/phân trang.
   - Trong `AdminDataPage.tsx`: giữ nguyên `ingredients`/`dishes` khi đổi trang.
   - Trong `MrxDailyIssueWorkbench.tsx`: giữ nguyên dữ liệu ngày cũ khi đang tải ngày mới.
3. **Cập nhật `docs/DESIGN.md` & `docs/UI-KIT.md`:**
   - Bổ sung `Rule C1` (Layout Stability & Zero Layout Shift) và `Rule C6` (Anti-Flicker Feedback Tiers).
