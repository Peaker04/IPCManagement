# Specification: MRX — Sửa nguồn trực tiếp theo ngày chưa xuất & số suất Mặn/Chay

**Date:** 2026-10-30
**Status:** Approved in brainstorming (5/5 sections) — chờ owner review bản viết
**Scope:** `MATERIAL_RECONCILIATION` (MRX) — Weekly Menu source, Reconciliation batch, Warehouse daily read, Chef cooking read
**Branch khảo sát:** `feature/ui-interaction-data-states` @ `d0bf9f4`
**Dự án con:** 1/4 (xem §10)

---

## 1. Bối cảnh và vấn đề

MRX là vòng đối soát độc lập: kho mặc định luôn đủ, không có nhập kho, **không có trả hàng**. Owner yêu cầu ưu tiên số một: khi Admin hoặc Quản lý sửa thực đơn/số suất thì cập nhật trực tiếp, không qua duyệt, và đồng bộ toàn bộ luồng trên phạm vi những ngày chưa xuất.

Hiện trạng đã kiểm chứng trong source:

| # | Vấn đề | Bằng chứng |
|---|---|---|
| P1 | "Đã xuất" xét theo **cả lô**: chỉ cần một ngày có phiếu xuất thì mọi ngày khác không được cập nhật định lượng, chỉ sinh delta `PENDING` (xuất thêm/trả hàng) và không dựng lại dữ liệu phiếu nấu | `ReconciliationSourceRevisionService.cs:98,155-168,186` |
| P2 | Sau lần sửa đầu trên lô đã xuất, `batch.MenuVersionId` không đổi; lô bị ảnh hưởng được tìm theo phiên bản gốc → từ lần sửa thứ hai lô bị bỏ qua im lặng | `ReconciliationSourceRevisionService.cs:215,245` |
| P3 | Sửa trực tiếp (`admin-confirm`) và duyệt (`mrx-decision`) chỉ cho Admin; Quản lý không làm được | `WeeklyMenuImportsController.Amendments.cs:65-90` |
| P4 | Số suất chỉ một con số cho căn tin × ngày × ca; mọi món (cả chay lẫn mặn) nhân cùng số đó → định lượng bị đội | `ReconciliationMaterialProjection.cs:32-53` |
| P5 | Projection khử trùng theo `DishId` → món có ở cả thực đơn chay và mặn mất một phần đóng góp | `ReconciliationMaterialProjection.cs:35` |
| P6 | Import thực đơn tự ghi số suất bịa `100` với `complete: true` và nuốt lỗi | `WeeklyMenuImportModal.tsx:138-147`, `useMrxBatchWorkspace.ts:289-297` |
| P7 | Sau thao tác ghi, các màn MRX đọc lại cache cũ (refetch không `force`, chỉ xóa một key) | `useWorkbenchQuery.ts:104-118`, `useMrxBatchWorkspace.ts:269,279` |
| P8 | Ngoại lệ nghiệp vụ `InvalidOperationException` trong luồng này trả HTTP 500 | `ExceptionMiddleware.cs` (không có arm) |

Spec này thay thế **BR-MRX-RETURN-1** (`2026-10-30-mrx-adversarial-integrity-spec.md`) đối với dữ liệu mới, vì MRX không có trả hàng; và mở rộng **BR-MRX-LOCK-1** từ "lô TRANSFERRED/IN_PROGRESS/COMPLETED" thành "mọi lô đã tồn tại" (BR-MRX-EDIT-6).

---

## 2. Quy tắc nghiệp vụ

- **BR-MRX-EDIT-1 — Vai trò.**
  - Admin, Quản lý: áp dụng trực tiếp; lý do bắt buộc.
  - Điều phối: gửi yêu cầu; Admin hoặc Quản lý duyệt/từ chối (từ chối bắt buộc lý do).
  - Thủ kho, Bếp trưởng: không sửa nguồn.
