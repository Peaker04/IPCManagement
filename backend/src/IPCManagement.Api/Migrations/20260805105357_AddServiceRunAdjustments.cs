using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRunAdjustments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "servicerunadjustments",
                columns: table => new
                {
                    serviceRunAdjustmentId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    serviceRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    correctedActualServings = table.Column<int>(type: "int", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunAdjustmentId);
                    table.ForeignKey(
                        name: "fkServiceRunAdjustmentsCreatedBy",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunAdjustmentsRun",
                        column: x => x.serviceRunId,
                        principalTable: "serviceruns",
                        principalColumn: "serviceRunId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_servicerunadjustments_createdBy",
                table: "servicerunadjustments",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "ixServiceRunAdjustmentsRunCreatedAt",
                table: "servicerunadjustments",
                columns: new[] { "serviceRunId", "createdAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "servicerunadjustments");
        }
    }
}
