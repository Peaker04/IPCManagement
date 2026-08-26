using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnforceReconciliationBatchImportUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE reconciliation_batch_import_uniqueness_guard (allowed INT NOT NULL);
                INSERT INTO reconciliation_batch_import_uniqueness_guard (allowed)
                SELECT NULL
                FROM reconciliationbatches
                GROUP BY QuantityImportBatchId
                HAVING COUNT(*) > 1
                LIMIT 1;
                DROP TEMPORARY TABLE reconciliation_batch_import_uniqueness_guard;
                """);

            migrationBuilder.DropIndex(
                name: "IX_reconciliationbatches_QuantityImportBatchId",
                table: "reconciliationbatches");

            migrationBuilder.CreateIndex(
                name: "ux_reconciliationbatches_quantityImportBatchId",
                table: "reconciliationbatches",
                column: "QuantityImportBatchId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE reconciliation_batch_import_uniqueness_rollback_guard (allowed INT NOT NULL);
                INSERT INTO reconciliation_batch_import_uniqueness_rollback_guard (allowed)
                SELECT NULL
                FROM reconciliationbatches
                LIMIT 1;
                DROP TEMPORARY TABLE reconciliation_batch_import_uniqueness_rollback_guard;
                """);

            migrationBuilder.DropIndex(
                name: "ux_reconciliationbatches_quantityImportBatchId",
                table: "reconciliationbatches");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatches_QuantityImportBatchId",
                table: "reconciliationbatches",
                column: "QuantityImportBatchId");
        }
    }
}
