# Audit trạng thái database và hướng tối ưu — 2026-08-10

## Kết luận điều hành

Audit này chỉ đọc, không reset/seed/restore/migrate/drop và không truy cập `ipc_lane1`. Hai schema
được kiểm tra là `ipc_lane9` (lane hiện hành trong `MEMORY.md`) và `ipcmanagement` (base legacy).

Chưa nên tối ưu query hoặc dọn bảng ngay. Rủi ro lớn nhất hiện tại là **schema integrity và recovery**:

1. `ipc_lane9` đủ 64 bảng ứng dụng và 60 migration nhưng chỉ còn 15/164 foreign key mà EF model kỳ
   vọng và mất cả ba trigger price-tier. Nguyên nhân đã xác định trong source:
   `IPCManagement.DatabaseTool clone` chỉ copy base table bằng `CREATE TABLE ... LIKE`; MySQL công bố rõ
   thao tác này không sao chép foreign key, còn tool không inventory/copy trigger. Verify clone hiện
   chỉ so danh sách bảng và row count nên vẫn báo PASS.
2. `ipcmanagement` chỉ có 44/60 migration, thiếu 10 bảng và 143 cột model hiện hành. Dữ liệu legacy
   còn 2.461 movement lệch phương trình số dư, 84 schedule lệch tuần và 176 line demand đang hoạt động
   thiếu BOM lineage. Không được chạy source hiện hành trên base này trước một migration/reconciliation
   gate riêng.
3. Backup có số lượng nhiều nhưng recovery posture yếu: 106 file / 351.735.547 byte, chỉ một bản
   off-site ngày 28/07, 0 ZIP có encrypted flag, restore rehearsal mới nhất chỉ chứng minh schema 41
   migration. ZIP đọc được không đồng nghĩa restore được schema 60 migration hiện tại.
4. Lifecycle outbox trên lane9 không vận hành: 432/432 row còn `PENDING` và quá 5 phút. Đây là lỗi
   vận hành/consumer, không phải bài toán index.

Khuyến nghị: đóng P0 về clone/FK/trigger, chạy restore drill hiện hành và đưa
outbox relay vào vận hành trước; sau đó mới xử lý catalog coverage/constraint và cuối cùng mới thử
index/drop bằng workload đại diện.

Theo quyết định của owner, `ipcmanagement` là **base đích cuối**. Lane9 là rehearsal/candidate
validation, không phải database để clone đè lên base. Chỉ promote reviewed migration và
reconciliation script đã pass từ lane sang base, giữ nguyên data lineage của base.

## Implementation update — 2026-08-10 01:16 ICT

Phần này supersede các P0 schema drift ban đầu; các baseline phía dưới được giữ làm
preflight evidence.

- DatabaseTool clone đã chuyển từ `CREATE TABLE ... LIKE` sang `SHOW CREATE TABLE`, copy trigger,
  so table definition + trigger inventory và fail-closed khi migration-owned trigger bị thiếu.
- `ipc_lane9` đã restore 149 FK + 3 trigger bằng reviewed SQL. Rollback 149/3 đã chạy thật,
  xác nhận quay về baseline và zero application-row delta, sau đó cùng forward hash được
  re-apply. Final lane: 61 migration, 164 FK, 3 trigger.
- Migration `20260810011000_ReconcileLegacyReceiptLifecycle` chỉ materialize legacy POSTED khi tất
  cả receipt line có movement `RECEIPT` đúng quantity và cùng actor; không tạo Manager approval giả.
- `ipcmanagement` đã promote từ 44 → 61 migration bằng exact reviewed SQL sau checkpoint.
  Final base: 64 application table, 164 FK, 3 trigger, zero missing table/column/FK theo model.
- 4.321 receipt legacy có physical movement được disposition `POSTED`; 83 receipt không có movement
  giữ `DRAFT`. Zero unexpected posted actor/time/quality/quantity violation.
- API current-source trỏ base: `/health/live` và `/health/ready` Healthy; readiness xác nhận database
  connection và zero pending migration. Backend full suite `776 pass + 1 intentional skip`.
