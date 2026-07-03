using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260703100000_AddStockMovementQuantitySnapshots")]
    public partial class AddStockMovementQuantitySnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "beforeQty",
                table: "stockmovements",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValueSql: "0.000000");

            migrationBuilder.AddColumn<decimal>(
                name: "afterQty",
                table: "stockmovements",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: false,
                defaultValueSql: "0.000000");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "afterQty", table: "stockmovements");
            migrationBuilder.DropColumn(name: "beforeQty", table: "stockmovements");
        }
    }
}
