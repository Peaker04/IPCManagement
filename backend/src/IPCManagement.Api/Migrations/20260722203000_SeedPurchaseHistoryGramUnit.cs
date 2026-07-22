using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260722203000_SeedPurchaseHistoryGramUnit")]
public partial class SeedPurchaseHistoryGramUnit : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT UNHEX('20260722203000418111111111111319'), 'G', 'Gram', 'KG', 0.001000
WHERE NOT EXISTS (
    SELECT 1
    FROM `units`
    WHERE LOWER(TRIM(`unitCode`)) = 'g'
);

UPDATE `units`
SET `unitName` = 'Gram'
WHERE LOWER(TRIM(`unitCode`)) = 'g';
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Canonical reference units may be linked after deployment and are intentionally retained.
    }
}
