using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260630161000_AddBomVersionStatus")]
    public partial class AddBomVersionStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "bomStatus",
                table: "dishbom",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValueSql: "'PUBLISHED'",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "bomStatus",
                table: "dishbom");
        }
    }
}
