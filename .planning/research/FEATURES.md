# Nghiên cứu FEATURES/BEHAVIOR — Milestone v1.1

**Milestone:** Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy  
**Ngày nghiên cứu:** 2026-07-16  
**Phạm vi:** Hành vi sản phẩm và tín hiệu nghiệm thu cho vòng đời BOM mới, cleanup dữ liệu legacy và các luồng phụ thuộc  
**Ranh giới đã chốt:** Giữ nguyên chứng từ đã khóa/hoàn tất và audit; chỉ dọn hoặc tái tạo dữ liệu nháp, dữ liệu đang hoạt động và bản ghi mồ côi đủ điều kiện.

## 1. Kết luận điều hành

Milestone không chỉ là “xóa dữ liệu cũ”. Sản phẩm cần một quy trình chuyển đổi có thể kiểm chứng gồm bốn hành vi nối tiếp: nhận diện workbook chuẩn, preview/reconcile, cleanup có phân loại phụ thuộc, và apply có audit/khả năng khôi phục. Nếu chỉ chạy SQL xóa BOM rồi import lại, hệ thống sẽ mất lịch sử điều chỉnh, làm đứt liên kết giải trình của material demand và có thể xóa nhầm catalog đang được chứng từ lịch sử tham chiếu.

Hai đường import đang tồn tại song song nhưng khác contract:

- `SampleDataImportService` đã nhận diện file `IPC. Định lượng 07.2026.xlsx`, ba sheet `định lượng suất 25k/30k/34k`, gộp dòng trùng theo bình quân gia quyền và ánh xạ đơn vị kỹ thuật cho nguyên liệu đếm được.
- Màn Admin và `DishesController` vẫn tải/preview/commit template cũ theo từng tier/customer với các cột như `DishCode`, `UnitCode`, `GrossQtyPerServing`, `EffectiveFrom`, `BomStatus`.

Vì vậy hành vi đích phải chọn workbook mới làm **canonical bulk contract duy nhất**, nhưng giữ CRUD BOM thủ công theo tier/scope/version. Bulk import cũ được retire sau khi UI/API mới đã thay thế và có kiểm thử hồi quy.

## 2. Bằng chứng hiện trạng

| Bề mặt | Hành vi hiện có | Khoảng trống/rủi ro cho v1.1 |
|---|---|---|
| Canonical importer | Đọc đúng tên file, ba sheet và các header tiếng Việt; hỗ trợ dry-run; tách tier 25k/30k/34k; gộp dòng trùng | Chỉ nằm trong sample-data importer Development và nhận đường dẫn thư mục, chưa phải workflow upload Admin có preview/apply token hóa |
| Đơn vị kỹ thuật | Ánh xạ `CAI`, `HOP`, `QUA`, `O`, `MIENG`, `CAY`, `LAT`; còn lại mặc định `KG` | Mapping là dictionary theo tên; cần báo cáo unknown/ambiguous và test contract để tránh silently gán KG khi workbook đổi tên |
| Bulk import Admin cũ | Tải mẫu thiếu/trống/theo món, preview và commit theo một tier/customer | Contract khác workbook canonical; duy trì cả hai lâu dài sẽ tạo hai nguồn sự thật |
| Manual CRUD | Thêm dòng, chỉnh published bằng version mới, ngừng áp dụng thay vì hard delete; có reason khi sửa | Đây là hành vi phải giữ; cleanup không được thay bằng “xóa rồi tạo lại” cho thao tác riêng lẻ |
| Cleanup migration | Xóa portion rule, `TMP-BOM-*`; null `materialrequestlines.bomId`; chỉ xóa dish/ingredient/warehouse khi không còn tham chiếu chính | Chưa phân biệt batch canonical/legacy đầy đủ; `Down` không phục hồi; không có preview thống kê hay audit batch |
| SQL một lần | Null toàn bộ material request BOM, xóa toàn bộ `bomadjustments`, `portionrules`, `dishbom` | Không được dùng làm hành vi production v1.1: phá lịch sử và vượt retention boundary |
| Replace catalog | `ReplaceBomCatalog` xóa mọi adjustment và BOM trước khi nạp lại | Không an toàn cho chứng từ lịch sử; cần thay bằng reconcile/version/retire theo batch và dependency policy |
| Phụ thuộc BOM | `materialrequestlines.bomId` có `SetNull`; line vẫn giữ snapshot định lượng/scope. `bomadjustments` phụ thuộc trực tiếp BOM | Có thể bảo toàn giải trình lịch sử nếu không xóa snapshot/audit; adjustment cần được giữ hoặc chuyển thành batch history trước cleanup |
| Phụ thuộc dish | `menuitems` và `productionplanlines` giữ FK bắt buộc tới dish | Dish đã từng dùng trong lịch sử phải deactivate/retain, không hard delete |
| Phụ thuộc ingredient | Tồn kho, movement, receipt/issue/return, material request, purchase request/order đều giữ FK bắt buộc | Ingredient có lịch sử giao dịch phải retain/deactivate; chỉ hard delete orphan thực sự |
| Bảng BOM Admin | Bảng hiện tại có `max-height`, scroll riêng, `table-fixed`, `colgroup`, min-width, action nowrap; search có padding icon | Đây là baseline cần khóa bằng UI test; tìm kiếm không được thay đổi chiều rộng/cột/chiều cao panel |

