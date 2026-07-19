using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260716090000_CleanLegacyPortionData")]
public partial class CleanLegacyPortionData : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
UPDATE `materialrequestlines`
SET `bomRatePercent` = 100.00,
    `appliedPortionRuleId` = NULL,
    `appliedPortionRuleSource` = 'FIXED_TIER',
    `appliedPortionRatePercent` = 100.00;

UPDATE `menuschedules` SET `bomRatePercent` = 100.00;
UPDATE `customercontracts` SET `defaultBomRatePercent` = 100.00;

DELETE FROM `portionrules`;

DELETE ba FROM `bomadjustments` ba
INNER JOIN `dishbom` db ON db.`bomId` = ba.`bomId`
INNER JOIN `dishes` d ON d.`dishId` = db.`dishId`
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%';

UPDATE `materialrequestlines` mrl
INNER JOIN `dishbom` db ON db.`bomId` = mrl.`bomId`
INNER JOIN `dishes` d ON d.`dishId` = db.`dishId`
SET mrl.`bomId` = NULL,
    mrl.`bomScope` = 'legacy-removed'
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%';

DELETE db FROM `dishbom` db
INNER JOIN `dishes` d ON d.`dishId` = db.`dishId`
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%';

DELETE d FROM `dishes` d
WHERE d.`dishCode` LIKE 'TMP-BOM-DISH-%'
  AND NOT EXISTS (SELECT 1 FROM `menuitems` mi WHERE mi.`dishId` = d.`dishId`)
  AND NOT EXISTS (SELECT 1 FROM `productionplanlines` pl WHERE pl.`dishId` = d.`dishId`);

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

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Legacy portion rules and temporary seed rows are intentionally not recreated.
    }
}
