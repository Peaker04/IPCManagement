using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationFrozenKitchenCookingFacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "DishId",
                table: "reconciliationbatchcontributors",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FrozenBomQuantityPerServing",
                table: "reconciliationbatchcontributors",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FrozenDishCode",
                table: "reconciliationbatchcontributors",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FrozenDishName",
                table: "reconciliationbatchcontributors",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "FrozenServings",
                table: "reconciliationbatchcontributors",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FrozenShiftName",
                table: "reconciliationbatchcontributors",
                type: "varchar(32)",
                maxLength: 32,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "FrozenWasteRatePercent",
                table: "reconciliationbatchcontributors",
                type: "decimal(9,4)",
                precision: 9,
                scale: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DishId",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenBomQuantityPerServing",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenDishCode",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenDishName",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenServings",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenShiftName",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenWasteRatePercent",
                table: "reconciliationbatchcontributors");
        }
    }
}
