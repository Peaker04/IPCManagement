using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessEvidenceClosure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "businessevidencepackages",
                columns: table => new
                {
                    packageId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    schemaVersion = table.Column<int>(type: "int", nullable: false),
                    issueType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    subjectId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    sourceFingerprint = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    manifestUtf8 = table.Column<byte[]>(type: "longblob", nullable: false),
                    manifestSha256 = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceDatabase = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    migrationHead = table.Column<string>(type: "varchar(180)", maxLength: 180, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    decision = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    outcomeEntityType = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    outcomeEntityId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    commandId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAtUtc = table.Column<DateTime>(type: "datetime", nullable: false),
                    expiresAtUtc = table.Column<DateTime>(type: "datetime", nullable: true),
                    version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.packageId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "businessevidenceattestations",
                columns: table => new
                {
                    attestationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    packageId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    authoritySlot = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actorId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    authorityReference = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    authoritySha256 = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    manifestSha256 = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    attestedAtUtc = table.Column<DateTime>(type: "datetime", nullable: false),
                    expiresAtUtc = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.attestationId);
                    table.ForeignKey(
                        name: "fkBusinessEvidenceAttestationPackage",
                        column: x => x.packageId,
                        principalTable: "businessevidencepackages",
                        principalColumn: "packageId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "uqBusinessEvidenceAttestationSlot",
                table: "businessevidenceattestations",
                columns: new[] { "packageId", "authoritySlot" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixBusinessEvidencePackageSubjectFingerprint",
                table: "businessevidencepackages",
                columns: new[] { "issueType", "subjectId", "sourceFingerprint" });

            migrationBuilder.CreateIndex(
                name: "uqBusinessEvidencePackageCommand",
                table: "businessevidencepackages",
                column: "commandId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE `_phase42_evidence_down_guard`
                (
                    `must_be_zero` INT NOT NULL,
                    CONSTRAINT `ckPhase42EvidenceDownEmpty` CHECK (`must_be_zero` = 0)
                );
                INSERT INTO `_phase42_evidence_down_guard` (`must_be_zero`)
                SELECT
                    (SELECT COUNT(*) FROM `businessevidencepackages`) +
                    (SELECT COUNT(*) FROM `businessevidenceattestations`);
                DROP TEMPORARY TABLE `_phase42_evidence_down_guard`;
                """);

            migrationBuilder.DropTable(
                name: "businessevidenceattestations");

            migrationBuilder.DropTable(
                name: "businessevidencepackages");
        }
    }
}
