using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMealQuantityPlanCompletedAndConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "mealquantityplans",
                type: "enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','COMPLETED','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.AddColumn<DateTime>(
                name: "completedAt",
                table: "mealquantityplans",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "completedBy",
                table: "mealquantityplans",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "rowVersion",
                table: "mealquantityplans",
                type: "timestamp(6)",
                rowVersion: true,
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP(6)");

            migrationBuilder.CreateIndex(
                name: "IX_mealquantityplans_completedBy",
                table: "mealquantityplans",
                column: "completedBy");

            migrationBuilder.AddForeignKey(
                name: "mealquantityplans_ibfk_3",
                table: "mealquantityplans",
                column: "completedBy",
                principalTable: "users",
                principalColumn: "userId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "mealquantityplans_ibfk_3",
                table: "mealquantityplans");

            migrationBuilder.DropIndex(
                name: "IX_mealquantityplans_completedBy",
                table: "mealquantityplans");

            migrationBuilder.DropColumn(
                name: "completedAt",
                table: "mealquantityplans");

            migrationBuilder.DropColumn(
                name: "completedBy",
                table: "mealquantityplans");

            migrationBuilder.DropColumn(
                name: "rowVersion",
                table: "mealquantityplans");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "mealquantityplans",
                type: "enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','COMPLETED','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }
    }
}
