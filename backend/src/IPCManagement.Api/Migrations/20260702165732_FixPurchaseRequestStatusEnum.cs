using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixPurchaseRequestStatusEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "purchaserequests",
                type: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','SENTTOSUPPLIER','PARTIALRECEIVED','RECEIVED','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "purchaserequests",
                type: "enum('DRAFT','SENTTOSUPPLIER','PARTIALRECEIVED','RECEIVED','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }
    }
}
