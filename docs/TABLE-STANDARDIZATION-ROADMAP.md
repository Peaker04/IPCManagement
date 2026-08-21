# Roadmap chuẩn hóa bảng toàn dự án

Ngày lập: 2026-08-21  
Phạm vi chuẩn: `docs/table-contracts.json` và `docs/TABLE-INVENTORY.md`.  
Rule chuẩn: `docs/DASHBOARD-UI-RULES.md`, `docs/GLOSSARY.md`, `docs/DATA-GRAIN-MATRIX.md`.

## Mục tiêu và nguyên tắc điều phối

Roadmap này là nơi duy nhất khai trạng thái và thứ tự wave. Các file `WAVE-*-AUDIT.md` giữ finding và evidence chi tiết, không tự mở hoặc đóng wave.

Mỗi bảng phải được xử lý theo grain và mục đích nghiệp vụ, không áp một cấu hình chung cho mọi loại dữ liệu. Một wave chỉ được đóng khi:

1. toàn bộ surface trong scope có disposition `KEEP`, `CHANGE`, `REMOVE` hoặc `DEFER` có owner và lý do;
2. ảnh hưởng kéo theo tới query, API, cache, pagination, export, permission, route, test và tài liệu đã được xử lý hoặc ghi thành blocker của chính wave;
3. code/component/export/fixture/style/script bị thay thế đã có consumer proof trước khi xoá;
4. code mới có consumer production hoặc test contract rõ ràng, không để trạng thái “đã viết nhưng chưa gắn”;
5. build/test/source scan và runtime gate phù hợp đều có evidence.

`DEFER` không được dùng để đóng wave nếu hạng mục đó là điều kiện đúng của chính scope. Hạng mục chỉ được chuyển wave khi wave nhận đã tồn tại trong bảng phụ thuộc bên dưới và có tiêu chí nhận cụ thể.

## Trạng thái wave

| Wave | Phạm vi | Trạng thái | Điều kiện đi tiếp |
| --- | --- | --- | --- |
| 0 | Inventory, grain, owner, row key, pagination contract | CLOSED | Contract source-backed và inventory không orphan |
| 1 | Primitive, density, skeleton, viewport, ownership migration | CLOSED | Không còn direct production table ngoài canonical viewport; legacy selector đã disposition |
| 2 | Action queue và exception workbench | CLOSED | Eligibility/action/status owner rõ; bảng chất lượng đã rút gọn |
| 3 | Ledger, document và dữ liệu lưu nhiều năm | IN PROGRESS | Import history/ledger có server boundary, date semantics và context-preserving detail |
| 4 | Master/reference và document master-detail | NOT STARTED | Effective range, history, permission và detail layout đúng grain |
| 5 | Aggregate/report/KPI và loại bỏ duplicate thông tin | NOT STARTED | Không KPI/bảng/cột lặp cùng fact; drill-down giữ nguồn |
| 6 | FE↔BE↔DB cho dữ liệu dài hạn | NOT STARTED | Query projection, index, paging/cursor, DTO/date/unit và payload budget có số đo |
| 7 | Geometry, loading stability, INP, overflow trên toàn inventory | NOT STARTED | Probe đủ route/tab/surface; row token, CLS/CGR/INP/overflow đạt, integrity sạch |
| 8 | Dead/unwired code, regression toàn dự án và closeout | NOT STARTED | Zero orphan không disposition; full gate và docs trạng thái thống nhất |

## Wave 3 — Ledger và document dài hạn

Áp dụng cho audit event, stock movement, import history, receipt/issue/PO history và các bảng chứng từ có retention nhiều năm.

### Cách xử lý

- Dùng server cursor/page theo thứ tự ổn định; không tải toàn bộ rồi phân trang ở FE.
- Mọi row key là document/source-line/event ID, không dùng tên hay index.
- Có time range và timezone semantics rõ; sort phải deterministic khi timestamp trùng.
- List chỉ giữ trường quyết định; payload/audit diff dài đi vào detail/drawer có bounded scroll.
- Reload/refetch giữ filter, cursor/list context và không làm biến mất hàng cũ trong background fetch.

