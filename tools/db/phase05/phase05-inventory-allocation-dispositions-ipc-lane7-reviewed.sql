-- Phase 05 / Plan 06 reviewed inventory allocation disposition SQL.
-- Additive, retry-safe MySQL 9.5 artifact. Its only permitted live target is ipc_lane7.
-- It does not reset, seed, import, restore, delete, or rewrite operational history.

CREATE TABLE IF NOT EXISTS `inventoryallocationdispositions` (
    `allocationDispositionId` BINARY(16) NOT NULL,
    `sourceIssueLineId` BINARY(16) NOT NULL,
    `destinationIssueLineId` BINARY(16) NOT NULL,
    `quantity` DECIMAL(18,6) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `createdBy` BINARY(16) NOT NULL,
    `createdAt` DATETIME NOT NULL,
    `version` BIGINT NOT NULL DEFAULT 0,
    `correlationId` VARCHAR(128) NULL,
    `causationId` VARCHAR(128) NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`allocationDispositionId`)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @phase05_add_allocation_destination_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX `ixInventoryAllocationDispositionsDestination` ON `inventoryallocationdispositions` (`destinationIssueLineId`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `index_name` = 'ixInventoryAllocationDispositionsDestination'
);
PREPARE phase05_add_allocation_destination_index FROM @phase05_add_allocation_destination_index;
EXECUTE phase05_add_allocation_destination_index;
DEALLOCATE PREPARE phase05_add_allocation_destination_index;

SET @phase05_add_allocation_source_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX `ixInventoryAllocationDispositionsSource` ON `inventoryallocationdispositions` (`sourceIssueLineId`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `index_name` = 'ixInventoryAllocationDispositionsSource'
);
PREPARE phase05_add_allocation_source_index FROM @phase05_add_allocation_source_index;
EXECUTE phase05_add_allocation_source_index;
DEALLOCATE PREPARE phase05_add_allocation_source_index;

SET @phase05_add_allocation_created_by_index = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX `IX_inventoryallocationdispositions_createdBy` ON `inventoryallocationdispositions` (`createdBy`)',
        'SELECT 1')
    FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `index_name` = 'IX_inventoryallocationdispositions_createdBy'
);
PREPARE phase05_add_allocation_created_by_index FROM @phase05_add_allocation_created_by_index;
EXECUTE phase05_add_allocation_created_by_index;
DEALLOCATE PREPARE phase05_add_allocation_created_by_index;

SET @phase05_add_allocation_source_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `inventoryallocationdispositions` ADD CONSTRAINT `inventoryallocationdispositions_ibfk_1` FOREIGN KEY (`sourceIssueLineId`) REFERENCES `inventoryissuelines` (`issueLineId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `constraint_name` = 'inventoryallocationdispositions_ibfk_1'
      AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_allocation_source_fk FROM @phase05_add_allocation_source_fk;
EXECUTE phase05_add_allocation_source_fk;
DEALLOCATE PREPARE phase05_add_allocation_source_fk;

SET @phase05_add_allocation_destination_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `inventoryallocationdispositions` ADD CONSTRAINT `inventoryallocationdispositions_ibfk_2` FOREIGN KEY (`destinationIssueLineId`) REFERENCES `inventoryissuelines` (`issueLineId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `constraint_name` = 'inventoryallocationdispositions_ibfk_2'
      AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_allocation_destination_fk FROM @phase05_add_allocation_destination_fk;
EXECUTE phase05_add_allocation_destination_fk;
DEALLOCATE PREPARE phase05_add_allocation_destination_fk;

SET @phase05_add_allocation_created_by_fk = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `inventoryallocationdispositions` ADD CONSTRAINT `inventoryallocationdispositions_ibfk_3` FOREIGN KEY (`createdBy`) REFERENCES `users` (`userId`) ON DELETE RESTRICT',
        'SELECT 1')
    FROM `information_schema`.`table_constraints`
    WHERE `constraint_schema` = DATABASE() AND `table_name` = 'inventoryallocationdispositions'
      AND `constraint_name` = 'inventoryallocationdispositions_ibfk_3'
      AND `constraint_type` = 'FOREIGN KEY'
);
PREPARE phase05_add_allocation_created_by_fk FROM @phase05_add_allocation_created_by_fk;
EXECUTE phase05_add_allocation_created_by_fk;
DEALLOCATE PREPARE phase05_add_allocation_created_by_fk;

INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260812174836_AddInventoryAllocationDispositions', '9.0.16');