- **BR-MRX-EDIT-2 — Đối tượng sửa.** Đổi món theo ngày × ca × slot; số suất **Mặn** và **Chay** theo căn tin × ngày × ca; import lại file thực đơn tuần.
- **BR-MRX-EDIT-3 — Khóa ngày.** Đơn vị khóa là **căn tin × ngày phục vụ**. Ngày đã có ít nhất một `InventoryIssue` của lô với `IssueDate` đó là ngày khóa: không sửa món, không sửa số suất, không sinh xuất thêm/trả hàng. Lô `COMPLETED` khóa toàn bộ. Lô `DRAFT`, `READY`, `TRANSFERRED`, `IN_PROGRESS` cho sửa các ngày chưa khóa.
- **BR-MRX-EDIT-4 — Tất cả hoặc không.** Yêu cầu có bất kỳ dòng nào chạm ngày khóa bị từ chối toàn bộ, không ghi gì, trả về danh sách ngày khóa.
- **BR-MRX-EDIT-5 — Đồng bộ.** Trong một giao dịch, với các ngày chưa khóa: phiên bản thực đơn, số suất, dòng định lượng theo ngày, tổng tuần và dữ liệu phiếu nấu (contributor) được cập nhật. Sau commit, Kho (danh sách cần xuất), Bếp (phiếu nấu), Đối chiếu, Dashboard và đơn tổng (dự án con 3) đọc ra số mới. Ngày khóa giữ nguyên giá trị đóng băng.
- **BR-MRX-EDIT-6 — Một đường sửa.** Khi căn tin × tuần đã có lô (mọi trạng thái), `quick-servings` và `bulk-update` ở MRX bị từ chối; mọi thay đổi đi qua dịch vụ áp dụng (§4). Trước khi có lô, sửa tự do như hiện tại.
- **BR-MRX-EDIT-7 — Đóng băng theo ngày.** Thay quy tắc "READY bất biến toàn lô" bằng: *số của một ngày bất biến kể từ khi ngày đó có phiếu xuất*.
- **BR-MRX-EDIT-8 — Lịch sử.** Mỗi lần áp dụng ghi một revision (người, vai trò, chế độ áp dụng, lý do, thời điểm) và các delta trước/sau theo ngày × nguyên liệu. Không xóa cứng dữ liệu.
- **BR-MRX-EDIT-9 — Xung đột.** Nếu ngày bị khóa giữa lúc xem trước và lúc áp dụng (Thủ kho vừa xuất), giao dịch bị từ chối với `MRX_DAY_LOCKED`; người sửa tải lại và tiếp tục với các ngày còn mở.
- **BR-MRX-SERV-1 — Số suất Mặn/Chay.** Món ở slot `vegetarian-*` nhân với số suất chay; mọi slot khác nhân với số suất mặn. `FinalServings = SavoryServings + VegetarianServings`.
- **BR-MRX-SERV-2 — Không bịa số suất.** Import không ghi số suất; ô chưa nhập hiển thị "Chưa nhập" và chặn kiểm tra định lượng/tạo lô.

---

## 3. Dữ liệu (chỉ thêm, không backfill)

1. **`mealquantityplanlines`** (dùng chung với DEFAULT): thêm `SavoryServings INT NULL`, `VegetarianServings INT NULL`. Khi cả hai khác null: `FinalServings = SavoryServings + VegetarianServings` (kiểm tra ở service). DEFAULT tiếp tục chỉ dùng `FinalServings`.
   - Dòng cũ (cả hai null) vẫn đọc được. Khi cần tính lại định lượng MRX cho ngày chưa khóa mà dòng chưa tách → chặn với `MRX_SERVINGS_SPLIT_REQUIRED`; không suy diễn.
2. **Projection** (`ReconciliationMaterialProjection`): xác định loại thực đơn bằng `WeeklyMenuImportSupport.ParsePersistedDishSlot`; khử trùng theo `(variant, DishId)`. Fingerprint nguồn lên **v3** (thêm hai số suất); preview v2 coi là cũ.
3. **`reconciliationbatchcontributors`**: thêm `FrozenMenuVariant VARCHAR(16) NULL` (`savory` | `vegetarian`); `FrozenServings` là số suất của đúng loại đó. Contributor cũ giữ null.
4. **Khóa ngày**: tính từ `inventoryissues` (`ReconciliationBatchId`, `IssueDate`); không lưu cờ. Thêm index `(ReconciliationBatchId, IssueDate)`.
5. **`reconciliationsourcerevisions`**: thêm `AppliedByRole VARCHAR(32) NULL`, `ApplyMode VARCHAR(24) NULL` (`DIRECT` | `APPROVED_REQUEST` | `REIMPORT`).
   **`reconciliationsourcedeltas`**: dữ liệu mới dùng `Status = APPLIED`; không sinh `SUPPLEMENTAL_ISSUE`/`RETURN_REQUIRED`. Delta `PENDING` cũ vẫn đọc được trong lịch sử nhưng **không chặn hoàn tất lô** (bỏ điều kiện tương ứng trong `ReconciliationCompletionService`).
