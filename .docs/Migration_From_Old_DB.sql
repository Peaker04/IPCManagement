START TRANSACTION;
ALTER TABLE `productionplanlines` RENAME INDEX `customerId1` TO `customerId3`;

ALTER TABLE `mealquantityplanlines` RENAME INDEX `customerId` TO `customerId1`;

ALTER TABLE `menuschedules` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT';

CREATE TABLE `approvalhistories` (
    `approvalHistoryId` binary(16) NOT NULL,
    `targetType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `targetId` binary(16) NOT NULL,
    `decision` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `oldStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `newStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `actionBy` binary(16) NOT NULL,
    `actionAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`approvalHistoryId`),
    CONSTRAINT `approvalhistories_ibfk_1` FOREIGN KEY (`actionBy`) REFERENCES `users` (`userId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customercontracts` (
    `contractId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `effectiveFrom` date NOT NULL,
    `effectiveTo` date NULL,
    `activeWeekDays` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `shiftNames` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `defaultMenuPrice` decimal(18,2) NOT NULL,
    `defaultBomRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00',
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`contractId`),
    CONSTRAINT `customercontracts_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `menuversions` (
    `menuVersionId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `weekStartDate` date NOT NULL,
    `versionNo` int NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
    `sourceFileName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `sourceChecksum` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `sourceImportBatch` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `createdBy` binary(16) NULL,
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `publishedBy` binary(16) NULL,
    `publishedAt` datetime NULL,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`menuVersionId`),
    CONSTRAINT `menuversions_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `IX_approvalhistories_actionBy` ON `approvalhistories` (`actionBy`);

CREATE INDEX `ixApprovalHistoriesTarget` ON `approvalhistories` (`targetType`, `targetId`, `actionAt`);

CREATE INDEX `customerId` ON `customercontracts` (`customerId`);

CREATE INDEX `ixCustomerContractsEffective` ON `customercontracts` (`customerId`, `effectiveFrom`, `effectiveTo`);

CREATE INDEX `customerId2` ON `menuversions` (`customerId`);

CREATE INDEX `ixMenuVersionsCustomerWeekStatus` ON `menuversions` (`customerId`, `weekStartDate`, `status`);

CREATE UNIQUE INDEX `uqMenuVersionsCustomerWeekVersion` ON `menuversions` (`customerId`, `weekStartDate`, `versionNo`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16');

CREATE TABLE `portionrules` (
    `portionRuleId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `dishId` binary(16) NULL,
    `effectiveFrom` date NOT NULL,
    `effectiveTo` date NULL,
    `activeWeekDays` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `shiftNames` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `menuVariant` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `menuSectionName` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `slotName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `dishCategory` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `portionRatePercent` decimal(5,2) NOT NULL,
    `bomRatePercent` decimal(5,2) NULL,
    `yieldLossPercent` decimal(5,2) NULL,
    `priority` int NOT NULL DEFAULT '0',
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`portionRuleId`),
    CONSTRAINT `portionrules_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
    CONSTRAINT `portionrules_ibfk_2` FOREIGN KEY (`dishId`) REFERENCES `dishes` (`dishId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `customerId` ON `portionrules` (`customerId`);

CREATE INDEX `dishId` ON `portionrules` (`dishId`);

CREATE INDEX `ixPortionRulesCustomerEffective` ON `portionrules` (`customerId`, `effectiveFrom`, `effectiveTo`, `status`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630062000_AddPortionRules', '9.0.16');

ALTER TABLE `materialrequestlines` ADD `appliedPortionRuleId` binary(16) NULL;

ALTER TABLE `materialrequestlines` ADD `appliedPortionRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00';

ALTER TABLE `materialrequestlines` ADD `appliedPortionRuleSource` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONTRACT_DEFAULT';

ALTER TABLE `materialrequestlines` ADD `yieldLossPercent` decimal(5,2) NULL;

CREATE INDEX `appliedPortionRuleId` ON `materialrequestlines` (`appliedPortionRuleId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630065000_AddPortionRuleTraceToDemandLines', '9.0.16');

ALTER TABLE `dishbom` ADD `bomStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLISHED';

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630161000_AddBomVersionStatus', '9.0.16');

COMMIT;

