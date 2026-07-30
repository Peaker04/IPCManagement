# Backup & Restore database `ipcmanagement`

Lưới an toàn dữ liệu tối thiểu cho MySQL. Hai script, không phụ thuộc gì ngoài `mysqldump.exe` /
`mysql.exe` có sẵn trong bộ cài MySQL Server.

| File | Việc |
|---|---|
| `Backup-Database.ps1` | Dump + manifest → nén `.zip` → mirror khác volume → xoá bản cũ quá hạn |
| `Restore-Database.ps1` | Verify SHA-256 → tạo DB đích → nạp dump → đối chiếu manifest, có guard DB thật/DB đã có dữ liệu |
| `Audit-NonCriticalDataQuality.sql` | Audit read-only BOM, quotation, demand traceability, duplicate master, menu status và lineage |
| `Compare-MigrationLineage.ps1` | Đối chiếu read-only `__EFMigrationsHistory` với file migration trong source |
| `migration-lineage.json` | Ledger canonical cho migration DB-only hiện hành và disposition lịch sử có evidence |

Chạy audit không ghi dữ liệu:

```powershell
$env:MYSQL_PWD = '<mat-khau-mysql>'
$mysql = 'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe'
Get-Content .\Audit-NonCriticalDataQuality.sql -Raw |
    & $mysql --database=ipcmanagement --table
```

Script audit chỉ chứa `SELECT`/`WITH`; nó không seed, migrate, cleanup hoặc đổi trạng thái chứng từ.
Mỗi result set có cột `audit_section`; ID binary chỉ được xuất dạng hex. Cột
`review_order` của duplicate ingredient chỉ giúp sắp xếp review theo số tham chiếu, không phải
đề xuất canonical ID và không được dùng để merge tự động.

Đối chiếu migration mà không thay đổi database:

```powershell
.\Compare-MigrationLineage.ps1 -Database ipcmanagement -DbUser ipc_backup
```

Script trả `CANONICAL_DATABASE_ONLY`, `DATABASE_ONLY`, `SOURCE_ONLY` hoặc `MATCHED`.
`CANONICAL_DATABASE_ONLY` chỉ hợp lệ khi manifest có reason và blob/successor evidence kiểm
chứng được. Thêm `-FailOnDrift` để làm quality gate: exit code `3` khi có ID chưa
giải thích, source-only, manifest stale hoặc evidence hỏng. Script không tự xóa row lịch sử
và không tự tạo migration.

Lý do tồn tại: `stockmovements` là **sổ cái tồn kho không tái tạo được** từ bất kỳ nguồn nào khác.
Mất bảng này là mất số liệu kho, không có cách dựng lại.

> **Đã xảy ra thật — 26/07/2026, 23:44.** `backend/database/IPCmanagement.sql` hard-code
> `USE ipcManagement;` nên chạy nó với database đích nào cũng xoá sạch database chính: 46 bảng bị
> drop, 5 bảng mất hẳn (`stockmovements` trong số đó). **Lúc đó thư mục backup còn chưa tồn tại** —
> tài liệu này đã viết xong từ 26/07 nhưng chưa ai chạy lần nào. Khôi phục được là nhờ binlog còn
> nguyên, không nhờ quy trình nào ở đây. Đọc `HISTORY.md` mục "Sự cố mất dữ liệu và củng
> cố tầng database" trước khi đụng vào database thật.

## Trạng thái trên máy này (cập nhật 27/07/2026)

| Hạng mục | Trạng thái |
|---|---|
| Task `IPC-DB-Backup` | **Đã đăng ký và chạy thật** — 4 tiếng/lần, `LastTaskResult = 0` |
| Thư mục backup | `D:\Backups\ipc` |
| User chạy backup | `ipc_backup@localhost` (chỉ đọc — `SELECT, RELOAD, PROCESS, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER`), **không phải `root`** |
| Mật khẩu user đó | `D:\Backups\ipc-backup-user-password.txt` + biến user `MYSQL_PWD` (đặt bằng `setx`) |
| Đã diễn tập restore | **Có** — restore vào `ipcmanagement_restore_verify`: 61/61 bảng, 53.415 dòng khớp tuyệt đối, 130 FK 0 dòng mồ côi |

