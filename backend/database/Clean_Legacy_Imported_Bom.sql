-- One-time cleanup for databases that previously imported the legacy single-tier BOM.
-- Run only after applying 20260709103000_AddBomTierWorkflow and before importing
-- the curated 25k/30k/34k BOM workbooks.

START TRANSACTION;

UPDATE `materialrequestlines`
SET `bomId` = NULL,
    `bomScope` = 'legacy-removed',
    `bomRatePercent` = 100.00,
    `appliedPortionRuleId` = NULL,
    `appliedPortionRuleSource` = 'FIXED_TIER',
    `appliedPortionRatePercent` = 100.00;

UPDATE `menuschedules`
SET `bomRatePercent` = 100.00;

UPDATE `customercontracts`
SET `defaultBomRatePercent` = 100.00;

DELETE FROM `bomadjustments`;
DELETE FROM `portionrules`;
DELETE FROM `dishbom`;

DELETE d FROM `dishes` d
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%'
  AND NOT EXISTS (SELECT 1 FROM `menuitems` mi WHERE mi.`dishId` = d.`dishId`)
  AND NOT EXISTS (SELECT 1 FROM `productionplanlines` pl WHERE pl.`dishId` = d.`dishId`);

DELETE i FROM `ingredients` i
WHERE i.`ingredientCode` LIKE 'TMP-BOM-ING-%'
  AND NOT EXISTS (SELECT 1 FROM `currentstock` cs WHERE cs.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `stockmovements` sm WHERE sm.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreceiptlines` irl WHERE irl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryissuelines` iil WHERE iil.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreturnlines` retl WHERE retl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `materialrequestlines` mrl WHERE mrl.`ingredientId` = i.`ingredientId`)
  AND NOT EXISTS (SELECT 1 FROM `purchaserequestlines` prl WHERE prl.`ingredientId` = i.`ingredientId`);

DELETE w FROM `warehouses` w
WHERE w.`warehouseCode` LIKE 'TMP-BOM-WH-%'
  AND NOT EXISTS (SELECT 1 FROM `ingredients` i WHERE i.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `currentstock` cs WHERE cs.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `stockmovements` sm WHERE sm.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreceipts` ir WHERE ir.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryissues` ii WHERE ii.`warehouseId` = w.`warehouseId`)
  AND NOT EXISTS (SELECT 1 FROM `inventoryreturns` ret WHERE ret.`warehouseId` = w.`warehouseId`);

COMMIT;

SELECT `priceTierAmount`, COUNT(*) AS `bomRows`
FROM `dishbom`
GROUP BY `priceTierAmount`
ORDER BY `priceTierAmount`;
