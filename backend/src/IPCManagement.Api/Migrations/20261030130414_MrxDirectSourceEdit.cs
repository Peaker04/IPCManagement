using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MrxDirectSourceEdit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AppliedByRole",
                table: "reconciliationsourcerevisions",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ApplyMode",
                table: "reconciliationsourcerevisions",
                type: "varchar(24)",
                maxLength: 24,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FrozenMenuVariant",
                table: "reconciliationbatchcontributors",
                type: "varchar(16)",
                maxLength: 16,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "savoryServings",
                table: "mealquantityplanlines",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "vegetarianServings",
                table: "mealquantityplanlines",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventoryissues_reconciliationBatchId_issueDate",
                table: "inventoryissues",
                columns: new[] { "reconciliationBatchId", "issueDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_inventoryissues_reconciliationBatchId_issueDate",
                table: "inventoryissues");

            migrationBuilder.DropColumn(
                name: "AppliedByRole",
                table: "reconciliationsourcerevisions");

            migrationBuilder.DropColumn(
                name: "ApplyMode",
                table: "reconciliationsourcerevisions");

            migrationBuilder.DropColumn(
                name: "FrozenMenuVariant",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "savoryServings",
                table: "mealquantityplanlines");

            migrationBuilder.DropColumn(
                name: "vegetarianServings",
                table: "mealquantityplanlines");
        }
    }
}
