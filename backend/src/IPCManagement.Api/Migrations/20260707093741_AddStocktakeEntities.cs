using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStocktakeEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stocktakes",
                columns: table => new
                {
                    stocktakeId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    stocktakeCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    warehouseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    approvedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    approvedAt = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.stocktakeId);
                    table.ForeignKey(
                        name: "FK_stocktakes_users_approvedBy",
                        column: x => x.approvedBy,
                        principalTable: "users",
                        principalColumn: "userId");
                    table.ForeignKey(
                        name: "FK_stocktakes_users_createdBy",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId");
                    table.ForeignKey(
                        name: "FK_stocktakes_warehouses_warehouseId",
                        column: x => x.warehouseId,
                        principalTable: "warehouses",
                        principalColumn: "warehouseId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "stocktakelines",
                columns: table => new
                {
                    lineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    stocktakeId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    systemQty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    actualQty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    discrepancyQty = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.lineId);
                    table.ForeignKey(
                        name: "FK_stocktakelines_ingredients_ingredientId",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId");
                    table.ForeignKey(
                        name: "FK_stocktakelines_stocktakes_stocktakeId",
                        column: x => x.stocktakeId,
                        principalTable: "stocktakes",
                        principalColumn: "stocktakeId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_stocktakelines_units_unitId",
                        column: x => x.unitId,
                        principalTable: "units",
                        principalColumn: "unitId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_stocktakelines_unitId",
                table: "stocktakelines",
                column: "unitId");

            migrationBuilder.CreateIndex(
                name: "ixStocktakelineIngredient",
                table: "stocktakelines",
                column: "ingredientId");

            migrationBuilder.CreateIndex(
                name: "ixStocktakelineStocktake",
                table: "stocktakelines",
                column: "stocktakeId");

            migrationBuilder.CreateIndex(
                name: "IX_stocktakes_approvedBy",
                table: "stocktakes",
                column: "approvedBy");

            migrationBuilder.CreateIndex(
                name: "IX_stocktakes_createdBy",
                table: "stocktakes",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "ixStocktakeCode",
                table: "stocktakes",
                column: "stocktakeCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixStocktakeWarehouse",
                table: "stocktakes",
                column: "warehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "stocktakelines");

            migrationBuilder.DropTable(
                name: "stocktakes");
        }
    }
}
