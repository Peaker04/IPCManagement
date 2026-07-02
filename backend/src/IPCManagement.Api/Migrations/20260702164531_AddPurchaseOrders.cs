using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "purchaseorders",
                columns: table => new
                {
                    purchaseOrderId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseOrderCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    purchaseRequestId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    supplierId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    orderDate = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false, defaultValue: "ORDERED", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseOrderId);
                    table.ForeignKey(
                        name: "purchaseorders_ibfk_1",
                        column: x => x.purchaseRequestId,
                        principalTable: "purchaserequests",
                        principalColumn: "purchaseRequestId");
                    table.ForeignKey(
                        name: "purchaseorders_ibfk_2",
                        column: x => x.supplierId,
                        principalTable: "suppliers",
                        principalColumn: "supplierId");
                    table.ForeignKey(
                        name: "purchaseorders_ibfk_3",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "purchaseorderlines",
                columns: table => new
                {
                    purchaseOrderLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseOrderId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseRequestLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    orderedQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    receivedQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    unitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseOrderLineId);
                    table.ForeignKey(
                        name: "purchaseorderlines_ibfk_1",
                        column: x => x.purchaseOrderId,
                        principalTable: "purchaseorders",
                        principalColumn: "purchaseOrderId");
                    table.ForeignKey(
                        name: "purchaseorderlines_ibfk_2",
                        column: x => x.purchaseRequestLineId,
                        principalTable: "purchaserequestlines",
                        principalColumn: "purchaseRequestLineId");
                    table.ForeignKey(
                        name: "purchaseorderlines_ibfk_3",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId");
                    table.ForeignKey(
                        name: "purchaseorderlines_ibfk_4",
                        column: x => x.unitId,
                        principalTable: "units",
                        principalColumn: "unitId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrderLinesIngredient",
                table: "purchaseorderlines",
                column: "ingredientId");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrderLinesOrder",
                table: "purchaseorderlines",
                column: "purchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrderLinesRequestLine",
                table: "purchaseorderlines",
                column: "purchaseRequestLineId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrderLinesUnit",
                table: "purchaseorderlines",
                column: "unitId");

            migrationBuilder.CreateIndex(
                name: "IX_purchaseorders_createdBy",
                table: "purchaseorders",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrdersRequest",
                table: "purchaseorders",
                column: "purchaseRequestId");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrdersRequestSupplier",
                table: "purchaseorders",
                columns: new[] { "purchaseRequestId", "supplierId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrdersSupplier",
                table: "purchaseorders",
                column: "supplierId");

            migrationBuilder.CreateIndex(
                name: "purchaseOrderCode",
                table: "purchaseorders",
                column: "purchaseOrderCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchaseorderlines");

            migrationBuilder.DropTable(
                name: "purchaseorders");
        }
    }
}
