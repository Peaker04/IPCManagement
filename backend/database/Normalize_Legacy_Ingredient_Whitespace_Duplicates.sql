-- Normalize two catalog duplicates that differ only by whitespace.
--
-- Evidence:
--   * same normalized ingredient name after collapsing whitespace;
--   * same unit and warehouse;
--   * no foreign-key rewrite is performed;
--   * duplicate rows are archived, not deleted.
--
-- This script is idempotent. Review the preflight result before applying on a
-- lane. The live ipcmanagement lane was applied through the authenticated API
-- with the same predicates and postconditions.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS ingredient_whitespace_duplicate_targets;
CREATE TEMPORARY TABLE ingredient_whitespace_duplicate_targets AS
SELECT canonical.ingredientId AS canonicalIngredientId,
       canonical.ingredientCode AS canonicalIngredientCode,
       canonical.ingredientName AS canonicalBeforeName,
       duplicate.ingredientId AS duplicateIngredientId,
       duplicate.ingredientCode AS duplicateIngredientCode,
       duplicate.ingredientName AS duplicateBeforeName
FROM ingredients canonical
JOIN ingredients duplicate
  ON canonical.ingredientId <> duplicate.ingredientId
 AND canonical.unitId = duplicate.unitId
 AND canonical.warehouseId = duplicate.warehouseId
 AND canonical.isActive <> 0
 AND duplicate.isActive <> 0
WHERE (canonical.ingredientCode = 'ING-171CCD8350'
       AND duplicate.ingredientCode = 'ING-5C0AA9B5C3')
   OR (canonical.ingredientCode = 'ING-4F6F4D39B7'
       AND duplicate.ingredientCode = 'ING-D2B6640504')
   OR (canonical.ingredientCode = 'ING-CFB47BEEBA'
       AND duplicate.ingredientCode = 'ING-A29D4BC718')
   OR (canonical.ingredientCode = 'ING-C84ED8242D'
       AND duplicate.ingredientCode = 'ING-9F9D6B5476')
   OR (canonical.ingredientCode = 'ING-A00AB9F807'
       AND duplicate.ingredientCode = 'ING-4CD539274F');

SELECT * FROM ingredient_whitespace_duplicate_targets;

UPDATE ingredients
SET ingredientName = CASE ingredientCode
    WHEN 'ING-171CCD8350' THEN 'Mồng tơi (lấy non)'
    WHEN 'ING-4F6F4D39B7' THEN 'Heo đùi mông (tề sẵn)'
    WHEN 'ING-CFB47BEEBA' THEN 'Cá ngừ 500-1000'
    WHEN 'ING-C84ED8242D' THEN 'Heo đùi mông đặc (tề sẵn)'
    WHEN 'ING-A00AB9F807' THEN 'Cá ngừ 1UP'
    ELSE ingredientName
END
WHERE ingredientCode IN (
  'ING-171CCD8350', 'ING-4F6F4D39B7',
  'ING-CFB47BEEBA', 'ING-C84ED8242D', 'ING-A00AB9F807')
  AND isActive <> 0;

UPDATE ingredients
SET isActive = 0
WHERE ingredientCode IN (
  'ING-5C0AA9B5C3', 'ING-D2B6640504',
  'ING-A29D4BC718', 'ING-9F9D6B5476', 'ING-4CD539274F')
  AND isActive <> 0;

SELECT ingredientCode, ingredientName, isActive
FROM ingredients
WHERE ingredientCode IN (
  'ING-171CCD8350', 'ING-5C0AA9B5C3',
  'ING-4F6F4D39B7', 'ING-D2B6640504',
  'ING-CFB47BEEBA', 'ING-A29D4BC718',
  'ING-C84ED8242D', 'ING-9F9D6B5476',
  'ING-A00AB9F807', 'ING-4CD539274F');

COMMIT;
