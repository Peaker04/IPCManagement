using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260716113000_CorrectPresetBomTechnicalUnits")]
public partial class CorrectPresetBomTechnicalUnits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
SET @unit_cai = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'CAI' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111201'), 'CAI', 'Cái', 'CAI', 1.000000
WHERE @unit_cai IS NULL;
SET @unit_cai = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'CAI' LIMIT 1);

SET @unit_hop = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'HOP' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111202'), 'HOP', 'Hộp', 'HOP', 1.000000
WHERE @unit_hop IS NULL;
SET @unit_hop = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'HOP' LIMIT 1);

SET @unit_qua = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'QUA' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111203'), 'QUA', 'Quả', 'QUA', 1.000000
WHERE @unit_qua IS NULL;
SET @unit_qua = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'QUA' LIMIT 1);

SET @unit_o = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'O' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111204'), 'O', 'Ổ', 'O', 1.000000
WHERE @unit_o IS NULL;
SET @unit_o = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'O' LIMIT 1);

SET @unit_mieng = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'MIENG' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111205'), 'MIENG', 'Miếng', 'MIENG', 1.000000
WHERE @unit_mieng IS NULL;
SET @unit_mieng = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'MIENG' LIMIT 1);

SET @unit_cay = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'CAY' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111206'), 'CAY', 'Cây', 'CAY', 1.000000
WHERE @unit_cay IS NULL;
SET @unit_cay = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'CAY' LIMIT 1);

SET @unit_lat = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'LAT' LIMIT 1);
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260716113000418111111111111207'), 'LAT', 'Lát', 'LAT', 1.000000
WHERE @unit_lat IS NULL;
SET @unit_lat = (SELECT `unitId` FROM `units` WHERE `unitCode` = 'LAT' LIMIT 1);

CREATE TEMPORARY TABLE `tmp_preset_bom_unit_corrections` (
    `ingredientName` varchar(200) NOT NULL,
    `unitId` binary(16) NOT NULL,
    PRIMARY KEY (`ingredientName`)
);

INSERT INTO `tmp_preset_bom_unit_corrections` (`ingredientName`, `unitId`) VALUES
('Bánh mì', @unit_o),
('Chuối', @unit_qua),
('Chả cá', @unit_mieng),
('Căn cuộn', @unit_cay),
('Sữa chua', @unit_hop),
('Trứng cút', @unit_cai),
('Trứng cút lột sẵn', @unit_cai),
('Trứng gà', @unit_cai),
('Trứng gà (cái)', @unit_cai),
('Trứng gà trung', @unit_cai),
('Đậu khuôn', @unit_lat),
('Đậu khuôn chiên', @unit_lat),
('Đậu khuôn chiên lát nhỏ', @unit_lat);

UPDATE `ingredients` i
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET i.`unitId` = c.`unitId`;

UPDATE `dishbom` x
INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;

UPDATE `currentstock` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `currentstocklots` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `stocksnapshots` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `stockmovements` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `inventoryreceiptlines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `inventoryissuelines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `inventoryreturnlines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `materialrequestlines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `purchaserequestlines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `purchaseorderlines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;
UPDATE `stocktakelines` x INNER JOIN `ingredients` i ON i.`ingredientId` = x.`ingredientId`
INNER JOIN `tmp_preset_bom_unit_corrections` c ON LOWER(TRIM(i.`ingredientName`)) = LOWER(c.`ingredientName`)
SET x.`unitId` = c.`unitId`;

DROP TEMPORARY TABLE `tmp_preset_bom_unit_corrections`;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // This is a semantic correction of imported quantities; reverting to KG would restore invalid data.
    }
}
