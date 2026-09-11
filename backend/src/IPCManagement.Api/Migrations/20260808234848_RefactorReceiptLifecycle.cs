using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class RefactorReceiptLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "concurrencyVersion",
                table: "inventoryreceipts",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "managerApprovalReason",
                table: "inventoryreceipts",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "managerApprovedAt",
                table: "inventoryreceipts",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "managerApprovedBy",
                table: "inventoryreceipts",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "postedAt",
                table: "inventoryreceipts",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "postedBy",
                table: "inventoryreceipts",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "qualityStatus",
                table: "inventoryreceipts",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "PENDING_INSPECTION",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "rejectedAt",
                table: "inventoryreceipts",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "rejectedBy",
                table: "inventoryreceipts",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rejectionReason",
                table: "inventoryreceipts",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "inventoryreceipts",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "DRAFT",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "acceptedQuantity",
                table: "inventoryreceiptlines",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "qualityReason",
                table: "inventoryreceiptlines",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "rejectedQuantity",
                table: "inventoryreceiptlines",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ixInventoryReceiptsLifecycle",
                table: "inventoryreceipts",
                columns: new[] { "status", "qualityStatus", "createdAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ixInventoryReceiptsLifecycle",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "concurrencyVersion",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "managerApprovalReason",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "managerApprovedAt",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "managerApprovedBy",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "postedAt",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "postedBy",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "qualityStatus",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "rejectedAt",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "rejectedBy",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "rejectionReason",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "status",
                table: "inventoryreceipts");

            migrationBuilder.DropColumn(
                name: "acceptedQuantity",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "qualityReason",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "rejectedQuantity",
                table: "inventoryreceiptlines");
        }
    }
}
