# MRX Migration, Compatibility & Rollback Runbook

Tài liệu hướng dẫn vận hành, kiểm tra tương thích ngược và kế hoạch phục hồi sau thảm họa (Disaster Recovery & Rollback Runbook) cho phân hệ Đối soát nguyên liệu (`MATERIAL_RECONCILIATION`), tuân thủ nguyên tắc `DOM-MODE-1` và quản trị an toàn theo `AGENTS.md`.

---

## 1. Phân loại 3 Hình thái Lô Đối soát (Retained Batch Shapes)

Hệ thống quản lý chặt chẽ 3 hình thái dữ liệu lô đối soát, không bao giờ tự ý chèn dữ liệu ngầm (`no implicit backfill/rewrite`):

| Hình thái lô (Batch Shape) | Đặc điểm cấu trúc dữ liệu | Khả năng đọc (`canRead`) | Khả năng xuất kho ngày (`canIssueByDate`) | Mã lý do tương thích (`reasonCode`) | Hành vi khi nhận mutation |
|---|---|---|---|---|---|
| **Shape 1: Lô đối soát cũ (Legacy Batch)** | Có `reconciliationbatches` và `reconciliationbatchlines`, nhưng **KHÔNG CÓ** dòng ngày `reconciliationbatchdailylines`. | `true` | `false` | `LEGACY_DAILY_LINEAGE_MISSING` | **Từ chối tuyệt đối (Fail-Closed):** Mọi lệnh tạo phiếu xuất, xuất bổ sung, phiếu nấu bếp trưởng, hay xử lý chênh lệch ngày đều bị từ chối với lỗi `LEGACY_DAILY_LINEAGE_MISSING`. Không ghi bất kỳ thay đổi nào xuống DB. |
| **Shape 2: Lô đã hoàn tất (`COMPLETED`)** | Đã chốt hoàn tất tuần (`WeeklyStatus == "WEEK_COMPLETE"`), trường `status == "COMPLETED"`. | `true` | `false` | `BATCH_READ_ONLY` | **Bất biến vĩnh viễn (Immutable):** Từ chối mọi thao tác chỉnh sửa, chuyển kho, stage sửa đổi thực đơn, giải trình chênh lệch hay hoàn tất lần hai. Chỉ phục vụ thanh tra/kiểm toán. |
| **Shape 3: Lô hiện hành có định lượng ngày (Modern Batch)** | Có đầy đủ `reconciliationbatchdailylines` và lineage món/BOM đóng băng. Trạng thái `READY`, `TRANSFERRED`, hoặc `IN_PROGRESS`. | `true` | `true` | `null` | **Tương thích toàn diện (Full Operation):** Cho phép xuất kho ngày, xuất phối hợp đa khách hàng, xuất bổ sung delta, hoàn trả vật lý, giải trình chênh lệch và chốt hoàn tất tuần. |

---

## 2. Dòng Dõi Migration (EF Migration Lineage)

Tất cả các migration của phân hệ MRX đều là **Additive Migrations** (chỉ thêm bảng/cột mới, có giá trị mặc định hoặc cho phép null, không bao giờ drop cột đang chạy):

1. **`20261019144828_AddReconciliationSourceRevisions`**:
   - Tạo bảng `reconciliationsourcerevisions` (lưu phiên bản thay đổi nguồn từ phê duyệt thực đơn).
   - Tạo bảng `reconciliationsourcedeltas` (lưu chênh lệch định lượng ngày).
2. **`20261019151504_AddReconciliationDispositionInvalidation`**:
   - Bổ sung các cột `InvalidatedAt`, `InvalidatedBy`, `InvalidationReason` vào bảng `reconciliationdailydispositions` để bảo toàn lịch sử giải trình khi nguồn bị thay đổi.
3. **`20261019154437_RefineReconciliationSourceRevisionProjection`**:
   - Thêm `ServiceDate` vào delta và cho phép `DailyLineId` null để hỗ trợ nguyên liệu mới phát sinh.
