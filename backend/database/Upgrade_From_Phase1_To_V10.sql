-- Upgrade_From_Phase1_To_V10.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Nâng cấp database từ schema Phase 1 (IPCmanagement.sql ban đầu, pre-2026-06-30)
-- lên v1.0 đầy đủ (EF migration 20260707093741_AddStocktakeEntities).
--
-- Đối tượng: developer local DB không dùng "dotnet ef database update".
-- Điều kiện: DB đã có schema Phase 1 gốc (roles/users/ingredients/... nhưng
--   CHƯA có customercontracts, menuversions, portionrules, approvalrules, ...).
--
-- Script này IDEMPOTENT: có thể chạy lại nhiều lần. Mỗi ALTER TABLE dùng
-- INFORMATION_SCHEMA để kiểm tra trước; mỗi CREATE TABLE dùng IF NOT EXISTS.
--
-- Gộp từ: Migration_From_Old_DB.sql + ITER1_MANUAL_DB_MIGRATION.sql (deprecated)
-- Ngày gộp: 2026-07-08
--
-- Sau khi chạy script này:
--   dotnet ef database update ...
-- EF sẽ không cần áp dụng lại các migration đã được đánh dấu ở đây.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
  `MigrationId`   varchar(150) NOT NULL,
  `ProductVersion` varchar(32) NOT NULL,
  PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260630031911_AddCustomerContractsAndMenuVersions
-- ───────────────────────────────────────────────────────────────────────────

