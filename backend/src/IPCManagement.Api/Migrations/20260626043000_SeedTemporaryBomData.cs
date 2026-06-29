using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260626043000_SeedTemporaryBomData")]
    public partial class SeedTemporaryBomData : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
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
""");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
DELETE FROM `dishbom`
WHERE `bomId` IN (
    UNHEX('11111111111111418111111111111116'),
    UNHEX('11111111111111418111111111111117'),
    UNHEX('11111111111111418111111111111118'),
    UNHEX('11111111111111418111111111111119'),
    UNHEX('1111111111111141811111111111111a'),
    UNHEX('1111111111111141811111111111111b'),
    UNHEX('1111111111111141811111111111111c'),
    UNHEX('1111111111111141811111111111111d'),
    UNHEX('1111111111111141811111111111111e'),
    UNHEX('1111111111111141811111111111111f'),
    UNHEX('11111111111111418111111111111120'),
    UNHEX('11111111111111418111111111111121'),
    UNHEX('11111111111111418111111111111122'),
    UNHEX('11111111111111418111111111111123'),
    UNHEX('11111111111111418111111111111124'),
    UNHEX('11111111111111418111111111111125'),
    UNHEX('11111111111111418111111111111126')
);

DELETE d FROM `dishes` d
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%'
  AND NOT EXISTS (SELECT 1 FROM `menuitems` mi WHERE mi.`dishId` = d.`dishId`)
  AND NOT EXISTS (SELECT 1 FROM `productionplanlines` pl WHERE pl.`dishId` = d.`dishId`)
  AND NOT EXISTS (SELECT 1 FROM `dishbom` db WHERE db.`dishId` = d.`dishId`);

DELETE i FROM `ingredients` i
WHERE i.`ingredientCode` LIKE 'TMP-BOM-ING-%'
  AND NOT EXISTS (SELECT 1 FROM `dishbom` db WHERE db.`ingredientId` = i.`ingredientId`)
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
""");
        }
    }
}
