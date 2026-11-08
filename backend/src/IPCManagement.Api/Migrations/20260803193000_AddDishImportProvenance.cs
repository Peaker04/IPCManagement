using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260803193000_AddDishImportProvenance")]
public partial class AddDishImportProvenance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "sourceImportBatch",
            table: "dishes",
            type: "varchar(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "sourceFileName",
            table: "dishes",
            type: "varchar(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "sourceChecksum",
            table: "dishes",
            type: "char(64)",
            fixedLength: true,
            maxLength: 64,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "sourceImportBatch", table: "dishes");
        migrationBuilder.DropColumn(name: "sourceFileName", table: "dishes");
        migrationBuilder.DropColumn(name: "sourceChecksum", table: "dishes");
    }
}
