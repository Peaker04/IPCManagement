-- Phase 4.2 reviewed cleanup template.
-- The executor must replace {{TARGET_DATABASE}} only after the preflight, rollback extract,
-- immutable receipt, destructive-window approval and exact SQL SHA-256 all match.
DROP TABLE `{{TARGET_DATABASE}}`.`backup_bomadjustments_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_dishbom_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_dishes_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_ingredients_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_materialrequestlines_bom_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_menuitems_20260717_141300`;
DROP TABLE `{{TARGET_DATABASE}}`.`backup_menuitems_pre2026_20260717_141300`;
