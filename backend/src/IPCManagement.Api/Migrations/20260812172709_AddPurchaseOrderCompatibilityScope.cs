using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseOrderCompatibilityScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "receivingWarehouseId",
                table: "purchaselinesupplierdecisions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "purchasingTerms",
                table: "purchaselinesupplierdecisions",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "proposedDeliveryDate",
                table: "purchaseorders",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "receivingWarehouseId",
                table: "purchaseorders",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "purchasingTerms",
                table: "purchaseorders",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.DropIndex(
                name: "ixPurchaseOrdersRequestSupplier",
                table: "purchaseorders");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseLineSupplierDecisionsCompatibility",
                table: "purchaselinesupplierdecisions",
                columns: new[] { "supplierId", "proposedDeliveryDate", "receivingWarehouseId", "purchasingTerms" });

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrdersCompatibility",
                table: "purchaseorders",
                columns: new[] { "purchaseRequestId", "supplierId", "proposedDeliveryDate", "receivingWarehouseId", "purchasingTerms" },
                unique: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ixPurchaseLineSupplierDecisionsCompatibility",
                table: "purchaselinesupplierdecisions");

            migrationBuilder.DropIndex(
                name: "ixPurchaseOrdersCompatibility",
                table: "purchaseorders");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseOrdersRequestSupplier",
                table: "purchaseorders",
                columns: new[] { "purchaseRequestId", "supplierId" },
                unique: true);

            migrationBuilder.DropColumn(
                name: "receivingWarehouseId",
                table: "purchaselinesupplierdecisions");

            migrationBuilder.DropColumn(
                name: "purchasingTerms",
                table: "purchaselinesupplierdecisions");

            migrationBuilder.DropColumn(
                name: "proposedDeliveryDate",
                table: "purchaseorders");

            migrationBuilder.DropColumn(
                name: "receivingWarehouseId",
                table: "purchaseorders");

            migrationBuilder.DropColumn(
                name: "purchasingTerms",
                table: "purchaseorders");
        }
    }
}