## 3. Table stakes — bắt buộc phải có

### TS-01. Một contract bulk canonical duy nhất

- Hệ thống nhận workbook mới bằng cấu trúc nội dung, không chỉ tin tên file.
- Bắt buộc có đủ ba sheet tier 25k/30k/34k và các cột nghiệp vụ canonical được version hóa.
- Preview phải hiển thị file hash, contract version, sheet được nhận diện, số dòng đọc/bỏ qua/gộp, tier và lỗi theo ô/dòng.
- Dòng trùng `tier + món + nguyên liệu` phải theo một quy tắc xác định: gộp bình quân gia quyền khi dữ liệu nguồn hợp lệ, hoặc block nếu không đủ căn cứ; không silently lấy dòng đầu.
- Giá trị định lượng, đơn vị, món, nguyên liệu hoặc tier không hợp lệ phải block apply, không chỉ cảnh báo chung.
- Contract cũ không còn là đường bulk import công khai sau khi cutover; các endpoint/DTO/template và client hook cũ chỉ được xóa sau khi đường mới pass compatibility gate.

### TS-02. Preview và apply là hai bước tách biệt

- Preview là read-only và không được tạo/cập nhật/xóa dữ liệu nghiệp vụ.
- Preview trả về một `previewId`/manifest bất biến gắn với hash file, actor, thời điểm, contract version và tập action dự kiến.
- Apply chỉ nhận manifest còn hiệu lực; nếu DB hoặc file đã đổi thì bắt buộc preview lại.
- Không cho apply nếu còn lỗi blocking, sheet thiếu, unit chưa giải quyết, dependency conflict hoặc chưa có backup marker.
- Apply chạy trong transaction/batch có trạng thái rõ ràng (`PREVIEWED`, `APPLYING`, `COMPLETED`, `FAILED`, `ROLLED_BACK` hoặc tương đương).
- Chạy apply lần hai với cùng workbook/batch không tạo bản ghi lặp và không làm dịch chuyển effective date thêm lần nữa.

### TS-03. Cleanup phải phân loại, không xóa theo pattern đơn thuần

Mỗi bản ghi ứng viên phải được phân vào một hành động trước khi apply:

| Loại ứng viên | Hành động mặc định |
|---|---|
| BOM cũ chưa từng được chứng từ tham chiếu | Retire/archive hoặc hard delete khi chứng minh là orphan và có backup |
| BOM cũ đã được material request lịch sử tham chiếu | Giữ snapshot và lịch sử; archive BOM, không phá giải trình |
| Dish cũ không nằm trong canonical workbook và không có tham chiếu | Có thể xóa sau preview |
| Dish cũ có menu/production history | Deactivate/đánh dấu legacy; không xóa |
| Ingredient cũ không có BOM, stock, movement hay document line | Có thể xóa sau preview |
| Ingredient có bất kỳ lịch sử kho/mua hàng/nhu cầu | Retain/deactivate; không xóa |
| Chứng từ `DRAFT` sinh từ BOM cũ | Hủy/tái tạo theo BOM mới trong cùng orchestration có audit |
| Chứng từ approved/locked/completed | Giữ nguyên dữ liệu và snapshot; không tính lại, không xóa |
| `TMP-BOM-*` không còn tham chiếu | Xóa idempotent |
| Portion rule/field định suất cũ | Loại bỏ sau khi chứng minh mọi consumer đã dùng fixed tier 100% |

Dry-run phải trả về số lượng theo từng bảng, từng action, từng reason và danh sách blocker; không chỉ trả tổng số xóa.

### TS-04. Bảo toàn chứng từ lịch sử