**Hai giới hạn còn nguyên, đừng nhầm là đã xong:**

1. Task chạy **chỉ khi user đang đăng nhập** (đăng ký không kèm mật khẩu tài khoản Windows). Máy đăng
   xuất thì không có backup. Muốn chạy nền thì đăng ký lại kèm credential Windows.
2. Backup nằm **cùng ổ `D:` với data directory của MySQL**. Ổ chết là mất cả hai — xem §5.1. Đây vẫn
   chưa phải disaster recovery.

---

## 1. Chạy backup thủ công

```powershell
# Mật khẩu KHÔNG nằm trong script. Đưa qua biến môi trường (khuyến nghị) ...
$env:MYSQL_PWD = '<mat-khau-mysql>'
.\Backup-Database.ps1 -OutputDir 'D:\Backups\ipc' `
  -MirrorDir 'E:\IPCManagement-offsite' -RetentionDays 14

# ... hoặc qua tham số
.\Backup-Database.ps1 -Password '<mat-khau-mysql>' -OutputDir 'D:\Backups\ipc'
```

Tham số (đều có mặc định hợp lý cho máy dev):

| Tham số | Mặc định | Ghi chú |
|---|---|---|
| `-Database` | `ipcmanagement` | |
| `-OutputDir` | `%USERPROFILE%\ipc-backups` | Nằm ngoài repo, không lo lọt vào git |
| `-MirrorDir` | không có | Phải ở volume khác `OutputDir`; copy xong phải khớp SHA-256 |
| `-RetentionDays` | `14` | Bắt buộc `>= 1` |
| `-DbUser` | `root` | Production nên dùng user backup riêng, xem §6 |
| `-Password` | `$env:MYSQL_PWD` | Thiếu → thoát mã 2 |
| `-DbHost` / `-Port` | `localhost` / `3306` | |
| `-MySqlBin` | `C:\Program Files\MySQL\MySQL Server 9.5\bin` | |

Kết quả: `D:\Backups\ipc\ipcmanagement-yyyyMMdd-HHmmss.zip`, bên trong có SQL và
manifest gồm SHA-256 SQL, table count, `stockmovements` count và migration lineage. Khi có
`-MirrorDir`, bản mirror chỉ được báo thành công sau khi hash khớp.

Cờ dump đang dùng: `--single-transaction` (không khoá bảng InnoDB, app vẫn chạy bình thường trong
lúc dump), `--routines --triggers --events` (mang theo cả object schema), `--set-gtid-purged=OFF`
(xem §6).

Table/ledger/migration evidence được parse từ chính SQL snapshot. Parser đếm top-level tuple
trong extended INSERT và bỏ qua ngoặc/dấu phẩy nằm trong MySQL escaped string; không query live sau
dump nên không có race giữa snapshot và manifest, đồng thời không làm restore chậm như
`--skip-extended-insert`.

**Exit code:** `0` OK · `1` dump lỗi/không toàn vẹn (file dở dang đã bị xoá, **không** để lại file
rỗng) · `2` sai cấu hình (thiếu mật khẩu, không thấy `mysqldump.exe`, retention < 1).

Script chỉ báo thành công khi file dump có marker `-- Dump completed` ở cuối — đây là cách phát hiện
dump bị cắt ngang giữa chừng mà `mysqldump` vẫn trả exit 0.

---

## 2. Đăng ký chạy tự động (Windows Task Scheduler)

**Bước 1 — cấp mật khẩu cho tài khoản chạy task.** Task Scheduler không thấy biến môi trường của
session hiện tại, phải ghi cố định:

```powershell
setx MYSQL_PWD "<mat-khau-mysql>"
```

(Biến này chỉ thuộc user hiện tại. Nếu task chạy dưới tài khoản khác thì phải `setx` trong session
của tài khoản đó. Đánh đổi: bất kỳ tiến trình nào của user đó đều đọc được — chấp nhận được với máy
dev, còn production xem §6.)

**Bước 2 — tạo task.** Sửa lại đường dẫn repo cho đúng máy bạn:

```cmd
schtasks /Create /TN "IPC-DB-Backup" ^
  /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"D:\IPCManagement\tools\db\Backup-Database.ps1\" -OutputDir \"D:\Backups\ipc\" -MirrorDir \"E:\IPCManagement-offsite\" -RetentionDays 14" ^
  /SC DAILY /ST 01:00 /RL HIGHEST /F
