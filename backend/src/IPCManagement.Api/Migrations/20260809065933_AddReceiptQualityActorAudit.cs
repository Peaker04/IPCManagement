using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptQualityActorAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "qualityCheckedAt",
                table: "inventoryreceipts",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "qualityCheckedBy",
                table: "inventoryreceipts",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "qualityCheckedAt",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "qualityCheckedBy",
                table: "inventoryreceipts");
        }
    }
}
