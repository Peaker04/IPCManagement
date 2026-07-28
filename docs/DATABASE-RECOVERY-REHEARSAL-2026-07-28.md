# Database recovery rehearsal — 28/07/2026

Evidence cho lát canonical lineage và backup/restore của Bước 16. Không thao tác lên
`ipc_lane1`; `ipcmanagement` chỉ được đọc bằng user backup. Database duy nhất bị tạo/xóa là clone
disposable có prefix `ipc_rehearsal_step16_`.

## Kết quả

| Gate | Kết quả |
|---|---|
| Canonical migration lineage | 41 ID trong DB, 39 source migration, 2 `CANONICAL_DATABASE_ONLY`, 0 unexplained, 0 source-only, 0 manifest lỗi/stale |
| Backup | Dump 12,51 MB + parse evidence từ snapshot trong 2,4 giây; zip 2,84 MB |
| Cross-volume mirror | `D:` → `C:`; byte length và SHA-256 archive khớp |
| Restore disposable | 61 bảng trong 4,2 giây |
| Manifest gate | 61 bảng, 17.256 `stockmovements`, 41 migration và latest migration đều khớp source backup |
| Cleanup | Clone `ipc_rehearsal_step16_20260728180559` đã drop; query sau cleanup trả 0 schema cùng prefix |
| Production/lane mutation | Không có |

Backup evidence được giữ ngoài repo:

- Primary: `D:\Backups\ipc-step16\ipcmanagement-20260728-180557.zip`
- Cross-volume mirror: `C:\IPCManagement-offsite-rehearsal\ipcmanagement-20260728-180557.zip`

Không ghi archive hash vào tài liệu để tránh biến tài liệu thành nguồn xác minh stale; mỗi lượt chạy
phải tính lại bằng `Get-FileHash`. Archive chứa SQL và manifest nhưng **chưa mã hóa**.

## Phạm vi đã đóng và còn hở

- Đã đóng: backup sinh manifest khôi phục, mirror sang volume khác có hash gate, restore tự kiểm
  table/ledger/migration evidence, guard chặn `ipcmanagement` và `ipc_lane1`, guard chặn target đã
  có bảng nếu không truyền `-Force`.
- RPO vận hành vẫn là tối đa 4 giờ theo lịch task hiện tại. RTO phần máy móc đo được là 4,2 giây;
  mục tiêu vận hành 30 phút vẫn gồm phát hiện sự cố, dừng/mở app và xác minh nghiệp vụ.
- Chưa đóng disaster recovery toàn máy: `C:` và `D:` là hai volume nhưng chưa chứng minh nằm trên
  hai physical disk độc lập. Scheduled Task hiện hành cũng chưa được đổi sang external drive/NAS/
  cloud. Operator phải cấu hình `-MirrorDir` tới đích thực sự độc lập rồi chạy lại cùng rehearsal.
- Manifest là integrity/evidence gate, không phải chữ ký mật mã. Nếu attacker sửa cả SQL lẫn
  manifest trước khi tạo zip thì gate không phát hiện; off-machine immutability/encryption còn hở.

## Lệnh gate có thể chạy lại

```powershell
# Lineage — chỉ đọc DB.
.\tools\db\Compare-MigrationLineage.ps1 `
  -Database ipcmanagement -DbUser ipc_backup -FailOnDrift

# Backup + mirror khác volume.
.\tools\db\Backup-Database.ps1 `
  -Database ipcmanagement -DbUser ipc_backup `
  -OutputDir 'D:\Backups\ipc' `
  -MirrorDir 'E:\IPCManagement-offsite' `
  -RetentionDays 14

# Restore vào tên disposable mới; script tự verify manifest nếu archive có manifest.
.\tools\db\Restore-Database.ps1 `
  -BackupPath 'E:\IPCManagement-offsite\ipcmanagement-yyyyMMdd-HHmmss.zip' `
  -Database 'ipc_rehearsal_step16_yyyyMMddHHmmss' `
  -DbUser '<restore-user>'
```

Chỉ drop clone sau khi xác minh đúng prefix và đúng database do lượt chạy hiện tại tạo. Không dùng
`ipc_lane1` làm target rehearsal.
