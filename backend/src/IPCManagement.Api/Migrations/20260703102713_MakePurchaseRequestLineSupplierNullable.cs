using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MakePurchaseRequestLineSupplierNullable : Migration
    {
        /// <inheritdoc />
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "supplierId",
                table: "purchaserequestlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16,
                oldNullable: true);
        }
    }
}
