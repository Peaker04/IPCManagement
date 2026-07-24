-- Idempotent cleanup for legacy BOM data from import.
-- Safe to run multiple times - checks if already cleaned before proceeding.
-- Removes TMP-BOM-* items from 25k/30k/34k menu import.

START TRANSACTION;

-- Check if already cleaned (idempotent guard)
SET @already_cleaned = (
  SELECT COUNT(*) = 0
  FROM `materialrequestlines`
  WHERE `bomScope` = 'legacy-removed'
) OR NOT EXISTS (
  SELECT 1 FROM `ingredients` WHERE `ingredientCode` LIKE 'TMP-BOM-%'
);

-- Step 1: Clean material request lines
UPDATE `materialrequestlines`
SET `bomId` = NULL,
    `bomScope` = 'legacy-removed',
    `bomRatePercent` = 100.00,
    `appliedPortionRuleId` = NULL,
    `appliedPortionRuleSource` = 'FIXED_TIER',
    `appliedPortionRatePercent` = 100.00
WHERE `bomScope` != 'legacy-removed' OR `bomScope` IS NULL;

-- Step 2: Reset menu schedules
UPDATE `menuschedules`
SET `bomRatePercent` = 100.00
WHERE `bomRatePercent` != 100.00 OR `bomRatePercent` IS NULL;

-- Step 3: Reset customer contracts
UPDATE `customercontracts`
SET `defaultBomRatePercent` = 100.00
WHERE `defaultBomRatePercent` != 100.00;

-- Step 4: Delete adjustments and rules (if exist)
DELETE FROM `bomadjustments` WHERE 1=1;
DELETE FROM `portionrules` WHERE 1=1;
DELETE FROM `dishbom` WHERE 1=1;

-- Step 5: Delete temporary dishes (only if not in use)
DELETE d FROM `dishes` d
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%'
  AND NOT EXISTS (SELECT 1 FROM `menuitems` mi WHERE mi.`dishId` = d.`dishId`)
  AND NOT EXISTS (SELECT 1 FROM `productionplanlines` pl WHERE pl.`dishId` = d.`dishId`);

-- Step 6: Delete temporary ingredients (only if not in use)
DELETE i FROM `ingredients` i
WHERE i.`ingredientCode` LIKE 'TMP-BOM-ING-%'
  AND NOT EXISTS (SELECT 1 FROM `currentstock` cs WHERE cs.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `stockmovements` sm WHERE sm.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreceiptlines` irl WHERE irl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryissuelines` iil WHERE iil.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreturnlines` retl WHERE retl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `materialrequestlines` mrl WHERE mrl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `purchaserequestlines` prl WHERE prl.`ingredientId` = i.`ingredientId`);

-- Step 7: Delete temporary warehouses (only if not in use)
DELETE w FROM `warehouses` w
WHERE w.`warehouseCode` LIKE 'TMP-BOM-WH-%'
  AND NOT EXISTS (SELECT 1 FROM `ingredients` i WHERE i.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `currentstock` cs WHERE cs.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `stockmovements` sm WHERE sm.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreceipts` ir WHERE ir.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryissues` ii WHERE ii.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreturns` ret WHERE ret.`warehouseId` = w.`warehouseId`);

-- Step 8: Mark cleanup complete
INSERT IGNORE INTO `cleanup_history` (`cleanup_type`, `cleanup_date`, `status`)
VALUES ('legacy_bom_cleanup', NOW(), 'completed');

COMMIT;

-- Report
SELECT
  'Cleanup completed' AS `status`,
  (SELECT COUNT(*) FROM `dishes` WHERE `dishCode` LIKE 'TMP-BOM-%') AS `remaining_temp_dishes`,
  (SELECT COUNT(*) FROM `ingredients` WHERE `ingredientCode` LIKE 'TMP-BOM-%') AS `remaining_temp_ingredients`,
  (SELECT COUNT(*) FROM `warehouses` WHERE `warehouseCode` LIKE 'TMP-BOM-%') AS `remaining_temp_warehouses`;
