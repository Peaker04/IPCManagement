using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260722190000_SeedPurchaseHistoryCanonicalUnits")]
public partial class SeedPurchaseHistoryCanonicalUnits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
CREATE TEMPORARY TABLE `tmp_purchase_history_canonical_units` (
    `unitId` binary(16) NOT NULL,
    `unitCode` varchar(20) NOT NULL,
    `unitName` varchar(100) NOT NULL,
    PRIMARY KEY (`unitCode`)
);

INSERT INTO `tmp_purchase_history_canonical_units` (`unitId`, `unitCode`, `unitName`) VALUES
(UNHEX('20260722190000418111111111111301'), 'BAO', 'Bao'),
(UNHEX('20260722190000418111111111111302'), 'CAN', 'Can'),
(UNHEX('20260722190000418111111111111303'), 'CAP', 'Cặp'),
(UNHEX('20260722190000418111111111111304'), 'CUC', 'Cục'),
(UNHEX('20260722190000418111111111111305'), 'DOI', 'đôi'),
(UNHEX('20260722190000418111111111111306'), 'LON', 'Lon'),
(UNHEX('20260722190000418111111111111307'), 'LIT', 'Lít'),
(UNHEX('20260722190000418111111111111308'), 'PHAN', 'Phần'),
(UNHEX('20260722190000418111111111111309'), 'TRAI', 'Trái'),
(UNHEX('20260722190000418111111111111310'), 'VI', 'vỉ'),
(UNHEX('20260722190000418111111111111311'), 'VIEN', 'viên'),
(UNHEX('20260722190000418111111111111312'), 'XAP', 'Xấp'),
(UNHEX('20260722190000418111111111111313'), 'BO_BUNCH', 'bó'),
(UNHEX('20260722190000418111111111111314'), 'BO_SET', 'bộ'),
(UNHEX('20260722190000418111111111111315'), 'BINH', 'bình'),
(UNHEX('20260722190000418111111111111316'), 'CHIEC', 'Chiếc'),
(UNHEX('20260722190000418111111111111317'), 'CON', 'con'),
(UNHEX('20260722190000418111111111111318'), 'BI', 'bì');

INSERT INTO `units` (`unitId`, `unitCode`, `unitName`, `baseUnitCode`, `convertRateToBase`)
SELECT c.`unitId`, c.`unitCode`, c.`unitName`, NULL, 1.000000
FROM `tmp_purchase_history_canonical_units` c
LEFT JOIN `units` u ON LOWER(TRIM(u.`unitCode`)) = LOWER(c.`unitCode`)
WHERE u.`unitId` IS NULL;

UPDATE `units` u
INNER JOIN `tmp_purchase_history_canonical_units` c
    ON LOWER(TRIM(u.`unitCode`)) = LOWER(c.`unitCode`)
SET u.`unitName` = c.`unitName`;

DROP TEMPORARY TABLE `tmp_purchase_history_canonical_units`;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Canonical reference units may be linked after deployment and are intentionally retained.
    }
}
