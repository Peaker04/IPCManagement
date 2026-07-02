CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;
CREATE TABLE `currentstock` (
    `warehouseId` binary(16) NOT NULL,
    `ingredientId` binary(16) NOT NULL,
    `unitId` binary(16) NOT NULL,
    `currentQty` decimal(18,6) NOT NULL DEFAULT 0.000000,
    `lastUpdated` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`warehouseId`, `ingredientId`),
    CONSTRAINT `currentstock_ibfk_1` FOREIGN KEY (`warehouseId`) REFERENCES `warehouses` (`warehouseId`),
    CONSTRAINT `currentstock_ibfk_2` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`),
    CONSTRAINT `currentstock_ibfk_3` FOREIGN KEY (`unitId`) REFERENCES `units` (`unitId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `ix_currentstock_ingredient` ON `currentstock` (`ingredientId`);

CREATE INDEX `IX_currentstock_unitId` ON `currentstock` (`unitId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260605013906_AddCurrentStockTable', '9.0.16');

CREATE TABLE `refreshtokens` (
    `tokenId` binary(16) NOT NULL,
    `userId` binary(16) NOT NULL,
    `tokenHash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `deviceInfo` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expiresAt` datetime NOT NULL,
    `isUsed` tinyint(1) NOT NULL DEFAULT FALSE,
    `isRevoked` tinyint(1) NOT NULL DEFAULT FALSE,
    `revokedAt` datetime NULL,
    `replacedByToken` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`tokenId`),
    CONSTRAINT `refreshtokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ixRefreshTokensHash` ON `refreshtokens` (`tokenHash`);

CREATE INDEX `ixRefreshTokensUserExpiry` ON `refreshtokens` (`userId`, `expiresAt`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260605020053_AddRefreshTokenTable', '9.0.16');

ALTER TABLE `currentstock` ADD `rowVersion` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260621180049_AddConcurrencyToCurrentStock', '9.0.16');

SET @kg_unit_id = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'KG' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('11111111111111418111111111111101'), 'KG', 'Kilogram', 'KG', 1.000000
WHERE @kg_unit_id IS NULL;
SET @kg_unit_id = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'KG' LIMIT 1);

SET @dry_warehouse_id = (SELECT `warehouseId` FROM `warehouses` WHERE `warehouseCode` = 'TMP-BOM-WH-DRY' LIMIT 1);
INSERT INTO `warehouses` (`warehouseId`, `warehouseCode`, `warehouseName`, `warehouseType`, `note`)
SELECT UNHEX('11111111111111418111111111111102'), 'TMP-BOM-WH-DRY', 'Kho mẫu gia vị BOM', 'PHULIEUGIAVI', 'Dữ liệu mẫu tạm thời cho luồng BOM'
WHERE @dry_warehouse_id IS NULL;
SET @dry_warehouse_id = (SELECT `warehouseId` FROM `warehouses` WHERE `warehouseCode` = 'TMP-BOM-WH-DRY' LIMIT 1);

SET @fresh_warehouse_id = (SELECT `warehouseId` FROM `warehouses` WHERE `warehouseCode` = 'TMP-BOM-WH-FRESH' LIMIT 1);
INSERT INTO `warehouses` (`warehouseId`, `warehouseCode`, `warehouseName`, `warehouseType`, `note`)
SELECT UNHEX('11111111111111418111111111111103'), 'TMP-BOM-WH-FRESH', 'Kho mẫu thực phẩm tươi BOM', 'TUOI', 'Dữ liệu mẫu tạm thời cho luồng BOM'
WHERE @fresh_warehouse_id IS NULL;
SET @fresh_warehouse_id = (SELECT `warehouseId` FROM `warehouses` WHERE `warehouseCode` = 'TMP-BOM-WH-FRESH' LIMIT 1);

SET @rice_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-RICE' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111104'), 'TMP-BOM-ING-RICE', 'Gạo trắng', @kg_unit_id, @dry_warehouse_id, 18000.00, 0, 1
WHERE @rice_id IS NULL;
SET @rice_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-RICE' LIMIT 1);

SET @fish_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-FISH' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111105'), 'TMP-BOM-ING-FISH', 'Cá nục', @kg_unit_id, @fresh_warehouse_id, 72000.00, 1, 1
WHERE @fish_id IS NULL;
SET @fish_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-FISH' LIMIT 1);

SET @pork_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-PORK' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111106'), 'TMP-BOM-ING-PORK', 'Thịt heo', @kg_unit_id, @fresh_warehouse_id, 115000.00, 1, 1
WHERE @pork_id IS NULL;
SET @pork_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-PORK' LIMIT 1);

SET @egg_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-EGG' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111107'), 'TMP-BOM-ING-EGG', 'Trứng gà', @kg_unit_id, @fresh_warehouse_id, 45000.00, 1, 1
WHERE @egg_id IS NULL;
SET @egg_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-EGG' LIMIT 1);

SET @mustard_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-MUSTARD' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111108'), 'TMP-BOM-ING-MUSTARD', 'Cải xanh', @kg_unit_id, @fresh_warehouse_id, 18000.00, 1, 1
WHERE @mustard_id IS NULL;
SET @mustard_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-MUSTARD' LIMIT 1);

SET @water_spinach_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-WATER-SPINACH' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('11111111111111418111111111111109'), 'TMP-BOM-ING-WATER-SPINACH', 'Rau muống', @kg_unit_id, @fresh_warehouse_id, 17000.00, 1, 1
WHERE @water_spinach_id IS NULL;
SET @water_spinach_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-WATER-SPINACH' LIMIT 1);

SET @chicken_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-CHICKEN' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110a'), 'TMP-BOM-ING-CHICKEN', 'Thịt gà', @kg_unit_id, @fresh_warehouse_id, 82000.00, 1, 1
WHERE @chicken_id IS NULL;
SET @chicken_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-CHICKEN' LIMIT 1);

SET @garlic_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-GARLIC' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110b'), 'TMP-BOM-ING-GARLIC', 'Tỏi', @kg_unit_id, @dry_warehouse_id, 55000.00, 0, 1
WHERE @garlic_id IS NULL;
SET @garlic_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-GARLIC' LIMIT 1);

SET @fish_sauce_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-FISH-SAUCE' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110c'), 'TMP-BOM-ING-FISH-SAUCE', 'Nước mắm', @kg_unit_id, @dry_warehouse_id, 30000.00, 0, 1
WHERE @fish_sauce_id IS NULL;
SET @fish_sauce_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-FISH-SAUCE' LIMIT 1);

SET @sugar_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-SUGAR' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110d'), 'TMP-BOM-ING-SUGAR', 'Đường', @kg_unit_id, @dry_warehouse_id, 24000.00, 0, 1
WHERE @sugar_id IS NULL;
SET @sugar_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-SUGAR' LIMIT 1);

SET @pepper_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-PEPPER' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110e'), 'TMP-BOM-ING-PEPPER', 'Tiêu xay', @kg_unit_id, @dry_warehouse_id, 185000.00, 0, 1
WHERE @pepper_id IS NULL;
SET @pepper_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-PEPPER' LIMIT 1);

SET @ginger_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-GINGER' LIMIT 1);
INSERT INTO `ingredients` (`ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `warehouseId`, `referencePrice`, `isFreshDaily`, `isActive`)
SELECT UNHEX('1111111111111141811111111111110f'), 'TMP-BOM-ING-GINGER', 'Gừng', @kg_unit_id, @dry_warehouse_id, 42000.00, 0, 1
WHERE @ginger_id IS NULL;
SET @ginger_id = (SELECT `ingredientId` FROM `ingredients` WHERE `ingredientCode` = 'TMP-BOM-ING-GINGER' LIMIT 1);

