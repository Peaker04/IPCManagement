# Database optimization research — primary-source baseline

**Ngày nghiên cứu:** 2026-08-10
**Phạm vi:** MySQL 8.0/8.4/9.x, EF Core và Pomelo.EntityFrameworkCore.MySql
**Hệ thống đích:** IPCManagement — giao dịch cung cấp suất ăn từ thực đơn/định mức đến nhu cầu, mua hàng, nhập/xuất, bếp xác nhận, trả/cấp bổ sung, ca phục vụ và audit.

## Kết luận điều hành

Không nên “tối ưu database” bằng cách xóa bảng/cột hoặc thêm index hàng loạt. Quy trình an toàn là: chốt version và schema thật; đối chiếu grain/nghiệp vụ với model EF; đo workload và execution plan; thử thay đổi có thể đảo ngược; sau đó mới tạo migration đã review và restore-tested.

Các ưu tiên phù hợp nhất với IPCManagement là:

1. Bảo toàn tính đúng của lifecycle bằng primary key, foreign key, unique constraint và `CHECK` cho các bất biến nội-row; index không thay thế constraint.
2. Tối ưu các truy vấn theo trục khách hàng/tuần/ngày/ca/trạng thái bằng composite index khớp đúng filter + sort quan sát được, không suy từ tên cột.
3. Dùng `EXPLAIN ANALYZE`, statistics và workload telemetry để chứng minh lợi ích. Index nghi thừa phải chuyển `INVISIBLE` và theo dõi trước khi drop.
4. Không partition các bảng lifecycle còn foreign key. Chỉ đánh giá partitioning cho bảng append-only rất lớn khi đã có số đo, retention boundary rõ và mô hình khóa cho phép.
5. Backup cũ chỉ được loại sau khi phân loại chain phục hồi, kiểm tra checksum và hoàn tất restore drill. Một file dump tồn tại không đồng nghĩa có khả năng PITR.

Tài liệu này là baseline từ nguồn chính thức, không phải kết quả kiểm tra database live và không xác nhận bất kỳ bảng/index/backup cụ thể nào là thừa.

## 1. Compatibility phải được chốt trước

