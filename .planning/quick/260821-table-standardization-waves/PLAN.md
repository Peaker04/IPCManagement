# Plan: Chuẩn hóa toàn bộ bảng theo wave

**Mục tiêu:** chuẩn hóa bảng, dữ liệu dài hạn, bố cục UI/UX và layout stability; mọi wave phải đóng được bằng evidence trước khi mở wave kế tiếp.

**Phạm vi:** toàn bộ route/page/table trong `frontend/src`, API/query projection liên quan, database chỉ khi có evidence chứng minh lỗi nguồn dữ liệu hoặc hiệu năng truy vấn.

**Nguồn chuẩn:** `docs/DASHBOARD-UI-RULES.md`, `docs/GLOSSARY.md`, `docs/UI-TAB-CONTENT-AUDIT.md`, `frontend/scripts/perf-probe.mjs`.

## Quy tắc bất biến giữa các wave

- Không sửa trực tiếp theo cảm nhận nếu chưa có table contract và số đo baseline.
- Mỗi bảng có một `grain`, một `rowKey`, một primary status owner và một scroll owner.
- Bảng chính giữ 5–7 trường quyết định; trường phụ vào detail/drawer/export.
- Dữ liệu nhiều năm phải phân trang/cursor phía server; không tải toàn bộ dataset về client.
- Không dùng tab cho preview/current/filter mode.
- Không kết luận lỗi UI là lỗi BE/DB nếu chưa trace đủ DB → query → DTO → mapper → FE model → renderer.
- Code rác/unused chỉ được xoá sau source search, typecheck và test discovery chứng minh không còn consumer.
- Không reset/seed/restore dữ liệu `ipc_lane1` để làm test pass.

## Wave 0 — Freeze baseline và inventory

**Mục tiêu:** tạo danh sách có thể kiểm đếm của mọi bảng và mọi consumer.

**Việc làm**

- Sinh `TABLE-INVENTORY.md` từ source, gồm route, tab, table id, file, grain, row key, columns, query owner, pagination, filters, detail surface.
- Đánh dấu loại bảng: action queue, ledger, aggregate, master/reference, checklist, import/preview.
- Chạy baseline production build và probe cho ma trận route/tab hiện hành.
- Ghi mọi orphan: component không import, hook không gọi, selector không gắn DOM, ownership tuple không có renderer, test fixture không có route.

**Checklist đóng wave**

- [ ] Inventory bao phủ hai chiều: source → registry và registry → source.
- [ ] Không có table id/row key trùng ngoài chủ ý.
- [ ] Mọi bảng có owner query và nguồn dữ liệu.
- [ ] Baseline JSON/Markdown đã lưu, không chứa credential.
- [ ] `npm run build`, `git diff --check` pass.
- [ ] Orphan list được phân loại `remove`, `wire`, `defer` kèm lý do.

**Go/no-go:** thiếu grain, row key hoặc data owner thì không được sang Wave 1.

## Wave 1 — Table foundation và layout contract

**Mục tiêu:** cố định primitives, kích thước và trạng thái để các wave sau không tạo biến thể riêng.

**Việc làm**

- Chuẩn hóa `DataTableShell`, header sticky, identifier sticky, empty/loading/error/retry, pagination, filter chips, detail drawer.
- Đặt tokens: compact 40px, standard 48px, spacious 56px; min-width badge; numeric alignment; `scrollbar-gutter: stable`.
- Bắt buộc skeleton giữ cùng chiều cao và cùng số cột với ready state.
- Thêm contract test cho `th/scope`, row key, tabular nums, overflow owner, density persistence.
- Xoá CSS/helper/component duplicate sau khi source-aware search xác nhận không còn consumer.

**Checklist đóng wave**

- [ ] Không có `TableV2`, `TableNew`, CSS fork hoặc formatter fork không có lý do.
- [ ] Loading/empty/error/ready không đổi kích thước vùng bảng.
- [ ] Header/cột định danh sticky đã có test.
- [ ] Density, column visibility và reset preference có owner rõ.
- [ ] Build + unit/contract + overflow smoke pass.
- [ ] Mọi thay đổi API/FE model kéo theo đã được ghi trong impact note.

**Go/no-go:** nếu primitive làm thay đổi DOM contract của nhiều bảng, phải migrate và test tất cả consumer trong cùng wave.

## Wave 2 — Action queue tables

**Phạm vi:** approvals, warehouse exceptions, data-quality, price warning queue.

**Việc làm**

- Ưu tiên sort theo cần hành động/quá hạn, không theo khóa chính.
- Giữ 5–7 cột; detail/action không đẩy chiều cao hàng.
- Gộp metric trùng giữa ContextStrip và bảng.
- Chuẩn hóa bulk action, focus, retry, forbidden và refresh snapshot.
- Kiểm tra primary status theo GLOSSARY, không để severity/approval/document status cạnh tranh.

**Checklist đóng wave**

- [ ] Mỗi queue có next action rõ trong 2 giây.
- [ ] Không duplicate record sau refetch/mutation.
- [ ] Filter chip, total count, pagination và empty state đúng.
- [ ] Action keyboard-accessible và không bị overflow.
- [ ] Perf probe: t0/tsettled, CLS, anchor, row height, skeleton count pass.
- [ ] Không còn component/hook cũ sau khi hợp nhất surface.

## Wave 3 — Long-lived ledger/document tables

**Phạm vi:** receipt, issue, movement, approval history, audit log, import history.

**Việc làm**

