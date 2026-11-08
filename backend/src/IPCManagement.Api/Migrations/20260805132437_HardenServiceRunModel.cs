using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class HardenServiceRunModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "servingVarianceResolutionReason",
                table: "serviceruns",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "servingVarianceResolvedAt",
                table: "serviceruns",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "servingVarianceResolvedBy",
                table: "serviceruns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_servingVarianceResolvedBy",
                table: "serviceruns",
                column: "servingVarianceResolvedBy");

            migrationBuilder.AddCheckConstraint(
                name: "ckServiceRunsConfirmationOutcome",
                table: "serviceruns",
                sql: "`serviceConfirmedAt` IS NULL OR `serviceConfirmationWaivedAt` IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ckServiceRunsConfirmationPolicy",
                table: "serviceruns",
                sql: "`serviceConfirmationPolicy` IN ('REQUIRED', 'WAIVABLE')");

            migrationBuilder.AddForeignKey(
                name: "fkServiceRunsServingVarianceResolvedBy",
                table: "serviceruns",
                column: "servingVarianceResolvedBy",
                principalTable: "users",
                principalColumn: "userId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fkServiceRunsServingVarianceResolvedBy",
                table: "serviceruns");

            migrationBuilder.DropIndex(
                name: "IX_serviceruns_servingVarianceResolvedBy",
                table: "serviceruns");

            migrationBuilder.DropCheckConstraint(
                name: "ckServiceRunsConfirmationOutcome",
                table: "serviceruns");

            migrationBuilder.DropCheckConstraint(
                name: "ckServiceRunsConfirmationPolicy",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "servingVarianceResolutionReason",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "servingVarianceResolvedAt",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "servingVarianceResolvedBy",
                table: "serviceruns");
        }
    }
}
