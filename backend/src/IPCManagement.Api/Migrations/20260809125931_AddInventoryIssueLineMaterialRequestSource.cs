using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryIssueLineMaterialRequestSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "materialRequestLineId",
                table: "inventoryissuelines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ixInventoryIssueLinesMaterialRequestLine",
                table: "inventoryissuelines",
                column: "materialRequestLineId");

            migrationBuilder.AddForeignKey(
                name: "inventoryissuelines_ibfk_4",
                table: "inventoryissuelines",
                column: "materialRequestLineId",
                principalTable: "materialrequestlines",
                principalColumn: "requestLineId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryissuelines_ibfk_4",
                table: "inventoryissuelines");

            migrationBuilder.DropIndex(
                name: "ixInventoryIssueLinesMaterialRequestLine",
                table: "inventoryissuelines");

            migrationBuilder.DropColumn(
                name: "materialRequestLineId",
                table: "inventoryissuelines");
        }
    }
}
