using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddOpenSupplementalRequestUniqueFence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "openIssueLineId",
                table: "supplementalmaterialrequests",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                computedColumnSql: "CASE WHEN `status` IN ('REJECTED', 'FULFILLED') THEN NULL ELSE `issueLineId` END",
                stored: false);

            migrationBuilder.CreateIndex(
                name: "uxSupplementalMaterialRequestsOpenIssueLine",
                table: "supplementalmaterialrequests",
                column: "openIssueLineId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uxSupplementalMaterialRequestsOpenIssueLine",
                table: "supplementalmaterialrequests");

            migrationBuilder.DropColumn(
                name: "openIssueLineId",
                table: "supplementalmaterialrequests");
        }
    }
}
