using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260722160000_MakePurchaseRequestLineSupplierOptional")]
public partial class MakePurchaseRequestLineSupplierOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<byte[]>(
            name: "supplierId",
            table: "purchaserequestlines",
            type: "binary(16)",
            fixedLength: true,
            maxLength: 16,
            nullable: true,
            oldClrType: typeof(byte[]),
            oldType: "binary(16)",
            oldFixedLength: true,
            oldMaxLength: 16);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<byte[]>(
            name: "supplierId",
            table: "purchaserequestlines",
            type: "binary(16)",
            fixedLength: true,
            maxLength: 16,
            nullable: false,
            oldClrType: typeof(byte[]),
            oldType: "binary(16)",
            oldFixedLength: true,
            oldMaxLength: 16,
            oldNullable: true);
    }
}
