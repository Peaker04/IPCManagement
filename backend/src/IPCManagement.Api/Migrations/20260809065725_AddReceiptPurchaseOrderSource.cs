using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptPurchaseOrderSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "purchaseOrderId",
                table: "inventoryreceipts",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ixInventoryReceiptsPurchaseOrder",
                table: "inventoryreceipts",
                column: "purchaseOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ixInventoryReceiptsPurchaseOrder",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "purchaseOrderId",
                table: "inventoryreceipts");
        }
    }
}