- Checkpoint, reviewed SQL, apply/rollback result và postflight nằm trong
  `.artifacts/shipyard-live/database-hardening-20260810/`; hash authoritative ở `docs/EVIDENCE-INDEX.md`.

Còn mở, không được auto-fix: 44 unit-normalization review, quotation/BOM coverage, duplicate
ingredient, historical movement balance, menu-week mismatch, outbox relay và encrypted off-site restore
drill. Các mục này cần source/owner hoặc Phase 6 operational implementation riêng.

## Phase 4.1 remediation update — 2026-08-10

Phần này supersede trạng thái outbox/schema ở implementation update phía trên; baseline audit vẫn được
giữ để truy nguyên quyết định.

- `ipc_lane9` đã rehearsal additive migration 62–63 theo chuỗi checkpoint → apply → postflight →
  rollback về 61 → verify → re-apply cùng SQL hash. `ipcmanagement` nhận đúng cùng reviewed SQL sau
  checkpoint riêng. Hai database hiện ở migration 63 và có định nghĩa hai bảng Phase 4.1 giống nhau.
- Relay lane9 đã xử lý thật 432/432 message qua consumer validation và ghi 432 durable delivery receipt;
  final zero pending/processing/failed/poison, readiness Healthy. Base không có backlog và controlled
  relay runtime cũng Healthy.
- 2.461 movement base được phân loại `LEGACY_QUANTITY_SNAPSHOT_UNAVAILABLE` với disposition
  `DISPOSITION_NO_LEDGER_ADJUSTMENT`; không tạo adjustment làm double-count. 84 menu-week row có zero
  downstream physical plan và chờ schedule owner review supersession.
- 44 unit review, quotation/BOM coverage và duplicate ingredient giữ `BLOCKED_BUSINESS`: không suy luận
  factor, price, BOM hoặc merge; production service bắt buộc role/evidence/base-family/stale-version guard.
- Recovery tooling đã sẵn sàng nhưng immutable off-site destination/receipt và off-site-only restore drill
  vẫn `BLOCKED_EXTERNAL`. Do đó cả bảy bảng `backup_*` được giữ, không sinh drop SQL.
- Gate current-source: Application 49/49, API 797 pass + 1 intentional skip, frontend 137 file/769 test,
  hai build, lint, dependency graph, EF model, secret scan và diff hygiene pass. Hash authoritative nằm
  trong `docs/EVIDENCE-INDEX.md`.

## Phạm vi và phương pháp

- Đối chiếu EF SQL model hiện hành với `INFORMATION_SCHEMA`: table, column, type, nullability,
  default, generated expression, charset/collation, FK, CHECK và index.
- Với mọi FK thiếu nhưng còn đủ table/column, chạy anti-join trong read-only transaction để đếm orphan.
- Chạy business invariant queries trên lane9; trên base chỉ chạy subset tương thích vì base thiếu các
  bảng lifecycle mới.
- Chụp Performance Schema/slow-log/server durability snapshot; không chạy `EXPLAIN ANALYZE` vì cửa sổ
  hiện tại chủ yếu là E2E, chưa đại diện workload production.
- Inventory file backup ở `D:/Backups`, `D:/IPCManagement-backups` và
  `C:/IPCManagement-offsite-rehearsal`; chỉ đọc metadata, SHA-256, ZIP central directory và SQL token.
- Evidence machine-readable nằm ở `.artifacts/shipyard-live/database-audit-20260810/`.

Giới hạn: row estimate của InnoDB và index usage kể từ server restart không đủ để kết luận drop index;
snapshot uptime chỉ khoảng 7 giờ. Audit không xác minh nội dung nghiệp vụ của quotation/BOM với nguồn
bên ngoài và không thực hiện restore thật.

## 1. Schema hiện hành

| Thuộc tính | `ipc_lane9` | `ipcmanagement` | EF model hiện hành |
|---|---:|---:|---:|
| Tổng bảng | 72 | 62 | — |
| Bảng ứng dụng | 64 | 54 | 64 |
| Bảng `backup_*` | 7 | 7 | 0 |
| Migration | 60 | 44 | 60 |
| Cột model có thể đối chiếu | 692/692 | 549/692 | 692 |
| Cột model bị thiếu | 0 | 143 | 0 |
| Cột physical ngoài model | 1 | 1 | 0 |
| Foreign key | 15 | 132 | 164 |
| CHECK | 22 | 15 | — |
| Index physical / non-PK model | 287 | 229 | 221 |
| Trigger price-tier | 0 | 3 | 3 raw-SQL migration |