- Approved/locked/completed là immutable trong migration v1.1.
- Chứng từ lịch sử tiếp tục hiển thị định lượng, đơn vị, BOM scope/tier và giá trị đã dùng tại thời điểm phát sinh, kể cả khi BOM hiện tại đã archive.
- Material request line đã có snapshot định lượng không được cập nhật lại chỉ vì canonical BOM thay đổi.
- Audit, stock movement, receipt/issue/return, purchase request/order và production history không bị cascade delete.
- Nếu dish/ingredient đã có lịch sử nhưng không còn dùng, UI/catalog operational phải ẩn qua inactive/legacy status thay vì xóa entity.

### TS-05. Tái tạo có kiểm soát dữ liệu nháp

- Chỉ DRAFT/open document nằm trong phạm vi thời gian/batch đã chọn mới được invalidated hoặc regenerate.
- Preview cho biết tài liệu nào sẽ bị hủy, tài liệu nào sẽ được tạo lại và chênh lệch định lượng trước/sau.
- Material demand phải tiếp tục tính `servings × grossQtyPerServing × rate` trước khi trừ tồn kho; unit conversion phải xảy ra trước khi tổng hợp.
- Approved demand hoặc downstream purchase/warehouse document đã phát sinh phải trở thành blocker, không được tự động quay lại DRAFT.
- Kết quả regenerate phải trace ngược về canonical BOM batch mới.

### TS-06. CRUD thủ công tiếp tục hoạt động độc lập

- Admin vẫn thêm được một dòng BOM cho món/ingredient/tier/scope cụ thể.
- Sửa published tạo version mới, đóng effective date của version cũ và giữ adjustment/audit.
- Ngừng áp dụng là archive/close, không hard delete.
- Cấm overlap effective period trong cùng `dish + ingredient + unit + tier + customer scope`; DRAFT có thể overlap nếu product rule hiện tại vẫn được giữ.
- Customer override và global BOM không bị cleanup gộp lẫn; precedence phải được giữ.
- Manual change phải yêu cầu reason khi thay đổi dữ liệu đã published.

### TS-07. Audit, backup và rollback có thể vận hành

- Trước apply phải có backup identifier hoặc snapshot manifest có thể kiểm tra được.
- Audit batch ghi actor, thời gian, source file/hash, contract version, dry-run id, count trước/sau, action theo bảng, blocker override (nếu có) và lý do.
- Backup/restore drill phải được chạy trên DB test/staging, không chỉ ghi hướng dẫn.
- Nếu apply thất bại giữa chừng thì transaction rollback và batch chuyển FAILED, không để nửa catalog mới/nửa catalog cũ.
- Rollback nghiệp vụ chỉ được phép khi chưa có chứng từ locked/completed mới phụ thuộc batch; nếu đã có thì phải block và hướng dẫn corrective version thay vì xóa lịch sử.

### TS-08. UI Admin rõ ràng và ổn định

- Dùng shadcn-style `Dialog`, `Alert`, `Button`, `Table`, `Input`, `Select`, `Checkbox` và primitives hiện có; bổ sung destructive confirmation primitive nếu cần thay vì `window.confirm`/`alert`.
- Màn canonical import có các trạng thái: chưa chọn file, đang phân tích, preview hợp lệ, preview có warning, blocked, applying, completed và failed.
- Summary hiển thị theo tier và action: create/update/archive/deactivate/delete/regenerate/retain/block.
- Confirmation cuối phải nêu chính xác số bản ghi destructive, số chứng từ DRAFT tái tạo và cam kết locked/completed không đổi.
- Bảng BOM hiện tại giữ `table-fixed`, `colgroup`, min-width và scroll riêng. Search không làm bảng co/giãn; `Sửa` và `Ngừng` luôn cùng một hàng.
- Kết quả tìm kiếm rỗng vẫn giữ cùng table viewport/header/cột; không thay toàn bảng bằng card co nhỏ.
- Focus được đưa vào dialog, có escape/cancel, loading disable và thông báo lỗi đọc được bằng screen reader.

### TS-09. Quyền và môi trường

- Dry-run/apply cleanup là admin-only, rate-limited và có authorization policy riêng hoặc policy CatalogAccess được chứng minh đủ chặt.
- Endpoint sample-data Development không trở thành đường production ngầm; production workflow dùng API được thiết kế riêng cho canonical BOM/cleanup.
- Đường dẫn file phía server không được nhận trực tiếp từ UI production; dùng upload stream/storage object đã validate.