-- approvalhistories — lịch sử phê duyệt tất cả loại tài liệu
CREATE TABLE IF NOT EXISTS `approvalhistories` (
    `approvalHistoryId` binary(16) NOT NULL,
    `targetType`        varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `targetId`          binary(16) NOT NULL,
    `decision`          varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
    `oldStatus`         varchar(50) COLLATE utf8mb4_unicode_ci NULL,
    `newStatus`         varchar(50) COLLATE utf8mb4_unicode_ci NULL,
    `reason`            text COLLATE utf8mb4_unicode_ci NULL,
    `actionBy`          binary(16) NOT NULL,
    `actionAt`          datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`approvalHistoryId`),
    CONSTRAINT `approvalhistories_ibfk_1` FOREIGN KEY (`actionBy`) REFERENCES `users` (`userId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customercontracts` (
    `contractId`            binary(16) NOT NULL,
    `customerId`            binary(16) NOT NULL,
    `effectiveFrom`         date NOT NULL,
    `effectiveTo`           date NULL,
    `activeWeekDays`        varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `shiftNames`            varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `defaultMenuPrice`      decimal(18,2) NOT NULL,
    `defaultBomRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00',
    `status`                varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `createdAt`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`contractId`),
    CONSTRAINT `customercontracts_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `menuversions` (
    `menuVersionId`     binary(16) NOT NULL,
    `customerId`        binary(16) NOT NULL,
    `weekStartDate`     date NOT NULL,
    `versionNo`         int NOT NULL,
    `status`            varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
    `sourceFileName`    varchar(255) COLLATE utf8mb4_unicode_ci NULL,
    `sourceChecksum`    varchar(128) COLLATE utf8mb4_unicode_ci NULL,
    `sourceImportBatch` varchar(80) COLLATE utf8mb4_unicode_ci NULL,
    `createdBy`         binary(16) NULL,
    `createdAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `publishedBy`       binary(16) NULL,
    `publishedAt`       datetime NULL,
    `updatedAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`menuVersionId`),
    CONSTRAINT `menuversions_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rename index conflicts from old schema (nếu tồn tại)
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='productionplanlines' AND INDEX_NAME='customerId1') > 0,
  'ALTER TABLE `productionplanlines` RENAME INDEX `customerId1` TO `customerId3`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplanlines' AND INDEX_NAME='customerId') > 0,
  'ALTER TABLE `mealquantityplanlines` RENAME INDEX `customerId` TO `customerId1`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- menuschedules.status → VARCHAR (ENUM cũ không support ACTIVE/SUPERSEDED/LOCKED)
ALTER TABLE `menuschedules`
  MODIFY COLUMN `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT';

-- Indexes cho các bảng mới
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approvalhistories' AND INDEX_NAME='IX_approvalhistories_actionBy') = 0,
  'CREATE INDEX `IX_approvalhistories_actionBy` ON `approvalhistories` (`actionBy`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approvalhistories' AND INDEX_NAME='ixApprovalHistoriesTarget') = 0,
  'CREATE INDEX `ixApprovalHistoriesTarget` ON `approvalhistories` (`targetType`, `targetId`, `actionAt`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customercontracts' AND INDEX_NAME='ixCustomerContractsEffective') = 0,
  'CREATE INDEX `ixCustomerContractsEffective` ON `customercontracts` (`customerId`, `effectiveFrom`, `effectiveTo`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='menuversions' AND INDEX_NAME='ixMenuVersionsCustomerWeekStatus') = 0,
  'CREATE INDEX `ixMenuVersionsCustomerWeekStatus` ON `menuversions` (`customerId`, `weekStartDate`, `status`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='menuversions' AND INDEX_NAME='uqMenuVersionsCustomerWeekVersion') = 0,
  'CREATE UNIQUE INDEX `uqMenuVersionsCustomerWeekVersion` ON `menuversions` (`customerId`, `weekStartDate`, `versionNo`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260630062000_AddPortionRules
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `portionrules` (
    `portionRuleId`     binary(16) NOT NULL,
    `customerId`        binary(16) NOT NULL,
    `dishId`            binary(16) NULL,
    `effectiveFrom`     date NOT NULL,
    `effectiveTo`       date NULL,
    `activeWeekDays`    varchar(100) COLLATE utf8mb4_unicode_ci NULL,
    `shiftNames`        varchar(100) COLLATE utf8mb4_unicode_ci NULL,
    `menuVariant`       varchar(50) COLLATE utf8mb4_unicode_ci NULL,
    `menuSectionName`   varchar(150) COLLATE utf8mb4_unicode_ci NULL,
    `slotName`          varchar(100) COLLATE utf8mb4_unicode_ci NULL,
    `dishCategory`      varchar(100) COLLATE utf8mb4_unicode_ci NULL,
    `portionRatePercent` decimal(5,2) NOT NULL,
    `bomRatePercent`    decimal(5,2) NULL,
    `yieldLossPercent`  decimal(5,2) NULL,
    `priority`          int NOT NULL DEFAULT '0',
    `status`            varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `reason`            text COLLATE utf8mb4_unicode_ci NOT NULL,
    `createdAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`portionRuleId`),
    CONSTRAINT `portionrules_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
    CONSTRAINT `portionrules_ibfk_2` FOREIGN KEY (`dishId`) REFERENCES `dishes` (`dishId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='portionrules' AND INDEX_NAME='ixPortionRulesCustomerEffective') = 0,
  'CREATE INDEX `ixPortionRulesCustomerEffective` ON `portionrules` (`customerId`, `effectiveFrom`, `effectiveTo`, `status`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630062000_AddPortionRules', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260630065000_AddPortionRuleTraceToDemandLines
-- ───────────────────────────────────────────────────────────────────────────

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materialrequestlines' AND COLUMN_NAME='appliedPortionRuleId') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRuleId` binary(16) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materialrequestlines' AND COLUMN_NAME='appliedPortionRatePercent') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRatePercent` decimal(5,2) NOT NULL DEFAULT ''100.00''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materialrequestlines' AND COLUMN_NAME='appliedPortionRuleSource') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRuleSource` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''CONTRACT_DEFAULT''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materialrequestlines' AND COLUMN_NAME='yieldLossPercent') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `yieldLossPercent` decimal(5,2) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materialrequestlines' AND INDEX_NAME='appliedPortionRuleId') = 0,
  'CREATE INDEX `appliedPortionRuleId` ON `materialrequestlines` (`appliedPortionRuleId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630065000_AddPortionRuleTraceToDemandLines', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260630161000_AddBomVersionStatus
-- ───────────────────────────────────────────────────────────────────────────

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='dishbom' AND COLUMN_NAME='bomStatus') = 0,
  'ALTER TABLE `dishbom` ADD COLUMN `bomStatus` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''PUBLISHED''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630161000_AddBomVersionStatus', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260701175833_AddCustomerImportMapping
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `customerimportmappings` (
    `mappingId`          binary(16) NOT NULL,
    `customerId`         binary(16) NOT NULL,
    `sourceCustomerCode` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    `isActive`           tinyint(1) NOT NULL DEFAULT '1',
    `createdAt`          datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`mappingId`),
    CONSTRAINT `customerimportmappings_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customerimportmappings' AND INDEX_NAME='uqCustomerImportMappings') = 0,
  'CREATE UNIQUE INDEX `uqCustomerImportMappings` ON `customerimportmappings` (`customerId`, `sourceCustomerCode`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260701175833_AddCustomerImportMapping', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migrations 20260702061320, 20260702072352, 20260702121000
-- (import audit fields + productionplans updatedAt/metadata)
-- ───────────────────────────────────────────────────────────────────────────

-- productionplans.updatedAt
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='productionplans' AND COLUMN_NAME='updatedAt') = 0,
  'ALTER TABLE `productionplans` ADD COLUMN `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- productionplans.menuVersionId + weekStartDate
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='productionplans' AND COLUMN_NAME='menuVersionId') = 0,
  'ALTER TABLE `productionplans` ADD COLUMN `menuVersionId` binary(16) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='productionplans' AND COLUMN_NAME='weekStartDate') = 0,
  'ALTER TABLE `productionplans` ADD COLUMN `weekStartDate` date NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260702061320_AddImportAuditFields', '9.0.16'),
  ('20260702072352_AddProductionPlanUpdatedAt', '9.0.16'),
  ('20260702121000_AddProductionPlanMetadata', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260702124738_AddSupplierQuotations
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `supplierquotations` (
    `quotationId`   binary(16) NOT NULL,
    `supplierId`    binary(16) NOT NULL,
    `ingredientId`  binary(16) NOT NULL,
    `unitPrice`     decimal(18,2) NOT NULL,
    `effectiveFrom` date NOT NULL,
    `effectiveTo`   date NULL,
    `note`          varchar(255) COLLATE utf8mb4_unicode_ci NULL,
    `isActive`      tinyint(1) NOT NULL DEFAULT '1',
    `createdAt`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`quotationId`),
    CONSTRAINT `supplierquotations_ibfk_1` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`supplierId`),
    CONSTRAINT `supplierquotations_ibfk_2` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplierquotations' AND INDEX_NAME='ixSupplierQuotationsIngredient') = 0,
  'CREATE INDEX `ixSupplierQuotationsIngredient` ON `supplierquotations` (`ingredientId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='supplierquotations' AND INDEX_NAME='ixSupplierQuotationsSupplierIngredientEffective') = 0,
  'CREATE INDEX `ixSupplierQuotationsSupplierIngredientEffective` ON `supplierquotations` (`supplierId`, `ingredientId`, `effectiveFrom`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260702124738_AddSupplierQuotations', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260702164531_AddPurchaseOrders
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `purchaseorders` (
    `purchaseOrderId`   binary(16) NOT NULL,
    `purchaseOrderCode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `purchaseRequestId` binary(16) NOT NULL,
    `supplierId`        binary(16) NOT NULL,
    `orderDate`         date NOT NULL,
    `status`            varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ORDERED',
    `createdBy`         binary(16) NOT NULL,
    `createdAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`         datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`purchaseOrderId`),
    CONSTRAINT `purchaseorders_ibfk_1` FOREIGN KEY (`purchaseRequestId`) REFERENCES `purchaserequests` (`purchaseRequestId`),
    CONSTRAINT `purchaseorders_ibfk_2` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`supplierId`),
    CONSTRAINT `purchaseorders_ibfk_3` FOREIGN KEY (`createdBy`) REFERENCES `users` (`userId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchaseorderlines` (
    `purchaseOrderLineId`   binary(16) NOT NULL,
    `purchaseOrderId`       binary(16) NOT NULL,
    `purchaseRequestLineId` binary(16) NOT NULL,
    `ingredientId`          binary(16) NOT NULL,
    `unitId`                binary(16) NOT NULL,
    `orderedQty`            decimal(18,6) NOT NULL,
    `receivedQty`           decimal(18,6) NOT NULL,
    `unitPrice`             decimal(18,2) NOT NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`purchaseOrderLineId`),
    CONSTRAINT `purchaseorderlines_ibfk_1` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchaseorders` (`purchaseOrderId`),
    CONSTRAINT `purchaseorderlines_ibfk_2` FOREIGN KEY (`purchaseRequestLineId`) REFERENCES `purchaserequestlines` (`purchaseRequestLineId`),
    CONSTRAINT `purchaseorderlines_ibfk_3` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`),
    CONSTRAINT `purchaseorderlines_ibfk_4` FOREIGN KEY (`unitId`) REFERENCES `units` (`unitId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaseorders' AND INDEX_NAME='purchaseOrderCode') = 0,
  'CREATE UNIQUE INDEX `purchaseOrderCode` ON `purchaseorders` (`purchaseOrderCode`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaseorders' AND INDEX_NAME='ixPurchaseOrdersRequestSupplier') = 0,
  'CREATE UNIQUE INDEX `ixPurchaseOrdersRequestSupplier` ON `purchaseorders` (`purchaseRequestId`, `supplierId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaseorderlines' AND INDEX_NAME='ixPurchaseOrderLinesRequestLine') = 0,
  'CREATE UNIQUE INDEX `ixPurchaseOrderLinesRequestLine` ON `purchaseorderlines` (`purchaseRequestLineId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260702164531_AddPurchaseOrders', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migrations 20260702165732…20260703103000 (enum/column fixes)