- Tài liệu MySQL 8.4 được dùng làm baseline LTS vì Pomelo hiện công bố kiểm thử với MySQL 8.0 và 8.4; bảng compatibility cũng buộc major Pomelo phải khớp major EF Core (ví dụ Pomelo 8.0.x với EF Core 8.0.x, Pomelo 9.0.x với EF Core 9.0.x). Không áp dụng cú pháp 8.4/9.x trước khi đối chiếu `SELECT VERSION()`, package lock và `ServerVersion` của ứng dụng. [Pomelo official repository — Compatibility](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql#compatibility)
- Pomelo chưa liệt kê MySQL Innovation 9.x trong matrix được kiểm thử hiện hành. Vì vậy “MySQL 9.x” trong audit là một compatibility question, không phải target nâng cấp mặc định; phải có provider integration test trước khi chấp nhận. Các biến cũng có thể bị loại giữa version — ví dụ `expire_logs_days` đã bị loại từ MySQL 8.2, nên 8.4/9.x phải quản lý expiry bằng `binlog_expire_logs_seconds`. [MySQL 8.4 release note — removed `expire_logs_days`](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-2-0.html), [MySQL 8.4 — Binary logging options](https://dev.mysql.com/doc/refman/8.4/en/replication-options-binary-log.html)
- EF migrations là chuỗi tăng dần được đối chiếu bằng migrations history table. Schema live, model snapshot và history phải được reconcile; không dùng `EnsureCreated` để “sửa nhanh” một database đang quản lý bằng migrations. [Microsoft — Migrations overview](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)

## 2. Audit schema và tính đúng nghiệp vụ

### 2.1 Khóa và quan hệ

- MySQL/InnoDB dùng primary key làm clustered index và chép primary-key columns vào mọi secondary-index entry; vì vậy primary key ngắn, ổn định giúp giảm storage/index overhead. Mỗi bảng giao dịch nên có PK rõ ràng, còn mã chứng từ nghiệp vụ nên là `UNIQUE` trong đúng scope thay vì làm PK rộng. [MySQL 8.4 — CREATE TABLE](https://dev.mysql.com/doc/refman/8.4/en/create-table.html)
- InnoDB foreign keys giữ dữ liệu liên bảng nhất quán; `foreign_key_checks` mặc định bật và nên giữ bật trong vận hành thường ngày. Việc audit cần tìm orphan, kiểu/length/collation không tương thích và hành vi `ON DELETE`/`ON UPDATE` không đúng lifecycle trước khi đề xuất xóa bảng/cột. [MySQL 8.4 — Foreign key constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html)
- EF Core tạo index cho FK theo convention, nhưng một index đã bao phủ FK có thể khiến EF không tạo index trùng. Vì thế phải so model, migration và `INFORMATION_SCHEMA.STATISTICS`, không kết luận “thiếu index FK” chỉ từ code. [Microsoft — Relationship conventions, indexes](https://learn.microsoft.com/en-us/ef/core/modeling/relationships/conventions#indexes)

Với IPCManagement, unique constraints cần được đánh giá cho các bất biến như mã chứng từ trong tenant/site, một line nguồn chỉ được materialize vào đúng lineage hợp lệ, receipt/command idempotency key, một active request trong cùng business scope, và sequence transition duy nhất. Constraint cụ thể chỉ được thêm sau duplicate preflight và xác nhận grain nghiệp vụ.

### 2.2 Nullability, trạng thái và `CHECK`

- `CHECK` của MySQL được enforce khi biểu thức là `FALSE`, nhưng `TRUE` hoặc `UNKNOWN` (thường do `NULL`) đều hợp lệ. Do đó `CHECK (Quantity > 0)` không thay thế `NOT NULL`; hai điều kiện phải được mô hình hóa riêng. `CHECK` chỉ nhận biểu thức deterministic trong cùng row, không nhận subquery hay stored function. [MySQL 8.4 — CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html)
- Dùng `CHECK` cho bất biến nội-row bền vững như `Quantity > 0`, `ReceivedQuantity <= OrderedQuantity` khi semantics luôn đúng, hoặc cặp thời gian hợp lệ. Không encode toàn bộ state machine đa bảng vào `CHECK`; transition, actor separation và balance xuyên chứng từ cần transaction/service rule cùng audit evidence.
- Thuộc tính nên audit trên mọi aggregate giao dịch: tenant/customer/site scope; business date/week/shift; status; actor + timestamp cho create/review/approve/post/acknowledge/close/cancel; source document/line; ingredient/material và unit lineage; idempotency/concurrency token; reason cho reject/override/correction; immutable audit/command receipt. “Thiếu” chỉ được xác nhận sau khi đối chiếu domain grain và luồng ứng dụng, không chỉ dựa trên tên cột.

### 2.3 Generated columns và functional indexes

- MySQL cho phép index stored generated columns và secondary index trên virtual generated columns; functional index được triển khai bằng hidden virtual generated column. Đây là lựa chọn cho filter trên biểu thức mà index cột thường không phục vụ, nhưng vẫn có storage/write cost cho index và chịu các giới hạn của generated column. [MySQL 8.4 — CREATE TABLE and generated columns](https://dev.mysql.com/doc/refman/8.4/en/create-table.html), [MySQL 8.4 — CREATE INDEX](https://dev.mysql.com/doc/refman/8.4/en/create-index.html)
- Chỉ cân nhắc cho biểu thức truy vấn nóng và ổn định, chẳng hạn normalized document key hoặc bucket ngày từ timestamp, sau khi chứng minh SQL thực tế không dùng được index hiện có. Không nhân đôi dữ liệu nghiệp vụ canonical bằng generated column nếu projection ở application đã đủ.

### 2.4 Bảng/cột “thừa” và “thiếu”

Một object chỉ là ứng viên thừa khi đồng thời có đủ bằng chứng:

1. Không còn mapped trong model EF/migration ownership.
2. Không còn read/write trong workload quan sát và source-backed test.
3. Không bị FK, view, trigger, event, routine, report/export hay restore procedure tham chiếu.
4. Không phải ledger/audit/idempotency/history cần giữ theo nghiệp vụ hoặc retention.
5. Dữ liệu đã được reconcile sang owner mới, có rollback và restore drill.

Các tên `Old`, `Backup`, `Legacy`, bảng rỗng hay index có counter bằng 0 chưa đủ chứng minh. Counter có thể đã reset khi restart; feature theo tuần/tháng có thể chưa xuất hiện trong cửa sổ đo. Trước drop, chuyển object sang trạng thái compatibility/read-only nếu kiến trúc cho phép, theo dõi qua ít nhất một chu kỳ nghiệp vụ đầy đủ và giữ migration rollback.

## 3. Index và query-plan audit

### 3.1 Inventory và measurements

- `INFORMATION_SCHEMA.TABLES` cung cấp engine, row estimate và kích thước data/index, nhưng `TABLE_ROWS` của InnoDB chỉ là ước lượng và có thể lệch đáng kể; dùng nó để xếp hạng, không dùng làm số đếm nghiệp vụ chính xác. Statistics trong Information Schema còn có cache-expiry. [MySQL 8.4 — INFORMATION_SCHEMA TABLES](https://dev.mysql.com/doc/refman/8.4/en/information-schema-tables-table.html)
- `sys.schema_redundant_indexes` liệt kê index bị index khác bao phủ; `sys.schema_unused_indexes` dựa trên Performance Schema để tìm index chưa được quan sát sử dụng. Cả hai là danh sách ứng viên để review, không phải lệnh drop tự động. [MySQL 8.4 — redundant indexes view](https://dev.mysql.com/doc/refman/8.4/en/sys-schema-redundant-indexes.html), [MySQL 8.4 — unused indexes view](https://dev.mysql.com/doc/refman/8.4/en/sys-schema-unused-indexes.html)
- Index B-tree giúp equality/range lookup; composite index phục vụ prefix bên trái của key. EF cũng lưu ý index `(A, B)` có thể phục vụ `A` hoặc `A+B`, không mặc nhiên phục vụ chỉ `B`; index đồng thời làm chậm write vì phải được duy trì. [MySQL 8.4 — How MySQL uses indexes](https://dev.mysql.com/doc/refman/8.4/en/mysql-indexes.html), [Microsoft — Efficient querying](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)

Với lifecycle suất ăn, hãy gom query shape thực tế rồi đánh giá các nhóm composite key theo thứ tự equality → range/order, ví dụ `(CustomerId, WeekStart, Status, Id)`, `(ServiceDate, ShiftId, Status, Id)` hoặc `(SourceDocumentId, SourceLineId)`. Đây chỉ là shape để kiểm chứng; không thêm cả ba nếu SQL/plan không chứng minh nhu cầu.

### 3.2 `EXPLAIN ANALYZE`

- `EXPLAIN ANALYZE` **thực sự chạy** statement và trả estimated cost/rows cùng actual first-row time, total iterator time, rows và loops. Nó hỗ trợ `SELECT` và một số multi-table `UPDATE`/`DELETE`; vì vậy audit production chỉ nên dùng cho `SELECT` an toàn hoặc clone/read replica có kiểm soát, tuyệt đối không thử mutation chỉ để xem plan. [MySQL 8.4 — EXPLAIN](https://dev.mysql.com/doc/refman/8.4/en/explain.html)
- Với mỗi top query: lưu SQL đã parameterize, row count, plan trước/sau, estimated-vs-actual divergence, rows examined, loops, latency p50/p95 và write overhead. Một index chỉ pass khi cải thiện workload mục tiêu mà không gây regression đáng kể cho create/approve/post/acknowledge flows.

### 3.3 Invisible indexes và histograms

- Secondary index có thể chuyển `INVISIBLE`; optimizer mặc định bỏ qua nhưng index vẫn được duy trì và unique constraint vẫn enforce. Đây là phép thử đảo ngược trước khi drop, kết hợp query plan, slow log/Performance Schema và workload regression. Primary key không thể invisible. [MySQL 8.4 — Invisible indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html)
- `ANALYZE TABLE ... UPDATE HISTOGRAM` lưu phân bố cột cho optimizer. Histogram phù hợp với cột không-index có phân bố lệch (ví dụ nhiều terminal status, rất ít pending) khi estimate sai; không dùng cho `JSON`, geometry, encrypted/temporary table, hoặc cột đã có single-column unique index. [MySQL 8.4 — ANALYZE TABLE](https://dev.mysql.com/doc/refman/8.4/en/analyze-table.html)
- InnoDB persistent optimizer statistics mặc định được giữ qua restart và có `last_update`; `ANALYZE TABLE` có I/O cost nên chạy sau bulk change hoặc trong maintenance window, không theo lịch dày đặc thiếu số đo. [MySQL 8.4 — InnoDB optimizer statistics](https://dev.mysql.com/doc/refman/8.4/en/innodb-performance-optimizer-statistics.html)

### 3.4 Partitioning: mặc định chưa dùng cho core lifecycle

- Partition pruning chỉ hữu ích khi predicate cho phép optimizer loại partition. Mọi unique key phải chứa partitioning columns; quan trọng hơn, MySQL 8.4 không hỗ trợ foreign keys trên partitioned InnoDB tables. [MySQL 8.4 — Partitioning overview](https://dev.mysql.com/doc/refman/8.4/en/partitioning-overview.html), [MySQL 8.4 — Partitioning restrictions](https://dev.mysql.com/doc/refman/8.4/en/partitioning-limitations.html)
- Vì supply lifecycle phụ thuộc provenance/FK dày, partitioning các bảng demand/PO/receipt/issue/return/supplemental là rủi ro integrity lớn hơn lợi ích khi chưa có scale evidence. Chỉ mở spike cho audit/event/archive append-only rất lớn, có date retention boundary, không cần FK, và `EXPLAIN` chứng minh pruning.

## 4. EF Core/Pomelo query và migration guidance

- Với read model/report/inbox, project đúng cột bằng `Select`, giới hạn result set, và ưu tiên keyset pagination cho next/previous. Index phải khớp ordering duy nhất; pagination order phải fully unique để không bỏ/lặp row. [Microsoft — Efficient querying](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying), [Microsoft — Pagination](https://learn.microsoft.com/en-us/ef/core/querying/pagination)
- Read-only entity queries thường nên `AsNoTracking`; tracking có identity resolution nhưng tốn dictionary/snapshot. Chọn `AsNoTrackingWithIdentityResolution` khi projection cần de-duplicate entity graph và benchmark chứng minh hợp lý. [Microsoft — Tracking vs. no-tracking](https://learn.microsoft.com/en-us/ef/core/querying/tracking)
- Nhiều collection `Include` có thể gây cartesian explosion. Split queries đổi duplication lấy thêm roundtrip và có consistency caveat giữa nhiều query; phải benchmark trên màn hình chứng từ chi tiết thay vì áp global. [Microsoft — Single vs. split queries](https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries)
- Lazy loading dễ tạo N+1; dùng eager/explicit loading hoặc DTO projection để roundtrip hiện rõ. Raw SQL chỉ là phương án cuối khi EF không sinh được SQL cần thiết và lợi ích đã đo đủ bù maintenance cost. [Microsoft — Efficient querying](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying)
- Concurrency token của EF biến update thành conditional update và ném `DbUpdateConcurrencyException` khi row đã đổi; nó phù hợp bảo vệ review/post/acknowledge khỏi lost update nhưng không thay thế idempotency key hay database unique constraint. [Microsoft — Handling concurrency conflicts](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)
- Production migration nên sinh SQL script để review/test/archive; idempotent script kiểm tra migration history và chỉ apply migration thiếu. Microsoft cảnh báo runtime migration làm application cần quyền DDL và giảm cơ hội review/rollback; EF Core 9 thêm migration lock nhưng SQL script bên ngoài không được lock đó bảo vệ. [Microsoft — Applying migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying)
- Gate trước deploy: `dotnet ef migrations has-pending-model-changes`, generate reviewed/idempotent SQL, preflight data constraints, backup/checkpoint, apply đúng lane, postflight schema + data + plan, và rollback evidence. Provider-specific SQL phải được thử trên đúng MySQL version Pomelo công bố hỗ trợ. [Microsoft — Applying migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying), [Pomelo official repository](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql)

## 5. Backup cũ, retention và PITR

### 5.1 Một recovery chain hợp lệ

- PITR bắt đầu bằng full backup rồi replay binary log đến timestamp/event position cần thiết. Full dump không kèm chuỗi binlog liên tục chỉ khôi phục được tới thời điểm dump, không phải PITR. [MySQL 8.4 — Point-in-time recovery](https://dev.mysql.com/doc/refman/8.4/en/point-in-time-recovery.html)
- MySQL 8.4 mặc định bật binary logging và dùng row format; mặc định expiry 30 ngày chỉ là server default, không phải retention policy của IPCManagement. Retention binlog phải bao phủ RPO, thời gian phát hiện sự cố, restore drill và replication lag; archive chain trước purge. [MySQL 8.4 — Binary logging options](https://dev.mysql.com/doc/refman/8.4/en/replication-options-binary-log.html), [MySQL 8.4 — PURGE BINARY LOGS](https://dev.mysql.com/doc/refman/8.4/en/purge-binary-logs.html)
- Với logical dump, triggers được dump mặc định nhưng routines và events cần option riêng `--routines` và `--events`; inventory phải ghi rõ dump có chứa những object nào. [MySQL 8.4 — Dumping stored programs](https://dev.mysql.com/doc/refman/8.4/en/mysqldump-stored-programs.html)
- Checksum validation có thể phát hiện một số corruption nhưng không chứng minh restore/boot/application consistency. MySQL Enterprise Backup mô tả chu kỳ backup → verify → restore và nêu giới hạn của `validate`; vì vậy restore drill vẫn là gate cuối. [MySQL Enterprise Backup 8.4 — Verifying a backup](https://dev.mysql.com/doc/mysql-enterprise-backup/8.4/en/mysqlbackup.verify.html), [Validation limitations](https://dev.mysql.com/doc/mysql-enterprise-backup/8.4/en/backup-commands-validate.html)

### 5.2 Phân loại file backup cũ

Mỗi artifact cần manifest tối thiểu: tạo lúc nào, source server/schema/version, tool + command class, full/incremental/logical, encryption, checksum, start/end binlog hoặc GTID/LSN, migration head, owner, location, restore-drill result và expiry decision.

Phân nhóm:

- **Authoritative recovery chain:** full backup + mọi incremental/binlog cần thiết, checksum/manifest đủ, off-host/immutable, restore drill pass.
- **Operational checkpoint:** rollback ngắn hạn trước migration/E2E; giữ tới khi postflight và rollback window đóng.
- **Evidence snapshot:** phục vụ audit/đối chiếu, không quảng bá là recovery backup.
- **Orphan/unknown:** thiếu source, checksum hoặc chain; quarantine, không xóa trước khi xác nhận không phải mắt xích duy nhất.
- **Superseded but retained:** chain cũ đã được chain mới restore-tested thay thế; xóa theo retention approval và ghi tombstone/manifest, không xóa thủ công rời rạc.

Nguồn MySQL không quy định một số ngày giữ phù hợp cho mọi hệ thống. IPCManagement phải chốt RPO/RTO và nghĩa vụ lưu audit trước, rồi mới thiết kế daily/weekly/monthly policy. Không purge binlog hoặc backup chỉ vì “cũ hơn 30 ngày”; default 30 ngày của MySQL không biết chu kỳ nghiệp vụ hay thời gian phát hiện lỗi của dự án.

## 6. Checklist triển khai cho IPCManagement

### Gate A — read-only inventory

- [ ] Ghi server version, engine, charset/collation, SQL mode, timezone, `log_bin`, binlog format/expiry và package EF/Pomelo.
- [ ] Export schema metadata: tables, columns/default/nullability/generated expressions, PK/UK/FK/`CHECK`, indexes/order/visibility/cardinality, views/triggers/routines/events và migration history.
- [ ] Xếp hạng table/index size; gắn cờ estimate thay vì báo `TABLE_ROWS` như count chính xác.
- [ ] Inventory tất cả backup ngoài repo bằng manifest, không move/delete trong audit pass.

### Gate B — business reconciliation

- [ ] Map từng table vào aggregate owner và grain: customer/site → week/day/shift → document → line → transition/receipt/audit.
- [ ] Đối chiếu provenance từ demand qua PR/PO/receipt/issue/acknowledgement/return/supplemental/service-run.
- [ ] Query duplicate, orphan, invalid status/time/quantity/unit và nullable lineage trước khi đề xuất constraint.
- [ ] Đánh dấu mỗi bảng/cột là canonical, compatibility, audit/history, derived/cache, staging/import, backup-copy hoặc unknown; `unknown` là blocker, không phải ứng viên drop.

### Gate C — workload and plan

- [ ] Thu top query theo total latency, p95, rows examined và frequency qua ít nhất một chu kỳ tuần/tháng phù hợp.
- [ ] Lưu generated SQL từ EF và chạy `EXPLAIN ANALYZE` chỉ cho `SELECT` an toàn trên lane/clone được duyệt.
- [ ] Review redundant/unused views; thử suspected index bằng `INVISIBLE`, theo dõi plan + slow workload + lifecycle regression trước drop.
- [ ] Chỉ tạo histogram cho cột skew khi estimates sai; ghi owner và refresh trigger.
- [ ] Benchmark write-path vì thêm index làm chậm mọi create/review/approve/post/acknowledge liên quan.

### Gate D — reviewed change

- [ ] Mỗi thay đổi có hypothesis, baseline, expected win, risk, rollback và acceptance threshold.
- [ ] Constraint mới có zero-violation preflight; index mới có before/after plan; drop có invisible observation window.
- [ ] Generate migration + reviewed idempotent SQL; model pending check sạch.
- [ ] Checkpoint đúng database lane, apply một lần, postflight schema/data/query plans và lưu rollback evidence.
- [ ] Không partition bảng core còn FK; không direct-edit migration history.

### Gate E — recovery and retention

- [ ] Chốt RPO/RTO, recovery window và audit retention với owner nghiệp vụ/ops.
- [ ] Chứng minh một restore hoàn chỉnh từ off-host full backup + binlog chain tới chosen point-in-time.
- [ ] Sau restore, chạy migration-state, row/constraint/lineage checksum và smoke workflow.
- [ ] Chỉ retire backup khi chain thay thế đã restore-tested; lưu quyết định, checksum và deletion/tombstone evidence.

## 7. Tiêu chí “tối ưu xong”

Một thay đổi chỉ được coi là hoàn tất khi đồng thời:

- business invariants và lifecycle regression vẫn pass;
- plan thực tế tốt hơn trên workload đại diện, không chỉ giảm estimated cost;
- latency/rows examined/IO đạt threshold đã chốt và write path không regression ngoài budget;
- EF model, migrations history và schema live đồng bộ;
- restore + rollback có bằng chứng;
- không còn candidate “thừa/thiếu” chưa có disposition và owner.

## Nguồn chính dùng

- [MySQL 8.4 Reference Manual — Optimization](https://dev.mysql.com/doc/refman/8.4/en/optimization.html)
- [MySQL 8.4 Reference Manual — Backup and Recovery](https://dev.mysql.com/doc/refman/8.4/en/backup-and-recovery.html)
- [Microsoft Learn — EF Core performance](https://learn.microsoft.com/en-us/ef/core/performance/)
- [Microsoft Learn — EF Core migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [Pomelo.EntityFrameworkCore.MySql official repository](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql)