```

Muốn 4 tiếng một lần (khuyến nghị, xem §4) thì đổi lịch:

```cmd
schtasks /Change /TN "IPC-DB-Backup" /SC HOURLY /MO 4 /ST 01:00
```

**Bước 3 — chạy thử và kiểm tra ngay, đừng đợi tới 01:00:**

```cmd
schtasks /Run   /TN "IPC-DB-Backup"
schtasks /Query /TN "IPC-DB-Backup" /V /FO LIST
```

Trong output của `/Query`, `Last Result` phải là `0`. Sau đó mở `D:\Backups\ipc` xác nhận có file
`.zip` mới, kích thước vài MB (không phải vài KB).

Gỡ task: `schtasks /Delete /TN "IPC-DB-Backup" /F`

---

## 3. Quy trình restore khi có sự cố

**Nguyên tắc: không bao giờ restore thẳng đè lên `ipcmanagement` hoặc `ipc_lane1`.** Restore
vào DB tạm, đối chiếu, rồi mới quyết định. Script tự chặn hai database thật và
chặn cả target đã có bảng (exit 2) trừ khi truyền `-Force` tường minh.

**B1. Dừng ứng dụng** (backend + worker) để không có ai ghi thêm vào DB hỏng.

**B2. Chụp lại hiện trạng trước khi động vào gì cả** — kể cả DB đang hỏng cũng phải backup, vì nó có
thể chứa dữ liệu mới hơn bản backup gần nhất:

```powershell
$env:MYSQL_PWD = '<mat-khau-mysql>'
.\Backup-Database.ps1 -OutputDir 'D:\Backups\ipc-incident'
```

**B3. Restore vào DB tạm:**

```powershell
.\Restore-Database.ps1 -BackupPath 'D:\Backups\ipc\ipcmanagement-20260726-155820.zip' `
                       -Database ipcmanagement_restore_test
```

Với archive mới có manifest, script verify SHA-256 của SQL trước restore và tự đối chiếu
table count, `stockmovements`, migration count/latest migration sau restore. Archive cũ không có
manifest vẫn restore được nhưng phải đối chiếu tay theo B4.

**B4. Đối chiếu số dòng** giữa DB tạm và DB thật trước khi tin bản backup:

```powershell
$mysql = 'C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe'
$q = "SELECT 'stockmovements' t, COUNT(*) n FROM stockmovements
      UNION ALL SELECT 'inventoryreceiptlines', COUNT(*) FROM inventoryreceiptlines
      UNION ALL SELECT 'inventoryreceipts',     COUNT(*) FROM inventoryreceipts
      UNION ALL SELECT 'dishbom',               COUNT(*) FROM dishbom
      UNION ALL SELECT 'materialrequestlines',  COUNT(*) FROM materialrequestlines
      UNION ALL SELECT 'users',                 COUNT(*) FROM users;"
& $mysql -u root ipcmanagement            -e $q
& $mysql -u root ipcmanagement_restore_test -e $q
```

Chênh lệch chính là **lượng dữ liệu sẽ mất** nếu bạn đè bản backup lên. Nếu con số không chấp nhận
được → dừng lại, cân nhắc PITR (§6) thay vì restore thẳng.

**B5. Chỉ khi B4 đạt** mới ghi đè DB thật:

```powershell
.\Restore-Database.ps1 -BackupPath 'D:\Backups\ipc\ipcmanagement-20260726-155820.zip' `
                       -Database ipcmanagement -Force
