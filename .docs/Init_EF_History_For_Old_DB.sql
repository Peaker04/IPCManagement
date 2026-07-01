-- Chạy script này 1 lần duy nhất trên các Database cũ (tạo từ IPCmanagement.sql)
-- Script này sẽ tạo bảng lịch sử và đánh dấu 4 migration đầu tiên là đã chạy, 
-- giúp tránh lỗi "Table already exists" khi các thành viên dùng lệnh dotnet ef database update.

CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
  `MigrationId` varchar(150) NOT NULL,
  `ProductVersion` varchar(32) NOT NULL,
  PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260605013906_AddCurrentStockTable', '9.0.16'),
  ('20260605020053_AddRefreshTokenTable', '9.0.16'),
  ('20260621180049_AddConcurrencyToCurrentStock', '9.0.16'),
  ('20260626043000_SeedTemporaryBomData', '9.0.16');
