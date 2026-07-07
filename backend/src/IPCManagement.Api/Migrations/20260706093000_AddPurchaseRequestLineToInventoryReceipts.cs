using Microsoft.EntityFrameworkCore.Migrations;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260706093000_AddPurchaseRequestLineToInventoryReceipts")]
    public partial class AddPurchaseRequestLineToInventoryReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "purchaseRequestLineId",
                table: "inventoryreceiptlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "purchaseRequestLineId",
                table: "inventoryreceiptlines",
                column: "purchaseRequestLineId");

            migrationBuilder.AddForeignKey(
                name: "inventoryreceiptlines_ibfk_4",
                table: "inventoryreceiptlines",
                column: "purchaseRequestLineId",
                principalTable: "purchaserequestlines",
                principalColumn: "purchaseRequestLineId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryreceiptlines_ibfk_4",
                table: "inventoryreceiptlines");

            migrationBuilder.DropIndex(
                name: "purchaseRequestLineId",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "purchaseRequestLineId",
                table: "inventoryreceiptlines");
        }
    }
}