-- ───────────────────────────────────────────────────────────────────────────

-- purchaserequests.status → VARCHAR(30) để support SENTTOWAREHOUSE / PARTIALRECEIVED / RECEIVED
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaserequests' AND COLUMN_NAME='status' AND DATA_TYPE='enum') > 0,
  'ALTER TABLE `purchaserequests` MODIFY COLUMN `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''DRAFT''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- purchaserequestlines: expectedDeliveryDate + note
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaserequestlines' AND COLUMN_NAME='expectedDeliveryDate') = 0,
  'ALTER TABLE `purchaserequestlines` ADD COLUMN `expectedDeliveryDate` date NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchaserequestlines' AND COLUMN_NAME='note') = 0,
  'ALTER TABLE `purchaserequestlines` ADD COLUMN `note` varchar(500) COLLATE utf8mb4_unicode_ci NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- inventoryissues.receivedAt
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryissues' AND COLUMN_NAME='receivedAt') = 0,
  'ALTER TABLE `inventoryissues` ADD COLUMN `receivedAt` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- inventoryreturns.returnType
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreturns' AND COLUMN_NAME='returnType') = 0,
  'ALTER TABLE `inventoryreturns` ADD COLUMN `returnType` varchar(30) COLLATE utf8mb4_unicode_ci NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260702165732_FixPurchaseRequestStatusEnum', '9.0.16'),
  ('20260702194500_AddPurchaseLineDeliveryNote', '9.0.16'),
  ('20260702203000_AddInventoryIssueReceivedAt', '9.0.16'),
  ('20260702204500_AddInventoryReturnType', '9.0.16'),
  ('20260703090000_AlignPurchaseRequestReceiptStatuses', '9.0.16');

