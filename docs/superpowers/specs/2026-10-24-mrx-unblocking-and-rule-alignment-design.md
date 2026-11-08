# Đặc Tả Kỹ Thuật: Tinh Chỉnh Nghiệp Vụ & Khóa Rào Chắn Chống Điểm Nghẽn / Ngõ Cụt Chế Độ MRX (`MATERIAL_RECONCILIATION`)

**Dự án:** [Peaker04/IPCManagement (`feature/greenfield-fe-3zone-workbench`)](https://github.com/Peaker04/IPCManagement/tree/feature/greenfield-fe-3zone-workbench)  
**Ngày lập:** 2026-10-24  
**Chủ đề:** Tinh chỉnh các quy tắc nghiệp vụ Backend cũ và Frontend mới trong chế độ Đối soát nguyên liệu (MRX) để loại bỏ 5 điểm nghẽn / ngõ cụt nghiêm trọng, đảm bảo luồng công việc thông suốt từ đầu đến cuối mà không vi phạm tính toàn vẹn dữ liệu.

---

## 1. Bối Cảnh & Vấn Đề Nghiệp Vụ Cần Giải Quyết

Trong chế độ Đối soát nguyên liệu (`MATERIAL_RECONCILIATION`), hệ thống vận hành theo chu trình khép kín:
**Nhập thực đơn tuần Excel → Khởi tạo số suất → Đóng băng & Chuyển giao lô → Xuất kho ngày / Xuất phối hợp → Bếp nấu (Pure Read-Only) → Quản lý giải trình chênh lệch → Chốt sổ đối soát tuần**.

Tuy nhiên, qua quá trình kiểm toán chuyên sâu mã nguồn C# Backend và React Frontend, hệ thống đang tồn tại **5 điểm nghẽn nghiệp vụ và ngõ cụt (Deadlocks / Dead-Ends)** khiến người vận hành bị chặn đứng không thể hoàn tất công việc:

1. **Điểm nghẽn 1 (Chí tử): Bế tắc khi Xuất thiếu / Bếp nấu tiết kiệm (Under-Issue Deadlock):**
   - *Backend*: `ReconciliationDailyIssuePolicy.cs` coi mọi dòng xuất thiếu (`netIssued < required`) là `UNDER_ISSUED` và ép trạng thái ngày thành `PARTIAL`. Không hề có cờ `hasValidDisposition` cho xuất thiếu! Đồng thời `ReconciliationActualService.cs` ném lỗi `InvalidOperationException("Chỉ dòng xuất vượt theo ngày mới cần hướng xử lý hoàn tất.")` nếu cố giải trình dòng thiếu. Hậu quả là `ReconciliationCompletionService.cs` chặn đứng việc chốt lô (`WeeklyStatus != "WEEK_COMPLETE"`).
   - *Frontend*: `ReconciliationPage.tsx` render dòng chữ tĩnh câm lặng: `"Chờ Kho xuất đủ"`, không có nút bấm nào để Quản lý giải trình.
   - *Hậu quả thực tế*: Khi bếp nấu tiết kiệm nguyên liệu (BOM tính 50kg nhưng thực tế bếp chỉ nấu 45kg thịt), lô đối soát bị **kẹt vĩnh viễn ở trạng thái `IN_PROGRESS`**, không thể hoàn tất. Kho không thể xuất bù thịt đã ăn xong từ đầu tuần, Quản lý không thể giải trình, gây đứt gãy quy trình đối soát kế toán.

2. **Điểm nghẽn 2: Ngõ cụt Thủ kho — Không có chức năng Xuất bổ sung thủ công trong ca:**
   - *Frontend*: Trên `MrxDailyIssueWorkbench.tsx`, sau khi tạo phiếu xuất đầu tiên, nút `"Xác nhận xuất kho"` bị khóa vĩnh viễn (`hasInitialIssue === true`). Thủ kho không có nút bấm nào để xuất thêm nguyên liệu khi bếp phát sinh nhu cầu đột xuất (cháy cơm, khách tăng đột biến). Màn hình `MrxSourceDeltaWorkbench` chỉ quản lý delta từ việc Điều phối sửa thực đơn, không giải quyết được nhu cầu xuất bổ sung tại chỗ.

3. **Điểm nghẽn 3: Kẹt nguồn thực đơn khi thiếu Kế hoạch số suất:**
   - *Backend*: `ReconciliationQuantityImportService.cs` ném lỗi 400 `BusinessRuleException("Phiên bản thực đơn chưa có nguồn số suất.")` nếu kế hoạch số suất rỗng hoặc chưa `COMPLETED`.
   - *Frontend*: Route `/meal-orders` bị khóa ở MRX mode. Nếu Điều phối bấm xuất bản thực đơn mà không sinh số suất, bấm "Kiểm tra định lượng" sẽ bị ném lỗi 400 và rơi vào ngõ cụt vì không có màn hình nhập số suất ở MRX.

4. **Điểm nghẽn 4: Thiếu Bằng chứng chặn minh bạch khi không thể Chốt đối soát tuần (`UXR-02`, `BR-GLOBAL-04`):**
   - *Frontend*: Trên `ReconciliationPage.tsx`, khi `canComplete = false`, nút `"Chốt đối soát tuần"` bị ẩn hoàn toàn (silent hidden). Quản lý không biết tại sao không chốt được và phải lần mò qua 7 tab ngày.

5. **Điểm nghẽn 5: Đứt đoạn điều hướng sau khi Bàn giao lô sang Kho:**
   - *Frontend*: Trên `MrxBatchWorkbench.tsx`, bấm "Chuyển sang Kho" chỉ hiện dòng text thông báo thành công, không có nút CTA dẫn tiếp sang trạm Kho (`/warehouse?view=mrx-daily`).

---

## 2. Các Rào Chắn & Nguyên Tắc Khóa Cứng (Hard Rules & Invariants)

Hệ thống khóa cứng các nguyên tắc sau đây để loại bỏ điểm nghẽn mà vẫn bảo toàn tính toàn vẹn kế toán:

* **`RULE-MRX-01` (Hai Chiều Giải Trình Chênh Lệch — Bidirectional Variance Disposition):**
  - Mọi chênh lệch giữa lượng xuất kho thực tế và định mức BOM (dù là **Xuất vượt `OVER_ISSUED`** hay **Xuất thiếu `UNDER_ISSUED`**) đều là chênh lệch hợp lệ cần được giải trình và lưu vết kiểm toán.
  - Cho phép Quản lý ghi nhận giải trình với danh mục `ACCEPTED_VARIANCE` (Chấp nhận chênh lệch) hoặc `CORRECTION_REQUIRED` kèm lý do bắt buộc (ví dụ: *"Tiết kiệm định lượng tại bếp"*, *"Hao hụt thực tế thấp hơn định mức"*).
  - Khi một dòng `UNDER_ISSUED` đã có giải trình hợp lệ (`hasValidDisposition = true`), nó được tính là **ĐÃ XỬ LÝ (RESOLVED)**, không còn bị coi là dòng chặn `PARTIAL`.

* **`RULE-MRX-02` (Điều Kiện Hoàn Tất Ngày & Tuần — Daily & Weekly Completion Invariant):**
  - Một ngày phục vụ đạt trạng thái **`COMPLETE`** khi và chỉ khi: Mọi dòng nguyên liệu trong ngày đó thỏa mãn:
    1. Hoặc xuất đúng định mức (`EXACT`).
    2. Hoặc xuất vượt nhưng đã có giải trình hợp lệ (`OVER_ISSUED` + `HasValidDisposition`).
    3. Hoặc xuất thiếu nhưng đã có giải trình hợp lệ (`UNDER_ISSUED` + `HasValidDisposition`).
  - Một tuần đối soát đạt trạng thái **`WEEK_COMPLETE`** khi và chỉ khi 100% các ngày áp dụng trong tuần đều đạt `COMPLETE`.

* **`RULE-MRX-03` (Quyền Xuất Bổ Sung Tại Trạm Kho — Warehouse Supplemental Issue Authority):**
  - Khi ngày phục vụ đã có phiếu xuất đầu tiên (`hasInitialIssue === true`), giao diện Kho không được khóa câm lặng mà phải mở tính năng **"Xuất bổ sung ca"**.
  - Phiếu xuất bổ sung gửi mutation `isSupplemental = true`, tăng aggregate sequence theo batch version, yêu cầu nhập số lượng xuất thêm dương và lý do bắt buộc.

* **`RULE-MRX-04` (Tự Động Sinh Số Suất Định Mức — Auto Servings Guarantee):**
  - Trong chế độ MRX, thao tác xuất bản thực đơn tuần hoặc tạo lô nháp phải tự động đảm bảo các ca phục vụ đều có kế hoạch số suất hợp lệ (`complete: true`), không đẩy người dùng sang màn hình `/meal-orders` (vốn bị khóa ở MRX).

* **`RULE-MRX-05` (Bằng Chứng Chặn Minh Bạch — Blocker Transparency Contract):**
  - Tuyệt đối cấm ẩn nút `"Chốt đối soát tuần"` một cách câm lặng. Khi tuần chưa đạt `WEEK_COMPLETE`, hệ thống bắt buộc phải hiển thị **Thẻ Điểm Tắc Luồng (Blocker Resolution Strip)** liệt kê chi tiết:
    - Danh sách các ngày chưa xuất kho đủ.
    - Danh sách các dòng nguyên liệu còn chênh lệch chưa giải trình.
    - Nút shortcut chuyển nhanh đến màn hình xử lý tương ứng.

* **`RULE-MRX-06` (Điều Hướng Liền Mạch — Seamless Flow Handoff):**
  - Mọi thao tác bàn giao giữa các vai trò (Điều phối $\rightarrow$ Kho $\rightarrow$ Bếp $\rightarrow$ Quản lý) phải cung cấp nút điều hướng chuyển tiếp trực tiếp (Call-To-Action).

---

## 3. Kiến Trúc Giải Pháp Kỹ Thuật (Architecture & Component Changes)

### 3.1. Backend C# (Services & Policies)
1. **`ReconciliationDailyIssuePolicy.cs`**:
   - Mở rộng `ReconciliationDailyLineStatus`: thêm `bool HasValidDisposition` cho cả hai chiều chênh lệch.
   - Sửa `ResolveLineStatus`:
     ```csharp
     return difference switch
     {
         < 0 => new("UNDER_ISSUED", hasValidDisposition),
         > 0 => new("OVER_ISSUED", hasValidDisposition),
         _ => new("EXACT")
     };
     ```
   - Sửa `ResolveDailyStatus`:
     ```csharp
     if (lines.Count == 0) return "NO_REQUIREMENT";
     if (lines.All(line => line.QuantityStatus == "UNTOUCHED")) return "UNTOUCHED";
     if (lines.Any(line => line.QuantityStatus == "UNTOUCHED")) return "PARTIAL";
     if (lines.Any(line => line.QuantityStatus is "UNDER_ISSUED" or "OVER_ISSUED" && !line.HasValidDisposition))
         return "VARIANCE_REQUIRES_RESOLUTION";
     return "COMPLETE";
     ```
2. **`ReconciliationActualService.cs`**:
   - Bỏ điều kiện chặn cứng `if (lineStatus.QuantityStatus != "OVER_ISSUED")`.
   - Cho phép ghi nhận `ReconciliationDailyDisposition` cho bất kỳ dòng nào có chênh lệch (`difference != 0`).
3. **`ReconciliationBatchService.cs`**:
   - Khi tính toán `GetWarehouseDailyAsync`: nạp đầy đủ các bản ghi disposition theo `dailyLineId` và truyền `hasDisposition` vào `ResolveLineStatus`.

### 3.2. Frontend React (Workbenches & Modals)
1. **`ReconciliationPage.tsx`**:
   - Cột Thao tác: Cho phép hiển thị nút `"Xử lý chênh lệch"` cho cả dòng có `issuedRequiredDifference < 0`.
   - Blocker Resolution Strip: Hiển thị ngay dưới Header khi `status === 'IN_PROGRESS'` và `weeklyStatus !== 'WEEK_COMPLETE'`, chỉ rõ nguyên nhân và nút xử lý.
2. **`MrxDailyIssueWorkbench.tsx`**:
   - Khi `hasInitialIssue === true`: Mở nút `"Xuất bổ sung ca"` mở modal hoặc cho phép nhập số lượng xuất thêm kèm lý do để gọi `mrxApi.createIssue({ isSupplemental: true, ... })`.
3. **`MrxBatchWorkbench.tsx`**:
   - `publishMenu()` và `checkQuantities()`: Tự động gọi API `quick-servings` hoàn tất số suất nếu chưa có.
   - Banner sau khi chuyển Kho: Thêm nút `"Mở trạm Kho xuất ngày"` trỏ tới `/warehouse?view=mrx-daily`.
