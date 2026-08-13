---
title: Chuẩn hóa UI/UX và dữ liệu FE–BE–Database
status: adopted-incremental
updated: 2026-08-03
scope: Các màn hình vận hành và chuỗi dữ liệu FE–BE–Database của IPC Management
source_of_truth: source code, test và evidence hiện hành
---

# Chuẩn hóa UI/UX và dữ liệu FE–BE–Database

## 1. Kết luận hiện trạng

Tại thời điểm `2026-08-03`, IPC Management **chưa nên được kết luận là đã chuẩn hóa 100% từ FE đến Database**. Trạng thái chính xác là:

| Phạm vi | Kết luận | Bằng chứng hiện có | Điều còn thiếu |
|---|---|---|---|
| UI/UX | Đã chuẩn hóa nền tảng; trạng thái gate hiện hành được quản lý tại [`MEMORY.md`](../MEMORY.md) | UI conformance matrix có normative rows; addendum UI/UX đã closeout; evidence authoritative nằm ở [`EVIDENCE-INDEX.md`](EVIDENCE-INDEX.md) | Các giá trị hình học chưa có nguồn chuẩn vẫn là `UNRESOLVED`; không được tự suy diễn thành pixel canon |
| Frontend data handling | Chuẩn hóa tốt ở lớp dùng chung nhưng chưa đồng nhất tuyệt đối ở mọi feature | Một `apiSlice`, `QueryView`, formatter và pagination contract dùng chung, có test contract tương ứng | `QueryView` mới là contract bắt buộc ở boundary đã migrate/pilot; các feature còn lại phải tiếp tục được kiểm tra khi chạm vào |
| Backend/API | Chuẩn về kiến trúc, response, auth, lỗi và transaction nền | Vertical slice, `ApiResponse`, validation, policy authorization, correlation ID, `EfTransactionRunner` | Một số invariant nghiệp vụ, audit coverage và import atomicity vẫn là việc mở |
| Database | Chuẩn về grain, khóa, quan hệ và nhiều integrity guard | `DATA-GRAIN-MATRIX`, EF migrations/configuration, unique index, foreign key, check constraint, row-version | Chưa khóa hết invariant ngoài UI; một số luồng import/audit cần chứng minh end-to-end |

**Quyết định sử dụng:** contract này đã được chấp nhận để áp dụng tăng dần. Mọi thay đổi UI/UX có liên quan số liệu, trạng thái, permission, filter, pagination hoặc mutation phải đi qua bản chuẩn hóa này. Không xử lý một lỗi dữ liệu bằng cách chỉ đổi cách hiển thị ở FE và không hiểu trạng thái `adopted-incremental` là mọi khoản nợ bên dưới đã hoàn tất.

## 2. Mục tiêu và phạm vi

Bản này là contract làm việc để:

- phát hiện vấn đề UI/UX có thể làm sai quyết định vận hành;
- xác định lỗi thuộc FE, API/service hay Database;
- giữ nguyên grain dữ liệu khi dữ liệu đi qua ba lớp;
- quy định điều kiện kiểm chứng trước khi gọi một thay đổi là hoàn tất;
- liên kết nguyên tắc UI/UX hiện có với gate, test và evidence thực tế.

Bản này **không thay thế** các nguồn chuyên biệt:

