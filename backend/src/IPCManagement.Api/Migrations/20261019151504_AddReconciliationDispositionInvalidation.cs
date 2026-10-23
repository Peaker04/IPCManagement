using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationDispositionInvalidation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "InvalidatedAt",
                table: "reconciliationdailydispositions",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "InvalidatedBy",
                table: "reconciliationdailydispositions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvalidationReason",
                table: "reconciliationdailydispositions",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InvalidatedAt",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropColumn(
                name: "InvalidatedBy",
                table: "reconciliationdailydispositions");

            migrationBuilder.DropColumn(
                name: "InvalidationReason",
                table: "reconciliationdailydispositions");
        }
    }
}
