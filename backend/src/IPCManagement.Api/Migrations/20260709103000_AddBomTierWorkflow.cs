using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260709103000_AddBomTierWorkflow")]
    public partial class AddBomTierWorkflow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "customerId",
                table: "dishbom",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "priceTierAmount",
                table: "dishbom",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 25000m);

            migrationBuilder.AddColumn<byte[]>(
                name: "bomId",
                table: "materialrequestlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bomScope",
                table: "materialrequestlines",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "global")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "priceTierAmount",
                table: "materialrequestlines",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 25000m);

            migrationBuilder.AddColumn<DateTime>(
                name: "sentToKitchenAt",
                table: "productionplans",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "sentToKitchenBy",
                table: "productionplans",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "customerId",
                table: "dishbom",
                column: "customerId");

            migrationBuilder.CreateIndex(
                name: "ixDishBomTierEffective",
                table: "dishbom",
                columns: new[] { "dishId", "customerId", "priceTierAmount", "effectiveFrom", "effectiveTo" });

            migrationBuilder.CreateIndex(
                name: "bomId",
                table: "materialrequestlines",
                column: "bomId");

            migrationBuilder.CreateIndex(
                name: "sentToKitchenBy",
                table: "productionplans",
                column: "sentToKitchenBy");

            migrationBuilder.AddForeignKey(
                name: "dishbom_ibfk_4",
                table: "dishbom",
                column: "customerId",
                principalTable: "customers",
                principalColumn: "customerId",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "materialrequestlines_ibfk_5",
                table: "materialrequestlines",
                column: "bomId",
                principalTable: "dishbom",
                principalColumn: "bomId",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "productionplans_ibfk_4",
                table: "productionplans",
                column: "sentToKitchenBy",
                principalTable: "users",
                principalColumn: "userId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "dishbom_ibfk_4", table: "dishbom");
            migrationBuilder.DropForeignKey(name: "materialrequestlines_ibfk_5", table: "materialrequestlines");
            migrationBuilder.DropForeignKey(name: "productionplans_ibfk_4", table: "productionplans");

            migrationBuilder.DropIndex(name: "customerId", table: "dishbom");
            migrationBuilder.DropIndex(name: "ixDishBomTierEffective", table: "dishbom");
            migrationBuilder.DropIndex(name: "bomId", table: "materialrequestlines");
            migrationBuilder.DropIndex(name: "sentToKitchenBy", table: "productionplans");

            migrationBuilder.DropColumn(name: "customerId", table: "dishbom");
            migrationBuilder.DropColumn(name: "priceTierAmount", table: "dishbom");
            migrationBuilder.DropColumn(name: "bomId", table: "materialrequestlines");
            migrationBuilder.DropColumn(name: "bomScope", table: "materialrequestlines");
            migrationBuilder.DropColumn(name: "priceTierAmount", table: "materialrequestlines");
            migrationBuilder.DropColumn(name: "sentToKitchenAt", table: "productionplans");
            migrationBuilder.DropColumn(name: "sentToKitchenBy", table: "productionplans");
        }
    }
}
