using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnforceSingleOperationalWarehouse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOperationalActive",
                table: "warehouses",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OperationalSingletonKey",
                table: "warehouses",
                type: "int",
                nullable: true,
                computedColumnSql: "CASE WHEN IsOperationalActive THEN 1 ELSE NULL END",
                stored: false);

            migrationBuilder.CreateIndex(
                name: "uqWarehousesOperationalSingleton",
                table: "warehouses",
                column: "OperationalSingletonKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uqWarehousesOperationalSingleton",
                table: "warehouses");

            migrationBuilder.DropColumn(
                name: "OperationalSingletonKey",
                table: "warehouses");

            migrationBuilder.DropColumn(
                name: "IsOperationalActive",
                table: "warehouses");
        }
    }
}
