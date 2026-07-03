using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260703103000_AddMonthlyStockSnapshots")]
    public partial class AddMonthlyStockSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "stocksnapshots",
                columns: table => new
                {
                    snapshotId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    warehouseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    periodMonth = table.Column<DateOnly>(type: "date", nullable: false),
                    openingQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false, defaultValueSql: "0.000000"),
                    quantityIn = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false, defaultValueSql: "0.000000"),
                    quantityOut = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false, defaultValueSql: "0.000000"),
                    closingQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false, defaultValueSql: "0.000000"),
                    generatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.snapshotId);
                    table.ForeignKey(
                        name: "stocksnapshots_ibfk_2",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId");
                    table.ForeignKey(
                        name: "stocksnapshots_ibfk_3",
                        column: x => x.unitId,
                        principalTable: "units",
                        principalColumn: "unitId");
                    table.ForeignKey(
                        name: "stocksnapshots_ibfk_1",
                        column: x => x.warehouseId,
                        principalTable: "warehouses",
                        principalColumn: "warehouseId");
                });

            migrationBuilder.CreateIndex(
                name: "ixStockSnapshotsIdentity",
                table: "stocksnapshots",
                columns: new[] { "warehouseId", "ingredientId", "unitId", "periodMonth" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixStockSnapshotsPeriod",
                table: "stocksnapshots",
                columns: new[] { "periodMonth", "warehouseId", "ingredientId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "stocksnapshots");
        }
    }
}
