-- Phase 05 / Plan 01 reviewed ServiceRun kernel SQL.
-- This file is reviewed connection-free in Wave 1. Its only permitted live target is ipc_lane7.
-- It never resets, seeds, imports, restores, deletes documents, movements, audits, or outbox records.

-- MySQL 9.5 does not accept a conditional index drop inside a combined ALTER TABLE.
-- Keep the reviewed artifact idempotent by preparing the valid drop only when metadata proves the legacy index exists.
SET @phase05_drop_legacy_plan_shift_index = (
    SELECT IF(
        COUNT(*) > 0,
        'ALTER TABLE `serviceruns` DROP INDEX `uqServiceRunsPlanShift`',
        'SELECT 1'
    )
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'serviceruns'
      AND `index_name` = 'uqServiceRunsPlanShift'
);
PREPARE phase05_drop_legacy_plan_shift_index FROM @phase05_drop_legacy_plan_shift_index;
EXECUTE phase05_drop_legacy_plan_shift_index;
DEALLOCATE PREPARE phase05_drop_legacy_plan_shift_index;

ALTER TABLE `serviceruns`
    ADD COLUMN IF NOT EXISTS `concurrencyVersion` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `customerId` BINARY(16) NULL,
    ADD COLUMN IF NOT EXISTS `serviceDate` DATE NULL,
    ADD COLUMN IF NOT EXISTS `priceTierAmount` DECIMAL(18,2) NULL;

CREATE TABLE IF NOT EXISTS `servicerundecisionitems` (
    `serviceRunDecisionItemId` BINARY(16) NOT NULL,
    `planId` BINARY(16) NOT NULL,
    `customerId` BINARY(16) NULL,
    `serviceDate` DATE NOT NULL,
    `shiftName` VARCHAR(20) NOT NULL,
    `priceTierAmount` DECIMAL(18,2) NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME NOT NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`serviceRunDecisionItemId`),
    KEY `ixServiceRunDecisionItemsPlanShiftReason` (`planId`, `shiftName`, `reason`(128))
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `servicerunsourcelines` (
    `serviceRunSourceLineId` BINARY(16) NOT NULL,
    `serviceRunId` BINARY(16) NOT NULL,
    `materialRequestLineId` BINARY(16) NOT NULL,
    `recordedAt` DATETIME NOT NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`serviceRunSourceLineId`),
    CONSTRAINT `fkServiceRunSourceLinesRun` FOREIGN KEY (`serviceRunId`)
        REFERENCES `serviceruns` (`serviceRunId`) ON DELETE RESTRICT,
    CONSTRAINT `fkServiceRunSourceLinesMaterialRequestLine` FOREIGN KEY (`materialRequestLineId`)
        REFERENCES `materialrequestlines` (`requestLineId`) ON DELETE RESTRICT,
    CONSTRAINT `uqServiceRunSourceLinesRunLine` UNIQUE (`serviceRunId`, `materialRequestLineId`),
    KEY `ixServiceRunSourceLinesMaterialRequestLine` (`materialRequestLineId`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS `ixServiceRunsPlanId` ON `serviceruns` (`planId`);
CREATE UNIQUE INDEX IF NOT EXISTS `uqServiceRunsCustomerDateShiftTier`
    ON `serviceruns` (`customerId`, `serviceDate`, `shiftName`, `priceTierAmount`);
ALTER TABLE `serviceruns`
    ADD CONSTRAINT `fkServiceRunsCustomer` FOREIGN KEY (`customerId`)
    REFERENCES `customers` (`customerId`) ON DELETE RESTRICT;

UPDATE `serviceruns` AS run
INNER JOIN `productionplans` AS plan ON plan.`planId` = run.`planId`
INNER JOIN (
    SELECT line.`planId`, line.`shiftName`, MIN(line.`customerId`) AS `customerId`,
           MIN(requestLine.`priceTierAmount`) AS `priceTierAmount`
    FROM `productionplanlines` AS line
    INNER JOIN `materialrequestlines` AS requestLine ON requestLine.`planLineId` = line.`planLineId`
    GROUP BY line.`planId`, line.`shiftName`
    HAVING COUNT(DISTINCT line.`customerId`) = 1
       AND COUNT(DISTINCT requestLine.`priceTierAmount`) = 1
) AS resolved ON resolved.`planId` = run.`planId` AND resolved.`shiftName` = run.`shiftName`
SET run.`customerId` = resolved.`customerId`,
    run.`serviceDate` = plan.`planDate`,
    run.`priceTierAmount` = resolved.`priceTierAmount`
WHERE run.`customerId` IS NULL
   OR run.`serviceDate` IS NULL
   OR run.`priceTierAmount` IS NULL;

INSERT IGNORE INTO `servicerunsourcelines`
    (`serviceRunSourceLineId`, `serviceRunId`, `materialRequestLineId`, `recordedAt`)
SELECT UUID_TO_BIN(UUID()), run.`serviceRunId`, requestLine.`requestLineId`, UTC_TIMESTAMP()
FROM `serviceruns` AS run
INNER JOIN `productionplanlines` AS line
    ON line.`planId` = run.`planId`
   AND line.`shiftName` = run.`shiftName`
   AND line.`customerId` = run.`customerId`
INNER JOIN `materialrequestlines` AS requestLine
    ON requestLine.`planLineId` = line.`planLineId`
   AND requestLine.`priceTierAmount` = run.`priceTierAmount`
WHERE run.`customerId` IS NOT NULL
  AND run.`serviceDate` IS NOT NULL
  AND run.`priceTierAmount` IS NOT NULL;

INSERT INTO `servicerundecisionitems`
    (`serviceRunDecisionItemId`, `planId`, `customerId`, `serviceDate`, `shiftName`, `priceTierAmount`, `reason`, `createdAt`)
SELECT UUID_TO_BIN(UUID()), run.`planId`, NULL, plan.`planDate`, run.`shiftName`, NULL,
       'Legacy ServiceRun scope is not single-valued; resolve customer and price tier before lifecycle mutation.',
       UTC_TIMESTAMP()
FROM `serviceruns` AS run
INNER JOIN `productionplans` AS plan ON plan.`planId` = run.`planId`
WHERE (run.`customerId` IS NULL OR run.`serviceDate` IS NULL OR run.`priceTierAmount` IS NULL)
  AND NOT EXISTS (
      SELECT 1
      FROM `servicerundecisionitems` AS decisionItem
      WHERE decisionItem.`planId` = run.`planId`
        AND decisionItem.`shiftName` = run.`shiftName`
        AND decisionItem.`reason` = 'Legacy ServiceRun scope is not single-valued; resolve customer and price tier before lifecycle mutation.'
  );