```

Lưu ý: dump **không** có `DROP DATABASE`, các bảng được `DROP TABLE` + tạo lại từng cái. Bảng nào
sinh ra sau thời điểm dump (ví dụ do migration mới) sẽ **còn sót lại** trong DB. Muốn sạch tuyệt đối
thì `DROP DATABASE ipcmanagement;` bằng tay trước khi chạy B5.

**B6. Bật lại ứng dụng**, kiểm tra một màn hình đọc tồn kho thật, rồi mới mở cho người dùng.

### Diễn tập định kỳ

**Backup chưa từng restore thử thì chưa phải backup.** Chạy lại B3 + B4 vào một DB tạm mỗi tháng,
xong thì dọn:

```powershell
& $mysql -u root -e "DROP DATABASE IF EXISTS ipcmanagement_restore_test;"
```

Diễn tập gần nhất: 2026-07-28 — dump 12,51 MB + parse evidence (2,4s) → zip 2,84 MB, mirror
`D:` → `C:` khớp SHA-256, restore disposable 61 bảng trong 4,2s; manifest khớp 17.256
`stockmovements`, 41 migration và latest migration. Clone đã drop, còn 0 schema rehearsal.
Chi tiết: `docs/DATABASE-RECOVERY-REHEARSAL-2026-07-28.md`.

---

## 4. RPO / RTO đề xuất

**RPO (mất tối đa bao nhiêu dữ liệu) — đề xuất 4 giờ.**

Lập luận: chi phí một lần backup gần như bằng không — đo thực tế **1.0 giây**, ra file **2.84 MB**.
Chạy 6 lần/ngày tốn ~17 MB/ngày, giữ 14 ngày hết ~240 MB đĩa. Không có lý do kỹ thuật nào để chỉ
chạy 1 lần/ngày.

Còn cái giá của việc mất dữ liệu thì **không** đối xứng: `stockmovements` có cột `beforeQty` /
`afterQty`, tức là một chuỗi số dư nối tiếp nhau. Nhập lại thủ công từ phiếu giấy không chỉ mất công
mà còn dễ làm lệch chuỗi số dư — một phiếu nhập bị bỏ sót là toàn bộ tồn kho phía sau sai theo. Đây
là điểm khác biệt so với dữ liệu master (nguyên liệu, món ăn) vốn gõ lại được. Vì vậy mức "mất 1
ngày công nhập liệu là chấp nhận được" **không** áp dụng cho hệ này.

RPO 24h (dump 1 lần/ngày) chỉ nên coi là sàn tối thiểu cho giai đoạn hiện tại.

**RTO (bao lâu thì chạy lại được) — đề xuất 30 phút.**

Thời gian máy móc đã đo: restore 4.2 giây. Toàn bộ phần còn lại là thao tác người:

| Bước | Ước lượng |
|---|---|
| Phát hiện + xác nhận sự cố | 10 phút |
| Dừng app, backup hiện trạng (B2) | 2 phút |
| Restore vào DB tạm + đối chiếu (B3–B4) | 5 phút |
| Ghi đè DB thật (B5) | 1 phút |
| Kiểm tra app, mở lại cho người dùng | 10 phút |

Ràng buộc để giữ được 30 phút: có người biết quy trình này, và §3 đã được diễn tập chứ không phải
đọc lần đầu lúc đang cháy.

---

## 5. Những gì lưới này KHÔNG bảo vệ

### Đích off-site đã chốt

Kiến trúc đích là object storage hỗ trợ versioning + immutability (triển khai trên
Cloudflare R2 hoặc Backblaze B2 sau khi cấp tài khoản), cộng hai SSD ngoài luân phiên,
trong đó luôn có một SSD nằm ngoài địa điểm vận hành.

- Credential shipper chỉ được ghi object; không có quyền xóa. Credential restore tách riêng.
- Mã hóa dump và binlog trước upload; khóa nằm trong secret manager, không trong repo.
- Upload dump theo lịch và ship binlog theo chu kỳ ngắn; không chỉ copy dump.
- Manifest SHA-256 nằm ở trust boundary tách khỏi payload.
- Off-site chỉ được đóng sau khi restore trên máy chưa từng có dữ liệu IPC, chỉ
  dùng bản off-site, rồi qua table/row/checksum/migration và `/health/ready` gate.

Mirror C:/D: hiện hành chỉ chứng minh integrity, không chứng minh disaster recovery.

1. **Hỏng toàn máy/ổ vật lý.** `-MirrorDir` nay bắt buộc khác volume và verify hash,
   nhưng `C:`/`D:` có thể vẫn cùng physical disk. Muốn thành disaster recovery phải trỏ
   mirror tới ổ ngoài/NAS/cloud hoặc máy khác và rehearsal từ chính bản đó.
2. **Hỏng dữ liệu logic.** Nếu bug ứng dụng ghi sai số liệu, backup sẽ chép nguyên si cái sai.
   Retention 14 ngày chính là cửa sổ để phát hiện — quá 14 ngày mới nhận ra thì không còn bản đúng.
3. **Mất dữ liệu giữa hai lần dump.** Mặc định RPO = chu kỳ chạy task. Muốn nhỏ hơn phải dùng PITR
   (§6).
4. **Không có soft-delete.** Script chỉ khôi phục được toàn bộ DB về một mốc thời gian, không undo
   được một thao tác xoá đơn lẻ. Soft-delete phải làm ở tầng ứng dụng — ngoài phạm vi thư mục này.
5. **Không rollback được migration.** Cũng vậy: chỉ có "quay cả DB về mốc X", không có "gỡ migration
   Y". Trước khi chạy migration trên DB thật, hãy chạy backup thủ công ngay trước đó.
6. **Backup không mã hoá.** File `.zip` chứa toàn bộ dữ liệu, kể cả bảng `users`. Đừng để trong thư
   mục chia sẻ hay repo git.
7. **Manifest không thay thế rehearsal.** Task Scheduler `Last Result = 0` + manifest chỉ chứng
   minh dump đủ marker/evidence và mirror khớp hash. Diễn tập hàng tháng (§3) vẫn là bước
   không bỏ được.

---

## 6. Ghi chú kỹ thuật

**Binlog / point-in-time recovery.** Kiểm tra máy hiện tại (2026-07-26): `log_bin = 1`,
`gtid_mode = ON`, `binlog_expire_logs_seconds = 2592000` (30 ngày) — **binlog đang bật sẵn**, tức là
PITR về mặt kỹ thuật đã khả thi ngay, RPO có thể xuống mức phút thay vì giờ. Nhưng có hai lỗ hổng:

- Binlog nằm cùng thư mục data (`D:\MySQL\MySQL Server 9.5\Data\`) → hỏng ổ là mất cả dump lẫn
  binlog. **Phải copy binlog ra ngoài cùng với file backup** thì PITR mới có ý nghĩa.
- Chưa có quy trình PITR nào được viết ra hay diễn tập.

**Quy trình PITR — bản đã diễn tập thật ngày 27/07/2026.** Sườn lệnh viết ngày 26/07 (chỉ có
`--start-datetime`/`--stop-datetime` rồi đổ thẳng vào `ipcmanagement`) **không dùng được trên máy
này**. Bản dưới đây là bản đã chạy và đã cứu được dữ liệu.

**B0. Copy binlog ra chỗ khác trước khi làm bất cứ gì.** Chúng là nguồn duy nhất và vẫn đang bị ghi
tiếp; đây là bước không được bỏ.

```powershell
Copy-Item "D:\MySQL\MySQL Server 9.5\Data\TUANKY-bin.*" D:\Backups\pitr-binlogs\
```

**B1. Xác định mốc base — chỗ dễ sai nhất.** Mốc base là **thời điểm nội dung của bản dump**, không
phải giờ tạo file hay giờ `CREATE DATABASE`. Các database snapshot kiểu `ipcmanagement_unit_research_*`
được tạo rỗng rồi nạp từ một file dump **cũ hơn**, nên lấy giờ `CREATE DATABASE` làm mốc là sai —
đã sai thật một lần ngày 27/07 và phải swap lại lần hai. Khoảng lặng binlog quanh lúc tạo database chỉ
chứng minh không ai ghi, **không** chứng minh nội dung thuộc mốc nào. Cách chắc chắn: so md5 khối
`INSERT` của snapshot với các file trong thư mục backup để tìm đúng file nguồn, rồi lấy giờ của file đó.

**B2. Tìm biên event thật, đừng dùng `--start-datetime`.** Decode binlog ra text rồi tìm dòng `# at <pos>`
ngay sau mốc base, và vị trí ngay trước transaction đầu tiên của sự cố:

