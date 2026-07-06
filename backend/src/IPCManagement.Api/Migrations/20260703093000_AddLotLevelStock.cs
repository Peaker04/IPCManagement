using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260703093000_AddLotLevelStock")]
    public partial class AddLotLevelStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "expiredDate",
                table: "stockmovements",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "lotNumber",
                table: "stockmovements",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "manufactureDate",
                table: "stockmovements",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "currentstocklots",
                columns: table => new
                {
                    lotStockId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    warehouseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    lotNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    manufactureDate = table.Column<DateOnly>(type: "date", nullable: true),
                    expiredDate = table.Column<DateOnly>(type: "date", nullable: true),
                    currentQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false, defaultValueSql: "0.000000"),
                    lastUpdated = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.lotStockId);
                    table.ForeignKey(
                        name: "currentstocklots_ibfk_2",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId");
                    table.ForeignKey(
                        name: "currentstocklots_ibfk_3",
                        column: x => x.unitId,
                        principalTable: "units",
                        principalColumn: "unitId");
                    table.ForeignKey(
                        name: "currentstocklots_ibfk_1",
                        column: x => x.warehouseId,
                        principalTable: "warehouses",
                        principalColumn: "warehouseId");
                });

            migrationBuilder.CreateIndex(
                name: "ixCurrentStockLotsFefo",
                table: "currentstocklots",
                columns: new[] { "warehouseId", "ingredientId", "expiredDate", "lotNumber" });

            migrationBuilder.CreateIndex(
                name: "ixCurrentStockLotsIdentity",
                table: "currentstocklots",
                columns: new[] { "warehouseId", "ingredientId", "unitId", "lotNumber", "manufactureDate", "expiredDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "currentstocklots");

            migrationBuilder.DropColumn(name: "expiredDate", table: "stockmovements");
            migrationBuilder.DropColumn(name: "lotNumber", table: "stockmovements");
            migrationBuilder.DropColumn(name: "manufactureDate", table: "stockmovements");
        }
    }
}
