-- Read-only postflight after the exact reviewed DROP template.
WITH expectedTables(tableName) AS (
    SELECT 'backup_bomadjustments_20260717_141300' UNION ALL
    SELECT 'backup_dishbom_20260717_141300' UNION ALL
    SELECT 'backup_dishes_20260717_141300' UNION ALL
    SELECT 'backup_ingredients_20260717_141300' UNION ALL
    SELECT 'backup_materialrequestlines_bom_20260717_141300' UNION ALL
    SELECT 'backup_menuitems_20260717_141300' UNION ALL
    SELECT 'backup_menuitems_pre2026_20260717_141300'
)
SELECT CASE WHEN COUNT(t.TABLE_NAME) = 0 THEN 'ABSENT' ELSE 'NO_GO_TABLE_REMAINS' END AS exactTableSetStatus,
       COUNT(t.TABLE_NAME) AS remainingTableCount
FROM expectedTables e
LEFT JOIN information_schema.TABLES t
  ON t.TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND t.TABLE_NAME = e.tableName;

SELECT 'consumer' AS checkType,
       (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND REFERENCED_TABLE_NAME LIKE 'backup\_%') +
       (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND VIEW_DEFINITION LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = '{{TARGET_DATABASE}}' AND ACTION_STATEMENT LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '{{TARGET_DATABASE}}' AND ROUTINE_DEFINITION LIKE '%backup\_%') +
       (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA = '{{TARGET_DATABASE}}' AND EVENT_DEFINITION LIKE '%backup\_%') AS consumerCount;

SELECT COUNT(*) AS outsideScopeTableCount,
       SHA2(GROUP_CONCAT(CONCAT(TABLE_NAME, ':', ENGINE, ':', COALESCE(TABLE_COLLATION, '')) ORDER BY TABLE_NAME SEPARATOR '|'), 256) AS outsideScopeDigest
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND TABLE_NAME NOT LIKE 'backup\_%';
