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
                CREATE TEMPORARY TABLE reconciliation_batch_import_uniqueness_guard (
                    sentinel INT NOT NULL PRIMARY KEY
                );
                INSERT INTO reconciliation_batch_import_uniqueness_guard (sentinel)
                SELECT 1
                WHERE EXISTS (
                    SELECT 1
                    FROM reconciliationbatches
                    GROUP BY QuantityImportBatchId
                    HAVING COUNT(*) > 1
                );
                INSERT INTO reconciliation_batch_import_uniqueness_guard (sentinel) VALUES (1);
                DROP TEMPORARY TABLE reconciliation_batch_import_uniqueness_guard;
                """);

            migrationBuilder.CreateIndex(
                name: "ux_reconciliationbatches_quantityImportBatchId",
                table: "reconciliationbatches",
                column: "QuantityImportBatchId",
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_reconciliationbatches_QuantityImportBatchId",
                table: "reconciliationbatches");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE reconciliation_batch_import_uniqueness_rollback_guard (
                    sentinel INT NOT NULL PRIMARY KEY
                );
                INSERT INTO reconciliation_batch_import_uniqueness_rollback_guard (sentinel)
                SELECT 1
                WHERE EXISTS (
                    SELECT 1
                    FROM reconciliationbatches
                );
                INSERT INTO reconciliation_batch_import_uniqueness_rollback_guard (sentinel) VALUES (1);
                DROP TEMPORARY TABLE reconciliation_batch_import_uniqueness_rollback_guard;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatches_QuantityImportBatchId",
                table: "reconciliationbatches",
                column: "QuantityImportBatchId");

            migrationBuilder.DropIndex(
                name: "ux_reconciliationbatches_quantityImportBatchId",
                table: "reconciliationbatches");
        }
    }
}
