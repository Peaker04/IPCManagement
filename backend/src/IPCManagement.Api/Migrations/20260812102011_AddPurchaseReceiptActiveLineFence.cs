using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseReceiptActiveLineFence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "purchaseOrderLineId",
                table: "inventoryreceiptlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            // Legacy receipt lines only carried the purchase-request line. A
            // source line can be restored without guesswork only when it also
            // belongs to the immutable purchase order recorded on the receipt.
            // Ambiguous/legacy rows stay null and are not enrolled in the new
            // active-line fence.
            migrationBuilder.Sql("""
                UPDATE `inventoryreceiptlines` AS `line`
                INNER JOIN `inventoryreceipts` AS `receipt`
                    ON `receipt`.`receiptId` = `line`.`receiptId`
                INNER JOIN `purchaseorderlines` AS `orderLine`
                    ON `orderLine`.`purchaseOrderId` = `receipt`.`purchaseOrderId`
                    AND `orderLine`.`purchaseRequestLineId` = `line`.`purchaseRequestLineId`
                SET `line`.`purchaseOrderLineId` = `orderLine`.`purchaseOrderLineId`
                WHERE `line`.`purchaseOrderLineId` IS NULL
                    AND `receipt`.`purchaseOrderId` IS NOT NULL
                    AND `line`.`purchaseRequestLineId` IS NOT NULL;
                """);

            migrationBuilder.CreateTable(
                name: "purchasereceiptactivelines",
                columns: table => new
                {
                    purchaseOrderLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    receiptId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseOrderLineId);
                    table.ForeignKey(
                        name: "purchasereceiptactivelines_ibfk_1",
                        column: x => x.purchaseOrderLineId,
                        principalTable: "purchaseorderlines",
                        principalColumn: "purchaseOrderLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchasereceiptactivelines_ibfk_2",
                        column: x => x.receiptId,
                        principalTable: "inventoryreceipts",
                        principalColumn: "receiptId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            // Only unequivocal legacy active lines may be leased. Duplicate
            // active drafts are intentionally omitted; service fallback keeps
            // them blocked until an audited void/rework decision is made.
            migrationBuilder.Sql("""
                INSERT INTO `purchasereceiptactivelines` (`purchaseOrderLineId`, `receiptId`, `createdAt`)
                SELECT `line`.`purchaseOrderLineId`, MIN(`line`.`receiptId`), UTC_TIMESTAMP()
                FROM `inventoryreceiptlines` AS `line`
                INNER JOIN `inventoryreceipts` AS `receipt`
                    ON `receipt`.`receiptId` = `line`.`receiptId`
                WHERE `line`.`purchaseOrderLineId` IS NOT NULL
                    AND `receipt`.`status` IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')
                GROUP BY `line`.`purchaseOrderLineId`
                HAVING COUNT(DISTINCT `line`.`receiptId`) = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "ixInventoryReceiptLinesPurchaseOrderLine",
                table: "inventoryreceiptlines",
                column: "purchaseOrderLineId");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseReceiptActiveLinesReceipt",
                table: "purchasereceiptactivelines",
                column: "receiptId");

            migrationBuilder.AddForeignKey(
                name: "inventoryreceiptlines_ibfk_6",
                table: "inventoryreceiptlines",
                column: "purchaseOrderLineId",
                principalTable: "purchaseorderlines",
                principalColumn: "purchaseOrderLineId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryreceiptlines_ibfk_6",
                table: "inventoryreceiptlines");

            migrationBuilder.DropTable(
                name: "purchasereceiptactivelines");

            migrationBuilder.DropIndex(
                name: "ixInventoryReceiptLinesPurchaseOrderLine",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "purchaseOrderLineId",
                table: "inventoryreceiptlines");
        }
    }
}
