-- Iter1 manual database migration
-- Target: MySQL/MariaDB database used by IPCManagement.Api.
-- Run this after selecting the target database, for example:
--   USE ipcmanagement;
--
-- This script is intentionally idempotent for local/demo databases where
-- EF migration history may be out of sync with already-created tables.

CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
  `MigrationId` varchar(150) NOT NULL,
  `ProductVersion` varchar(32) NOT NULL,
  PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

-- Customer contract effective policy used by Admin Contract and weekly import.
CREATE TABLE IF NOT EXISTS `customercontracts` (
  `contractId` binary(16) NOT NULL,
  `customerId` binary(16) NOT NULL,
  `effectiveFrom` date NOT NULL,
  `effectiveTo` date NULL,
  `activeWeekDays` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shiftNames` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `defaultMenuPrice` decimal(18,2) NOT NULL,
  `defaultBomRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`contractId`),
  KEY `customerId` (`customerId`),
  KEY `ixCustomerContractsEffective` (`customerId`, `effectiveFrom`, `effectiveTo`),
  CONSTRAINT `customercontracts_ibfk_1`
    FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Weekly menu version header used by import preview/commit and publish/archive.
CREATE TABLE IF NOT EXISTS `menuversions` (
  `menuVersionId` binary(16) NOT NULL,
  `customerId` binary(16) NOT NULL,
  `weekStartDate` date NOT NULL,
  `versionNo` int NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `sourceFileName` varchar(255) COLLATE utf8mb4_unicode_ci NULL,
  `sourceChecksum` varchar(128) COLLATE utf8mb4_unicode_ci NULL,
  `sourceImportBatch` varchar(80) COLLATE utf8mb4_unicode_ci NULL,
  `createdBy` binary(16) NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `publishedBy` binary(16) NULL,
  `publishedAt` datetime NULL,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`menuVersionId`),
  KEY `customerId` (`customerId`),
  KEY `ixMenuVersionsCustomerWeekStatus` (`customerId`, `weekStartDate`, `status`),
  UNIQUE KEY `uqMenuVersionsCustomerWeekVersion` (`customerId`, `weekStartDate`, `versionNo`),
  CONSTRAINT `menuversions_ibfk_1`
    FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Portion rule table used by customer/shift/dish/category-specific demand math.
CREATE TABLE IF NOT EXISTS `portionrules` (
  `portionRuleId` binary(16) NOT NULL,
  `customerId` binary(16) NOT NULL,
  `dishId` binary(16) NULL,
  `effectiveFrom` date NOT NULL,
  `effectiveTo` date NULL,
  `activeWeekDays` varchar(100) COLLATE utf8mb4_unicode_ci NULL,
  `shiftNames` varchar(100) COLLATE utf8mb4_unicode_ci NULL,
  `menuVariant` varchar(50) COLLATE utf8mb4_unicode_ci NULL,
  `menuSectionName` varchar(150) COLLATE utf8mb4_unicode_ci NULL,
  `slotName` varchar(100) COLLATE utf8mb4_unicode_ci NULL,
  `dishCategory` varchar(100) COLLATE utf8mb4_unicode_ci NULL,
  `portionRatePercent` decimal(5,2) NOT NULL,
  `bomRatePercent` decimal(5,2) NULL,
  `yieldLossPercent` decimal(5,2) NULL,
  `priority` int NOT NULL DEFAULT 0,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`portionRuleId`),
  KEY `customerId` (`customerId`),
  KEY `dishId` (`dishId`),
  KEY `ixPortionRulesCustomerEffective` (`customerId`, `effectiveFrom`, `effectiveTo`, `status`),
  CONSTRAINT `portionrules_ibfk_1`
    FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
  CONSTRAINT `portionrules_ibfk_2`
    FOREIGN KEY (`dishId`) REFERENCES `dishes` (`dishId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The workflow now uses DRAFT/ACTIVE/SUPERSEDED/LOCKED for menu schedule versions.
-- Use VARCHAR instead of the old enum so existing data survives and future status
-- names can be rolled out without another enum rewrite.
ALTER TABLE `menuschedules`
  MODIFY COLUMN `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT';

-- Demand trace fields for the portion rule used at generation time.
-- MySQL 9 does not accept ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so keep
-- the script idempotent through INFORMATION_SCHEMA guarded statements.
SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materialrequestlines' AND COLUMN_NAME = 'appliedPortionRuleId') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRuleId` binary(16) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materialrequestlines' AND COLUMN_NAME = 'appliedPortionRatePercent') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRatePercent` decimal(5,2) NOT NULL DEFAULT ''100.00''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materialrequestlines' AND COLUMN_NAME = 'appliedPortionRuleSource') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `appliedPortionRuleSource` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''CONTRACT_DEFAULT''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materialrequestlines' AND COLUMN_NAME = 'yieldLossPercent') = 0,
  'ALTER TABLE `materialrequestlines` ADD COLUMN `yieldLossPercent` decimal(5,2) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materialrequestlines' AND INDEX_NAME = 'appliedPortionRuleId') = 0,
  'CREATE INDEX `appliedPortionRuleId` ON `materialrequestlines` (`appliedPortionRuleId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Mark these manual migrations as applied for environments that use EF history.
INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
  ('20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16'),
  ('20260630062000_AddPortionRules', '9.0.16'),
  ('20260630065000_AddPortionRuleTraceToDemandLines', '9.0.16');

-- Quick verification queries.
SELECT 'customercontracts' AS table_name, COUNT(*) AS row_count FROM `customercontracts`
UNION ALL
SELECT 'menuversions' AS table_name, COUNT(*) AS row_count FROM `menuversions`
UNION ALL
SELECT 'portionrules' AS table_name, COUNT(*) AS row_count FROM `portionrules`;
