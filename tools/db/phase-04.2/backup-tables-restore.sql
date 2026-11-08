-- Rollback-extract restore template. The extract is produced and restore-tested in Plan 05.
-- Required immutable inputs: {{ROLLBACK_EXTRACT_PATH}} and {{ROLLBACK_EXTRACT_SHA256}}.
-- The target must equal the current run-owned ipc_rehearsal_phase42_{{RUN_ID}} database.
CREATE TEMPORARY TABLE `_phase42_restore_target_guard`
(
    `is_valid` INT NOT NULL,
    CONSTRAINT `ckPhase42RestoreTarget` CHECK (`is_valid` = 1)
);
INSERT INTO `_phase42_restore_target_guard` (`is_valid`)
SELECT CASE
    WHEN '{{TARGET_DATABASE}}' = CONCAT('ipc_rehearsal_phase42_', '{{RUN_ID}}')
     AND '{{ROLLBACK_EXTRACT_SHA256}}' REGEXP '^[A-Fa-f0-9]{64}$'
    THEN 1 ELSE 0
END;
SELECT CASE WHEN `is_valid` = 1 THEN 'PASS' ELSE 'NO_GO_TARGET' END AS targetGuardStatus
FROM `_phase42_restore_target_guard`;
DROP TEMPORARY TABLE `_phase42_restore_target_guard`;

-- mysql client directive; bytes at {{ROLLBACK_EXTRACT_PATH}} must match {{ROLLBACK_EXTRACT_SHA256}} before this line.
SOURCE {{ROLLBACK_EXTRACT_PATH}};

-- Exact restored allow-list; definitions, counts and row digests must match preflight before re-apply.
SELECT COUNT(*) AS restoredTableCount, SHA2(GROUP_CONCAT(TABLE_NAME ORDER BY TABLE_NAME SEPARATOR '|'), 256) AS restoredTableSetDigest
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}'
  AND TABLE_NAME IN (
      'backup_bomadjustments_20260717_141300',
      'backup_dishbom_20260717_141300',
      'backup_dishes_20260717_141300',
      'backup_ingredients_20260717_141300',
      'backup_materialrequestlines_bom_20260717_141300',
      'backup_menuitems_20260717_141300',
      'backup_menuitems_pre2026_20260717_141300'
  );

SELECT 'consumer' AS checkType, COUNT(*) AS consumerCount
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND REFERENCED_TABLE_NAME LIKE 'backup\_%';

SELECT COUNT(*) AS outsideScopeTableCount,
       SHA2(GROUP_CONCAT(CONCAT(TABLE_NAME, ':', ENGINE, ':', COALESCE(TABLE_COLLATION, '')) ORDER BY TABLE_NAME SEPARATOR '|'), 256) AS outsideScopeDigest
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = '{{TARGET_DATABASE}}' AND TABLE_NAME NOT LIKE 'backup\_%';