6. **Gắn lô với nguồn**: sau mỗi lần áp dụng, `batch.MenuVersionId` luôn trỏ phiên bản mới; tìm lô bị ảnh hưởng theo **căn tin × tuần** (qua `MenuVersion`), không theo phiên bản gốc.
7. **Request**: `CreateMenuAmendmentLineRequest` thêm `NewSavoryServings`, `NewVegetarianServings`. Ở MRX, `NewServings` bị từ chối (400).

Migration EF: một migration thêm cột/index, không chuyển dữ liệu.

---

## 4. Backend

### 4.1 Dịch vụ áp dụng duy nhất

`MrxSourceChangeApplier.ApplyAsync(change, actor, mode)` dùng cho ba đường vào: sửa trực tiếp, duyệt yêu cầu của Điều phối, import lại. Chạy trong `EfTransactionRunner.ExecuteProtectedAsync` (serializable, kiểm tra mode/version trước và sau):

1. Kiểm tra quyền, lý do, `expectedBaseMenuVersionId`, `expectedBatchVersion` (nếu đã có lô).
2. Tìm lô chưa `COMPLETED` của căn tin × tuần; nếu lô `COMPLETED` → `MRX_BATCH_COMPLETED`.
3. Lấy tập ngày khóa (BR-MRX-EDIT-3). Có dòng chạm ngày khóa → `MRX_DAY_LOCKED` + danh sách ngày (BR-MRX-EDIT-4).
4. Tạo phiên bản thực đơn mới bằng `MenuAmendmentVersionMaterializer`; ghi số suất mặn/chay; audit từng trường.
5. Nếu đã có lô, với mỗi **ngày chưa khóa**:
   - tính lại yêu cầu từ nguồn mới;
   - dòng ngày hiện có: cập nhật `RequiredQuantity`, `Version++`; nguyên liệu mới: thêm batch line (nếu chưa có) và daily line; nguyên liệu bị bỏ: `RequiredQuantity = 0`;
   - thay contributor **chỉ của ngày đó**.
   Sau đó: cộng lại `RequiredQuantity` của batch line từ các daily line; `batch.MenuVersionId = phiên bản mới`; `batch.Version++`; ghi revision + delta `APPLIED`.
6. Tranh chấp với tạo phiếu xuất: tạo phiếu xuất cũng tăng `batch.Version`, nên một trong hai giao dịch nhận xung đột; phía sửa nguồn trả `MRX_DAY_LOCKED` nếu ngày vừa bị khóa, ngược lại `MRX_SOURCE_STALE`.

`ReconciliationSourceRevisionService.StageBatchAsync` được thay bằng logic trên (bỏ biến `issued` cấp lô).

### 4.2 API

| Endpoint | Disposition | Quyền | Thay đổi |
|---|---|---|---|
| `GET /api/reconciliation/weekly-menu` | Retained (giữ) | như hiện tại | Thêm theo ngày: `isLocked`, `lockReason`; theo ca: `savoryServings`, `vegetarianServings`; `batchStatus`, `batchVersion` |
| `POST /api/coordination/weekly-menu/amendments/preview` (nhánh MRX) | giữ disposition hiện tại | Admin, QL, Điều phối | Ở MRX trả thêm delta định lượng theo ngày × nguyên liệu và danh sách ngày khóa; không ghi |
| `GET /api/coordination/weekly-menu/amendments/mrx-inbox` | giữ | **Admin, Quản lý** | Danh sách yêu cầu chờ duyệt (mở thêm cho Quản lý) |
| `POST /api/coordination/weekly-menu/amendments/mrx-apply` | ReconciliationOnly | **Admin, Quản lý** | **Mới**, thay `admin-confirm` (xóa endpoint cũ cùng lúc với FE) |
| `POST /api/coordination/weekly-menu/amendments/mrx-submit` | ReconciliationOnly | Điều phối | Giữ |
| `POST /api/coordination/weekly-menu/amendments/{id}/mrx-decision` | ReconciliationOnly | **Admin, Quản lý** | Duyệt gọi `MrxSourceChangeApplier`; ngày đã khóa từ khi gửi → từ chối duyệt, yêu cầu chuyển `CORRECTION_REQUIRED` |
| `GET /api/reconciliation/batches/{id}/warehouse-daily` | ReconciliationOnly | như hiện tại | Thêm theo ngày: `lastRevisionAt`, `lastRevisionBy` |
| `GET /api/reconciliation/batches/{id}/kitchen-cooking[/csv\|/xlsx]` | ReconciliationOnly | như hiện tại | Thêm cột `menuVariant` (Mặn/Chay); `servings` theo loại |

