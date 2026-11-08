# Đặc Tả Kỹ Thuật: Khóa Cứng Quy Chuẩn Nghiệp Vụ, An Toàn Trạng Thái 5 Tầng & Kiểm Toán Toàn Diện Chế Độ MRX (MRX Exhaustive Hardening & Rules Lock Specification)

> **Mã đặc tả:** `SPEC-MRX-EXHAUSTIVE-20261024`  
> **Trạng thái:** BẮT BUỘC KHÓA CỨNG (LOCKED & MANDATORY)  
> **Chủ quản thẩm quyền:**  
> - Nghiệp vụ miền: `docs/domain/material-reconciliation.md`  
> - Kiểm toán kiểm thử: `.pi/skills/ipc-test-audit/SKILL.md` (Rule TA-1 đến TA-5) & `test-audit`  
> - Kiến trúc giao diện: `docs/DESIGN.md` (UXR-01..05, D1..D9, T1..T16, M1.1..1.3, N1..N8, C1..C12, E1..E8, `RULE-FEEDBACK-01..04`)  
> **Phạm vi áp dụng:** Toàn bộ phân hệ `MATERIAL_RECONCILIATION` (Thực đơn tuần, Kho nguyên liệu, Bếp trưởng, Đối soát, Báo cáo đối soát). Riêng Trạm Bếp trưởng (`/chef?view=mrx-cooking`) được giữ nguyên là phiếu nấu đông cứng chỉ đọc và xuất CSV/XLSX.

---

## 1. MỤC TIÊU VÀ CÁC QUY TẮC BẤT BIẾN KHÓA CỨNG (LOCKED INVARIANTS)

### 1.1. Khóa Cứng Quy Tắc An Toàn Tải File & Xác Thực Token (`RULE-MRX-SEC-01`)
- **Vấn đề đã xác nhận:** Các nút tải file CSV/XLSX tại các endpoint `/api/reconciliation/reports/*/csv`, `/api/reconciliation/preparation/export-workbook`, `/api/reconciliation/batches/{id}/kitchen-cooking/*` đều yêu cầu quyền truy cập (`[Authorize]`). Việc gọi `window.open(url, '_blank')` trực tiếp làm mất header `Authorization: Bearer <token>`, dẫn đến lỗi `401 Unauthorized` (`{"success":false,"message":"Chưa đăng nhập hoặc token hết hạn."}`).
- **Quy tắc khóa cứng (`RULE-MRX-SEC-01`):**
  - **CẤM TUYỆT ĐỐI** gọi `window.open()` trực tiếp tới bất kỳ API nội bộ nào yêu cầu xác thực.
  - **BẮT BUỘC** sử dụng hàm helper chung `downloadAuthenticatedFile(url: string, filename: string)`:
    - Lấy token từ `localStorage.getItem('ipc_v3_token')`.
    - Thực hiện `fetch(url, { headers: { Authorization: `Bearer ${token}` } })`.
    - Kiểm tra `res.ok`, nếu lỗi phải ném ngoại lệ có thông điệp rõ ràng (`Tải file thất bại (mã HTTP)`).
    - Tạo đối tượng `Blob` tạm, kích hoạt thẻ `<a download>` ngầm và thu hồi URL `window.URL.revokeObjectURL()` sạch sẽ.

### 1.2. Khóa Cứng Phân Lập Chế Độ Vận Hành & Điều Hướng Chuẩn (`RULE-MRX-NAV-01` & `DOM-MODE-1`)
- **Vấn đề đã xác nhận:**
  1. Khi ở chế độ `MATERIAL_RECONCILIATION`, nếu người dùng vào `/weekly-menu` không có tham số `?view=mrx-batch`, trang hiển thị giao diện DEFAULT và gọi các API KHSX bị cấm.
  2. Tại `WarehousePage.tsx:40`, khi URL là `/warehouse?view=mrx-daily&date=...` nhưng không có `batchId`, trang tự ý chuyển hướng sang màn hình Chuẩn bị đa khách hàng (`MrxMultiCustomerPreparationWorkbench`).
