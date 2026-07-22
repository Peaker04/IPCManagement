using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    [DbContext(typeof(IpcManagementContext))]
    [Migration("20260721120000_AddPurchaseHistoryReconciliation")]
    public partial class AddPurchaseHistoryReconciliation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "packageBaseUnitIdSnapshot",
                table: "inventoryreceiptlines",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "packagePolicyVersionSnapshot",
                table: "inventoryreceiptlines",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "packageQuantitySnapshot",
                table: "inventoryreceiptlines",
                type: "decimal(18,6)",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "purchasehistoryreconciliationruns",
                columns: table => new
                {
                    purchaseHistoryReconciliationRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    manifestId = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    manifestHash = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceSha256 = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    policyVersion = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    asOfDate = table.Column<DateOnly>(type: "date", nullable: false),
                    databaseFingerprint = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    backupIdentifier = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    backupTargetFingerprint = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    restoreFingerprint = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    restoreVerified = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    appliedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    appliedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    candidateCount = table.Column<int>(type: "int", nullable: false),
                    currentUniqueBusinessKeyCount = table.Column<int>(type: "int", nullable: false),
                    auditedDeltaCount = table.Column<int>(type: "int", nullable: false),
                    actionCount = table.Column<int>(type: "int", nullable: false),
                    blockerCount = table.Column<int>(type: "int", nullable: false),
                    keepCount = table.Column<int>(type: "int", nullable: false),
                    versionCount = table.Column<int>(type: "int", nullable: false),
                    deactivateCount = table.Column<int>(type: "int", nullable: false),
                    deleteCount = table.Column<int>(type: "int", nullable: false),
                    blockCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseHistoryReconciliationRunId);
                    table.CheckConstraint("ckPurchaseHistoryReconciliationRunsCounts", "`candidateCount` >= 0 AND `currentUniqueBusinessKeyCount` >= 0 AND `auditedDeltaCount` >= 0 AND `actionCount` >= 0 AND `blockerCount` >= 0 AND `keepCount` >= 0 AND `versionCount` >= 0 AND `deactivateCount` >= 0 AND `deleteCount` >= 0 AND `blockCount` >= 0 AND `actionCount` = (`keepCount` + `versionCount` + `deactivateCount` + `deleteCount` + `blockCount`) AND `blockerCount` = `blockCount`");
                    table.CheckConstraint("ckPurchaseHistoryReconciliationRunsRestoreVerified", "`restoreVerified` = 1");
                    table.CheckConstraint("ckPurchaseHistoryReconciliationRunsStatus", "`status` IN ('APPLIED', 'NOOP')");
                    table.ForeignKey(
                        name: "purchasehistoryreconciliationruns_ibfk_1",
                        column: x => x.appliedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "purchasehistoryreconciliationactions",
                columns: table => new
                {
                    purchaseHistoryReconciliationActionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseHistoryReconciliationRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    actionId = table.Column<string>(type: "char(32)", fixedLength: true, maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actionType = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceKey = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceSheet = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceRow = table.Column<int>(type: "int", nullable: true),
                    businessKey = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    targetType = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    targetId = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reasonCode = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    beforeEvidence = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    beforeHash = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    afterEvidence = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    afterHash = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actionHash = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseHistoryReconciliationActionId);
                    table.CheckConstraint("ckPurchaseHistoryReconciliationActionsDisposition", "`actionType` IN ('keep', 'version', 'deactivate', 'delete', 'block')");
                    table.CheckConstraint("ckPurchaseHistoryReconciliationActionsSourceRow", "`sourceRow` IS NULL OR `sourceRow` > 0");
                    table.ForeignKey(
                        name: "purchasehistoryreconciliationactions_ibfk_1",
                        column: x => x.purchaseHistoryReconciliationRunId,
                        principalTable: "purchasehistoryreconciliationruns",
                        principalColumn: "purchaseHistoryReconciliationRunId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_inventoryreceiptlines_packageBaseUnitIdSnapshot",
                table: "inventoryreceiptlines",
                column: "packageBaseUnitIdSnapshot");

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryReceiptLinesPackageQuantityPositive",
                table: "inventoryreceiptlines",
                sql: "`packageQuantitySnapshot` IS NULL OR `packageQuantitySnapshot` > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ckInventoryReceiptLinesPackageSnapshotComplete",
                table: "inventoryreceiptlines",
                sql: "(`packageQuantitySnapshot` IS NULL AND `packageBaseUnitIdSnapshot` IS NULL AND `packagePolicyVersionSnapshot` IS NULL) OR (`packageQuantitySnapshot` IS NOT NULL AND `packageBaseUnitIdSnapshot` IS NOT NULL AND `packagePolicyVersionSnapshot` IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseHistoryReconciliationActionsHash",
                table: "purchasehistoryreconciliationactions",
                column: "actionHash");

            migrationBuilder.CreateIndex(
                name: "uqPurchaseHistoryReconciliationActionsRunAction",
                table: "purchasehistoryreconciliationactions",
                columns: new[] { "purchaseHistoryReconciliationRunId", "actionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixPurchaseHistoryReconciliationRunsActor",
                table: "purchasehistoryreconciliationruns",
                columns: new[] { "appliedBy", "appliedAt" });

            migrationBuilder.CreateIndex(
                name: "ixPurchaseHistoryReconciliationRunsManifestId",
                table: "purchasehistoryreconciliationruns",
                column: "manifestId");

            migrationBuilder.CreateIndex(
                name: "uqPurchaseHistoryReconciliationRunsManifestHash",
                table: "purchasehistoryreconciliationruns",
                column: "manifestHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "inventoryreceiptlines_ibfk_5",
                table: "inventoryreceiptlines",
                column: "packageBaseUnitIdSnapshot",
                principalTable: "units",
                principalColumn: "unitId",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "inventoryreceiptlines_ibfk_5",
                table: "inventoryreceiptlines");

            migrationBuilder.DropTable(
                name: "purchasehistoryreconciliationactions");

            migrationBuilder.DropTable(
                name: "purchasehistoryreconciliationruns");

            migrationBuilder.DropIndex(
                name: "IX_inventoryreceiptlines_packageBaseUnitIdSnapshot",
                table: "inventoryreceiptlines");

            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryReceiptLinesPackageQuantityPositive",
                table: "inventoryreceiptlines");

            migrationBuilder.DropCheckConstraint(
                name: "ckInventoryReceiptLinesPackageSnapshotComplete",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "packageBaseUnitIdSnapshot",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "packagePolicyVersionSnapshot",
                table: "inventoryreceiptlines");

            migrationBuilder.DropColumn(
                name: "packageQuantitySnapshot",
                table: "inventoryreceiptlines");

        }
    }
}