```cmd
mysqlbinlog --no-defaults --base64-output=DECODE-ROWS -v --result-file=D:\Backups\dump670.txt ^
  D:\Backups\pitr-binlogs\TUANKY-bin.000670
```

**B3. Sinh file replay — `--skip-gtids` là BẮT BUỘC.** Server đang bật `gtid_mode=ON`. Thiếu cờ này
thì mysqlbinlog phát ra `SET @@SESSION.GTID_NEXT='<uuid>:<số>'`, MySQL thấy GTID đó đã có trong
`gtid_executed` nên **bỏ qua toàn bộ transaction mà không báo lỗi gì** — chạy xong, exit 0, và không có
gì được áp dụng. Replay vào **database tạm** chứ không vào database thật:

```cmd
mysqlbinlog --no-defaults --skip-gtids ^
  --rewrite-db="ipcmanagement->ipcmanagement_pitr" --database=ipcmanagement_pitr ^
  --start-position=<pos_base> TUANKY-bin.000670 TUANKY-bin.000671 ... ^
  --stop-position=<pos_truoc_su_co> TUANKY-bin.000680 ^
  --result-file=D:\Backups\replay.sql
```

`--start-position` chỉ áp cho file ĐẦU, `--stop-position` chỉ áp cho file CUỐI trong danh sách.
`--rewrite-db` áp dụng **trước** `--database`, nên `--database` phải ghi tên **sau khi đổi**.

