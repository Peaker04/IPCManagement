using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

/// <summary>
/// Reconciles receipts created by the pre-lifecycle writer. A legacy receipt is marked POSTED only
/// when every line has one persisted RECEIPT movement, all movements use one actor, and movement
/// quantities match the receipt lines. Receipts without physical movement evidence remain DRAFT.
/// </summary>
[DbContext(typeof(IpcManagementContext))]
[Migration("20260810011000_ReconcileLegacyReceiptLifecycle")]
public partial class ReconcileLegacyReceiptLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            UPDATE `inventoryreceiptlines` AS line
            INNER JOIN `stockmovements` AS movement
              ON movement.`refTable` = 'inventoryreceiptlines'
             AND movement.`refId` = line.`receiptLineId`
             AND movement.`movementType` = 'RECEIPT'
             AND ABS(movement.`quantityIn` - line.`quantity`) <= 0.000001
             AND movement.`quantityOut` = 0
            SET line.`acceptedQuantity` = line.`quantity`,
                line.`rejectedQuantity` = 0
            WHERE line.`acceptedQuantity` IS NULL
              AND line.`rejectedQuantity` IS NULL;
            """);

        migrationBuilder.Sql(
            """
            UPDATE `inventoryreceipts` AS receipt
            INNER JOIN (
                SELECT line.`receiptId`,
                       MAX(movement.`movementDate`) AS `postedAt`,
                       MAX(movement.`performedBy`) AS `postedBy`
                FROM `inventoryreceiptlines` AS line
                INNER JOIN `stockmovements` AS movement
                  ON movement.`refTable` = 'inventoryreceiptlines'
                 AND movement.`refId` = line.`receiptLineId`
                 AND movement.`movementType` = 'RECEIPT'
                 AND ABS(movement.`quantityIn` - line.`quantity`) <= 0.000001
                 AND movement.`quantityOut` = 0
                GROUP BY line.`receiptId`
                HAVING COUNT(DISTINCT line.`receiptLineId`) = (
                           SELECT COUNT(*)
                           FROM `inventoryreceiptlines` AS all_lines
                           WHERE all_lines.`receiptId` = line.`receiptId`)
                   AND COUNT(DISTINCT movement.`performedBy`) = 1
            ) AS evidence ON evidence.`receiptId` = receipt.`receiptId`
            SET receipt.`status` = 'POSTED',
                receipt.`qualityStatus` = 'ACCEPTED',
                receipt.`postedAt` = evidence.`postedAt`,
                receipt.`postedBy` = evidence.`postedBy`,
                receipt.`managerApprovalReason` = 'LEGACY_PRE_LIFECYCLE_NO_MANAGER_EVIDENCE',
                receipt.`concurrencyVersion` = GREATEST(receipt.`concurrencyVersion`, 1)
            WHERE receipt.`status` = 'DRAFT';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Reconciliation records physical history and is intentionally not reversed destructively.
    }
}
