using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AllowSupplementalReconciliationIssues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            ReplaceIndex(migrationBuilder, "inventoryissues", "uxInventoryIssuesReconciliationBatch", "ixInventoryIssuesReconciliationBatch", "reconciliationBatchId", unique: false);
            ReplaceIndex(migrationBuilder, "inventoryissuelines", "uxInventoryIssueLinesReconciliationBatchLine", "ixInventoryIssueLinesReconciliationBatchLine", "reconciliationBatchLineId", unique: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            ReplaceIndex(migrationBuilder, "inventoryissues", "ixInventoryIssuesReconciliationBatch", "uxInventoryIssuesReconciliationBatch", "reconciliationBatchId", unique: true);
            ReplaceIndex(migrationBuilder, "inventoryissuelines", "ixInventoryIssueLinesReconciliationBatchLine", "uxInventoryIssueLinesReconciliationBatchLine", "reconciliationBatchLineId", unique: true);
        }

        private static void ReplaceIndex(MigrationBuilder migrationBuilder, string table, string oldName, string newName, string column, bool unique)
        {
            migrationBuilder.Sql($"""
                SET @create_index = IF(
                    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '{table}' AND index_name = '{newName}'),
                    'SELECT 1',
                    'CREATE {(unique ? "UNIQUE " : string.Empty)}INDEX `{newName}` ON `{table}` (`{column}`)');
                PREPARE create_statement FROM @create_index;
                EXECUTE create_statement;
                DEALLOCATE PREPARE create_statement;
                SET @drop_index = IF(
                    EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '{table}' AND index_name = '{oldName}'),
                    'ALTER TABLE `{table}` DROP INDEX `{oldName}`',
                    'SELECT 1');
                PREPARE drop_statement FROM @drop_index;
                EXECUTE drop_statement;
                DEALLOCATE PREPARE drop_statement;
                """);
        }
    }
}