- **Quy tắc khóa cứng (`RULE-MRX-NAV-01`):**
  - Tại `WeeklyMenuPage.tsx`: Nếu `operationalMode === 'MATERIAL_RECONCILIATION'` và `view !== 'mrx-batch'`, **BẮT BUỘC tự động chuyển hướng (`<Navigate to="/weekly-menu?view=mrx-batch" replace />`)**. Không được mount `DefaultWeeklyMenuPage`.
  - Tại `WarehousePage.tsx`: Khi `view === 'mrx-daily'`, **BẮT BUỘC luôn luôn render `MrxDailyIssueWorkbench`** (kể cả khi `batchId` rỗng, `serviceDate` được truyền thẳng vào props để trạm tự chọn lô phù hợp). Tuyệt đối không được cướp quyền sang `MrxMultiCustomerPreparationWorkbench` (vốn chỉ thuộc về `view === 'mrx-preparation'`).

### 1.3. Khóa Cứng Triệt Tiêu Flash Empty State & Quản Trị Trạng Thái 5 Tầng (`RULE-FEEDBACK-01..04`)
- **Vấn đề đã xác nhận:**
  - `ReconciliationPage.tsx:490` ép cứng `hasExistingData = true` cho các tab báo cáo, khiến `ReconciliationReportTables.tsx` render bảng với mảng rỗng `[]` và hiển thị thông báo "Không có chênh lệch nào" trong 150–200ms trước khi dữ liệu thật tải về.
  - Thiếu cờ `isFetching` trên 4/5 phân hệ MRX (`MrxBatchWorkbench`, `MrxMultiCustomerPreparationWorkbench`, `MrxSourceDeltaWorkbench`, `MrxCookingWorkbench`).
  - Lỗi stale preview token khi đổi tuần/khách hàng trong `MrxBatchWorkbench.tsx`.
- **Quy tắc khóa cứng (`RULE-MRX-STATE-01`):**
  - **Quản lý trạng thái báo cáo độc lập**: Mỗi tab báo cáo trong `ReconciliationPage.tsx` (`variances`, `transactions`, `audit`, `completed`) phải có cờ tải độc lập (`isReportLoading`). Khi đang tải tab mới, `ReconciliationReportTables` **BẮT BUỘC hiển thị loading skeleton hoặc thanh tiến trình mờ**, TUYỆT ĐỐI KHÔNG được hiển thị Empty State khi dữ liệu chưa về.
  - **Vô hiệu hóa Preview khi đổi ngữ cảnh nguồn**: Tại `MrxBatchWorkbench.tsx`, bất kỳ thay đổi nào đối với `customerId` hoặc `weekStartDate` **BẮT BUỘC phải gọi `setPreview(null)` ngay lập tức** để ngăn ngừa việc dùng token preview cũ để tạo lô nháp cho tuần mới.
  - **Đồng bộ hóa 6 trạng thái UI**: Toàn bộ 5 trạm MRX bắt buộc truyền đủ các nhánh trạng thái vào `<StateBoundary>`:
    - `isLoading`: Tải lần đầu khi chưa có dữ liệu $\rightarrow$ `WorkbenchSkeleton`.
    - `isFetching`: Tải ngầm khi đã có dữ liệu $\rightarrow$ Lớp mờ `opacity-70` + hairline progress bar đỉnh bảng.
    - `isForbidden` (HTTP 403): Màn hình `ShieldAlert` chặn quyền truy cập có hướng dẫn và nút quay lại.
    - `isConflict` (HTTP 409): Màn hình `AlertTriangle` cảnh báo xung đột dữ liệu đồng thời kèm nút `[Tải lại dữ liệu mới nhất]`.
    - `emptyScenario`: Phân định rõ kịch bản `prerequisite-blocked` (thiếu dữ liệu bước trước) vs `filter-empty` (bộ lọc không khớp).