**B4. Soi `replay.sql` trước khi nạp.** Phải bằng 0 hết: `grep -c ipc_lane1`, `grep -c "GTID_NEXT= '"`,
và số tham chiếu tới database thật chưa được rewrite (`grep -oE 'ipcmanagement\b' | wc -l`). Kiểm tra
dòng cuối file dừng đúng trước thời điểm sự cố.

**B5. Nạp vào DB tạm rồi TÌM ORACLE.** Đây là thứ đã bắt được lỗi lần đầu: sự cố thường **không đụng
tới mọi bảng**. Bảng nào script phá hoại không nhắc tên thì vẫn giữ nguyên dữ liệu tiền sự cố — dump
lại database hỏng **trước khi swap** là có ngay một bộ đối chiếu chính xác tuyệt đối. Ngày 27/07 có 11
bảng như vậy; gate là **11/11 khớp cả số dòng lẫn md5 khối INSERT**, không phải 10/11.

**B6. Chỉ khi gate xanh mới swap**, và swap bằng cách xoá bảng bên trong database đích rồi nạp lại
(giữ chính database + quyền của nó), không `DROP DATABASE`.

Mọi `mysqldump` trong quy trình này phải có `--set-gtid-purged=OFF` (lý do ngay bên dưới).

Nếu gặp máy mà binlog **chưa** bật, thêm vào `my.ini` mục `[mysqld]` rồi restart service MySQL
(cần cửa sổ downtime — **không tự ý bật trên máy đang chạy**):

```ini
[mysqld]
server_id                 = 1
log_bin                   = mysql-bin
binlog_expire_logs_seconds = 2592000
```

**Vì sao `--set-gtid-purged=OFF`.** Server đang bật GTID. Mặc định `mysqldump` nhét
`SET @@GLOBAL.GTID_PURGED=...` vào đầu file, và câu lệnh đó **sẽ làm restore thất bại** trên server
đã có GTID_EXECUTED khác rỗng — đúng trường hợp restore vào DB tạm trên chính máy này. Tắt đi thì
dump không dùng để dựng replica được nữa, nhưng đổi lại restore standalone luôn chạy. Hệ này không
có replication nên đánh đổi này là đúng.

**User backup riêng cho production.** Đừng dùng `root` cho task chạy tự động:

```sql
CREATE USER 'ipc_backup'@'localhost' IDENTIFIED BY '<mat-khau-rieng>';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER, PROCESS, RELOAD
  ON *.* TO 'ipc_backup'@'localhost';
```

Rồi thêm `-DbUser ipc_backup` vào lệnh trong `schtasks`. User này không xoá được gì, nên kể cả lộ
mật khẩu qua biến môi trường thì thiệt hại cũng giới hạn ở việc đọc dữ liệu.
