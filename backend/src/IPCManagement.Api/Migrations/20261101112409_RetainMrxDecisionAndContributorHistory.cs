using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class RetainMrxDecisionAndContributorHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "InvalidatedAt",
                table: "reconciliationbatchcontributors",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "InvalidatedBySourceRevisionId",
                table: "reconciliationbatchcontributors",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_DailyLineId_InvalidatedAt",
                table: "reconciliationbatchcontributors",
                columns: new[] { "DailyLineId", "InvalidatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_InvalidatedBySourceRevisionId",
                table: "reconciliationbatchcontributors",
                column: "InvalidatedBySourceRevisionId");

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationbatchcontributors_reconciliationsourcerevision~",
                table: "reconciliationbatchcontributors",
                column: "InvalidatedBySourceRevisionId",
                principalTable: "reconciliationsourcerevisions",
                principalColumn: "SourceRevisionId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_BatchLineId_FkSupport",
                table: "reconciliationdispositions",
                column: "BatchLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId_FkSupport",
                table: "reconciliationdailydispositions",
                column: "DailyLineId");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdispositions_BatchLineId",
                table: "reconciliationdispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId",
                table: "reconciliationdailydispositions");

            migrationBuilder.AddColumn<DateTime>(
                name: "InvalidatedAt",
                table: "reconciliationdispositions",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "InvalidatedBy",
                table: "reconciliationdispositions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvalidationReason",
                table: "reconciliationdispositions",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<byte[]>(
                name: "ActiveOwnerKey",
                table: "reconciliationdispositions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                computedColumnSql: "CASE WHEN `InvalidatedAt` IS NULL THEN `BatchLineId` ELSE NULL END",
                stored: false);

            migrationBuilder.AddColumn<byte[]>(
                name: "ActiveOwnerKey",
                table: "reconciliationdailydispositions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                computedColumnSql: "CASE WHEN `InvalidatedAt` IS NULL THEN `DailyLineId` ELSE NULL END",
                stored: false);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_ActiveOwnerKey",
                table: "reconciliationdispositions",
                column: "ActiveOwnerKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_BatchLineId",
                table: "reconciliationdispositions",
                column: "BatchLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdailydispositions_ActiveOwnerKey",
                table: "reconciliationdailydispositions",
                column: "ActiveOwnerKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId",
                table: "reconciliationdailydispositions",
                column: "DailyLineId");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdispositions_BatchLineId_FkSupport",
                table: "reconciliationdispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId_FkSupport",
                table: "reconciliationdailydispositions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_BatchLineId_FkSupport",
                table: "reconciliationdispositions",
                column: "BatchLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId_FkSupport",
                table: "reconciliationdailydispositions",
                column: "DailyLineId");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdispositions_ActiveOwnerKey",
                table: "reconciliationdispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdispositions_BatchLineId",
                table: "reconciliationdispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdailydispositions_ActiveOwnerKey",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropColumn(
                name: "ActiveOwnerKey",
                table: "reconciliationdispositions");

            migrationBuilder.DropColumn(
                name: "ActiveOwnerKey",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropColumn(
                name: "InvalidatedAt",
                table: "reconciliationdispositions");

            migrationBuilder.DropColumn(
                name: "InvalidatedBy",
                table: "reconciliationdispositions");

            migrationBuilder.DropColumn(
                name: "InvalidationReason",
                table: "reconciliationdispositions");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_BatchLineId",
                table: "reconciliationdispositions",
                column: "BatchLineId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId",
                table: "reconciliationdailydispositions",
                column: "DailyLineId",
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdispositions_BatchLineId_FkSupport",
                table: "reconciliationdispositions");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationdailydispositions_DailyLineId_FkSupport",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationbatchcontributors_reconciliationsourcerevision~",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationbatchcontributors_DailyLineId_InvalidatedAt",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationbatchcontributors_InvalidatedBySourceRevisionId",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "InvalidatedAt",
                table: "reconciliationbatchcontributors");

            migrationBuilder.DropColumn(
                name: "InvalidatedBySourceRevisionId",
                table: "reconciliationbatchcontributors");
        }
    }
}
