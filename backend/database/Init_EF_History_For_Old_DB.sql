-- Chạy script này trên các database local cũ trước khi chạy:
-- dotnet ef database update --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
--
-- Mục tiêu:
-- 1. Tạo bảng lịch sử EF nếu database được tạo từ file SQL cũ.
-- 2. Đánh dấu các migration đã có sẵn schema tương ứng để tránh lỗi "table/column already exists".
-- 3. Dọn các migration ID cũ đã được thay bằng migration hợp nhất trong code hiện tại.
--
-- Script idempotent: có thể chạy lại nhiều lần. Với database trống, script không đánh dấu
-- các migration chưa có bảng/cột; EF sẽ tự tạo khi chạy database update.

CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
  `MigrationId` varchar(150) NOT NULL,
  `ProductVersion` varchar(32) NOT NULL,
  PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

-- Baseline cho database được tạo từ IPCmanagement.sql.
INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260605013906_AddCurrentStockTable', '9.0.16'),
  ('20260605020053_AddRefreshTokenTable', '9.0.16'),
  ('20260621180049_AddConcurrencyToCurrentStock', '9.0.16'),
  ('20260626043000_SeedTemporaryBomData', '9.0.16');

-- Một số máy local từng có 3 migration tách nhỏ này. Code hiện tại đã thay bằng
-- migration hợp nhất 20260630031911_AddCustomerContractsAndMenuVersions.
INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory`
  WHERE `MigrationId` = '20260629161000_AddCustomerContracts'
)
AND EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory`
  WHERE `MigrationId` = '20260629233000_AddMenuVersions'
)
AND EXISTS (
  SELECT 1 FROM `__EFMigrationsHistory`
  WHERE `MigrationId` = '20260629234500_UpdateMenuScheduleStatusForVersioning'
);

DELETE FROM `__EFMigrationsHistory`
WHERE `MigrationId` IN (
  '20260629161000_AddCustomerContracts',
  '20260629233000_AddMenuVersions',
  '20260629234500_UpdateMenuScheduleStatusForVersioning'
)
AND EXISTS (
  SELECT 1 FROM (
    SELECT 1 FROM `__EFMigrationsHistory`
    WHERE `MigrationId` = '20260630031911_AddCustomerContractsAndMenuVersions'
  ) AS replacement
);

-- Nếu schema đã được tạo thủ công hoặc từ dump mới hơn, đánh dấu đúng migration
-- tương ứng. Nếu bảng/cột chưa tồn tại thì không làm gì, để EF tự migrate.
INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customercontracts'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menuversions'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260630062000_AddPortionRules', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'portionrules'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260630065000_AddPortionRuleTraceToDemandLines', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'materialrequestlines'
    AND COLUMN_NAME = 'appliedPortionRuleId'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'materialrequestlines'
    AND COLUMN_NAME = 'appliedPortionRatePercent'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260630161000_AddBomVersionStatus', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'dishbom'
    AND COLUMN_NAME = 'bomStatus'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260701175833_AddCustomerImportMapping', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customerimportmappings'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260702121000_AddProductionPlanMetadata', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'productionplans'
    AND COLUMN_NAME = 'menuVersionId'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'productionplans'
    AND COLUMN_NAME = 'weekStartDate'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260702194500_AddPurchaseLineDeliveryNote', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchaserequestlines'
    AND COLUMN_NAME = 'expectedDeliveryDate'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchaserequestlines'
    AND COLUMN_NAME = 'note'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260702203000_AddInventoryIssueReceivedAt', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventoryissues'
    AND COLUMN_NAME = 'receivedAt'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260702204500_AddInventoryReturnType', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventoryreturns'
    AND COLUMN_NAME = 'returnType'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260702165732_FixPurchaseRequestStatusEnum', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchaserequests'
    AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%SENTTOWAREHOUSE%'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260703090000_AlignPurchaseRequestReceiptStatuses', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchaserequests'
    AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%PARTIALRECEIVED%'
    AND COLUMN_TYPE LIKE '%RECEIVED%'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260703093000_AddLotLevelStock', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'currentstocklots'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stockmovements'
    AND COLUMN_NAME = 'lotNumber'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260703100000_AddStockMovementQuantitySnapshots', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stockmovements'
    AND COLUMN_NAME = 'beforeQty'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stockmovements'
    AND COLUMN_NAME = 'afterQty'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260703103000_AddMonthlyStockSnapshots', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocksnapshots'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260706033326_AddMealQuantityPlanCompletedAndConcurrency', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mealquantityplans'
    AND COLUMN_NAME = 'completedAt'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mealquantityplans'
    AND COLUMN_NAME = 'rowVersion'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260706034750_AddApprovalRoutingAndRules', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approvalrules'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approvalassignments'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260706093000_AddPurchaseRequestLineToInventoryReceipts', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventoryreceiptlines'
    AND COLUMN_NAME = 'purchaseRequestLineId'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260707085015_AddReceivedToInventoryReturn', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventoryreturns'
    AND COLUMN_NAME = 'receivedAt'
);

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
SELECT '20260707093741_AddStocktakeEntities', '9.0.16'
WHERE EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocktakes'
)
AND EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stocktakelines'
);