## 4. Differentiators — nên có để giảm rủi ro vận hành

### DF-01. Reconciliation matrix trước/sau

Hiển thị ma trận theo tier: số món, số ingredient, số BOM line, coverage, unit distribution, unsupported tier, zero quantity, overlap và missing BOM. Admin có thể drill-down tới dòng nguồn và entity đích.

### DF-02. Dependency-aware cleanup explorer

Mỗi ứng viên cleanup có “vì sao được xóa/không được xóa”, các FK/chứng từ đang tham chiếu và action cuối. Điều này biến cleanup từ SQL mù thành quyết định có thể audit.

### DF-03. Unit anomaly review queue

Ngoài mapping kỹ thuật đã biết, preview gom các tên gần giống/không nhận diện để Admin chọn đơn vị trước apply. Lựa chọn được ghi thành mapping có version và test fixture, không dựa riêng vào ngưỡng số lượng như `0.5–5`.

### DF-04. Historical explainability

Từ một material request line lịch sử, người dùng xem được snapshot BOM/tier/scope, source batch và reason adjustment đã tạo ra định lượng; BOM archive vẫn truy vết được nhưng không xuất hiện trong catalog active.

### DF-05. Safe cutover dashboard

Một release gate duy nhất hiển thị: backup ready, canonical preview pass, blockers bằng 0, DRAFT regenerated, locked checksum unchanged, quality checks pass và old-format references bằng 0.

## 5. Anti-features — chủ động không làm

- **Không** chạy `DELETE FROM dishbom`/`DELETE FROM bomadjustments` toàn cục như script one-time hiện tại.
- **Không** dùng `ReplaceBomCatalog` theo nghĩa xóa sạch catalog; thay bằng reconcile theo batch, version và retention policy.
- **Không** xóa dish/ingredient chỉ vì không còn trong workbook nếu chúng có lịch sử menu, production, kho, purchasing hoặc audit.
- **Không** regenerate approved/locked/completed document bằng BOM hiện tại.
- **Không** duy trì hai bulk template cũ/mới như hai nguồn nhập ngang hàng sau cutover.
- **Không** mặc định mọi giá trị từ `0.5–5` là KG hoặc mọi tên không map được là KG mà không phát cảnh báo review.
- **Không** cho commit trực tiếp khi chưa preview hoặc khi preview/file/database snapshot đã đổi.
- **Không** đưa đường dẫn máy cục bộ `D:\...` vào API/runtime production.
- **Không** biến màn Admin thành spreadsheet editor toàn năng; CRUD nhanh theo từng dòng vẫn có validation/versioning nghiệp vụ.
- **Không** làm bảng BOM auto-fit theo kết quả search hoặc để action xuống hai hàng.
- **Không** coi migration `Down` rỗng là kế hoạch rollback đủ dùng cho thao tác destructive.

## 6. Dependency map và thứ tự bắt buộc

```text
Contract canonical + retention matrix
  -> parser/validator + unit mapping versioned
    -> preview manifest + reconciliation report
      -> dependency classifier + backup marker
        -> apply/cleanup transaction + audit batch
          -> regenerate DRAFT/open downstream data
            -> post-apply invariant checks
              -> retire old bulk endpoints/template/client hooks/tests
                -> production cutover gate
```

Các dependency quan trọng:

1. Không retire old API/UI trước khi canonical preview/apply đã có và Admin route dùng nó.
2. Không hard delete BOM trước khi phân loại `materialrequestlines.bomId` và bảo toàn snapshot/audit.
3. Không xóa dish trước khi kiểm `menuitems`, `productionplanlines`, portion rule và lịch sử import.
4. Không xóa ingredient trước khi kiểm toàn bộ stock/current lot/snapshot/movement, receipt, issue, return, material request, purchase request/order.
5. Không regenerate material demand trước khi unit mapping/conversion canonical pass validation.
6. Không finalize cleanup batch trước khi checksum locked/completed, audit counts và quality report đều pass.
7. Không xóa code/DTO test cũ cho đến khi `rg`/GitNexus change detection chứng minh không còn consumer.

## 7. Acceptance signals

### 7.1 Canonical contract

- Preview nhận đúng ba sheet canonical và từ chối workbook thiếu/đổi tên cột bắt buộc bằng lỗi chỉ rõ sheet/cell/header.
- Tổng số dòng sau normalize khớp tổng action và tổng lỗi/bỏ qua; mỗi dòng nguồn có trace id.
- Mỗi BOM active có tier thuộc `{25000, 30000, 34000}`, quantity `> 0`, unit hợp lệ và không overlap trong cùng scope.
- Các nguyên liệu đếm được trong fixture dùng đúng technical unit; tên unknown xuất hiện trong review queue thay vì silently pass.

