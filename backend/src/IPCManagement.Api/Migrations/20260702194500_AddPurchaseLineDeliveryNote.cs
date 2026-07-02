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
    [Migration("20260702194500_AddPurchaseLineDeliveryNote")]
    public partial class AddPurchaseLineDeliveryNote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "expectedDeliveryDate",
                table: "purchaserequestlines",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "note",
                table: "purchaserequestlines",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "expectedDeliveryDate",
                table: "purchaserequestlines");

            migrationBuilder.DropColumn(
                name: "note",
                table: "purchaserequestlines");
        }
    }
}
