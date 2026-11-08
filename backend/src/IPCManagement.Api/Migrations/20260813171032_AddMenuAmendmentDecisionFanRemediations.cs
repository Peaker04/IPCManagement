using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuAmendmentDecisionFanRemediations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "serviceRunDecisionItemId",
                table: "menuamendmentreconciliationcorrections",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "menuamendmentreconciliationremediations",
                columns: table => new
                {
                    menuAmendmentReconciliationRemediationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    menuAmendmentReconciliationCaseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    commandId = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    effectiveImpactSnapshotJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.menuAmendmentReconciliationRemediationId);
                    table.ForeignKey(
                        name: "FK_menuamendmentreconciliationremediations_menuamendmentreconci~",
                        column: x => x.menuAmendmentReconciliationCaseId,
                        principalTable: "menuamendmentreconciliationcases",
                        principalColumn: "menuAmendmentReconciliationCaseId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "uqMenuAmendmentReconciliationCorrectionsDecision",
                table: "menuamendmentreconciliationcorrections",
                column: "serviceRunDecisionItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixMenuAmendmentReconciliationRemediationsCaseCreatedAt",
                table: "menuamendmentreconciliationremediations",
                columns: new[] { "menuAmendmentReconciliationCaseId", "createdAt" });

            migrationBuilder.CreateIndex(
                name: "uqMenuAmendmentReconciliationRemediationsCommand",
                table: "menuamendmentreconciliationremediations",
                column: "commandId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "menuamendmentreconciliationremediations");

            migrationBuilder.DropIndex(
                name: "uqMenuAmendmentReconciliationCorrectionsDecision",
                table: "menuamendmentreconciliationcorrections");

            migrationBuilder.DropColumn(
                name: "serviceRunDecisionItemId",
                table: "menuamendmentreconciliationcorrections");
        }
    }
}
