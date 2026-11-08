using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationDailyFrozenLineage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines");

            migrationBuilder.AddColumn<byte[]>(
                name: "DailyLineId",
                table: "reconciliationbatchcontributors",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "reconciliationBatchDailyLineId",
                table: "inventoryissuelines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "reconciliationServiceDate",
                table: "inventoryissuelines",
                type: "date",
                nullable: true);

            migrationBuilder.AddUniqueConstraint(
                name: "AK_reconciliationbatchlines_BatchLineId_BatchId_IngredientId_Ca~",
                table: "reconciliationbatchlines",
                columns: new[] { "BatchLineId", "BatchId", "IngredientId", "CanonicalUnitId" });

            migrationBuilder.CreateTable(
                name: "reconciliationbatchdailylines",
                columns: table => new
                {
                    DailyLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IngredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CanonicalUnitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ServiceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RequiredQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationbatchdailylines", x => x.DailyLineId);
                    table.UniqueConstraint("AK_reconciliationbatchdailylines_DailyLineId_BatchLineId", x => new { x.DailyLineId, x.BatchLineId });
                    table.UniqueConstraint("AK_reconciliationbatchdailylines_DailyLineId_BatchLineId_Ingred~", x => new { x.DailyLineId, x.BatchLineId, x.IngredientId, x.CanonicalUnitId, x.ServiceDate });
                    table.CheckConstraint("ckReconciliationBatchDailyLineRequiredQuantity", "`requiredQuantity` > 0");
                    table.ForeignKey(
                        name: "FK_reconciliationbatchdailylines_reconciliationbatchlines_Batch~",
                        columns: x => new { x.BatchLineId, x.BatchId, x.IngredientId, x.CanonicalUnitId },
                        principalTable: "reconciliationbatchlines",
                        principalColumns: new[] { "BatchLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_DailyLineId_BatchLineId",
                table: "reconciliationbatchcontributors",
                columns: new[] { "DailyLineId", "BatchLineId" });

            migrationBuilder.CreateIndex(
                name: "IX_inventoryissuelines_reconciliationBatchDailyLineId_reconcili~",
                table: "inventoryissuelines",
                columns: new[] { "reconciliationBatchDailyLineId", "reconciliationBatchLineId", "ingredientId", "unitId", "reconciliationServiceDate" });

            migrationBuilder.CreateIndex(
                name: "ixInventoryIssueLinesReconciliationBatchDailyLine",
                table: "inventoryissuelines",
                column: "reconciliationBatchDailyLineId");

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines",
                sql: "((`materialRequestLineId` IS NOT NULL AND `reconciliationBatchLineId` IS NULL AND `reconciliationBatchDailyLineId` IS NULL AND `reconciliationServiceDate` IS NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NOT NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NULL AND `reconciliationBatchDailyLineId` IS NULL AND `reconciliationServiceDate` IS NULL)) AND ((`reconciliationBatchDailyLineId` IS NULL AND `reconciliationServiceDate` IS NULL) OR (`reconciliationBatchDailyLineId` IS NOT NULL AND `reconciliationBatchLineId` IS NOT NULL AND `reconciliationServiceDate` IS NOT NULL))");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchdailylines_BatchLineId_BatchId_Ingredient~",
                table: "reconciliationbatchdailylines",
                columns: new[] { "BatchLineId", "BatchId", "IngredientId", "CanonicalUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchdailylines_BatchLineId_ServiceDate",
                table: "reconciliationbatchdailylines",
                columns: new[] { "BatchLineId", "ServiceDate" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "inventoryissuelines_ibfk_6",
                table: "inventoryissuelines",
                columns: new[] { "reconciliationBatchDailyLineId", "reconciliationBatchLineId", "ingredientId", "unitId", "reconciliationServiceDate" },
                principalTable: "reconciliationbatchdailylines",
                principalColumns: new[] { "DailyLineId", "BatchLineId", "IngredientId", "CanonicalUnitId", "ServiceDate" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationbatchcontributors_reconciliationbatchdailyline~",
                table: "reconciliationbatchcontributors",
                columns: new[] { "DailyLineId", "BatchLineId" },
                principalTable: "reconciliationbatchdailylines",
                principalColumns: new[] { "DailyLineId", "BatchLineId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryissuelines_ibfk_6",
                table: "inventoryissuelines");

            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationbatchcontributors_reconciliationbatchdailyline~",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropTable(
                name: "reconciliationbatchdailylines");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_reconciliationbatchlines_BatchLineId_BatchId_IngredientId_Ca~",
                table: "reconciliationbatchlines");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationbatchcontributors_DailyLineId_BatchLineId",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropIndex(
                name: "IX_inventoryissuelines_reconciliationBatchDailyLineId_reconcili~",
                table: "inventoryissuelines");

            migrationBuilder.DropIndex(
                name: "ixInventoryIssueLinesReconciliationBatchDailyLine",
                table: "inventoryissuelines");

            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines");

            migrationBuilder.DropColumn(
                name: "DailyLineId",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "reconciliationBatchDailyLineId",
                table: "inventoryissuelines");

            migrationBuilder.DropColumn(
                name: "reconciliationServiceDate",
                table: "inventoryissuelines");

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines",
                sql: "(`materialRequestLineId` IS NOT NULL AND `reconciliationBatchLineId` IS NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NOT NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NULL)");
        }
    }
}
