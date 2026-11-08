using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class HardenReconciliationSystemDefaultTolerance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MySQL DDL autocommits. Keep every hardening operation in one atomic ALTER TABLE so
            // invalid legacy rows or duplicate defaults cannot leave a partially modified schema.
            migrationBuilder.Sql("""
                ALTER TABLE `reconciliationtolerances`
                    ADD `SystemDefaultKey` tinyint unsigned AS (CASE WHEN `ScopeKind` = 'SYSTEM_DEFAULT' THEN 1 ELSE NULL END) NULL,
                    ADD UNIQUE INDEX `IX_reconciliationtolerances_SystemDefaultKey` (`SystemDefaultKey`),
                    ADD CONSTRAINT `ckReconciliationToleranceScope` CHECK ((`ScopeKind` = 'SYSTEM_DEFAULT' AND `ScopeId` IS NULL) OR (`ScopeKind` IN ('INGREDIENT','UNIT_GROUP') AND `ScopeId` IS NOT NULL)),
                    ADD CONSTRAINT `ckReconciliationToleranceValue` CHECK (`Value` >= 0),
                    ADD CONSTRAINT `ckReconciliationToleranceVersion` CHECK (`Version` >= 1);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE `reconciliationtolerances`
                    DROP INDEX `IX_reconciliationtolerances_SystemDefaultKey`,
                    DROP CHECK `ckReconciliationToleranceScope`,
                    DROP CHECK `ckReconciliationToleranceValue`,
                    DROP CHECK `ckReconciliationToleranceVersion`,
                    DROP COLUMN `SystemDefaultKey`;
                """);
        }
    }
}