### 1.1 `ipc_lane9`

- Không thiếu bảng hay cột model.
- Thiếu 149 FK; anti-join của cả 149 relation trả **0 orphan row**. Đây là điều kiện thuận lợi để dựng
  reviewed FK migration, nhưng không phải lý do để add 149 constraint mù quáng.
- Root cause nằm tại `backend/tools/IPCManagement.DatabaseTool/Program.cs`: clone hai chặng dùng
  `CREATE TABLE target LIKE source`, rồi verify chỉ so table inventory và row count. MySQL 8.4 xác nhận
  `LIKE` giữ column/index/generated/CHECK nhưng **không giữ FK**. Vì lane9 được clone, kết quả 15 FK là
  constraint được migration mới tạo sau clone; 149 FK của source cũ bị rơi.
- Cùng clone path chỉ inventory `BASE TABLE`, nên ba trigger từ migration
  `20260803210000_AddCustomerWeekMenuTier` cũng bị rơi. Migration history vẫn ghi đã apply nên EF
  không tự chạy lại. Hệ quả là lane9 thiếu guard DB ngăn schedule sai price tier và ngăn
  thay tier khi schedule đã tồn tại, dù business query tại thời điểm audit chưa có mismatch.
- 44 index chỉ lệch tên nhưng cùng unique flag + ordered columns. Không đổi chỉ để đồng nhất tên.
- Index model `stockmovements(ingredientId)` (`ingredientId5`) không tồn tại độc lập, nhưng index
  `(ingredientId, movementDate)` đã cover left prefix. Nên bỏ cấu hình index dư khỏi model ở wave sau,
  không thêm một index physical trùng.
- Physical column `stocktakes.activeWarehouseKey` và unique index của nó là guard có chủ đích được tạo
  bằng raw-SQL migration, không phải bảng/cột rác. Nó không có trong snapshot vì migration raw SQL
  không map column; cần thêm một schema-contract test để tránh bị hiểu nhầm là drift.
- 38 column-definition drift còn lại gồm 35 default drift và 5 collation drift có overlap. Phần lớn là
  legacy DB default `0` tồn tại trong live nhưng current model không khai báo. Cần quyết định model là
  canonical hay muốn giữ server-side default trước khi tạo migration; không tự drop default. Riêng
  `unitnormalizationreviews` dùng `utf8mb4_0900_ai_ci` cho bốn text column và hai default legacy, trong
  khi model là `utf8mb4_unicode_ci`.

### 1.2 `ipcmanagement`

- Chậm 16 migration; thiếu 10 bảng: lifecycle command/outbox/transition, menu amendment + line,
  service run + adjustment, receipt correction + line và legacy-lineage disposition.
- Thiếu 143 cột model; `stockmovements.movementType` chưa có token `RECEIPT_CORRECTION`.
- Thiếu 32 FK và 49 index theo cấu trúc, chủ yếu vì table/column của 16 migration chưa tồn tại. Các
  relation còn đủ table/column để kiểm tra đều có 0 orphan.
- Không được dùng `dotnet ef migrations has-pending-model-changes` làm live-schema gate: lệnh đó chỉ
  so model với snapshot. Kết quả sạch không phát hiện base chậm migration hoặc lane9 mất FK.

## 2. Business integrity và thuộc tính thiếu

### 2.1 Lane9 — canonical candidate

Các invariant quan trọng đang sạch: zero negative/duplicate stock grain, unit mismatch, movement
equation mismatch, invalid receipt/issue/return/supplemental quantity, over-return, duplicate active
supplemental, undispositioned legacy lineage và duplicate lifecycle sequence.

Các gap cần xử lý:

| Mức | Phát hiện | Disposition |
|---|---|---|
| P0 | 432/432 outbox row `PENDING`, đều quá 5 phút | Boot/monitor relay; thêm readiness/alert về oldest pending age và poison count. Không xóa outbox. |
| P1 | 729 ingredient active không có quotation hiệu lực | Bổ sung theo nguồn giá, supplier và effective date; không suy luận giá từ lịch sử. |
| P1 | 33 dish active không có BOM published hiện hành | Đối chiếu menu/tier/customer và workbook nguồn trước khi publish BOM. |
| P1 | 16 nhóm tên ingredient active trùng | Preview mapping theo ID + mọi reference; không merge theo tên. |
| P1 | 44/44 unit-normalization review còn `NEEDS_CONFIRMATION`; 38 `BLOCKED`, chỉ 6 có factor đề xuất | Không auto-apply recommendation; xác minh quy cách/nguồn chứng từ và actor review. |
| P1 | 16 cột `status` chưa có CHECK | Thêm theo wave sau zero-violation preflight; CHECK không thay service state machine. |
| P1 | 5 JSON-like LONGTEXT chưa có `JSON_VALID` | Validate mọi row và contract serializer trước khi add CHECK. |
| P1 | `NOW()` lệch UTC +25.200 giây trong khi app dùng `DateTime.UtcNow` | Chốt UTC ở connection/session/server hoặc dùng UTC functions nhất quán; test timestamp roundtrip. |
| P2 | `unitnormalizationreviews` lệch collation | Chuẩn hóa sau FK/type/collation compatibility preflight. |

27 current-stock rows ở warehouse khác warehouse mặc định của ingredient là multi-warehouse hợp lệ,
không phải corruption.

Riêng đơn vị đo: lane9 có 43 unit, zero code trùng sau normalize, zero rate `<= 0`, zero
base-family mất, zero orphan từ ingredient/BOM/stock/package snapshot và zero BOM–demand unit mismatch.
Hai nhóm trùng tên là `BÓ` (`BO`, `BO_BUNCH`, `BO_SET`) và `ĐÔI` (`DOI`, `ĐOI`): đây là
ambiguity hiển thị/mã hóa cần owner quyết định, không phải duplicate để merge tự động.
Base `ipcmanagement` trả cùng kết quả unit audit và cùng fingerprint output với lane9; do đó
promotion không cần backfill unit hàng loạt, nhưng vẫn phải disposition 44 review trước khi thay
canonical unit hoặc conversion factor.

### 2.2 Base legacy — không dùng làm canonical trước reconciliation

Subset 32 invariant trả thêm các gap sau:

- 2.461 stock-movement row legacy lệch `afterQty = beforeQty + in - out`; Phase 4.1 classification
  xác nhận cả 2.461 đều có `beforeQty=afterQty=0` trong khi movement quantity vẫn tồn tại, nên đây là
  snapshot lịch sử không được ghi chứ không phải lý do tạo thêm adjustment (làm vậy sẽ double-count);
- 84 menu schedule có `weekStartDate` không khớp thứ Hai chứa `serviceDate`;
- 182 material-request line thiếu `bomId`, trong đó 176 thuộc request chưa cancelled;
- 14 refresh token đã hết hạn nhưng còn active;
- 756 ingredient active thiếu quotation, 32 dish active thiếu BOM và 16 nhóm ingredient trùng.

Đây là dữ liệu legacy cần phân loại/reconcile, không được backfill hàng loạt. Base và lane9 có dataset
khác nhau nên không dùng chênh row count để chọn bản “mới hơn”. Quyết định authoritative database phải
dựa trên nghiệp vụ, migration head, recovery chain và owner vận hành.

## 3. Bảng/cột/index thừa, thiếu và cần giữ

