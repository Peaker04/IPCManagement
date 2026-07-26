using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260702121000_AddProductionPlanMetadata")]
    public partial class AddProductionPlanMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "customerId",
                table: "productionplans",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "menuVersionId",
                table: "productionplans",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "weekStartDate",
                table: "productionplans",
                type: "date",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "customerId",
                table: "productionplans",
                column: "customerId");

            migrationBuilder.CreateIndex(
                name: "menuVersionId",
                table: "productionplans",
                column: "menuVersionId");

            migrationBuilder.AddForeignKey(
                name: "productionplans_ibfk_2",
                table: "productionplans",
                column: "customerId",
                principalTable: "customers",
                principalColumn: "customerId");

            migrationBuilder.AddForeignKey(
                name: "productionplans_ibfk_3",
                table: "productionplans",
                column: "menuVersionId",
                principalTable: "menuversions",
                principalColumn: "menuVersionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "productionplans_ibfk_2",
                table: "productionplans");

            migrationBuilder.DropForeignKey(
                name: "productionplans_ibfk_3",
                table: "productionplans");

            migrationBuilder.DropIndex(
                name: "customerId",
                table: "productionplans");

            migrationBuilder.DropIndex(
                name: "menuVersionId",
                table: "productionplans");

            migrationBuilder.DropColumn(
                name: "customerId",
                table: "productionplans");

            migrationBuilder.DropColumn(
                name: "menuVersionId",
                table: "productionplans");

            migrationBuilder.DropColumn(
                name: "weekStartDate",
                table: "productionplans");
        }
    }
}
