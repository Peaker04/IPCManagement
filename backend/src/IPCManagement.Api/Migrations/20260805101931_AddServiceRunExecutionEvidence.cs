using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRunExecutionEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "actualServingsReason",
                table: "serviceruns",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "startedAt",
                table: "serviceruns",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "startedBy",
                table: "serviceruns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "varianceResolutionReason",
                table: "serviceruns",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "varianceResolvedAt",
                table: "serviceruns",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "varianceResolvedBy",
                table: "serviceruns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_startedBy",
                table: "serviceruns",
                column: "startedBy");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_varianceResolvedBy",
                table: "serviceruns",
                column: "varianceResolvedBy");

            migrationBuilder.AddForeignKey(
                name: "fkServiceRunsStartedBy",
                table: "serviceruns",
                column: "startedBy",
                principalTable: "users",
                principalColumn: "userId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fkServiceRunsVarianceResolvedBy",
                table: "serviceruns",
                column: "varianceResolvedBy",
                principalTable: "users",
                principalColumn: "userId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fkServiceRunsStartedBy",
                table: "serviceruns");

            migrationBuilder.DropForeignKey(
                name: "fkServiceRunsVarianceResolvedBy",
                table: "serviceruns");

            migrationBuilder.DropIndex(
                name: "IX_serviceruns_startedBy",
                table: "serviceruns");

            migrationBuilder.DropIndex(
                name: "IX_serviceruns_varianceResolvedBy",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "actualServingsReason",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "startedAt",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "startedBy",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "varianceResolutionReason",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "varianceResolvedAt",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "varianceResolvedBy",
                table: "serviceruns");
        }
    }
}
