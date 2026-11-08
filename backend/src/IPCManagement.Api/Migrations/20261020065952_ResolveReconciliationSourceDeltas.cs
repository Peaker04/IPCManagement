using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class ResolveReconciliationSourceDeltas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ResolutionCommandId",
                table: "reconciliationsourcedeltas",
                type: "varchar(128)",
                maxLength: 128,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ResolutionEntity",
                table: "reconciliationsourcedeltas",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<byte[]>(
                name: "ResolutionId",
                table: "reconciliationsourcedeltas",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ResolvedBy",
                table: "reconciliationsourcedeltas",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "reconciliationSourceDeltaId",
                table: "inventoryreturns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "reconciliationSourceDeltaVersion",
                table: "inventoryreturns",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResolutionCommandId",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropColumn(
                name: "ResolutionEntity",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropColumn(
                name: "ResolutionId",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropColumn(
                name: "ResolvedBy",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropColumn(
                name: "reconciliationSourceDeltaId",
                table: "inventoryreturns");

            migrationBuilder.DropColumn(
                name: "reconciliationSourceDeltaVersion",
                table: "inventoryreturns");
        }
    }
}