### Checklist đóng Wave 3

- [x] Canonical viewport và stable row key cho surface đã audit.
- [x] Import history có server page/date/customer boundary.
- [x] Import-history rollback eligibility được batch theo page; regression khóa query count hằng số (4 query cho page, không phụ thuộc số hàng).
- [x] FE history query truyền active customer scope và reset page khi customer đổi; focused hook regression pass.
- [x] Backend history date window regression covers inclusive `DateOnly` bounds across 2023→2030 and deterministic newest-first ordering.
- [x] OpenAPI marks `weekStartDate` as `format: date`; FE date formatter uses the date prefix without timezone conversion, with a timestamp regression.
- [x] Rollback hook regression proves the current history page remains selected after the mutation; customer scope/page reset remains limited to an actual scope change.
- [x] Source-aware ledger consumer scan records production/test consumers for shared movement, import-history, audit, receipt, role-inbox and import-job owners; no export-only ledger owner found.
- [x] SQL interceptor regression proves the history page query contains a database `LIMIT`; query count remains constant per page.
- [x] Probe bảng chất lượng xác nhận hàng `48→53px`, growth `0.0913`, không đổi ngưỡng.
- [x] Fixture nhiều năm chứng minh page-size 1 trả ít item/bytes hơn page-size 10 trên cùng retention history; SQL interceptor xác nhận server `LIMIT`.
- [ ] Production database `EXPLAIN`/index evidence remains a Wave 6 cross-stack carry-over (`W3-CARRY-01`), not inferred from SQLite tests.
- [ ] DTO null/date/timezone có regression.
- [ ] Detail/rollback quay lại đúng filter/page/cursor sau refetch.
- [ ] Mỗi ledger surface trong contract có retention và pagination disposition được kiểm chứng từ source.
- [x] Consumer scan cho shared movement/import components; export hoặc fixture cũ được giữ/xoá có bằng chứng.

Carry-over `W3-CARRY-01`: Wave 6 phải chạy `EXPLAIN` trên production-like multi-year fixture cho import history và đối chiếu index `(customerId, weekStartDate, createdAt)`/sort order trước khi tối ưu DB.

## Wave 4 — Master/reference và master-detail

Áp dụng cho BOM, nhân viên, hợp đồng, báo giá, catalog và document header/line.

### Cách xử lý

- Tên người dùng đọc đứng trước mã; metadata phụ không thành cột riêng nếu không phục vụ sort/filter/action.
- Effective range, active state và approval state không trộn thành một trạng thái.
- Header và line dùng master-detail; không nhân header facts trên mọi dòng.
- Action phải theo permission/eligibility từ owner; modal/drawer không tạo máy trạng thái song song.

### Checklist đóng Wave 4

