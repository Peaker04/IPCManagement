using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReceivedToInventoryReturn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "receivedAt",
                table: "inventoryreturns",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "receivedBy",
                table: "inventoryreturns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventoryreturns_receivedBy",
                table: "inventoryreturns",
                column: "receivedBy");

            migrationBuilder.AddForeignKey(
                name: "inventoryreturns_ibfk_4",
                table: "inventoryreturns",
                column: "receivedBy",
                principalTable: "users",
                principalColumn: "userId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryreturns_ibfk_4",
                table: "inventoryreturns");

            migrationBuilder.DropIndex(
                name: "IX_inventoryreturns_receivedBy",
                table: "inventoryreturns");

            migrationBuilder.DropColumn(
                name: "receivedAt",
                table: "inventoryreturns");

            migrationBuilder.DropColumn(
                name: "receivedBy",
                table: "inventoryreturns");
        }
    }
}
