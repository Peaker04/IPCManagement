# Đặc Tả Kỹ Thuật: Thẩm Định Toàn Diện & Xử Lý Điểm Nghẽn Từng Route Chế Độ MRX (`MATERIAL_RECONCILIATION`)

**Dự án:** [Peaker04/IPCManagement (`feature/greenfield-fe-3zone-workbench`)](https://github.com/Peaker04/IPCManagement/tree/feature/greenfield-fe-3zone-workbench)  
**Ngày lập:** 2026-10-24  
**Chủ đề:** Chuyển đổi phương thức thực thi từ "Batch gộp" sang "Đào sâu từng Route đơn lẻ (Single-Route Deep Dive)" — Đảm bảo mỗi Route trong chế độ MRX được thẩm định toàn diện 6 chiều, có bằng chứng thực tế, loại bỏ triệt để mọi lỗi ẩn, đứt gãy luồng và ngõ cụt người dùng.

---

## 1. Nguyên Tắc Thẩm Định 6 Chiều Trên Mỗi Route (Single-Route 6-Dimension Contract)

Không coi bất kỳ output console hay assertion nào là "mặc định pass" mà phải kiểm chứng bằng tương tác thực tế và hành vi DOM thật. Mỗi Route phải đạt 6 tiêu chuẩn sau:

1. **Chiều 1 — Thao tác & Nút bấm (Interactive Controls & Actions):**
   - Mọi nút bấm, dropdown, ô nhập liệu phải có hành vi xác thực rõ ràng (`validation`), trạng thái vô hiệu hóa (`disabled`) khi thiếu điều kiện, và phản hồi thành công/thất bại trực quan.
   - Tuyệt đối không có nút bấm "chết" (bấm không phản hồi), nút bị ẩn câm lặng không rõ nguyên nhân, hoặc thông báo dạng `alert()` của trình duyệt.
2. **Chiều 2 — Đủ 6 Trạng thái Giao diện (`StateBoundary` 6-State Matrix):**
   - `loading`: Khung skeleton giữ nguyên hình học của bảng thật (không gây layout shift CLS $\le 0.05$).
   - `empty`: Bao phủ đủ 4 kịch bản (True empty, Prerequisite blocked, Partial data, Filter empty kèm nút reset).
   - `error`: Bắt lỗi HTTP mạng và server, có nút `[Thử lại]` để refetch.
   - `permission-denied`: Trạng thái 403 rõ ràng khi tài khoản không có quyền thao tác.
   - `write-reconciliation` (409): Khi xung đột phiên bản, hiển thị cảnh báo kèm nút tải lại dữ liệu mới nhất từ server.
   - `partial`: Cảnh báo khi một phần dữ liệu phụ trợ chưa sẵn sàng.
3. **Chiều 3 — Đồng bộ URL & Trạng thái F5 (URL State & Persistence):**
   - Mọi trạng thái lọc chính (`view`, `batchId`, `date`, `customerId`) phải được đồng bộ vào URL query params.
   - Khi người dùng F5 tải lại trang, hệ thống phải phục hồi đúng ngữ cảnh đang làm việc, không bị văng về trang rỗng hay mất thông tin lô đã chọn.
4. **Chiều 4 — Bảo vệ Bản nháp Chưa lưu (Dirty Draft Protection):**
   - Khi người dùng đang nhập dở dữ liệu (số suất, số lượng xuất kho, lý do giải trình) mà bấm link khác hoặc tải lại trang, bắt buộc phải xuất hiện `alertdialog` cảnh báo mất dữ liệu (`DirtyNavigation` / `beforeunload`).
5. **Chiều 5 — Rào chắn Phân quyền & Cách ly Chế độ (RBAC & `DOM-MODE-1`):**
   - Các nút thao tác ghi (Xuất kho, Bổ sung, Chốt lô, Giải trình) phải được bọc qua `ActionGuard` có kiểm tra đúng vai trò, quyền hạn và chế độ `MATERIAL_RECONCILIATION`.
   - Các route dành riêng cho `DEFAULT` (như `/purchasing`, `/meal-orders`, `/approvals`) phải chuyển hướng an toàn về `/forbidden` khi đang ở chế độ MRX.
6. **Chiều 6 — Mắt xích Chuyển giao Tiếp theo (Seamless Handoff CTA):**
   - Khi hoàn tất một công đoạn ở trạm hiện tại (ví dụ: chuyển giao lô sang kho, hoàn tất phiếu xuất), giao diện bắt buộc phải cung cấp nút điều hướng chuyển tiếp (Call-To-Action) dẫn người dùng sang trạm tiếp theo của quy trình.

---

## 2. Đặc Tả Chi Tiết 7 Chặng Route Trong Chu Trình MRX

### Chặng 1: `/login` & Điều Hướng Khởi Động (Auth & Landing)
- **Actor:** Mọi vai trò (Điều phối, Thủ kho, Bếp trưởng, Quản lý).
- **Mục tiêu:** Đăng nhập an toàn, nạp đúng token JWT, và tự động điều hướng về đúng trạm làm việc của vai trò đó trong chế độ MRX:
  - *Quản lý (Manager/Admin)* $\rightarrow$ `/reconciliation`.
  - *Điều phối (Coordinator)* $\rightarrow$ `/weekly-menu?view=mrx-batch`.
  - *Thủ kho (Warehouse Staff)* $\rightarrow$ `/warehouse?view=mrx-daily`.
  - *Bếp trưởng (Chef)* $\rightarrow$ `/chef?view=mrx-cooking`.
- **Rào chắn:** Loại bỏ hoàn toàn tài khoản/mật khẩu hardcoded; form bắt đầu trống; lỗi sai mật khẩu hiển thị inline trợ năng.

### Chặng 2: `/weekly-menu?view=mrx-batch` (Trạm Khởi Nguồn — Điều Phối Viên)
- **Actor:** Điều phối viên (Coordinator) hoặc Admin.
- **Thao tác chính:**
  1. Chọn Khách hàng & Tuần làm việc (đồng bộ URL).
  2. Nút "Nhập thực đơn Excel": Mở modal tải file, tải template Excel mẫu, preview phân tích file, và commit thực đơn.
  3. Tự động sinh số suất ăn định mức (`quick-servings`) với `complete: true` khi xuất bản thực đơn hoặc tạo lô, không để rơi vào lỗi thiếu nguồn số suất.
  4. Nút "Kiểm tra định lượng": Hiển thị danh sách kế hoạch số suất và chẩn đoán nếu có món thiếu BOM.
  5. Nút "Tạo lô nháp" $\rightarrow$ "Đóng băng lô" $\rightarrow$ "Chuyển sang Kho".
  6. Sau khi chuyển sang Kho: Banner thông báo kèm nút CTA `[Mở trạm Kho xuất ngày]` dẫn sang `/warehouse?view=mrx-daily`.
  7. Luồng "Điều chỉnh nguồn" (thay đổi số suất ca): Modal cho phép nhập số suất mới và lý do, xem trước ảnh hưởng (preview), gửi Admin duyệt hoặc xác nhận trực tiếp nếu là Admin.

### Chặng 3: `/warehouse?view=mrx-daily` (Trạm Kho 1 — Định Lượng Xuất Ngày & Bổ Sung)
- **Actor:** Thủ kho (Warehouse Staff) hoặc Admin.
- **Thao tác chính:**
  1. Dropdown chọn Lô đối soát và Ngày phục vụ; đồng bộ URL `?batchId=&date=`.
  2. Bảng định lượng ngày: Hiển thị đúng các cột Nguyên liệu, ĐVT, Nhu cầu đã khóa, Đã xuất theo sổ, Đã hoàn trả, Còn lại cần xuất.
  3. Thao tác Xuất kho lần đầu: Cho phép nhập số lượng thực xuất. Nếu xuất vượt, bắt buộc nhập lý do (`varianceReason`).
  4. Thao tác Xuất bổ sung trong ca (`RULE-MRX-03`): Khi ngày đã có phiếu xuất đầu tiên (`hasInitialIssue === true`), nút "Xuất bổ sung ca" mở modal cho phép chọn nguyên liệu, nhập số lượng bổ sung dương và lý do bắt buộc để gửi mutation `isSupplemental: true`.
  5. Banner hướng dẫn: Hiển thị lối tắt sang `Hàng đợi thay đổi nguồn` (`/warehouse?view=mrx-issues`) và nút `Chuẩn bị phối hợp` (`/warehouse?view=mrx-preparation`).

### Chặng 4: `/warehouse?view=mrx-preparation` & `/warehouse?view=mrx-issues` (Trạm Kho 2 & 3)
- **Actor:** Thủ kho (Warehouse Staff).
- **Thao tác chính:**
  - *Trạm Chuẩn bị phối hợp (`mrx-preparation`)*: Chọn ngày phục vụ; chọn các lô cần phối hợp; lọc theo Nhà cung cấp; bấm "Xác nhận xuất phối hợp" sinh ra và hiển thị mã nhóm chuẩn bị (`PreparationGroupId`).
  - *Trạm Hàng đợi thay đổi nguồn (`mrx-issues`)*: Xem danh sách delta do Điều phối sửa số suất; xử lý delta dương (Xuất bổ sung ca); xử lý delta âm (Hoàn trả vật lý và xác nhận nhận lại hàng vào kho).

### Chặng 5: `/chef?view=mrx-cooking` (Trạm Bếp — Phiếu Nấu Theo Lô)
- **Actor:** Bếp trưởng (Chef).
- **Thao tác chính:**
  1. Dropdown chọn Lô đối soát nấu và Ngày phục vụ; đồng bộ URL.
  2. Thẻ nấu theo món ăn (Card per Dish): Hiển thị tên món, ca ăn, số suất, định mức nguyên liệu cần nấu.
  3. Chức năng In phiếu nấu A4 (`window.print()`) định dạng chuyên nghiệp không in sidebar.
  4. Xuất file CSV / Excel phiếu nấu phục vụ kiểm đếm tại bếp.
  5. Rào chắn: 100% Pure Read-Only, không hiển thị giá tiền, không hiển thị tồn kho, không có nút xác nhận vật tư.

### Chặng 6: `/reconciliation` (Trạm Quản Lý — Điều Khiển & Chốt Tuần)
- **Actor:** Quản lý (Manager) hoặc Admin.
- **Thao tác chính:**
  1. Control Tower: 5 thẻ hàng đợi (Đổi nguồn chờ duyệt, Lô chờ xuất kho, Lô chờ đối soát, Chênh lệch cần xử lý, Lô sẵn sàng hoàn tất).
  2. Tab 1 `lines` (Rà soát dòng ngày):
     - Hiển thị chênh lệch giữa Định mức BOM và Thực xuất.
     - Nút "Xử lý chênh lệch" hoạt động cho cả dòng xuất vượt (`> 0`) và dòng xuất thiếu (`< 0` - bếp nấu tiết kiệm) theo `RULE-MRX-01`.
     - Modal giải trình: Danh mục `ACCEPTED_VARIANCE`, các chip lý do gợi ý chuẩn.
  3. Thẻ Cảnh Báo Điểm Tắc Luồng (`ReconciliationBlockerStrip`): Hiển thị chi tiết nguyên nhân khi tuần chưa đạt `WEEK_COMPLETE` kèm nút shortcut lọc nhanh dòng cần xử lý.
  4. Nút "Chốt đối soát tuần": Mở modal xác nhận khóa sổ, gửi kèm `version` token kiểm soát đồng thời, chuyển trạng thái lô sang `COMPLETED`.
  5. Tab 2–5 (`variances`, `transactions`, `audit`, `completed`): Hiển thị đầy đủ bảng sổ sách và nút tải file CSV tương ứng.