- [x] Wave 4 audit bắt đầu tại Admin Contracts: duplicate `BOM áp dụng 100%` đã bỏ khỏi ContextStrip, giữ tại cột bảng; focused render test khóa chỉ còn một fact presentation.
- [x] Effective-range cell chỉ hiển thị khoảng ngày (`Không giới hạn` khi không có ngày cuối); contract status giữ riêng tại cột trạng thái. Import-history page reset carry-over cũng được sửa thành scope-keyed state để loại effect render cascade; lint và 8 focused tests pass.
- [x] Admin Contracts user-facing copy bỏ `contract/version`, dùng `hợp đồng/phiên bản`; Supplier Quotations và Employees được disposition `KEEP` vì range, active state và row action là các quyết định riêng, không phải duplicate fact.
- [x] BOM current/preview được giữ là hai state của import workflow, không phải nested navigation. Floorplan/UI audit/conditional fixture đã bỏ technical-tab assumptions; read-only inventory còn 15 owner, preview tiếp tục thuộc mutation/import workflow evidence.
- [x] BOM summary được single-owner ở context cấp trang; panel không lặp lại fact và số dòng kiểm tra dùng `totalRows`. Copy thao tác đã đổi sang ngôn ngữ nghiệp vụ; test contract khóa duplicate/technical copy.
- [x] Phiếu nhập master list không còn chỉ đọc 20 header đầu: query phân trang theo `totalCount`, detail selection được reset khi đổi trang; focused lifecycle contract 7/7.
- [x] Natural label/stable ID/effective-range disposition đã được source-scan cho BOM (`dish.id + bomId`, ngày hiệu lực), contracts (`customerId`, range/status tách), quotations (`quotationId`, range/active tách), employees (`userId`, active/role tách), receipt (`receiptId`/`receiptLineId`, header-line tách). Không còn một owner nào dùng tên hiển thị làm React key.
- [x] Duplicate header facts đã chuyển khỏi line table hoặc có lý do giữ: receipt header chỉ ở master/detail header, dòng chỉ giữ nguyên liệu và số lượng; BOM summary có single-owner; contracts không nhân header fact vào line.
- [ ] Edit/detail action giữ list context và focus return.
- [x] Permission, empty/loading/error và optimistic/refetch state đã có regression ở focused contracts: Admin BOM feedback, Admin Employees confirmation, Supplier Quotations state, Warehouse receipt lifecycle; các test contract đều chặn empty/error giả và giữ selection sau refetch.
- [ ] Component/form/style cũ bị thay thế đã source-scan và xoá cùng consumer cuối.

### Wave 4 carry-over audit

| Carry-over | Owner | Evidence hiện hành | Disposition |
|---|---|---|---|
| Edit giữ list context | Employees, Contracts, Quotations | mutation/refetch tests giữ page/selection; chưa có browser focus assertion | Mở — bổ sung focus return contract trước khi đóng wave |
| Dead/unwired component cleanup | frontend scripts + UI fixtures | `docs/CODE-CLEANUP-INVENTORY.md`, source-aware scan | Mở — Wave 7/8, không xoá đoán mò |
| Production-like retention/query plan | Import history | `W3-CARRY-01` | Chuyển Wave 6 — cần EXPLAIN trên MySQL fixture |

## Wave 5 — Aggregate, report và duplicate thông tin

Áp dụng cho KPI, demand/cost/purchase summary, statistics và các góc nhìn báo cáo.

### Cách xử lý

- Một fact chỉ có một vị trí chính; KPI không lặp lại nguyên bảng nếu không thêm quyết định.
- Tổng hợp luôn có grain/time scope/unit và drill-down về source ID.
- Các góc nhìn chỉ đổi tham số được biểu diễn bằng filter/combobox, không tạo technical nested tab.
- Danh sách mục tiêu 5–7 cột; secondary text/tooltip/detail dùng cho thông tin bổ trợ.

### Wave 5 initial fact/owner audit

| Surface | Fact/grain | Primary owner | Duplicate risk | Disposition |
|---|---|---|---|---|
| Reports Data Quality | workflow quality issue page + read-only KPI/report scope | Reports | Cùng backend projection với Admin Cleanup | KEEP BOTH: Reports chỉ xem, tìm kiếm và điều hướng; Admin Cleanup là owner remediation mutation. Không gộp hai action owner.
| Admin Cleanup | quality issue page + remediation state | Admin Data | Lặp một phần KPI Reports | KEEP ACTION OWNER: KPI rút gọn, mutation chỉ ở Admin.
| Reports Price | receipt-line / supplier / month / dish-group aggregate | Reports Price combobox scope | Bốn bảng đổi tham số | KEEP AS FILTERED VIEWS: không nested technical tab; mỗi bảng có grain và pagination riêng. Context metric đã sửa thành `warning/pageRows` có mẫu số.
| Reports Demand/Purchase | day demand vs purchase-plan source-line | Reports | Dễ trùng tổng shortage/estimated amount | FIXED: `PurchasePlanPageDto` totals are calculated from the full filtered row set before `Skip/Take`; page-size regression locks this contract.
| Weekly Menu Purchase Summary | day–material demand hoặc week–material BOM projection | Weekly Menu scope | KPI shortage/pending dùng từ day–material lines nhưng label cũ ghi “nguyên liệu” | FIXED: label đã đổi thành `Dòng ...`, giữ hai mode và pagination riêng.