| Nhóm | Đối tượng | Kết luận hiện tại |
|---|---|---|
| Thiếu P0 | 149 FK trên lane9 | Phải khôi phục sau khi sửa clone và generate reviewed SQL; zero orphan hiện tại. |
| Thiếu P0 | 3 trigger price-tier trên lane9 | Khôi phục từ reviewed migration SQL và bổ sung schema-object verifier cho clone. |
| Thiếu P0 | 16 migration trên base | Không auto-migrate. Lập rehearsal từ checkpoint và business postflight. |
| Thiếu P1 | CHECK status/JSON và một số quantity/time invariant | Add theo wave nhỏ sau zero-violation preflight. |
| Thừa có điều kiện | 7 bảng `backup_*`, 6.686 row | Zero app/FK/view/trigger/routine/event consumer đã xác minh. Chỉ retire sau successor encrypted + off-site + restore-tested. |
| Thừa trong model | `stockmovements.ingredientId5` | Composite left-prefix đã cover; gỡ model declaration ở migration riêng, không add DB index. |
| Giữ | `stocktakes.activeWarehouseKey` | Generated concurrency fence có chủ đích; bổ sung contract test/documentation. |
| Giữ | audit/history/outbox/transition/command receipt | Không đánh giá thừa chỉ vì append-only hoặc chưa có consumer UI. |
| Cần quyết định | 35 live defaults không có trong EF model | Chốt canonical semantics từng nhóm; tránh silent zero khi writer bỏ cột. |
| Cần quan sát | index “unused/redundant” từ 7 giờ uptime | Chưa drop. Thu workload đủ chu kỳ và thử `INVISIBLE` trước. |

## 4. Backup và khả năng phục hồi

Inventory hiện có:

- 106 file, 351.735.547 byte; 71 scheduled full, newest 09/08 21:00 ICT.
- 86 ZIP đọc được và CRC pass; 70 có manifest; 0 ZIP mang encrypted flag.
- Chỉ một copy off-site, ngày 28/07. Duplicate hash duy nhất là primary + off-site mirror của cùng
  rehearsal, đây là redundancy hợp lệ.
- 19 SQL file: không file nào có `USE` hoặc `CREATE/DROP DATABASE`; 16 file có `DROP TABLE`, vì vậy
  không restore trực tiếp vào target chưa được kiểm tra.
- Restore rehearsal 28/07 chỉ ở 41 migration; không chứng minh restore được schema 60 migration,
  FK đầy đủ, lifecycle lineage và app current-source.

Không xóa backup cũ lúc này. Đề xuất phân loại:

1. **Authoritative recovery chain:** chưa có chain nào đủ encrypted + off-machine/immutable + restore
   current schema + business oracle.
2. **Operational checkpoint:** giữ Phase 4/lane checkpoint tới khi close rollback window.
3. **Evidence snapshot:** giữ nhưng không quảng bá là disaster-recovery backup.
4. **Superseded candidate:** các full cũ chỉ retire sau khi chain successor pass restore drill và retention
   owner duyệt.

Restore drill tiếp theo phải dựng database mới, replay full + binlog tới chosen point, kiểm tra migration
head 60, 164 FK, row/checksum/lineage oracle, health readiness và smoke lifecycle. CRC/manifest riêng lẻ
không đủ.

## 5. Performance và index

Server MySQL 9.5.0 có `log_bin=ON`, ROW, GTID ON, binlog retention 30 ngày,
`sync_binlog=1`, `innodb_flush_log_at_trx_commit=1`, slow log và Performance Schema bật. Snapshot có
0 slow query, 0 deadlock và 1 row-lock wait.

Không có bằng chứng để add/drop index theo performance ở audit này:

- uptime ngắn và workload chủ yếu là Phase 4 E2E;
- insert supplemental khoảng 2 giây là contention probe chủ đích;
- một số report/BOM/demand query examine nhiều row nhưng dataset nhỏ và chưa có p95 production.

Pomelo 9.0.0 công bố tested servers là MySQL 8.0/8.4, không có MySQL 9.5. Cần compatibility suite riêng
cho migrations, generated columns, enum, timestamp concurrency và query translation; không mặc định
provider support chỉ vì app hiện boot được.

## 6. Kế hoạch tối ưu theo wave

### Wave 0 — base-promotion contract và recovery (P0)

1. Khóa `ipcmanagement` là base đích; lane9 chỉ rehearsal. Cấm clone/restore đè lane9 lên base.
2. Chốt RPO/RTO và retention owner.
3. Tạo encrypted immutable off-site full + binlog chain và restore drill current-source.

