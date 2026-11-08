using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FreezeMrxBomConversionRates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FrozenBomUnitToBaseRate",
                table: "reconciliationbatchcontributors",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FrozenCanonicalUnitToBaseRate",
                table: "reconciliationbatchcontributors",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FrozenBomUnitToBaseRate",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "FrozenCanonicalUnitToBaseRate",
                table: "reconciliationbatchcontributors");
        }
    }
}
