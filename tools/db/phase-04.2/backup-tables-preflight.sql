-- Read-only preflight. {{TARGET_DATABASE}} is an explicit allow-listed token; no default schema exists.
WITH expectedTables(tableName) AS (
    SELECT 'backup_bomadjustments_20260717_141300' UNION ALL
    SELECT 'backup_dishbom_20260717_141300' UNION ALL
    SELECT 'backup_dishes_20260717_141300' UNION ALL
    SELECT 'backup_ingredients_20260717_141300' UNION ALL
    SELECT 'backup_materialrequestlines_bom_20260717_141300' UNION ALL
    SELECT 'backup_menuitems_20260717_141300' UNION ALL
    SELECT 'backup_menuitems_pre2026_20260717_141300'
)
SELECT CASE WHEN COUNT(t.TABLE_NAME) = 7 AND COUNT(e.tableName) = 7 THEN 'PASS' ELSE 'NO_GO_EXACT_TABLE_SET' END AS exactTableSetStatus,
       COUNT(t.TABLE_NAME) AS existingTableCount
FROM expectedTables e
LEFT JOIN information_schema.TABLES t
  ON t.TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND t.TABLE_NAME = e.tableName;

-- Definitions are retained verbatim in the rollback-extract manifest.
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_bomadjustments_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_dishbom_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_dishes_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_ingredients_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_materialrequestlines_bom_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_menuitems_20260717_141300`;
SHOW CREATE TABLE `{{TARGET_DATABASE}}`.`backup_menuitems_pre2026_20260717_141300`;

-- Counts and deterministic full-row rowDigest values are captured before extraction.
SET SESSION group_concat_max_len = 16777216;
SELECT 'backup_bomadjustments_20260717_141300' AS tableName, COUNT(*) AS rowCount,
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`bomAdjustmentId`), HEX(`bomId`), `oldGrossQtyPerServing`, `newGrossQtyPerServing`, `oldWasteRatePercent`, `newWasteRatePercent`, COALESCE(`reason`, '<NULL>'), HEX(`adjustedBy`), DATE_FORMAT(`adjustedAt`, '%Y-%m-%dT%H:%i:%s')) ,256) ORDER BY `bomAdjustmentId` SEPARATOR ''), ''), 256) AS rowDigest
FROM `{{TARGET_DATABASE}}`.`backup_bomadjustments_20260717_141300`
UNION ALL SELECT 'backup_dishbom_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`bomId`), HEX(`dishId`), HEX(`ingredientId`), HEX(`unitId`), `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, COALESCE(`effectiveTo`, '<NULL>'), `bomStatus`, COALESCE(HEX(`customerId`), '<NULL>'), `priceTierAmount`), 256) ORDER BY `bomId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_dishbom_20260717_141300`
UNION ALL SELECT 'backup_dishes_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`dishId`), `dishCode`, `dishName`, COALESCE(`dishGroup`, '<NULL>'), COALESCE(`dishType`, '<NULL>'), `isActive`), 256) ORDER BY `dishId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_dishes_20260717_141300`
UNION ALL SELECT 'backup_ingredients_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`ingredientId`), `ingredientCode`, `ingredientName`, HEX(`unitId`), HEX(`warehouseId`), `referencePrice`, `isFreshDaily`, `isActive`), 256) ORDER BY `ingredientId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_ingredients_20260717_141300`
UNION ALL SELECT 'backup_materialrequestlines_bom_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`requestLineId`), COALESCE(HEX(`bomId`), '<NULL>'), `bomScope`, `bomRatePercent`, COALESCE(HEX(`appliedPortionRuleId`), '<NULL>'), `appliedPortionRuleSource`, `appliedPortionRatePercent`), 256) ORDER BY `requestLineId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_materialrequestlines_bom_20260717_141300`
UNION ALL SELECT 'backup_menuitems_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`menuItemId`), HEX(`menuId`), HEX(`dishId`), COALESCE(`dishSlot`, '<NULL>'), `displayOrder`), 256) ORDER BY `menuItemId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_menuitems_20260717_141300`
UNION ALL SELECT 'backup_menuitems_pre2026_20260717_141300', COUNT(*),
       SHA2(COALESCE(GROUP_CONCAT(SHA2(CONCAT_WS('#', HEX(`menuItemId`), HEX(`menuId`), HEX(`dishId`), COALESCE(`dishSlot`, '<NULL>'), `displayOrder`), 256) ORDER BY `menuItemId` SEPARATOR ''), ''), 256)
FROM `{{TARGET_DATABASE}}`.`backup_menuitems_pre2026_20260717_141300`;

-- Database consumers must be zero; application/EF/raw-SQL/job/report/task consumers are separate hashed inputs.
SELECT 'consumer' AS checkType,
       (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND REFERENCED_TABLE_NAME LIKE 'backup\_%') +
       (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND VIEW_DEFINITION LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = '{{TARGET_DATABASE}}' AND ACTION_STATEMENT LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '{{TARGET_DATABASE}}' AND ROUTINE_DEFINITION LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA = '{{TARGET_DATABASE}}' AND EVENT_DEFINITION LIKE '%backup\_%') AS consumerCount;

-- outsideScope digest is compared unchanged after DROP and after rollback restore.
SELECT COUNT(*) AS outsideScopeTableCount,
       SHA2(GROUP_CONCAT(CONCAT(TABLE_NAME, ':', ENGINE, ':', COALESCE(TABLE_COLLATION, '')) ORDER BY TABLE_NAME SEPARATOR '|'), 256) AS outsideScopeDigest
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND TABLE_NAME NOT LIKE 'backup\_%';