Acceptance: restore mới pass 60 migration, schema/FK oracle, business lineage và smoke app; rollback
artifact đã thử thật.

### Wave 1 — clone và FK integrity (P0)

1. Sửa clone để preserve/recreate FK và trigger từ `SHOW CREATE TABLE`/schema metadata, hoặc clone
   bằng dump tool đủ schema object; verify phải so columns, generated expressions, CHECK, FK actions,
   unique/index, trigger/view/routine/event inventory và row counts.
2. Generate FK/trigger restoration SQL từ model/migration source đã review.
3. Preflight zero orphan + compatible type/collation; review delete/update action; apply chỉ trên lane được
   phép; postflight 164/164, 3/3 trigger và lifecycle regression; giữ rollback DDL/evidence.

### Wave 2 — runtime correctness (P0/P1)

1. Vận hành outbox relay + retry/poison alert.
2. Chốt UTC convention và test DB/app timestamps.
3. Rehearse đủ 16 migration + reconciliation trên lane trước khi promote vào base.

### Wave 2.5 — promote vào `ipcmanagement` (P0)

1. Tạo checkpoint full + binlog coordinate của base; preflight migration head, FK/trigger inventory,
   unit/catalog/business violations và fingerprint các aggregate.
2. Dùng **cùng reviewed SQL/script đã pass trên lane9**, không generate lại sau approval và không
   copy nguyên database lane đè base.
3. Apply trong maintenance window; postflight migration head, 164 FK, ba trigger, unit/stock/document
   lineage, outbox, API readiness và headed smoke.
4. Nếu bất kỳ gate nào fail, dừng promotion và thực thi rollback đã rehearsal; không sửa tay
   trực tiếp trên base để "làm cho pass".

### Wave 3 — data quality và constraints (P1)

1. Quotation/BOM coverage và duplicate-ingredient decision theo source nghiệp vụ.
2. Add CHECK status, JSON validity, quantity/time constraints theo migration nhỏ, mỗi migration có
   zero-violation preflight và rollback.
3. Chuẩn hóa `unitnormalizationreviews` collation/defaults; quyết định 35 server defaults.

### Wave 4 — query/index/retention (P2)

1. Thu workload ít nhất một chu kỳ tuần và cửa sổ month-end/report; capture generated SQL, total latency,
   p95, rows examined và write cost.
2. Chỉ chạy `EXPLAIN ANALYZE` cho SELECT an toàn trên lane/clone; thử drop bằng invisible index trước.
3. Gỡ index model dư và retire 7 backup table khi recovery successor đã restore-tested.
4. Không partition core lifecycle tables có FK.

## 7. Gate cho mọi mutation tương lai

Mọi thay đổi DB phải theo đúng:

`preflight → reviewed SQL → checkpoint → apply đúng mutation lane → postflight schema/data/health → rollback evidence`

Trong phạm vi hiện hành mutation chỉ được cân nhắc trên `ipc_lane9`; không chạm `ipc_lane1`. Không apply
gộp FK + data cleanup + index change trong một wave. Mỗi hypothesis phải có metric trước/sau và tiêu chí
rollback định lượng.

## Nguồn và evidence

- Research primary sources đầy đủ: `docs/research/database-optimization-primary-sources-2026-08-10.md`.
- [MySQL 8.4 — CREATE TABLE ... LIKE](https://dev.mysql.com/doc/refman/8.4/en/create-table-like.html):
  `LIKE` không preserve foreign key definitions.
- [MySQL 8.4 — Foreign key constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html):
  referential integrity, metadata và lưu ý bật lại `foreign_key_checks` không quét lại dữ liệu.
- [Pomelo official repository](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql):
  compatibility matrix công bố MySQL 8.0/8.4.
- Schema/business/backup/workload evidence:
  `.artifacts/shipyard-live/database-audit-20260810/`.

## Audit disposition

- Database mutation: **0**.
- Protected database `ipc_lane1`: **không truy cập**.
- GitNexus: **không dùng** theo opt-in policy.
- Graph lane: **N/A — graph-free docs/evidence diff**.
- Quyết định drop/migrate/restore: **deferred, cần user duyệt sau khi Wave 0 preconditions hoàn tất**.