Policy mới `ReconciliationSourceEditAccess` = Admin + Quản lý (dùng đúng các alias vai trò hiện có trong `AuthorizationPolicies`).

### 4.3 Import lại thực đơn khi đã có lô

Commit import ở MRX tạo một `change` cả tuần bằng cách so file với nguồn hiện tại: ngày khóa có nội dung giống → bỏ qua; ngày khóa có nội dung khác → từ chối toàn bộ (`MRX_DAY_LOCKED`). File không chứa số suất → số suất giữ nguyên. Áp dụng qua `MrxSourceChangeApplier` với `ApplyMode = REIMPORT` (Admin/QL) hoặc tạo yêu cầu (Điều phối).

### 4.4 Lỗi

Trả 4xx với `code` có cấu trúc trong `ApiResponse`: `MRX_DAY_LOCKED` (409), `MRX_SOURCE_STALE` (409), `MRX_BATCH_COMPLETED` (409), `MRX_SERVINGS_SPLIT_REQUIRED` (422), `MRX_BOM_MISSING` (422). Các ngoại lệ nghiệp vụ trong luồng này dùng `BusinessRuleException`/`ResourceConflictException`, không để rơi vào 500.

---

## 5. Frontend

Màn `/weekly-menu?view=mrx-batch`, theo UI Kit 3 vùng (`WorkspaceHeader`, `DataGrid`, `SplitView`, `StateBoundary`, primitives `components/ui`). Route mở cho Điều phối, Admin, Quản lý.

- **Lưới tuần** (cột ngày × hàng ca): mỗi ô có số suất *Mặn*, *Chay* (tổng tự cộng) và món theo slot chia nhóm Mặn/Chay. Ngày khóa: nhãn "Đã xuất kho", chỉ đọc, tooltip lý do. Số suất chưa nhập: "Chưa nhập", chặn *Kiểm tra định lượng*.
- **Luồng sửa:** *Chỉnh sửa* → sửa trên lưới (ô đổi được tô) → *Xem thay đổi* mở panel phải (định lượng trước/sau/chênh theo ngày × nguyên liệu, cảnh báo ngày khóa) → lý do → nút chính theo vai trò: Admin/QL "Áp dụng ngay" (hộp xác nhận tóm tắt số ngày/nguyên liệu bị ảnh hưởng); Điều phối "Gửi duyệt".
- **Yêu cầu chờ duyệt** (Admin/QL): danh sách, xem preview, Duyệt/Từ chối.
- **Import lại:** modal tóm tắt theo ngày (đổi / khóa-giống-bỏ-qua / khóa-khác-chặn).
- **Bỏ** đoạn tự ghi `servings: 100` sau import ở cả `WeeklyMenuImportModal` và `useMrxBatchWorkspace`.
- **Đồng bộ màn hình:** hàm `invalidateMrxScope(batchId, customerId, weekStartDate)` xóa mọi key cache MRX liên quan (preview, nguồn, daily, preparation, recon, cooking, dashboard) và được gọi sau **mọi** thao tác ghi MRX, rồi ép tải lại màn đang mở. Các workbench MRX tải lại khi tab được focus lại. Không làm realtime push.
- **Kho:** ngày chưa xuất có revision hiện "Đã điều chỉnh lúc HH:mm bởi … (vai trò)".
- **Phiếu nấu:** cột Mặn/Chay, số suất theo loại.
- **Lỗi:** map mã lỗi sang tiếng Việt; `MRX_DAY_LOCKED` tô đỏ ngày khóa trên lưới và giữ bản nháp.
- **Trạng thái:** loading, empty, error, permission-denied, partial (legacy/thiếu tách số suất), write-reconciliation.