### Checklist đóng Wave 5

- [x] Ma trận `fact → KPI/table/detail` không có duplicate không chủ đích.
- [x] Purchase-plan aggregate totals remain full-scope when the UI page is limited; backend regression covers `PageSize = 1` with `TotalCount = 2`.
- [x] Aggregate không double-count và không trộn day/week/source-line grain; backend regression khóa day/week grouping và unique `(period, ingredient, unit)`.
- [ ] Unit/currency/date format thống nhất FE và export.
- [x] Export nêu rõ page-scope trên UI và giữ các aggregate field cần đối chiếu (`estimatedUnitPrice`, `estimatedAmount`) trong purchase-plan CSV.
- [ ] Mọi technical tab/view còn lại đã giữ hoặc loại bằng phân tích nghiệp vụ.
- [ ] Report query/cache key đổi góc nhìn không trả stale data.

## Wave 6 — Truyền dữ liệu dài hạn FE↔BE↔DB

Wave này chỉ sửa cross-stack khi evidence ở Wave 3–5 chứng minh vấn đề không thể giải quyết đúng ở presentation.

### Cách xử lý theo lớp

| Lớp | Bắt buộc kiểm | Không được làm |
| --- | --- | --- |
| DB | index theo filter/sort thực, keyset order, query plan, retention | thêm index đoán mò hoặc đổi grain |
| BE | projection tối thiểu, server filter/sort/page, cancellation, deterministic order | trả entity graph đầy đủ rồi cắt ở FE |
| API/DTO | page metadata/cursor, null/date/unit semantics, payload budget | overload một field cho nhiều nghĩa |
| FE | stable args/cache key, giữ previous data, bounded render, exact invalidation | client-side pagination trên tập nhiều năm |

### Checklist đóng Wave 6

- [ ] Query plan và response bytes đo trên fixture nhiều năm.
- [ ] Page/cursor không duplicate/missing row khi dữ liệu mới được chèn.
- [ ] API contract, OpenAPI và FE type đồng bộ.
- [ ] Filter/sort/export dùng cùng semantics.
- [ ] Không N+1, overfetch entity graph hoặc cache key thiếu scope.
- [ ] Regression nối DB result → API payload → FE row/count.

## Wave 7 — Runtime geometry và performance

Chạy production build dưới H.1 cho toàn bộ route/tab/table contract, không chỉ ba route mẫu.

### Wave 7 open findings

| ID | Owner | Evidence hiện có | Điều kiện đóng |
| --- | --- | --- | --- |
| W7-RUNTIME-01 | Runtime/FE | Static check pass: 9 routes, 27 targets, 8 interactions; production build/lint pass. Rebuilt production bundle with `VITE_API_BASE_URL=http://127.0.0.1:5262`; H.1 load integrity is `0`, but `schedule` now exposes a real failure (`deltaTop=316px`, `CLS window=0.1287`) and `reports-price`/`admin-audit` remain correctly `N/A` with 0 settled data rows. | Fix the schedule mount shift without changing thresholds; provide valid data/selector coverage for the two N/A targets; then run `--load`, `--inp`, `--overflow` across all five desktop viewports and preserve request/console/page errors before closing Wave 7. |

### Checklist đóng Wave 7

