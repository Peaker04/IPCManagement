using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMrxHistoricalPurposeProposals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mrxhistoricalpurposeproposals",
                columns: table => new
                {
                    ProposalId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IssueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ServiceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    UnallocatedQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    AllocationsJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    Reason = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    DecisionReason = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mrxhistoricalpurposeproposals", x => x.ProposalId);
                    table.ForeignKey(
                        name: "FK_mrxhistoricalpurposeproposals_inventoryissuelines_IssueLineId",
                        column: x => x.IssueLineId,
                        principalTable: "inventoryissuelines",
                        principalColumn: "issueLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_mrxhistoricalpurposeproposals_reconciliationbatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "reconciliationbatches",
                        principalColumn: "BatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_mrxhistoricalpurposeproposals_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_mrxhistoricalpurposeproposals_BatchId_ServiceDate_Status",
                table: "mrxhistoricalpurposeproposals",
                columns: new[] { "BatchId", "ServiceDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_mrxhistoricalpurposeproposals_CreatedBy",
                table: "mrxhistoricalpurposeproposals",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_mrxhistoricalpurposeproposals_IssueLineId_Status",
                table: "mrxhistoricalpurposeproposals",
                columns: new[] { "IssueLineId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_mrxhistoricalpurposeproposals_Status_CreatedAt_ProposalId",
                table: "mrxhistoricalpurposeproposals",
                columns: new[] { "Status", "CreatedAt", "ProposalId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mrxhistoricalpurposeproposals");
        }
    }
}