### 1.4. Khóa Cứng An Toàn Đồng Thời Trong Giải Trình Hàng Loạt (`RULE-MRX-BULK-01`)
- **Vấn đề đã xác nhận:** Vòng lặp `for` giải trình hàng loạt tại `ReconciliationDispositionModal.tsx` nếu gặp lỗi ở dòng giữa chừng sẽ không thể thử lại (retry) vì các dòng đầu đã tăng `version` ở server, gây deadlock lỗi `409 Concurrency Conflict`.
- **Quy tắc khóa cứng (`RULE-MRX-BULK-01`):**
  - Vòng lặp giải trình hàng loạt phải theo dõi tập hợp các ID dòng đã thành công (`succeededLineIds: Set<string>`).
  - Khi gặp lỗi và người dùng bấm nút thử lại, hệ thống **CHỈ gửi các dòng chưa được xử lý thành công**, loại trừ các dòng đã hoàn tất để không bao giờ bị dính lỗi xung đột phiên bản.

### 1.5. Khóa Cứng Quy Chuẩn Kiểm Toán Kiểm Thử (Test-Audit Gate — Rule TA-1 đến TA-5)
- **Rule TA-1 (Backend-Grounded Fixtures Only):**
  - Mọi fixture dùng trong test (`fixtures.ts`) BẮT BUỘC phải xuất phát từ DTO C# của Backend (`ReconciliationBatchDto`, `ReconciliationLineDto`, `InventoryIssueDto`, `ReconciliationWarehouseDailyDto`).
  - CẤM TỰ BỊA các trường client-only như `materialCode`, `materialName`, `unit`, `notes` mà không thông qua hàm mapper chính thức `mapBatchDtoToSummary`.
- **Rule TA-2 (No Tautological Mocking):**
  - CẤM mock hàm helper/transform của client (`vi.spyOn(service, 'method')`).
  - Điểm mock BẮT BUỘC phải ở ranh giới mạng (`apiClient` hoặc `global.fetch`) để kiểm thử trọn vẹn chuỗi: `HTTP Response JSON → Parser/Mapper → React Component DOM`.
- **Rule TA-3 (Zero Allowlist / Exemption Padding):**
  - Cấm sử dụng `test.skip`, `test.todo` hoặc nới lỏng assertions để ép test pass.
- **Rule TA-4 (Full 4-Scenario Coverage):**
  - Mỗi phân hệ MRX bắt buộc có đủ 4 bài test:
    1. *Kịch bản Thành công (Success)*: Render dữ liệu từ DTO C#, định dạng `<Num>`, `<IdentifierText>`, ngày tháng chuẩn.
    2. *Kịch bản Bị chặn / Rỗng (Empty/Blocked)*: API trả về mảng rỗng hoặc thiếu điều kiện tiên quyết $\rightarrow$ hiển thị StateBoundary rỗng có hướng dẫn.
    3. *Kịch bản Lỗi & Thử lại (Error + Retry)*: API trả về lỗi 500 $\rightarrow$ hiển thị lỗi kèm nút thử lại, giữ nguyên dữ liệu cũ (Zero-CLS).
    4. *Kịch bản Phân quyền & Xung đột (RBAC 403 & Conflict 409)*: Bắt đúng mã lỗi HTTP 403 và 409, hiển thị đúng cảnh báo tại chỗ mà không xóa form.
