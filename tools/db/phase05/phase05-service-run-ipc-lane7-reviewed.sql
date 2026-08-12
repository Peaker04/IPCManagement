-- Phase 05 / Plan 01 reviewed ServiceRun kernel SQL.
-- This file is reviewed connection-free in Wave 1. Its only permitted live target is ipc_lane7.
-- It never resets, seeds, imports, restores, deletes documents, movements, audits, or outbox records.
--
-- MySQL 9.5 does not support IF NOT EXISTS on ADD COLUMN or CREATE INDEX.
-- Each additive column, index, and foreign key therefore has an information_schema guard
-- that prepares either its one DDL statement or a no-op. No existing schema/data is dropped.

-- Keep the legacy plan/shift unique key: an existing foreign key depends on it.
-- The scoped key below is additive and never weakens legacy referential integrity.

SET @phase05_add_concurrency_version = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `serviceruns` ADD COLUMN `concurrencyVersion` BIGINT NOT NULL DEFAULT 0',
        'SELECT 1')
    FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'serviceruns' AND `column_name` = 'concurrencyVersion'
);
PREPARE phase05_add_concurrency_version FROM @phase05_add_concurrency_version;
EXECUTE phase05_add_concurrency_version;
DEALLOCATE PREPARE phase05_add_concurrency_version;

SET @phase05_add_customer_id = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `serviceruns` ADD COLUMN `customerId` BINARY(16) NULL',
        'SELECT 1')
    FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'serviceruns' AND `column_name` = 'customerId'
);
PREPARE phase05_add_customer_id FROM @phase05_add_customer_id;
EXECUTE phase05_add_customer_id;
DEALLOCATE PREPARE phase05_add_customer_id;

SET @phase05_add_service_date = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `serviceruns` ADD COLUMN `serviceDate` DATE NULL',
        'SELECT 1')
    FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'serviceruns' AND `column_name` = 'serviceDate'
);
PREPARE phase05_add_service_date FROM @phase05_add_service_date;
EXECUTE phase05_add_service_date;
DEALLOCATE PREPARE phase05_add_service_date;

SET @phase05_add_price_tier_amount = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `serviceruns` ADD COLUMN `priceTierAmount` DECIMAL(18,2) NULL',
        'SELECT 1')
    FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'serviceruns' AND `column_name` = 'priceTierAmount'
);
PREPARE phase05_add_price_tier_amount FROM @phase05_add_price_tier_amount;
EXECUTE phase05_add_price_tier_amount;
DEALLOCATE PREPARE phase05_add_price_tier_amount;

CREATE TABLE IF NOT EXISTS `servicerundecisionitems` (
    `serviceRunDecisionItemId` BINARY(16) NOT NULL,
    `planId` BINARY(16) NOT NULL,
    `customerId` BINARY(16) NULL,
    `serviceDate` DATE NOT NULL,
    `shiftName` VARCHAR(20) NOT NULL,
    `priceTierAmount` DECIMAL(18,2) NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME NOT NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`serviceRunDecisionItemId`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `servicerunsourcelines` (
    `serviceRunSourceLineId` BINARY(16) NOT NULL,
    `serviceRunId` BINARY(16) NOT NULL,
    `materialRequestLineId` BINARY(16) NOT NULL,
    `recordedAt` DATETIME NOT NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`serviceRunSourceLineId`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @phase05_add_decision_item_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX `ixServiceRunDecisionItemsPlanShiftReason` ON `servicerundecisionitems` (`planId`, `shiftName`, `reason`(128))',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'servicerundecisionitems'
      AND `index_name` = 'ixServiceRunDecisionItemsPlanShiftReason'
);
PREPARE phase05_add_decision_item_index FROM @phase05_add_decision_item_index;
EXECUTE phase05_add_decision_item_index;
DEALLOCATE PREPARE phase05_add_decision_item_index;

SET @phase05_add_source_line_unique_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE UNIQUE INDEX `uqServiceRunSourceLinesRunLine` ON `servicerunsourcelines` (`serviceRunId`, `materialRequestLineId`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'servicerunsourcelines'
      AND `index_name` = 'uqServiceRunSourceLinesRunLine'
);
PREPARE phase05_add_source_line_unique_index FROM @phase05_add_source_line_unique_index;
EXECUTE phase05_add_source_line_unique_index;
DEALLOCATE PREPARE phase05_add_source_line_unique_index;

SET @phase05_add_source_line_material_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX `ixServiceRunSourceLinesMaterialRequestLine` ON `servicerunsourcelines` (`materialRequestLineId`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'servicerunsourcelines'
      AND `index_name` = 'ixServiceRunSourceLinesMaterialRequestLine'
);
PREPARE phase05_add_source_line_material_index FROM @phase05_add_source_line_material_index;
EXECUTE phase05_add_source_line_material_index;
DEALLOCATE PREPARE phase05_add_source_line_material_index;

SET @phase05_add_scoped_service_run_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE UNIQUE INDEX `uqServiceRunsCustomerDateShiftTier` ON `serviceruns` (`customerId`, `serviceDate`, `shiftName`, `priceTierAmount`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'serviceruns'
      AND `index_name` = 'uqServiceRunsCustomerDateShiftTier'
);
PREPARE phase05_add_scoped_service_run_index FROM @phase05_add_scoped_service_run_index;
EXECUTE phase05_add_scoped_service_run_index;
DEALLOCATE PREPARE phase05_add_scoped_service_run_index;

SET @phase05_add_source_line_run_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `servicerunsourcelines` ADD CONSTRAINT `fkServiceRunSourceLinesRun` FOREIGN KEY (`serviceRunId`) REFERENCES `serviceruns` (`serviceRunId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'servicerunsourcelines'
      AND `constraint_name` = 'fkServiceRunSourceLinesRun' AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_source_line_run_fk FROM @phase05_add_source_line_run_fk;
EXECUTE phase05_add_source_line_run_fk;
DEALLOCATE PREPARE phase05_add_source_line_run_fk;

SET @phase05_add_source_line_request_line_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `servicerunsourcelines` ADD CONSTRAINT `fkServiceRunSourceLinesMaterialRequestLine` FOREIGN KEY (`materialRequestLineId`) REFERENCES `materialrequestlines` (`requestLineId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'servicerunsourcelines'
      AND `constraint_name` = 'fkServiceRunSourceLinesMaterialRequestLine' AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_source_line_request_line_fk FROM @phase05_add_source_line_request_line_fk;
EXECUTE phase05_add_source_line_request_line_fk;
DEALLOCATE PREPARE phase05_add_source_line_request_line_fk;

SET @phase05_add_service_run_customer_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `serviceruns` ADD CONSTRAINT `fkServiceRunsCustomer` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'serviceruns'
      AND `constraint_name` = 'fkServiceRunsCustomer' AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_service_run_customer_fk FROM @phase05_add_service_run_customer_fk;
EXECUTE phase05_add_service_run_customer_fk;
DEALLOCATE PREPARE phase05_add_service_run_customer_fk;

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
