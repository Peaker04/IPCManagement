using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLegacyLineageDispositionWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "legacylinedispositions",
                columns: table => new
                {
                    dispositionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    legacyLineType = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    legacyLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    targetMaterialRequestLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    targetIssueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    status = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reviewReason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    reviewedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    reviewedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    appliedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    appliedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    openDispositionKey = table.Column<int>(type: "int", nullable: true, computedColumnSql: "CASE WHEN `status` IN ('PENDING_MANAGER_REVIEW', 'APPROVED') THEN 1 ELSE NULL END", stored: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.dispositionId);
                    table.CheckConstraint("ckLegacyLineageDispositionsStatus", "`status` IN ('PENDING_MANAGER_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED')");
                    table.CheckConstraint("ckLegacyLineageDispositionsTypeTarget", "(`legacyLineType` = 'ISSUE_LINE' AND `targetMaterialRequestLineId` IS NOT NULL AND `targetIssueLineId` IS NULL) OR (`legacyLineType` = 'RETURN_LINE' AND `targetIssueLineId` IS NOT NULL AND `targetMaterialRequestLineId` IS NULL)");
                    table.ForeignKey(
                        name: "FK_legacylinedispositions_inventoryissuelines_targetIssueLineId",
                        column: x => x.targetIssueLineId,
                        principalTable: "inventoryissuelines",
                        principalColumn: "issueLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_legacylinedispositions_materialrequestlines_targetMaterialRe~",
                        column: x => x.targetMaterialRequestLineId,
                        principalTable: "materialrequestlines",
                        principalColumn: "requestLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_legacylinedispositions_users_appliedBy",
                        column: x => x.appliedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_legacylinedispositions_users_createdBy",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_legacylinedispositions_users_reviewedBy",
                        column: x => x.reviewedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_appliedBy",
                table: "legacylinedispositions",
                column: "appliedBy");

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_createdBy",
                table: "legacylinedispositions",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_legacyLineType_legacyLineId",
                table: "legacylinedispositions",
                columns: new[] { "legacyLineType", "legacyLineId" });

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_reviewedBy",
                table: "legacylinedispositions",
                column: "reviewedBy");

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_targetIssueLineId",
                table: "legacylinedispositions",
                column: "targetIssueLineId");

            migrationBuilder.CreateIndex(
                name: "IX_legacylinedispositions_targetMaterialRequestLineId",
                table: "legacylinedispositions",
                column: "targetMaterialRequestLineId");

            migrationBuilder.CreateIndex(
                name: "uxLegacyLineageDispositionsOpenLine",
                table: "legacylinedispositions",
                columns: new[] { "legacyLineType", "legacyLineId", "openDispositionKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "legacylinedispositions");
        }
    }
}