-- stockmovements: lot fields + quantity snapshots
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stockmovements' AND COLUMN_NAME='lotNumber') = 0,
  'ALTER TABLE `stockmovements` ADD COLUMN `lotNumber` varchar(100) COLLATE utf8mb4_unicode_ci NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stockmovements' AND COLUMN_NAME='manufactureDate') = 0,
  'ALTER TABLE `stockmovements` ADD COLUMN `manufactureDate` date NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stockmovements' AND COLUMN_NAME='expiredDate') = 0,
  'ALTER TABLE `stockmovements` ADD COLUMN `expiredDate` date NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stockmovements' AND COLUMN_NAME='beforeQty') = 0,
  'ALTER TABLE `stockmovements` ADD COLUMN `beforeQty` decimal(18,6) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stockmovements' AND COLUMN_NAME='afterQty') = 0,
  'ALTER TABLE `stockmovements` ADD COLUMN `afterQty` decimal(18,6) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `currentstocklots` (
    `lotStockId`     binary(16) NOT NULL,
    `warehouseId`    binary(16) NOT NULL,
    `ingredientId`   binary(16) NOT NULL,
    `unitId`         binary(16) NOT NULL,
    `lotNumber`      varchar(100) COLLATE utf8mb4_unicode_ci NULL,
    `manufactureDate` date NULL,
    `expiredDate`    date NULL,
    `currentQty`     decimal(18,6) NOT NULL DEFAULT '0.000000',
    `lastUpdated`    datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`lotStockId`),
    CONSTRAINT `currentstocklots_ibfk_1` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`warehouseId`),
    CONSTRAINT `currentstocklots_ibfk_2` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`),
    CONSTRAINT `currentstocklots_ibfk_3` FOREIGN KEY (`unitId`) REFERENCES `units` (`unitId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stocksnapshots` (
    `snapshotId`   binary(16) NOT NULL,
    `warehouseId`  binary(16) NOT NULL,
    `ingredientId` binary(16) NOT NULL,
    `unitId`       binary(16) NOT NULL,
    `periodMonth`  date NOT NULL,
    `openingQty`   decimal(18,6) NOT NULL DEFAULT '0.000000',
    `quantityIn`   decimal(18,6) NOT NULL DEFAULT '0.000000',
    `quantityOut`  decimal(18,6) NOT NULL DEFAULT '0.000000',
    `closingQty`   decimal(18,6) NOT NULL DEFAULT '0.000000',
    `generatedAt`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`snapshotId`),
    CONSTRAINT `stocksnapshots_ibfk_1` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`warehouseId`),
    CONSTRAINT `stocksnapshots_ibfk_2` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`),
    CONSTRAINT `stocksnapshots_ibfk_3` FOREIGN KEY (`unitId`) REFERENCES `units` (`unitId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='currentstocklots' AND INDEX_NAME='ixCurrentStockLotsFefo') = 0,
  'CREATE INDEX `ixCurrentStockLotsFefo` ON `currentstocklots` (`warehouseId`, `ingredientId`, `expiredDate`, `lotNumber`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stocksnapshots' AND INDEX_NAME='ixStockSnapshotsIdentity') = 0,
  'CREATE UNIQUE INDEX `ixStockSnapshotsIdentity` ON `stocksnapshots` (`warehouseId`, `ingredientId`, `unitId`, `periodMonth`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260703093000_AddLotLevelStock', '9.0.16'),
  ('20260703100000_AddStockMovementQuantitySnapshots', '9.0.16'),
  ('20260703103000_AddMonthlyStockSnapshots', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260706033326_AddMealQuantityPlanCompletedAndConcurrency
-- ───────────────────────────────────────────────────────────────────────────

-- mealquantityplans.status: thêm COMPLETED
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND COLUMN_NAME='status' AND COLUMN_TYPE LIKE '%COMPLETED%') = 0,
  'ALTER TABLE `mealquantityplans` MODIFY COLUMN `status` enum(''DRAFT'',''FORECASTED'',''CONFIRMED'',''ADJUSTED'',''COMPLETED'',''CANCELLED'') NOT NULL DEFAULT ''DRAFT''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND COLUMN_NAME='completedAt') = 0,
  'ALTER TABLE `mealquantityplans` ADD COLUMN `completedAt` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND COLUMN_NAME='completedBy') = 0,
  'ALTER TABLE `mealquantityplans` ADD COLUMN `completedBy` binary(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND COLUMN_NAME='rowVersion') = 0,
  'ALTER TABLE `mealquantityplans` ADD COLUMN `rowVersion` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND INDEX_NAME='IX_mealquantityplans_completedBy') = 0,
  'CREATE INDEX `IX_mealquantityplans_completedBy` ON `mealquantityplans` (`completedBy`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FK if it doesn't exist (MySQL doesn't have IF NOT EXISTS for FK)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mealquantityplans' AND CONSTRAINT_NAME='mealquantityplans_ibfk_3');
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `mealquantityplans` ADD CONSTRAINT `mealquantityplans_ibfk_3` FOREIGN KEY (`completedBy`) REFERENCES `users` (`userId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260706033326_AddMealQuantityPlanCompletedAndConcurrency', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260706034750_AddApprovalRoutingAndRules
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `approvalrules` (
    `ruleId`       binary(16) NOT NULL,
    `ruleName`     varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
    `documentType` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `minAmount`    decimal(18,2) NULL,
    `maxAmount`    decimal(18,2) NULL,
    `slaHours`     int NULL,
    `isActive`     tinyint(1) NOT NULL DEFAULT '1',
    `createdAt`    datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`ruleId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvalassignments` (
    `assignmentId`   binary(16) NOT NULL,
    `ruleId`         binary(16) NOT NULL,
    `sequence`       int NOT NULL,
    `approverRole`   varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `approverUserId` binary(16) NULL,
    `isRequired`     tinyint(1) NOT NULL DEFAULT '1',
    CONSTRAINT `PRIMARY` PRIMARY KEY (`assignmentId`),
    CONSTRAINT `approvalassignments_ibfk_1` FOREIGN KEY (`ruleId`) REFERENCES `approvalrules` (`ruleId`) ON DELETE CASCADE,
    CONSTRAINT `approvalassignments_ibfk_2` FOREIGN KEY (`approverUserId`) REFERENCES `users` (`userId`) ON DELETE SET NULL
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approvalassignments' AND INDEX_NAME='IX_approvalassignments_ruleId') = 0,
  'CREATE INDEX `IX_approvalassignments_ruleId` ON `approvalassignments` (`ruleId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='approvalassignments' AND INDEX_NAME='IX_approvalassignments_approverUserId') = 0,
  'CREATE INDEX `IX_approvalassignments_approverUserId` ON `approvalassignments` (`approverUserId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260706034750_AddApprovalRoutingAndRules', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260706093000_AddPurchaseRequestLineToInventoryReceipts
-- ───────────────────────────────────────────────────────────────────────────

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreceiptlines' AND COLUMN_NAME='purchaseRequestLineId') = 0,
  'ALTER TABLE `inventoryreceiptlines` ADD COLUMN `purchaseRequestLineId` binary(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreceiptlines' AND INDEX_NAME='purchaseRequestLineId') = 0,
  'CREATE INDEX `purchaseRequestLineId` ON `inventoryreceiptlines` (`purchaseRequestLineId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260706093000_AddPurchaseRequestLineToInventoryReceipts', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260707085015_AddReceivedToInventoryReturn
-- ───────────────────────────────────────────────────────────────────────────

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreturns' AND COLUMN_NAME='receivedAt') = 0,
  'ALTER TABLE `inventoryreturns` ADD COLUMN `receivedAt` datetime NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreturns' AND COLUMN_NAME='receivedBy') = 0,
  'ALTER TABLE `inventoryreturns` ADD COLUMN `receivedBy` binary(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventoryreturns' AND INDEX_NAME='IX_inventoryreturns_receivedBy') = 0,
  'CREATE INDEX `IX_inventoryreturns_receivedBy` ON `inventoryreturns` (`receivedBy`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260707085015_AddReceivedToInventoryReturn', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────
