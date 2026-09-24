using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationBatchSupersession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReplacementReason",
                table: "reconciliationbatches",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<byte[]>(
                name: "SupersedesBatchId",
                table: "reconciliationbatches",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_reconciliationbatches_supersedesBatchId",
                table: "reconciliationbatches",
                column: "SupersedesBatchId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationbatches_reconciliationbatches_SupersedesBatchId",
                table: "reconciliationbatches",
                column: "SupersedesBatchId",
                principalTable: "reconciliationbatches",
                principalColumn: "BatchId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationbatches_reconciliationbatches_SupersedesBatchId",
                table: "reconciliationbatches");

            migrationBuilder.DropIndex(
                name: "ux_reconciliationbatches_supersedesBatchId",
                table: "reconciliationbatches");

            migrationBuilder.DropColumn(
                name: "ReplacementReason",
                table: "reconciliationbatches");

            migrationBuilder.DropColumn(
                name: "SupersedesBatchId",
                table: "reconciliationbatches");
        }
    }
}