SET @rice_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-RICE' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111110'), 'TMP-BOM-DISH-RICE', 'Cơm trắng', 'Tinh bột', 'Mặn', 1
WHERE @rice_dish_id IS NULL;
SET @rice_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-RICE' LIMIT 1);

SET @fish_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-FISH' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111111'), 'TMP-BOM-DISH-FISH', 'Cá kho tiêu', 'Món mặn', 'Mặn', 1
WHERE @fish_dish_id IS NULL;
SET @fish_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-FISH' LIMIT 1);

SET @pork_egg_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-PORK-EGG' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111112'), 'TMP-BOM-DISH-PORK-EGG', 'Thịt kho trứng', 'Món mặn', 'Mặn', 1
WHERE @pork_egg_dish_id IS NULL;
SET @pork_egg_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-PORK-EGG' LIMIT 1);

SET @soup_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-SOUP' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111113'), 'TMP-BOM-DISH-SOUP', 'Canh cải thịt bằm', 'Canh', 'Mặn', 1
WHERE @soup_dish_id IS NULL;
SET @soup_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-SOUP' LIMIT 1);

SET @veg_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-VEG' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111114'), 'TMP-BOM-DISH-VEG', 'Rau muống xào tỏi', 'Rau', 'Mặn', 1
WHERE @veg_dish_id IS NULL;
SET @veg_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-VEG' LIMIT 1);