-- Migration 20260707093741_AddStocktakeEntities
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `stocktakes` (
    `stocktakeId`   binary(16) NOT NULL,
    `stocktakeCode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `warehouseId`   binary(16) NOT NULL,
    `status`        varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    `notes`         varchar(1000) COLLATE utf8mb4_unicode_ci NULL,
    `createdBy`     binary(16) NOT NULL,
    `createdAt`     datetime NOT NULL,
    `approvedBy`    binary(16) NULL,
    `approvedAt`    datetime NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`stocktakeId`),
    CONSTRAINT `FK_stocktakes_users_approvedBy`   FOREIGN KEY (`approvedBy`)  REFERENCES `users` (`userId`),
    CONSTRAINT `FK_stocktakes_users_createdBy`    FOREIGN KEY (`createdBy`)   REFERENCES `users` (`userId`),
    CONSTRAINT `FK_stocktakes_warehouses_warehouseId` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`warehouseId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stocktakelines` (
    `lineId`         binary(16) NOT NULL,
    `stocktakeId`    binary(16) NOT NULL,
    `ingredientId`   binary(16) NOT NULL,
    `unitId`         binary(16) NOT NULL,
    `systemQty`      decimal(18,2) NOT NULL,
    `actualQty`      decimal(18,2) NULL,
    `discrepancyQty` decimal(18,2) NULL,
    `reason`         varchar(1000) COLLATE utf8mb4_unicode_ci NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`lineId`),
    CONSTRAINT `FK_stocktakelines_ingredients_ingredientId` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`),
    CONSTRAINT `FK_stocktakelines_stocktakes_stocktakeId`   FOREIGN KEY (`stocktakeId`)  REFERENCES `stocktakes` (`stocktakeId`) ON DELETE CASCADE,
    CONSTRAINT `FK_stocktakelines_units_unitId`             FOREIGN KEY (`unitId`)       REFERENCES `units` (`unitId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stocktakes' AND INDEX_NAME='ixStocktakeCode') = 0,
  'CREATE UNIQUE INDEX `ixStocktakeCode` ON `stocktakes` (`stocktakeCode`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stocktakes' AND INDEX_NAME='ixStocktakeWarehouse') = 0,
  'CREATE INDEX `ixStocktakeWarehouse` ON `stocktakes` (`warehouseId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stocktakelines' AND INDEX_NAME='ixStocktakelineStocktake') = 0,
  'CREATE INDEX `ixStocktakelineStocktake` ON `stocktakelines` (`stocktakeId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stocktakelines' AND INDEX_NAME='ixStocktakelineIngredient') = 0,
  'CREATE INDEX `ixStocktakelineIngredient` ON `stocktakelines` (`ingredientId`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260707093741_AddStocktakeEntities', '9.0.16');

-- ───────────────────────────────────────────────────────────────────────────

COMMIT;

-- Verify migrations applied
SELECT `MigrationId`, `ProductVersion` FROM `__EFMigrationsHistory` ORDER BY `MigrationId`;