- Chuẩn hóa server pagination/cursor, date range, actor, document type, status.
- Kiểm tra query projection chỉ trả fields cần cho list; detail lấy riêng khi mở.
- Kiểm tra sort/filter ổn định qua nhiều năm và timezone.
- Thêm index/DB projection chỉ khi query plan hoặc timing chứng minh cần.
- Giữ identifier + source + timestamp, đưa metadata phụ vào drawer.

**Checklist đóng wave**

- [ ] Không endpoint nào tải toàn bộ dataset dài hạn về client.
- [ ] Total/page/cursor nhất quán sau filter/sort.
- [ ] Query plan và response size được ghi cho dataset lớn.
- [ ] API/DTO/mapper/FE model kiểm tra null, timezone, decimal, enum.
- [ ] Drawer/detail deep-link và giữ ngữ cảnh danh sách.
- [ ] Probe cold route dưới throttling không có CLS/scroll growth bất thường.

## Wave 4 — Aggregate/report tables

**Phạm vi:** price, demand, purchase, stock, movement, kitchen, usage, audit, data quality.

**Việc làm**

- Phân biệt dimension và metric; gộp min/max, variance/status, quantity/unit khi cùng quyết định.
- Dùng combobox cho góc nhìn cùng dataset; không sinh nested tabs mới.
- Kiểm tra denominator, unit, date range, weighted aggregate và empty semantics.
- Đối chiếu API aggregate với raw sample và tổng số dòng.
- Lazy-load chart/detail nếu table là primary surface.

**Checklist đóng wave**

- [ ] Mỗi bảng có mô tả scope/kỳ/đơn vị.
- [ ] Metric không lặp giữa header KPI, table và detail.
- [ ] Số liệu dùng formatter/tabular nums và căn phải.
- [ ] Aggregate total khớp API và fixture.
- [ ] Export dùng cùng filter/scope với bảng.
- [ ] Không có report subview chỉ khác label nhưng dùng cùng query/records.

## Wave 5 — Master/reference và import tables

**Phạm vi:** BOM, contracts, employees, catalog, approval rules, BOM preview/import jobs.

**Việc làm**

- Tách current/effective/version/preview thành state hoặc detail, không phải tab.
- Hiển thị tên trước mã; effective date và active state ổn định.
- Preview read-only, lỗi blocking có scope dòng/cột và action sửa.
- Kiểm tra provenance, checksum, stale preview và commit atomicity.
- Dọn hook/state/selector preview đã không còn gắn vào UI.

**Checklist đóng wave**

- [ ] Không còn technical tab `current`, `preview`, `raw`, `debug`.
- [ ] Không mutation nào đặt trong mỗi row nếu có thể dùng một dialog cấp trang.
- [ ] Error/warning/success phân biệt đúng semantic tone.
- [ ] Dữ liệu import: file → preview → commit → persisted record có evidence.
- [ ] Orphan preview code và fixture đã xoá hoặc ghi rõ deferred.

## Wave 6 — Cross-stack data correctness

**Mục tiêu:** xử lý các lỗi còn lại do truyền dữ liệu không hợp lý, không đoán mò.

**Protocol**

1. Chụp response thật/mock lớn và row UI bị sai.
2. Trace DB row/query projection.
3. So DTO/API response với mapper.
4. So RTK/query cache và FE page model.
5. So formatter và DOM cell.
6. Chỉ sửa lớp gây sai; thêm regression ở lớp đó và một E2E slice.

**Checklist đóng wave**

- [ ] Mỗi mismatch có evidence và root cause layer.
- [ ] Không sửa DB chỉ để che lỗi renderer.
- [ ] Không sửa FE formatter để che DTO sai kiểu.
- [ ] Migration/index có rollback và query evidence.
- [ ] Response shape, total count, sort và null semantics được khóa bằng test.

## Wave 7 — Perf, visual và hygiene closure

**Việc làm**

- Mở rộng `perf-probe.mjs` cho table width, column count, row-height delta, anchor, skeleton/ready signature và duplicate metric labels.
- Chạy production preview với H.1 throttling trên toàn ma trận.
- Chạy overflow bốn viewport và INP thao tác đổi filter/tab/mở detail.
- Xóa dead code, unused import, orphan registry, stale fixture, old selector và report artifact tạm.
- Cập nhật `docs/UI-TAB-CONTENT-AUDIT.md`, evidence index và history.

**Checklist đóng wave**

- [ ] `npm run build` pass.
- [ ] Unit/component/contract/E2E smoke pass.
- [ ] Probe load/inp/overflow pass hoặc từng N/A có lý do máy đọc được.
- [ ] CLS session window, LCP, anchor và denominator đều có evidence.
- [ ] `tsc`, lint, unused scan và `git diff --check` pass.
- [ ] Không còn orphan trong inventory.
- [ ] Working tree chỉ còn thay đổi đã khai báo.
- [ ] Báo cáo nghiệm thu cập nhật và commit atomically.

## Checklist đóng toàn bộ chương trình

- [ ] Tất cả 7 wave đều có checklist đóng và evidence link.
- [ ] Không còn item `defer` không có owner, lý do và thời hạn.
- [ ] Không còn code rác thuộc các surface đã loại bỏ.
- [ ] Không còn route/tab/table contract stale.
- [ ] UI rules, glossary, table inventory và code cùng một nguồn sự thật.
- [ ] Production bundle chạy ổn định dưới throttling.
- [ ] Không còn blocker cross-stack chưa được phân loại.