- quy tắc grain và chống double-count: [`DATA-GRAIN-MATRIX.md`](DATA-GRAIN-MATRIX.md);
- quyết định UI canon: [`UI-CONFORMANCE-MATRIX.md`](UI-CONFORMANCE-MATRIX.md) và [`PB-UI-VARIANT-AUDIT.md`](PB-UI-VARIANT-AUDIT.md);
- trạng thái/evidence hiện hành: [`MEMORY.md`](../MEMORY.md) và [`EVIDENCE-INDEX.md`](EVIDENCE-INDEX.md);
- điểm vào nguyên tắc UI/UX của IPCManagement: [`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md); rule normative đầy đủ: [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md).

### 2.1. Trạng thái rollout

- Contract dùng chung (`apiSlice`, `QueryView`, formatter, pagination và status presentation) là nền đã có trước khi tài liệu này được chấp nhận.
- Lát cắt triển khai đầu tiên của tài liệu là Dashboard: hai query owner `workflow overview` và `operational KPI` được phân loại qua `QueryView`; lỗi từng owner không còn render số `0` hoặc empty state giả, retry thuộc đúng owner và refresh giữ dữ liệu cũ.
- Warehouse exceptions và weekly purchase summary đã hoàn tất rollout tiếp theo; purchase summary không còn render bảng local/empty giả khi aggregate authoritative đang loading/error, còn refresh giữ hàng hiện tại.
- Inventory AST `frontend/tests/queryBoundaryInventory.test.ts` hiện bắt buộc mọi production query-hook owner dùng adapter chung hoặc có exception chính xác, có rationale và source marker; owner mới hoặc exception stale đều làm gate fail.
- Lát cắt Warehouse exceptions tiếp theo đã đưa danh sách cấp bổ sung, danh sách phiếu trả và chi tiết phiếu trả về cùng contract; error/forbidden không còn đi kèm bảng trống giả, còn refresh giữ hàng đang xem.
- Regression của lát cắt nằm tại `frontend/src/features/dashboard/pages/DashboardPage.state.test.tsx`.
- Regression Warehouse nằm tại `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.test.tsx`.
- Các boundary còn lại chỉ được ghi là đã migrate khi có source/test riêng chứng minh. Việc chấp nhận tài liệu không tự đóng bất kỳ `OPEN-*` nào trong `MEMORY.md`.

## 3. Chuỗi dữ liệu chuẩn bắt buộc

Một thao tác có ảnh hưởng nghiệp vụ phải giữ được chuỗi sau:

```text
Người dùng
  -> FE control + scope + permission + UI state
  -> API request/response + DTO + validation + error contract
  -> BE service + domain rule + authorization + transaction + audit
  -> Database grain + key + constraint + concurrency
  -> API response/cache invalidation
  -> FE reload và hiển thị lại đúng grain
```

Không được kết luận một flow thành công chỉ vì API trả `200`. Với mutation, evidence tối thiểu phải nối được:

`FE control → request → response → DB transition → FE sau reload`.

## 4. Contract UI/UX cần giữ khi xử lý vấn đề

### 4.1. State và layout

Mọi vùng dữ liệu dùng cùng đại số trạng thái:

`uninitialized | loading | refreshing | error | forbidden | empty | ready`.

Các quy tắc bắt buộc:

- `loading` lần đầu được phép dùng skeleton; `refreshing` giữ dữ liệu cũ, focus, scroll và trang hiện tại.
- `error` và `forbidden` không được render thành `empty`.
- Empty do filter phải khác empty do chưa có dữ liệu và phải có hành động khôi phục tương ứng.
- Table, pagination, badge, alert, toast và dialog không được làm thay đổi geometry của vùng người dùng đang thao tác.
- Bảng phải giữ contract của `TableViewport`/`PaginatedTableFrame`; trang cuối thiếu dòng không được làm pagination nhảy vị trí.
- Trạng thái phải có chữ và/hoặc hình dạng; không dùng màu làm kênh duy nhất.

### 4.2. Thông tin hiển thị

Một field chỉ được hiển thị ở worklist nếu phục vụ ít nhất một việc: ra quyết định, nhận diện đối tượng hoặc làm bằng chứng audit.

Không hiển thị trực tiếp cho người vận hành:

- GUID/primary key thô, tên bảng, tên cột, endpoint;
- enum kỹ thuật, HTTP status, stack trace, `traceId`;
- timestamp ISO/UTC thô, số lượng không có đơn vị;
- `isDeleted`, `version`, `etag`, `cacheTag`.

ID kỹ thuật vẫn phải được giữ trong data/action contract để drill-down và mutation; UI dùng mã nghiệp vụ, nhãn vai trò và thông báo có hành động khắc phục.

### 4.3. Action và feedback

- Nút bị chặn bởi điều kiện nghiệp vụ: hiện, disable và nói rõ lý do.
- Thiếu permission: ẩn nhất quán theo route/menu/action; không dùng trạng thái empty để che forbidden.
- Success ngắn: toast. Mutation error cần xử lý: inline persistent. Validation: cạnh field.
- Mutation tác động tồn kho, duyệt, sign-off hoặc tạo chứng từ phải xác nhận đúng object, hệ quả và lý do khi cần.
- Optimistic update chỉ dùng khi rollback không gây hiểu sai số liệu tồn kho/trạng thái; không re-sort hoặc đổi trang trước khi mutation settle.

## 5. Contract dữ liệu theo ba lớp

### 5.1. Grain là khóa nghiệp vụ, không phải tên hiển thị

| Loại dữ liệu | Grain tối thiểu | Quy tắc FE/API/DB |
|---|---|---|
| Nhu cầu ngày | `serviceDate + shift + customer + tier + ingredient + unit + sourceLine` | Không cộng xuyên ngày/ca; action đi tới source-line |
| Tổng hợp tuần | `week + serviceDate + customer + tier + ingredient + unit` | Nếu là tổng cả tuần phải ghi rõ grain; dòng tổng phải drill-down được |
| Kế hoạch/BOM | `dish + customer scope + tier + effective range + bomLine` | Không gộp ingredient chỉ vì tên giống nhau |
| Tồn hiện tại | `warehouse + ingredient + unit + snapshot` | Không cộng snapshot với movement trong cùng phép tính |
| Movement audit | `movementId + source document/line + time + warehouse` | Không deduplicate chỉ vì cùng tên nguyên liệu |
| Danh mục | `ingredientId` hoặc `dishId` | Trùng tên là data-quality case cần xử lý có duyệt |

Nguyên tắc bất biến:

1. React key, aggregate key và mutation key không được dùng tên nguyên liệu.
2. Mọi số lượng phải có `(đơn vị, grain)`.
3. `0`, `null/—` và `đang tính` là ba trạng thái khác nhau.
4. Aggregate presentation không được trở thành object để mutation; mutation phải dùng ID dòng nguồn.
5. Đơn vị gốc của chứng từ phải được giữ; quy đổi chỉ là thông tin phụ có dấu `≈`.

### 5.2. Frontend contract hiện hành

| Contract | Nơi chuẩn hóa | Điều kiện sử dụng |
|---|---|---|
| Query state | `frontend/src/lib/queryView.ts` | Boundary phải phân biệt loading, refreshing, error, forbidden và ready; empty chỉ dẫn xuất trong ready từ dữ liệu authoritative |
| HTTP/auth/cache | `frontend/src/api/apiSlice.ts` | Dùng một RTK Query slice; refresh session và invalidation phải theo owner/tag, không tạo slice hoặc registry thứ hai |
| Number/date/currency | `frontend/src/lib/formatters.ts` | Dùng formatter dùng chung; date-only không đổi timezone, timestamp dùng timezone vận hành |
| Pagination | `frontend/src/lib/paginationContract.ts` và adapter tương ứng | Phân biệt local, page-number và cursor; đổi filter phải reset owner page/cursor |
| Status/action | `frontend/src/lib/statusPresentation.ts`, action eligibility và permission contract | Nhãn người dùng khác enum kỹ thuật; action bị chặn phải có lý do |

Nếu feature chưa dùng đủ contract trên, đó là **khoản nợ chuẩn hóa**, không phải lý do để tạo một formatter, state algebra hoặc pagination variant mới.

### 5.3. Backend/API contract hiện hành

API cần giữ các quy tắc sau:

- response thành công dùng `ApiResponse<T>` hoặc contract feature đã được xác định rõ;
- lỗi validation trả field errors có thể map về control; lỗi domain dùng thông điệp nghiệp vụ;
- production không expose stack trace; `correlationId` dùng để tra cứu kỹ thuật;
- controller giữ trách nhiệm HTTP/auth/DTO, service giữ domain rule, repository/DbContext giữ persistence;
- permission được enforce ở BE, không phụ thuộc vào việc FE có ẩn nút hay không;
- mutation có nguy cơ retry/duplicate phải có transaction boundary, concurrency hoặc idempotency phù hợp;
- response phải trả đủ mã nguồn, unit, date/scope và status cần thiết để FE không phải suy đoán.

### 5.4. Database contract hiện hành

Database phải là lớp phán quyết cuối cho integrity:

- dùng EF migrations và entity configuration làm nguồn schema triển khai;
- khóa chính/ngoại, unique index và check constraint phải phản ánh đúng grain;
- field số lượng/tiền có precision rõ ràng;
- các bảng mutable nhạy cảm cần concurrency token/row-version khi có nguy cơ lost update;
- snapshot, source-line và movement là các loại dữ liệu khác nhau, không dùng một bảng/aggregate để thay thế lẫn nhau;
- transaction nhiều bước phải chạy qua `EfTransactionRunner` và có verify sau commit khi cần retry/uncertain commit;
- audit phải lưu được actor, thời điểm, object nguồn và kết quả chuyển trạng thái.

Deployment local ngày 03/08/2026 đã áp ba migration standardization cuối theo thứ tự lên base
`ipcmanagement`, sau đó đồng bộ tại chỗ lên `ipc_lane1`, `ipc_lane8`, `ipc_lane9` và
`ipc_e2e_template`. Cả năm database có 44 migration, zero pending; readiness fail-closed bằng
HTTP 503 nếu schema lại tụt sau source để không cho lỗi thiếu cột lan thành endpoint 500.

## 6. Phân loại lỗi để xử lý đúng nơi

| Triệu chứng | Kiểm tra đầu tiên | Không được làm |
|---|---|---|
| Hai dòng cùng tên bị gộp hoặc double-count | FE row/key → API key/quantity → DB source-line/movement → FE reload | Dùng `Max`, deduplicate theo tên hoặc đổi label để che lỗi |
| Trang cuối làm bảng/pagination nhảy | DOM geometry, row height, page-size và refresh state | Ẩn pagination hoặc thay toàn bảng bằng spinner khi refetch |
| Forbidden hiển thị như không có dữ liệu | HTTP 403, query adapter và boundary branch | Thay lỗi 403 bằng `[]` ở API/FE |
| Trạng thái sau mutation bị cũ | mutation response, invalidation tag, cache và reload | Bắt người dùng F5 hoặc sửa cục bộ không có nguồn |
| Hai người cùng sửa/duyệt một dòng | row-version/concurrency response và domain message | Nuốt 409 hoặc báo lỗi kỹ thuật chung chung |
| Nhập file lỗi khó hiểu | preview diagnostics, field/row scope, import token/checksum và transaction | Trả HTTP 500 generic hoặc ghi một phần dữ liệu rồi dừng im lặng |
| Số liệu không khớp giữa màn hình | kiểm tra grain, đơn vị, effective date và source-line | Cộng thêm một lớp aggregate ở FE để “cho khớp” |

## 7. Việc còn mở trước khi tuyên bố “chuẩn hoàn toàn”

Không còn mục `OPEN` nào trong scope standardization; Phase 7 closeout đã audit pass 26/26 requirement và 7/7 phase. Không được mở lại hoặc đóng một regression mới bằng assertion UI đơn lẻ; evidence phải đúng lớp và có regression tại lớp liên quan.

Follow-up ngày 03/08/2026 đã đóng request ownership toàn frontend: GET intent dùng cùng RTK cache key,
exact mutation concurrent có single-flight ở base query, late-401 không refresh lặp, còn input số suất
chỉ commit khi kết thúc edit. Regression unit/static và Chrome headed năm viewport đều pass; scope browser
dùng read-only stub nên không được mô tả là backend/database mutation E2E.

Đã đóng ngày 03/08/2026: `OPEN-02` bằng domain/API regressions cho BOM workbook hỏng; `OPEN-07` bằng preview ticket khóa checksum/phạm vi và provenance nullable cho dish tạo bởi import; `OPEN-08` bằng batch transaction atomic với forced-failure, retry và replay regressions; `OPEN-05` bằng audit old/new + actor + request correlation cho contract và menu-week range; `OPEN-06` bằng canonical customer/week tier, composite FK, unique scope, ba database trigger và shared service invariant; `OPEN-09` bằng workbook case matrix deterministic, source hash guard và headed E2E đủ năm viewport nối FE/API/DB/reload/rollback. Verification nằm trong Phases 2–6 của workstream standardization.

## 8. Definition of Done cho một thay đổi UI/UX có dữ liệu

Một thay đổi chỉ được xem là hoàn tất khi tất cả điều kiện phù hợp đều đạt:

- [ ] UI giữ đúng state algebra, geometry, action/permission và thông tin grain.
- [ ] FE dùng đúng query adapter, formatter, pagination và cache invalidation contract.
- [ ] API request/response có ID nguồn, unit, scope, date và status cần thiết; validation/error map được về UI.
- [ ] BE enforce auth, domain rule, concurrency/transaction/audit theo mức rủi ro.
- [ ] DB constraint hoặc service invariant bảo vệ dữ liệu, không chỉ dựa vào FE.
- [ ] Test liên quan pass; test mới khóa regression của chính vấn đề.
- [ ] Nếu là flow mutation/E2E: có chuỗi FE control → API → DB transition → FE reload.
- [ ] Khi thay đổi ảnh hưởng render/layout hoặc flow tương tác, browser gate dùng đúng năm desktop viewport trong `MEMORY.md`; không có overflow, console/page error, escaped mutation hoặc layout shift ngoài ngưỡng đã được duyệt.
- [ ] `git diff --check` và secret/stub scan pass; tài liệu liên quan được đồng bộ trong cùng thay đổi.

## 9. Bộ kiểm chứng tối thiểu

Chạy từ project root, không reset/seed/import lại database chỉ để làm test xanh:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --no-restore
npm run verify
git diff --check
```

Với thay đổi chỉ ở UI, vẫn phải chạy source-aware/UI tests phù hợp. Với thay đổi liên quan dữ liệu hoặc mutation, phải bổ sung API regression và E2E/browser evidence; không dùng kết quả BE/API riêng lẻ để kết luận UI đã đúng.

## 10. Nguồn kiểm chứng

- [Triết lý và cách áp dụng UI/UX](UI-PHILOSOPHY.md)
- [Bộ rule UI/UX Dashboard](DASHBOARD-UI-RULES.md)
- [Ma trận UI conformance](UI-CONFORMANCE-MATRIX.md)
- [Closeout UI/UX addendum](UI-UX-ADDENDUM-CLOSEOUT.md)
- [Ma trận grain dữ liệu](DATA-GRAIN-MATRIX.md)
- [Kiến trúc hệ thống](ARCHITECTURE.md)
- [Evidence index](EVIDENCE-INDEX.md)
- [Trạng thái hiện hành](../MEMORY.md)
- [Dashboard query-state regression](../frontend/src/features/dashboard/pages/DashboardPage.state.test.tsx)
