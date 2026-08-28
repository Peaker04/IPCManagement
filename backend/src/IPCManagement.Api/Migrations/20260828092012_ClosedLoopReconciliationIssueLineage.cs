using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class ClosedLoopReconciliationIssueLineage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryissues_ibfk_2",
                table: "inventoryissues");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationBatchStatus",
                table: "reconciliationbatches");

            migrationBuilder.AlterColumn<byte[]>(
                name: "materialRequestId",
                table: "inventoryissues",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16);

            migrationBuilder.AddColumn<byte[]>(
                name: "reconciliationBatchId",
                table: "inventoryissues",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "reconciliationBatchLineId",
                table: "inventoryissuelines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationBatchStatus",
                table: "reconciliationbatches",
                sql: "`status` IN ('DRAFT','READY','TRANSFERRED','IN_PROGRESS','COMPLETED')");

            migrationBuilder.CreateIndex(
                name: "ixInventoryIssuesReconciliationBatch",
                table: "inventoryissues",
                column: "reconciliationBatchId");

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryIssuesSourceFamily",
                table: "inventoryissues",
                sql: "(`materialRequestId` IS NOT NULL AND `reconciliationBatchId` IS NULL) OR (`materialRequestId` IS NULL AND `reconciliationBatchId` IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "uxInventoryIssueLinesReconciliationBatchLine",
                table: "inventoryissuelines",
                column: "reconciliationBatchLineId",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines",
                sql: "(`materialRequestLineId` IS NOT NULL AND `reconciliationBatchLineId` IS NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NOT NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "inventoryissuelines_ibfk_5",
                table: "inventoryissuelines",
                column: "reconciliationBatchLineId",
                principalTable: "reconciliationbatchlines",
                principalColumn: "BatchLineId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "inventoryissues_ibfk_2",
                table: "inventoryissues",
                column: "materialRequestId",
                principalTable: "materialrequests",
                principalColumn: "requestId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "inventoryissues_ibfk_5",
                table: "inventoryissues",
                column: "reconciliationBatchId",
                principalTable: "reconciliationbatches",
                principalColumn: "BatchId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TEMPORARY TABLE closed_loop_issue_lineage_rollback_guard (
                    sentinel INT NOT NULL PRIMARY KEY
                );
                INSERT INTO closed_loop_issue_lineage_rollback_guard (sentinel)
                SELECT 1
                WHERE EXISTS (
                    SELECT 1 FROM inventoryissues WHERE reconciliationBatchId IS NOT NULL
                    UNION ALL
                    SELECT 1 FROM inventoryissuelines WHERE reconciliationBatchLineId IS NOT NULL
                );
                INSERT INTO closed_loop_issue_lineage_rollback_guard (sentinel) VALUES (1);
                DROP TEMPORARY TABLE closed_loop_issue_lineage_rollback_guard;
                """);

            migrationBuilder.DropForeignKey(
                name: "inventoryissuelines_ibfk_5",
                table: "inventoryissuelines");

            migrationBuilder.DropForeignKey(
                name: "inventoryissues_ibfk_2",
                table: "inventoryissues");

            migrationBuilder.DropForeignKey(
                name: "inventoryissues_ibfk_5",
                table: "inventoryissues");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationBatchStatus",
                table: "reconciliationbatches");

            migrationBuilder.DropIndex(
                name: "ixInventoryIssuesReconciliationBatch",
                table: "inventoryissues");

            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryIssuesSourceFamily",
                table: "inventoryissues");

            migrationBuilder.DropIndex(
                name: "uxInventoryIssueLinesReconciliationBatchLine",
                table: "inventoryissuelines");

            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryIssueLinesSourceFamily",
                table: "inventoryissuelines");

            migrationBuilder.DropColumn(
                name: "reconciliationBatchId",
                table: "inventoryissues");

            migrationBuilder.DropColumn(
                name: "reconciliationBatchLineId",
                table: "inventoryissuelines");

            migrationBuilder.AlterColumn<byte[]>(
                name: "materialRequestId",
                table: "inventoryissues",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16,
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationBatchStatus",
                table: "reconciliationbatches",
                sql: "`status` IN ('DRAFT','READY','IN_PROGRESS','COMPLETED')");

            migrationBuilder.AddForeignKey(
                name: "inventoryissues_ibfk_2",
                table: "inventoryissues",
                column: "materialRequestId",
                principalTable: "materialrequests",
                principalColumn: "requestId");
        }
    }
}
