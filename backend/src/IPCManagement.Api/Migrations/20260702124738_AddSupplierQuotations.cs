using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierQuotations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "supplierquotations",
                columns: table => new
                {
                    quotationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    supplierId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    unitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    effectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    effectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    note = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    isActive = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValueSql: "'1'"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.quotationId);
                    table.ForeignKey(
                        name: "supplierquotations_ibfk_1",
                        column: x => x.supplierId,
                        principalTable: "suppliers",
                        principalColumn: "supplierId");
                    table.ForeignKey(
                        name: "supplierquotations_ibfk_2",
                        column: x => x.ingredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixSupplierQuotationsIngredient",
                table: "supplierquotations",
                column: "ingredientId");

            migrationBuilder.CreateIndex(
                name: "ixSupplierQuotationsSupplierIngredientEffective",
                table: "supplierquotations",
                columns: new[] { "supplierId", "ingredientId", "effectiveFrom" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "supplierquotations");
        }
    }
}