SET @chicken_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-CHICKEN' LIMIT 1);
INSERT INTO `dishes` (`dishId`, `dishCode`, `dishName`, `dishGroup`, `dishType`, `isActive`)
SELECT UNHEX('11111111111111418111111111111115'), 'TMP-BOM-DISH-CHICKEN', 'Gà kho gừng', 'Món mặn', 'Mặn', 1
WHERE @chicken_dish_id IS NULL;
SET @chicken_dish_id = (SELECT `dishId` FROM `dishes` WHERE `dishCode` = 'TMP-BOM-DISH-CHICKEN' LIMIT 1);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111116'), @rice_dish_id, @rice_id, @kg_unit_id, 0.150000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @rice_dish_id AND `ingredientId` = @rice_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111117'), @fish_dish_id, @fish_id, @kg_unit_id, 0.120000, 3.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @fish_dish_id AND `ingredientId` = @fish_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111118'), @fish_dish_id, @fish_sauce_id, @kg_unit_id, 0.008000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @fish_dish_id AND `ingredientId` = @fish_sauce_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111119'), @fish_dish_id, @sugar_id, @kg_unit_id, 0.005000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @fish_dish_id AND `ingredientId` = @sugar_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111a'), @fish_dish_id, @pepper_id, @kg_unit_id, 0.001000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @fish_dish_id AND `ingredientId` = @pepper_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111b'), @pork_egg_dish_id, @pork_id, @kg_unit_id, 0.085000, 2.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @pork_egg_dish_id AND `ingredientId` = @pork_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111c'), @pork_egg_dish_id, @egg_id, @kg_unit_id, 0.050000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @pork_egg_dish_id AND `ingredientId` = @egg_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111d'), @pork_egg_dish_id, @fish_sauce_id, @kg_unit_id, 0.008000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @pork_egg_dish_id AND `ingredientId` = @fish_sauce_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111e'), @pork_egg_dish_id, @sugar_id, @kg_unit_id, 0.005000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @pork_egg_dish_id AND `ingredientId` = @sugar_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('1111111111111141811111111111111f'), @soup_dish_id, @mustard_id, @kg_unit_id, 0.090000, 5.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @soup_dish_id AND `ingredientId` = @mustard_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111120'), @soup_dish_id, @pork_id, @kg_unit_id, 0.025000, 2.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @soup_dish_id AND `ingredientId` = @pork_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111121'), @veg_dish_id, @water_spinach_id, @kg_unit_id, 0.100000, 5.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @veg_dish_id AND `ingredientId` = @water_spinach_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111122'), @veg_dish_id, @garlic_id, @kg_unit_id, 0.003000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @veg_dish_id AND `ingredientId` = @garlic_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111123'), @chicken_dish_id, @chicken_id, @kg_unit_id, 0.120000, 3.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @chicken_dish_id AND `ingredientId` = @chicken_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111124'), @chicken_dish_id, @ginger_id, @kg_unit_id, 0.006000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @chicken_dish_id AND `ingredientId` = @ginger_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111125'), @chicken_dish_id, @fish_sauce_id, @kg_unit_id, 0.007000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @chicken_dish_id AND `ingredientId` = @fish_sauce_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `dishbom` (`bomId`, `dishId`, `ingredientId`, `unitId`, `grossQtyPerServing`, `wasteRatePercent`, `effectiveFrom`, `effectiveTo`)
SELECT UNHEX('11111111111111418111111111111126'), @chicken_dish_id, @sugar_id, @kg_unit_id, 0.004000, 0.00, '2026-01-01', NULL
WHERE NOT EXISTS (SELECT 1 FROM `dishbom` WHERE `dishId` = @chicken_dish_id AND `ingredientId` = @sugar_id AND `unitId` = @kg_unit_id AND `effectiveTo` IS NULL);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260626043000_SeedTemporaryBomData', '9.0.16');

ALTER TABLE `productionplanlines` RENAME INDEX `customerId1` TO `customerId3`;

