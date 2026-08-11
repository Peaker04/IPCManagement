using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReceiptPostCorrections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "receiptcorrections",
                columns: table => new
                {
                    correctionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    receiptId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    correctionCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    commandId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "POSTED", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    concurrencyVersion = table.Column<long>(type: "bigint", nullable: false, defaultValue: 1L)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.correctionId);
                    table.CheckConstraint("ckReceiptCorrectionsStatus", "`status` = 'POSTED'");
                    table.ForeignKey(
                        name: "receiptcorrections_ibfk_1",
                        column: x => x.receiptId,
                        principalTable: "inventoryreceipts",
                        principalColumn: "receiptId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "receiptcorrections_ibfk_2",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "receiptcorrectionlines",
                columns: table => new
                {
                    correctionLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    correctionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    receiptLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    sourceLotNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceManufactureDate = table.Column<DateOnly>(type: "date", nullable: true),
                    sourceExpiredDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.correctionLineId);
                    table.CheckConstraint("ckReceiptCorrectionLinesQuantity", "`quantity` > 0");
                    table.ForeignKey(
                        name: "receiptcorrectionlines_ibfk_1",
                        column: x => x.correctionId,
                        principalTable: "receiptcorrections",
                        principalColumn: "correctionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "receiptcorrectionlines_ibfk_2",
                        column: x => x.receiptLineId,
                        principalTable: "inventoryreceiptlines",
                        principalColumn: "receiptLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "receiptcorrectionlines_ibfk_3",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "receiptcorrectionlines_ibfk_4",
                        column: x => x.unitId,
                        principalTable: "units",
                        principalColumn: "unitId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_receiptcorrectionlines_ingredientId",
                table: "receiptcorrectionlines",
                column: "ingredientId");

            migrationBuilder.CreateIndex(
                name: "IX_receiptcorrectionlines_unitId",
                table: "receiptcorrectionlines",
                column: "unitId");

            migrationBuilder.CreateIndex(
                name: "ixReceiptCorrectionLinesCorrection",
                table: "receiptcorrectionlines",
                column: "correctionId");

            migrationBuilder.CreateIndex(
                name: "ixReceiptCorrectionLinesReceiptLine",
                table: "receiptcorrectionlines",
                column: "receiptLineId");

            migrationBuilder.CreateIndex(
                name: "IX_receiptcorrections_createdBy",
                table: "receiptcorrections",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "ixReceiptCorrectionsReceipt",
                table: "receiptcorrections",
                column: "receiptId");

            migrationBuilder.CreateIndex(
                name: "uqReceiptCorrectionsCode",
                table: "receiptcorrections",
                column: "correctionCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uqReceiptCorrectionsCommand",
                table: "receiptcorrections",
                column: "commandId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "receiptcorrectionlines");

            migrationBuilder.DropTable(
                name: "receiptcorrections");
        }
    }
}