4. **`20261020065952_ResolveReconciliationSourceDeltas`**:
   - Thêm các cột truy vết giải quyết delta: `ResolutionCommandId`, `ResolutionEntity`, `ResolutionId`, `ResolvedBy` trên bảng `reconciliationsourcedeltas`.
   - Thêm `reconciliationSourceDeltaId` và `reconciliationSourceDeltaVersion` trên bảng `inventoryreturns` để gắn kết hoàn trả vật lý.
5. **`20261022020917_AddPreparationGroupIdToInventoryIssue`**:
   - Thêm cột `preparationGroupId binary(16) NULL` vào bảng `inventoryissues` để liên kết logic các phiếu xuất kho được tạo từ một lệnh xuất kho phối hợp đa khách hàng (Task 7).

---

## 3. Quy trình Sao lưu & Phục hồi (Backup & Restore Runbook)

Trước khi thực hiện bất kỳ migration hoặc can thiệp DDL nào trên cơ sở dữ liệu MySQL thật:

### A. Sao lưu Cơ sở dữ liệu (Single-Transaction Dump)
Sử dụng công cụ `mysqldump` với cờ `--single-transaction` để bảo đảm tính nhất quán dữ liệu mà không khóa bảng đang đọc:

```powershell
$dumpExe = "C:\Program Files\MySQL\MySQL Server 9.5\bin\mysqldump.exe"
$backupDir = "D:\Temp\IPCManagement-backups\mrx-backup-<timestamp>"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$dumpFile = Join-Path $backupDir "ipcmanagement-backup.sql"

& $dumpExe --user=root --password=<password> --host=localhost --port=3306 `
    --single-transaction --routines --triggers ipcmanagement `
    | Out-File -FilePath $dumpFile -Encoding utf8

$hash = (Get-FileHash -Path $dumpFile -Algorithm SHA256).Hash
Set-Content -Path (Join-Path $backupDir "SHA256SUMS.txt") -Value "$hash  ipcmanagement-backup.sql"
```

### B. Kiểm tra Toàn vẹn Bản Sao lưu
- Kiểm tra dung lượng file (thường $\ge 19\text{ MB}$).
- Kiểm tra 5 dòng cuối cùng có chứa marker: `-- Dump completed on ...`.
- Đếm số lượng bảng: `(Select-String -Path $dumpFile -Pattern "CREATE TABLE").Count >= 93`.

### C. Quy trình Phục hồi (Disaster Recovery / Rollback)
Nếu migration thất bại hoặc cần phục hồi dữ liệu về trạng thái trước đó:

```powershell
$mysqlExe = "C:\Program Files\MySQL\MySQL Server 9.5\bin\mysql.exe"
Get-Content $dumpFile | & $mysqlExe --user=root --password=<password> --host=localhost --port=3306 ipcmanagement
```

---

## 4. Truy vấn Kiểm chứng Không Mất Dữ liệu (Zero Data-Loss Verification Queries)

Sau khi áp dụng migration hoặc phục hồi, chạy các truy vấn SQL sau để kiểm chứng:

```sql
-- 1. Xác nhận lịch sử migration đã ghi nhận đủ
SELECT MigrationId FROM ipcmanagement.__EFMigrationsHistory ORDER BY MigrationId DESC LIMIT 5;

-- 2. Xác nhận cột mới trên inventoryissues
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'ipcmanagement' AND TABLE_NAME = 'inventoryissues' AND COLUMN_NAME = 'preparationGroupId';

-- 3. Xác nhận không có dòng định lượng nào bị mất hoặc bị biến đổi số lượng
SELECT COUNT(*) AS TotalBatches, SUM(version) AS VersionChecksum FROM ipcmanagement.reconciliationbatches;
SELECT COUNT(*) AS TotalDailyLines, SUM(requiredQuantity) AS TotalRequiredQty FROM ipcmanagement.reconciliationbatchdailylines;

-- 4. Xác nhận số lượng phiếu xuất và phiếu trả khớp nguyên vẹn
SELECT COUNT(*) AS TotalIssues FROM ipcmanagement.inventoryissues;
SELECT COUNT(*) AS TotalReturns FROM ipcmanagement.inventoryreturns;
```