- [ ] Mỗi contract có ít nhất loading và ready measurement; empty/error cho owner conditional.
- [ ] Skeleton count/cột/density khớp ready table; hàng settled không vượt token density.
- [ ] Probe in selector và mẫu số cho mọi tỷ lệ; missing anchor/data trả `N/A` có lý do.
- [ ] CLS, CGR, scroll growth, INP decomposition và overflow đạt ngưỡng canonical.
- [ ] Desktop viewport matrix đúng `MEMORY.md`; screenshot chỉ là reviewer artifact.
- [ ] Request, console/page error, long task và final DOM JSON được lưu.
- [ ] Không sửa threshold hoặc thêm khoảng trắng/chiều cao giả để làm gate xanh.

## Wave 8 — Dead/unwired cleanup và closeout

Cleanup diễn ra trong từng wave; Wave 8 là sweep cuối, không phải nơi dồn nợ.

### Phân loại bắt buộc

| Loại | Proof để `REMOVE` | Nếu còn nghi ngờ |
| --- | --- | --- |
| Component/hook | zero import, zero lazy/registry/string consumer, build/test pass | `KEEP-REVIEW` kèm owner |
| Export | zero import từ barrel và direct path | giữ cho tới khi source-aware scan đủ |
| CSS selector/token | zero JSX/class/string/generated consumer và visual gate pass | không xoá bằng grep đơn lẻ nếu class sinh động |
| Route/tab/permission token | không còn registry, deep-link, preference, test fixture hoặc BE contract | xử lý cùng mọi consumer, không xoá riêng UI |
| Script/config | không có package/CI/docs/manual invocation và có replacement | ghi replacement command trước khi xoá |
| Test fixture/mock | không được discovery/import và không còn khóa contract hiện hành | cập nhật inventory/count-lock cùng commit |
| Code đã viết chưa gắn | có contract cần dùng thì wire + test; không có contract thì remove | không giữ vì “có thể dùng sau” |

### Checklist đóng Wave 8

- [ ] Source-aware unused scan có disposition cho mọi candidate.
- [ ] Dependency-cruiser/build/lint/test discovery không báo orphan mới.
- [ ] Route/tab/preference/permission/API/cache literals khớp source hiện hành.
- [ ] Không còn file mới chưa tracked thuộc production scope.
- [ ] Repository `git diff --check`, secret/stub scan và full regression pass.
- [ ] Runtime probe Wave 7 vẫn pass sau cleanup.
- [ ] `MEMORY.md`, history, evidence index và audit docs không mâu thuẫn.

## Gate ảnh hưởng kéo theo giữa các wave

Trước mỗi commit và trước khi đóng wave, điền đủ bảng sau trong audit của wave:

| Hạng mục thay đổi | Consumers/callers | API/cache/DB | Route/permission | Test/fixture | Docs/evidence | Kết quả |
| --- | --- | --- | --- | --- | --- | --- |
| `<file/symbol/contract>` | paths đã kiểm | affected/N/A | affected/N/A | paths đã cập nhật | paths/artifact | handled/blocker |

Quy tắc chuyển wave:

- Wave sau chỉ nhận một finding nếu finding có ID, owner, source evidence, tiêu chí hoàn tất và regression cần chạy.
- Nếu thay đổi làm phát sinh lỗi ở surface ngoài scope nhưng cùng shared owner, surface đó nhập vào wave hiện tại.
- Nếu lỗi chỉ lộ ra ở lớp khác nhưng quyết định đúng phụ thuộc grain/contract hiện tại, dừng đóng wave và xử lý cross-stack trong cùng wave hoặc kích hoạt Wave 6 với finding cụ thể.
- Không đánh dấu `PASS` từ build riêng, API riêng hoặc screenshot riêng.

## Lệnh gate tối thiểu

Chạy từ root, điều chỉnh focused suite theo file đã chạm:

```powershell
node frontend/scripts/perf-probe.mjs --check
npm run test:unit -w frontend -- --run tests/tableContracts.test.ts
npm run depcruise -w frontend
npm run lint -w frontend
npm run build -w frontend
git diff --check
```

Runtime/browser và backend regression được bổ sung theo checklist của wave; các lệnh tối thiểu trên không thay thế chúng.