ALTER TABLE `mealquantityplanlines` RENAME INDEX `customerId` TO `customerId1`;

ALTER TABLE `menuschedules` MODIFY COLUMN `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT';

CREATE TABLE `approvalhistories` (
    `approvalHistoryId` binary(16) NOT NULL,
    `targetType` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `targetId` binary(16) NOT NULL,
    `decision` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `oldStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `newStatus` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `actionBy` binary(16) NOT NULL,
    `actionAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`approvalHistoryId`),
    CONSTRAINT `approvalhistories_ibfk_1` FOREIGN KEY (`actionBy`) REFERENCES `users` (`userId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `customercontracts` (
    `contractId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `effectiveFrom` date NOT NULL,
    `effectiveTo` date NULL,
    `activeWeekDays` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `shiftNames` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `defaultMenuPrice` decimal(18,2) NOT NULL,
    `defaultBomRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00',
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`contractId`),
    CONSTRAINT `customercontracts_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `menuversions` (
    `menuVersionId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `weekStartDate` date NOT NULL,
    `versionNo` int NOT NULL,
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
    `sourceFileName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `sourceChecksum` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `sourceImportBatch` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `createdBy` binary(16) NULL,
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `publishedBy` binary(16) NULL,
    `publishedAt` datetime NULL,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`menuVersionId`),
    CONSTRAINT `menuversions_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `IX_approvalhistories_actionBy` ON `approvalhistories` (`actionBy`);

CREATE INDEX `ixApprovalHistoriesTarget` ON `approvalhistories` (`targetType`, `targetId`, `actionAt`);

CREATE INDEX `customerId` ON `customercontracts` (`customerId`);

CREATE INDEX `ixCustomerContractsEffective` ON `customercontracts` (`customerId`, `effectiveFrom`, `effectiveTo`);

CREATE INDEX `customerId2` ON `menuversions` (`customerId`);

CREATE INDEX `ixMenuVersionsCustomerWeekStatus` ON `menuversions` (`customerId`, `weekStartDate`, `status`);

CREATE UNIQUE INDEX `uqMenuVersionsCustomerWeekVersion` ON `menuversions` (`customerId`, `weekStartDate`, `versionNo`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630031911_AddCustomerContractsAndMenuVersions', '9.0.16');

CREATE TABLE `portionrules` (
    `portionRuleId` binary(16) NOT NULL,
    `customerId` binary(16) NOT NULL,
    `dishId` binary(16) NULL,
    `effectiveFrom` date NOT NULL,
    `effectiveTo` date NULL,
    `activeWeekDays` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `shiftNames` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `menuVariant` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `menuSectionName` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `slotName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `dishCategory` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `portionRatePercent` decimal(5,2) NOT NULL,
    `bomRatePercent` decimal(5,2) NULL,
    `yieldLossPercent` decimal(5,2) NULL,
    `priority` int NOT NULL DEFAULT '0',
    `status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
    `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `PRIMARY` PRIMARY KEY (`portionRuleId`),
    CONSTRAINT `portionrules_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`customerId`),
    CONSTRAINT `portionrules_ibfk_2` FOREIGN KEY (`dishId`) REFERENCES `dishes` (`dishId`)
) CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `customerId` ON `portionrules` (`customerId`);

CREATE INDEX `dishId` ON `portionrules` (`dishId`);

CREATE INDEX `ixPortionRulesCustomerEffective` ON `portionrules` (`customerId`, `effectiveFrom`, `effectiveTo`, `status`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630062000_AddPortionRules', '9.0.16');

ALTER TABLE `materialrequestlines` ADD `appliedPortionRuleId` binary(16) NULL;

ALTER TABLE `materialrequestlines` ADD `appliedPortionRatePercent` decimal(5,2) NOT NULL DEFAULT '100.00';

ALTER TABLE `materialrequestlines` ADD `appliedPortionRuleSource` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONTRACT_DEFAULT';

ALTER TABLE `materialrequestlines` ADD `yieldLossPercent` decimal(5,2) NULL;

CREATE INDEX `appliedPortionRuleId` ON `materialrequestlines` (`appliedPortionRuleId`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630065000_AddPortionRuleTraceToDemandLines', '9.0.16');

ALTER TABLE `dishbom` ADD `bomStatus` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLISHED';

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260630161000_AddBomVersionStatus', '9.0.16');

COMMIT;

