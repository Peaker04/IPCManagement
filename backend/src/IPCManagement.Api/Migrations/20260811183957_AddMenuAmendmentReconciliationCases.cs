using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuAmendmentReconciliationCases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "menuamendmentreconciliationcases",
                columns: table => new
                {
                    menuAmendmentReconciliationCaseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    menuAmendmentId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    impactSnapshotJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.menuAmendmentReconciliationCaseId);
                    table.ForeignKey(
                        name: "FK_menuamendmentreconciliationcases_menuamendments_menuAmendmen~",
                        column: x => x.menuAmendmentId,
                        principalTable: "menuamendments",
                        principalColumn: "menuAmendmentId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "servicerunvariancedeclarations",
                columns: table => new
                {
                    serviceRunVarianceDeclarationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    serviceRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    track = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceLineEvidenceJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    declaredBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    declaredAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunVarianceDeclarationId);
                    table.ForeignKey(
                        name: "FK_servicerunvariancedeclarations_serviceruns_serviceRunId",
                        column: x => x.serviceRunId,
                        principalTable: "serviceruns",
                        principalColumn: "serviceRunId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "servicerunvariancewaivers",
                columns: table => new
                {
                    serviceRunVarianceWaiverId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    serviceRunVarianceDeclarationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    approvedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    approvedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunVarianceWaiverId);
                    table.ForeignKey(
                        name: "FK_servicerunvariancewaivers_servicerunvariancedeclarations_ser~",
                        column: x => x.serviceRunVarianceDeclarationId,
                        principalTable: "servicerunvariancedeclarations",
                        principalColumn: "serviceRunVarianceDeclarationId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "uqMenuAmendmentReconciliationCase",
                table: "menuamendmentreconciliationcases",
                column: "menuAmendmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixServiceRunVarianceDeclarationsRunDeclaredAt",
                table: "servicerunvariancedeclarations",
                columns: new[] { "serviceRunId", "declaredAt" });

            migrationBuilder.CreateIndex(
                name: "uqServiceRunVarianceWaiverDeclaration",
                table: "servicerunvariancewaivers",
                column: "serviceRunVarianceDeclarationId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "menuamendmentreconciliationcases");

            migrationBuilder.DropTable(
                name: "servicerunvariancewaivers");

            migrationBuilder.DropTable(
                name: "servicerunvariancedeclarations");
        }
    }
}
