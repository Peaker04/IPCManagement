using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryReturnLineSourceIssueLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "sourceIssueLineId",
                table: "inventoryreturnlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ixInventoryReturnLinesSourceIssueLine",
                table: "inventoryreturnlines",
                column: "sourceIssueLineId");

            migrationBuilder.AddForeignKey(
                name: "inventoryreturnlines_ibfk_4",
                table: "inventoryreturnlines",
                column: "sourceIssueLineId",
                principalTable: "inventoryissuelines",
                principalColumn: "issueLineId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryreturnlines_ibfk_4",
                table: "inventoryreturnlines");

            migrationBuilder.DropIndex(
                name: "ixInventoryReturnLinesSourceIssueLine",
                table: "inventoryreturnlines");

            migrationBuilder.DropColumn(
                name: "sourceIssueLineId",
                table: "inventoryreturnlines");
        }
    }
}