- **Rule TA-5 (Zero Fake API Data Guard):**
  - Toàn bộ các file trong `src/api/*.ts` tuyệt đối không chứa dữ liệu giả hoặc nuốt lỗi, được xác minh bằng `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. MA TRẬN 5 TRẠM VẬN HÀNH CHẾ ĐỘ MRX & CÁC THÀNH PHẦN KHÓA CỨNG

| Trạm vận hành | Route URL | Component phụ trách | Các Modal & Dialog liên kết | Trạng thái StateBoundary khóa cứng |
|---|---|---|---|---|
| **1. Điều phối lô MRX** | `/weekly-menu?view=mrx-batch` | `MrxBatchWorkbench.tsx`<br>`MrxBatchPreviewSection.tsx` | • `WeeklyMenuImportModal`<br>• `MrxBatchDishesModal` (có lọc ca & tìm kiếm)<br>• `MrxSourceChangeModal`<br>• `MrxReviewChangeModal` | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `isForbidden` (403)<br>• `isConflict` (409)<br>• `emptyScenario="prerequisite-blocked"` (kèm chip chọn tuần sẵn có) |
| **2. Kho xuất ngày & Bổ sung** | `/warehouse?view=mrx-daily` | `MrxDailyIssueWorkbench.tsx` | • `MrxSupplementalIssueModal` (hỗ trợ xuất trọn gói cả món)<br>• `ReconciliationIssueDetailModal` (xem chi tiết dòng phiếu xuất) | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `isPartial` (khi lô có ngày chưa áp dụng)<br>• `isForbidden` (403)<br>• State date-isolation (reset sạch quantities khi đổi tab ngày) |
| **3. Chuẩn bị xuất phối hợp** | `/warehouse?view=mrx-preparation` | `MrxMultiCustomerPreparationWorkbench.tsx` | • Tải file Excel chuẩn bị qua `downloadAuthenticatedFile`<br>• Modal xác nhận xuất phối hợp đa khách hàng | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `emptyScenario="prerequisite-blocked"`<br>• `isForbidden` (403) |
| **4. Hàng đợi Bù/Trả nguồn** | `/warehouse?view=mrx-issues` | `MrxSourceDeltaWorkbench.tsx` | • Modal xác nhận xử lý thay đổi nguồn (Xuất bổ sung vs Hoàn trả vật lý) | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `emptyScenario="filter-empty"`<br>• `isConflict` (409 expectedVersion) |
| **5. Bếp trưởng (Phiếu nấu)** | `/chef?view=mrx-cooking` | `MrxCookingWorkbench.tsx` | • Giữ nguyên chế độ chỉ đọc: Tải CSV/Excel phiếu nấu qua `downloadAuthenticatedFile`<br>• In trực tiếp | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `emptyScenario="filter-empty"`<br>• `isLegacyLineageMissing` |
| **6. Tháp điều hành & Chốt tuần** | `/reconciliation` | `ReconciliationPage.tsx`<br>`ReconciliationReportTables.tsx` | • `ReconciliationLineDetailModal`<br>• `ReconciliationDispositionModal` (có Bulk mode)<br>• `ReconciliationCompletionModal`<br>• `ReconciliationIssueDetailModal` | • `isLoading && !hasExistingData`<br>• `isFetching`<br>• `isReportLoading` (chống flash empty state)<br>• `isForbidden` (403)<br>• `isConflict` (409) |

---

## 3. TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE GATES)

1. **Khóa an toàn tải file**: 100% các nút tải CSV/Excel đều sử dụng token xác thực, 0 lần xuất hiện màn hình JSON báo lỗi 401.
2. **Khóa an toàn phân lập chế độ**: Truy cập `/weekly-menu` khi ở mode MRX tự động điều hướng sang `?view=mrx-batch`; truy cập `/warehouse?view=mrx-daily&date=...` hiển thị đúng bàn xuất kho ngày, không bị cướp quyền sang trạm chuẩn bị.
3. **Khóa an toàn trạng thái (Zero-CLS & Zero-Flash)**: Chuyển tab giữa các báo cáo không bao giờ xuất hiện thông báo rỗng tạm thời; đổi ngày ở kho không bao giờ rò rỉ số lượng của ngày cũ; mất kết nối mạng giữ nguyên dữ liệu cũ ở mức `opacity-70`.
4. **Kiểm toán kiểm thử (Test-Audit)**:
   - 100% test bám sát DTO C# backend (Rule TA-1).
   - Mocking diễn ra tại ranh giới mạng `apiClient` / HTTP (Rule TA-2).
   - Đủ 4 kịch bản kiểm thử hành vi (Rule TA-4).
   - Toàn bộ suite 18 tệp test FE pass 100%.
5. **Kiểm thử trình duyệt thực tế (Playwright & E2E Sandbox)**:
   - 10/10 test runtime Playwright pass.
   - Quét 30 cấu hình responsive (5 viewports x 6 routes): 0 thanh cuộn ngang ngoài ý muốn, 0 nút bị che khuất.
   - Quy trình toàn trình 7 ngày 4 tác tử trên database sandbox `ipc_mrx_e2e_sandbox` pass 100% trong dưới 1m45s.
6. **Kiến trúc bền vững**: Mọi tệp nguồn Frontend đều tuân thủ nghiêm ngặt `< 600 dòng`.