---

## 6. Kiểm thử

**Backend (xUnit, fixture theo DTO C#, quy tắc TA-1..5):**
- Projection: chay × suất chay, mặn × suất mặn; món ở cả hai thực đơn tính hai lần; dòng chưa tách → `MRX_SERVINGS_SPLIT_REQUIRED`.
- Applier: ngày mở được cập nhật đủ (daily line, contributor, tổng tuần, version); ngày khóa giữ nguyên từng giá trị; yêu cầu chạm ngày khóa → không ghi gì; **lần sửa thứ hai vẫn tới lô** (hồi quy P2); lô `COMPLETED` bị từ chối; version cũ bị từ chối.
- Quyền: Admin/QL áp dụng được; Điều phối 403 với `mrx-apply` nhưng gửi được; Thủ kho/Bếp 403.
- Duyệt yêu cầu khi ngày đã khóa sau lúc gửi → từ chối.
- Import lại: ngày khóa giống → qua; khác → chặn.
- `quick-servings`/`bulk-update` bị chặn khi đã có lô.
- Không sinh `SUPPLEMENTAL_ISSUE`/`RETURN_REQUIRED`; delta `PENDING` cũ không chặn hoàn tất.
- Audit đầy đủ; mã lỗi 4xx đúng.
- Tranh chấp xuất kho vs sửa nguồn cùng ngày: chạy trên MySQL thật (`ipc_mrx_e2e_sandbox`), chỉ một bên thắng.

**Frontend (Vitest):** ngày khóa chỉ đọc; validation Mặn/Chay; panel preview đúng delta; nút theo vai trò; `invalidateMrxScope` được gọi sau mọi mutation; map mã lỗi.

**E2E (Playwright `e2e-mrx`, sandbox; owner chạy trên Windows):** import → nhập Mặn/Chay → tạo lô → chuyển Kho → Thủ kho xuất Thứ 2 → Quản lý đổi món + số suất Thứ 4 → kiểm DB (Thứ 4 đổi, Thứ 2 nguyên), màn Kho Thứ 4, phiếu nấu, Đối chiếu hiện số mới, đúng sau reload → thử sửa Thứ 2 bị chặn → Điều phối gửi, Quản lý duyệt.

---

## 7. Tài liệu cập nhật cùng thay đổi

- `docs/domain/material-reconciliation.md`: đóng băng theo ngày đã xuất (BR-MRX-EDIT-7), MRX không có trả hàng, số suất Mặn/Chay, quy tắc sửa nguồn; bỏ mô tả delta xuất thêm/trả hàng do đổi nguồn.
- `docs/FLOWS.md` §F7: luồng sửa nguồn.
- `docs/DOMAIN.md`: mã BR/FR mới.
- `.planning/WORK.md`: theo quy trình repo.

## 8. Triển khai

Migration chỉ thêm cột/index; lô cũ giữ nguyên. BE và FE phải deploy cùng lúc (xóa `admin-confirm`, đổi shape request). Không đổi chế độ vận hành, không seed dữ liệu.

## 9. Ngoài phạm vi

Nhóm loại NCC (dự án con 2); đơn tổng xuất file theo ngày/tuần (dự án con 3); gỡ toàn bộ code trả hàng khỏi MRX (dự án con 4 — spec này chỉ ngừng sinh việc trả hàng); các lỗi ngoài luồng này: phiếu nấu tải bị 401, lọc ca, KPI Dashboard, rò rỉ chế độ `CoordinationOrders`/`ProductionPlans`/`MaterialDemand` (dự án con 4).

## 10. Lộ trình dự án con

1. **Spec này** — sửa nguồn trực tiếp + số suất Mặn/Chay.
2. Nhóm loại NCC cho nguyên liệu (Admin quản lý, đóng băng vào lô).
3. Đơn tổng: xuất file theo khách hàng trong tuần, chọn theo ngày hoặc cả tuần, nhóm theo loại NCC; bảng nguyên liệu cả tuần.
4. Dọn dẹp: gỡ trả hàng khỏi MRX, sửa các lỗi đứt luồng đã kiểm chứng.
