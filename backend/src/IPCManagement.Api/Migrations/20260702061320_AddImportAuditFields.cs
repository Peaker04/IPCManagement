using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddImportAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "menuVersionId",
                table: "menuschedules",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "updatedAt",
                table: "mealquantityplanlines",
                type: "datetime",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<int>(
                name: "successRowCount",
                table: "menuversions",
                type: "int",
                nullable: false,
                defaultValueSql: "'0'");

            migrationBuilder.AddColumn<int>(
                name: "errorRowCount",
                table: "menuversions",
                type: "int",
                nullable: false,
                defaultValueSql: "'0'");

            migrationBuilder.AddColumn<int>(
                name: "warningRowCount",
                table: "menuversions",
                type: "int",
                nullable: false,
                defaultValueSql: "'0'");

            migrationBuilder.CreateIndex(
                name: "IX_menuschedules_menuVersionId",
                table: "menuschedules",
                column: "menuVersionId");

            migrationBuilder.AddForeignKey(
                name: "menuschedules_ibfk_3",
                table: "menuschedules",
                column: "menuVersionId",
                principalTable: "menuversions",
                principalColumn: "menuVersionId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "menuschedules_ibfk_3",
                table: "menuschedules");

            migrationBuilder.DropIndex(
                name: "IX_menuschedules_menuVersionId",
                table: "menuschedules");

            migrationBuilder.DropColumn(
                name: "menuVersionId",
                table: "menuschedules");

            migrationBuilder.DropColumn(
                name: "updatedAt",
                table: "mealquantityplanlines");

            migrationBuilder.DropColumn(
                name: "successRowCount",
                table: "menuversions");

            migrationBuilder.DropColumn(
                name: "errorRowCount",
                table: "menuversions");

            migrationBuilder.DropColumn(
                name: "warningRowCount",
                table: "menuversions");
        }
    }
}
