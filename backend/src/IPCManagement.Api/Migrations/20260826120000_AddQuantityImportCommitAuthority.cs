using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuantityImportCommitAuthority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "contentFingerprint",
                table: "quantityimportbatches",
                type: "char(64)",
                fixedLength: true,
                maxLength: 64,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "fingerprintFormatVersion",
                table: "quantityimportbatches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "menuVersionId",
                table: "quantityimportbatches",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sourceLabel",
                table: "quantityimportbatches",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "menuVersionId1",
                table: "quantityimportbatches",
                column: "menuVersionId");

            migrationBuilder.CreateIndex(
                name: "ux_quantityimportbatches_contentFingerprint",
                table: "quantityimportbatches",
                column: "contentFingerprint",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "quantityimportbatches_ibfk_2",
                table: "quantityimportbatches",
                column: "menuVersionId",
                principalTable: "menuversions",
                principalColumn: "menuVersionId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE quantity_import_authority_rollback_guard (allowed INT NOT NULL);
                INSERT INTO quantity_import_authority_rollback_guard (allowed)
                SELECT NULL
                FROM quantityimportbatches q
                WHERE q.menuVersionId IS NOT NULL
                   OR q.contentFingerprint IS NOT NULL
                   OR q.fingerprintFormatVersion IS NOT NULL
                LIMIT 1;
                DROP TEMPORARY TABLE quantity_import_authority_rollback_guard;
                """);

            migrationBuilder.DropForeignKey(
                name: "quantityimportbatches_ibfk_2",
                table: "quantityimportbatches");

            migrationBuilder.DropIndex(
                name: "menuVersionId1",
                table: "quantityimportbatches");

            migrationBuilder.DropIndex(
                name: "ux_quantityimportbatches_contentFingerprint",
                table: "quantityimportbatches");

            migrationBuilder.DropColumn(
                name: "contentFingerprint",
                table: "quantityimportbatches");

            migrationBuilder.DropColumn(
                name: "fingerprintFormatVersion",
                table: "quantityimportbatches");

            migrationBuilder.DropColumn(
                name: "menuVersionId",
                table: "quantityimportbatches");

            migrationBuilder.DropColumn(
                name: "sourceLabel",
                table: "quantityimportbatches");
        }
    }
}