### 7.2 Idempotence và dữ liệu

- Apply cùng một manifest lần đầu tạo thay đổi dự kiến; lần hai tạo `0` thay đổi hoặc bị nhận diện là batch đã hoàn tất.
- Sau cleanup không còn `TMP-BOM-*` orphan, unsupported active tier, active BOM legacy hoặc FK orphan.
- Số dish/ingredient hard delete đúng bằng tập orphan trong preview; mọi entity có lịch sử chỉ inactive/archive.
- Data-quality report sau apply có `missing conversion = 0`, invalid unit active `= 0`, zero/negative BOM quantity `= 0`, overlap published `= 0`.

### 7.3 Retention/downstream

- Checksum/count của approved/locked/completed menu/production/material/purchase/inventory documents không đổi trước và sau apply.
- Lịch sử vẫn render được dish, ingredient, unit, quantity, tier/scope và audit reason dù catalog tương ứng inactive/archive.
- DRAFT trong scope được regenerate đúng một lần và chênh lệch nhu cầu bằng công thức BOM mới; DRAFT ngoài scope không đổi.
- Nếu một DRAFT đã có downstream approved purchase/issue/receipt, preview block apply với document id cụ thể.

### 7.4 Manual CRUD

- Các test add, overlap, non-overlap, draft overlap, published versioning, close/archive và customer override đều pass sau khi retire bulk import cũ.
- Sửa published giữ dòng cũ với effective-to trước ngày version mới; adjustment/audit có actor/reason.
- Ngừng áp dụng không làm mất material request history.

### 7.5 UI/shadcn

- Ở BOM list đầy đủ, sau search một món và ở empty result, bounding box table/header/cột không đổi ngoài nội dung row; scroll container vẫn có cùng kích thước cấu hình.
- Nút `Sửa` và `Ngừng` có cùng y-coordinate/hàng và không wrap ở viewport desktop mục tiêu.
- Search icon không chồng text; có automated visual/DOM assertion cho padding và action nowrap.
- Preview/apply/cleanup dialog điều hướng bàn phím được, focus trap đúng, destructive action có mô tả count và cancel mặc định an toàn.
- Loading/error/empty/success states đều có text và không phụ thuộc màu đơn thuần.

### 7.6 Audit/rollback/release

- Mỗi apply có một audit batch duy nhất với source hash, actor, before/after counts và backup id.
- Forced failure giữa apply chứng minh transaction rollback sạch và rerun được.
- Restore drill từ backup trên DB test tái lập được counts/checksum trước cleanup.
- Old-format endpoint/template/DTO/client hook/test fixture không còn reference sau cutover; build, lint, backend tests, smoke và visual checks pass.
- GitNexus `detect_changes` chỉ ra đúng các flow BOM/import/cleanup/material-demand/Admin UI dự kiến trước khi commit.

## 8. Khuyến nghị phân phase từ góc nhìn hành vi

1. **Contract & safety baseline:** khóa schema canonical, versioned unit mapping, retention/action matrix và backup protocol.
2. **Preview/reconciliation:** parser upload, manifest, errors/warnings, dependency classifier và dry-run API.
3. **Apply & downstream:** transactional reconcile/cleanup, audit batch, rollback gate và regenerate DRAFT.
4. **Admin shadcn surface:** canonical import/cleanup UI, stable BOM data table, manual CRUD preservation.
5. **Legacy retirement & verification:** xóa template/parser/DTO/endpoint/client cũ, invariant tests, restore drill và cutover dashboard.

## 9. Điểm cần khóa trong requirements

- Định nghĩa chính thức các status nào thuộc nhóm “locked/completed” cho từng domain, thay vì một danh sách string dùng chung.
- Thời gian/phạm vi DRAFT được phép regenerate khi cutover.
- Rollback window: trước khi phát sinh chứng từ locked mới hay theo số giờ/ngày.
- Policy với customer override cũ không tồn tại trong workbook global canonical: retain đến hết hiệu lực hay archive tại cutover.
- Contract version và cách cập nhật mapping technical unit khi workbook tháng sau đổi tên nguyên liệu.

---

*Research này mô tả hành vi đích và guardrail. Không sửa source code, migration hay dữ liệu runtime.*
