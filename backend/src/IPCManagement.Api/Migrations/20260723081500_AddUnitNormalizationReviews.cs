using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260723081500_AddUnitNormalizationReviews")]
public partial class AddUnitNormalizationReviews : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
CREATE TABLE IF NOT EXISTS `unitnormalizationreviews` (
  `reviewId` binary(16) NOT NULL,
  `ingredientId` binary(16) NOT NULL,
  `sourceUnitId` binary(16) NOT NULL,
  `catalogUnitId` binary(16) NOT NULL,
  `recommendedUnitId` binary(16) NULL,
  `observedStockQty` decimal(18,6) NULL,
  `sourceReceiptCount` int NOT NULL DEFAULT 0,
  `catalogReceiptCount` int NOT NULL DEFAULT 0,
  `bomLineCount` int NOT NULL DEFAULT 0,
  `proposedSourceToCatalogFactor` decimal(18,6) NULL,
  `confidence` varchar(20) NOT NULL DEFAULT 'BLOCKED',
  `status` varchar(30) NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
  `evidenceSource` varchar(500) NOT NULL,
  `evidenceNote` text NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewedAt` datetime NULL,
  `reviewedBy` binary(16) NULL,
  PRIMARY KEY (`reviewId`),
  UNIQUE KEY `uq_unitnormalizationreviews_pair` (`ingredientId`,`sourceUnitId`,`catalogUnitId`),
  KEY `idx_unitnormalizationreviews_status` (`status`),
  KEY `fk_unitnormalizationreviews_sourceunit` (`sourceUnitId`),
  KEY `fk_unitnormalizationreviews_catalogunit` (`catalogUnitId`),
  KEY `fk_unitnormalizationreviews_recommendedunit` (`recommendedUnitId`),
  KEY `fk_unitnormalizationreviews_reviewer` (`reviewedBy`),
  CONSTRAINT `fk_unitnormalizationreviews_ingredient` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients` (`ingredientId`) ON DELETE RESTRICT,
  CONSTRAINT `fk_unitnormalizationreviews_sourceunit` FOREIGN KEY (`sourceUnitId`) REFERENCES `units` (`unitId`) ON DELETE RESTRICT,
  CONSTRAINT `fk_unitnormalizationreviews_catalogunit` FOREIGN KEY (`catalogUnitId`) REFERENCES `units` (`unitId`) ON DELETE RESTRICT,
  CONSTRAINT `fk_unitnormalizationreviews_recommendedunit` FOREIGN KEY (`recommendedUnitId`) REFERENCES `units` (`unitId`) ON DELETE RESTRICT,
  CONSTRAINT `fk_unitnormalizationreviews_reviewer` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`userId`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TABLE IF EXISTS `unitnormalizationreviews`;");
    }
}
