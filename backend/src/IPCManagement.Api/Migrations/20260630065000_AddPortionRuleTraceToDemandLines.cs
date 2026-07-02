using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260630065000_AddPortionRuleTraceToDemandLines")]
    public partial class AddPortionRuleTraceToDemandLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "appliedPortionRuleId",
                table: "materialrequestlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "appliedPortionRatePercent",
                table: "materialrequestlines",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValueSql: "'100.00'");

            migrationBuilder.AddColumn<string>(
                name: "appliedPortionRuleSource",
                table: "materialrequestlines",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValueSql: "'CONTRACT_DEFAULT'",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "yieldLossPercent",
                table: "materialrequestlines",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "appliedPortionRuleId",
                table: "materialrequestlines",
                column: "appliedPortionRuleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "appliedPortionRuleId",
                table: "materialrequestlines");

            migrationBuilder.DropColumn(
                name: "appliedPortionRuleId",
                table: "materialrequestlines");

            migrationBuilder.DropColumn(
                name: "appliedPortionRatePercent",
                table: "materialrequestlines");

            migrationBuilder.DropColumn(
                name: "appliedPortionRuleSource",
                table: "materialrequestlines");

            migrationBuilder.DropColumn(
                name: "yieldLossPercent",
                table: "materialrequestlines");
        }
    }
}
