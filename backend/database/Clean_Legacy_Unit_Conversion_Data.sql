-- Remove legacy inventory rows whose unit cannot be converted to the ingredient unit.
-- Run inside a transaction. The caller decides COMMIT (apply) or ROLLBACK (dry-run).
-- This intentionally leaves valid BOM tiers and the generic unit-conversion engine intact.

DROP TEMPORARY TABLE IF EXISTS conversion_stock_targets;
CREATE TEMPORARY TABLE conversion_stock_targets AS
SELECT stock.warehouseId, stock.ingredientId, stock.unitId
FROM currentstock stock
JOIN ingredients ingredient ON ingredient.ingredientId = stock.ingredientId
JOIN units sourceUnit ON sourceUnit.unitId = stock.unitId
JOIN units targetUnit ON targetUnit.unitId = ingredient.unitId
WHERE sourceUnit.unitId <> targetUnit.unitId
  AND NOT (
    sourceUnit.convertRateToBase > 0
    AND targetUnit.convertRateToBase > 0
    AND UPPER(COALESCE(NULLIF(TRIM(sourceUnit.baseUnitCode), ''), TRIM(sourceUnit.unitCode))) =
        UPPER(COALESCE(NULLIF(TRIM(targetUnit.baseUnitCode), ''), TRIM(targetUnit.unitCode)))
  );

DROP TEMPORARY TABLE IF EXISTS conversion_receipt_line_targets;
CREATE TEMPORARY TABLE conversion_receipt_line_targets AS
SELECT line.receiptLineId,
       line.receiptId,
       line.purchaseRequestLineId,
       line.ingredientId,
       line.unitId,
       line.quantity,
       line.amount
FROM inventoryreceiptlines line
JOIN ingredients ingredient ON ingredient.ingredientId = line.ingredientId
JOIN units sourceUnit ON sourceUnit.unitId = line.unitId
JOIN units targetUnit ON targetUnit.unitId = ingredient.unitId
WHERE sourceUnit.unitId <> targetUnit.unitId
  AND NOT (
    sourceUnit.convertRateToBase > 0
    AND targetUnit.convertRateToBase > 0
    AND UPPER(COALESCE(NULLIF(TRIM(sourceUnit.baseUnitCode), ''), TRIM(sourceUnit.unitCode))) =
        UPPER(COALESCE(NULLIF(TRIM(targetUnit.baseUnitCode), ''), TRIM(targetUnit.unitCode)))
  );

DROP TEMPORARY TABLE IF EXISTS conversion_receipt_stats;
CREATE TEMPORARY TABLE conversion_receipt_stats AS
SELECT target.receiptId,
       COUNT(*) AS removedLineCount,
       (SELECT COUNT(*) FROM inventoryreceiptlines line WHERE line.receiptId = target.receiptId) AS totalLineCount
FROM conversion_receipt_line_targets target
GROUP BY target.receiptId;

SELECT COUNT(*) AS stockRowsToRemove FROM conversion_stock_targets;
SELECT COUNT(*) AS receiptLinesToRemove FROM conversion_receipt_line_targets;
SELECT COUNT(DISTINCT receiptId) AS affectedReceipts FROM conversion_receipt_line_targets;
SELECT MIN(receipt.receiptDate) AS firstAffectedReceiptDate,
       MAX(receipt.receiptDate) AS lastAffectedReceiptDate,
       COUNT(DISTINCT receipt.receiptId) AS affectedReceiptCount
FROM inventoryreceipts receipt
JOIN conversion_receipt_line_targets target ON target.receiptId = receipt.receiptId;
SELECT sourceUnit.unitCode AS receiptUnit,
       targetUnit.unitCode AS ingredientUnit,
       COUNT(*) AS lineCount,
       COUNT(DISTINCT target.receiptId) AS receiptCount
FROM conversion_receipt_line_targets target
JOIN units sourceUnit ON sourceUnit.unitId = target.unitId
JOIN ingredients ingredient ON ingredient.ingredientId = target.ingredientId
JOIN units targetUnit ON targetUnit.unitId = ingredient.unitId
GROUP BY sourceUnit.unitCode, targetUnit.unitCode
ORDER BY lineCount DESC, receiptUnit, ingredientUnit;
SELECT SUM(CASE WHEN receiptStats.remainingLineCount = 0 THEN 1 ELSE 0 END) AS receiptsThatBecomeEmpty,
       SUM(CASE WHEN receiptStats.remainingLineCount > 0 THEN 1 ELSE 0 END) AS mixedReceiptsKept
FROM (
  SELECT receiptId, totalLineCount - removedLineCount AS remainingLineCount
  FROM conversion_receipt_stats
) receiptStats;
SELECT COUNT(*) AS receiptLinesLinkedToPurchaseRequests
FROM conversion_receipt_line_targets
WHERE purchaseRequestLineId IS NOT NULL;
SELECT COUNT(*) AS stockMovementsToRemove
FROM stockmovements movement
JOIN conversion_stock_targets target
  ON target.warehouseId = movement.warehouseId
 AND target.ingredientId = movement.ingredientId
 AND target.unitId = movement.unitId;
SELECT COUNT(*) AS stockLotsToRemove
FROM currentstocklots lot
JOIN conversion_stock_targets target
  ON target.warehouseId = lot.warehouseId
 AND target.ingredientId = lot.ingredientId
 AND target.unitId = lot.unitId;
SELECT COUNT(*) AS stockSnapshotsToRemove
FROM stocksnapshots snapshot
JOIN conversion_stock_targets target
  ON target.warehouseId = snapshot.warehouseId
 AND target.ingredientId = snapshot.ingredientId
 AND target.unitId = snapshot.unitId;

DELETE line
FROM inventoryreceiptlines line
JOIN conversion_receipt_line_targets target ON target.receiptLineId = line.receiptLineId;
SELECT ROW_COUNT() AS receiptLinesRemoved;

DELETE receipt
FROM inventoryreceipts receipt
JOIN (SELECT DISTINCT receiptId FROM conversion_receipt_line_targets) target
  ON target.receiptId = receipt.receiptId
WHERE NOT EXISTS (
  SELECT 1 FROM inventoryreceiptlines remaining WHERE remaining.receiptId = receipt.receiptId
);
SELECT ROW_COUNT() AS emptyReceiptsRemoved;

UPDATE purchaseorderlines orderLine
JOIN (
  SELECT DISTINCT purchaseRequestLineId
  FROM conversion_receipt_line_targets
  WHERE purchaseRequestLineId IS NOT NULL
) target ON target.purchaseRequestLineId = orderLine.purchaseRequestLineId
SET orderLine.receivedQty = COALESCE((
  SELECT SUM(remaining.quantity)
  FROM inventoryreceiptlines remaining
  WHERE remaining.purchaseRequestLineId = orderLine.purchaseRequestLineId
), 0);
SELECT ROW_COUNT() AS purchaseOrderLinesReconciled;

UPDATE purchaseorders purchaseOrder
JOIN (
  SELECT DISTINCT orderLine.purchaseOrderId
  FROM purchaseorderlines orderLine
  JOIN conversion_receipt_line_targets target
    ON target.purchaseRequestLineId = orderLine.purchaseRequestLineId
) affected ON affected.purchaseOrderId = purchaseOrder.purchaseOrderId
SET purchaseOrder.status = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM purchaseorderlines line
    WHERE line.purchaseOrderId = purchaseOrder.purchaseOrderId
      AND line.receivedQty < line.orderedQty
  ) THEN 'RECEIVED'
  WHEN EXISTS (
    SELECT 1 FROM purchaseorderlines line
    WHERE line.purchaseOrderId = purchaseOrder.purchaseOrderId
      AND line.receivedQty > 0
  ) THEN 'PARTIALLY_RECEIVED'
  ELSE 'ORDERED'
END,
purchaseOrder.updatedAt = UTC_TIMESTAMP()
WHERE purchaseOrder.status IN ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED');
SELECT ROW_COUNT() AS purchaseOrdersReconciled;

DELETE lot
FROM currentstocklots lot
JOIN conversion_stock_targets target
  ON target.warehouseId = lot.warehouseId
 AND target.ingredientId = lot.ingredientId
 AND target.unitId = lot.unitId;
SELECT ROW_COUNT() AS stockLotsRemoved;

DELETE snapshot
FROM stocksnapshots snapshot
JOIN conversion_stock_targets target
  ON target.warehouseId = snapshot.warehouseId
 AND target.ingredientId = snapshot.ingredientId
 AND target.unitId = snapshot.unitId;
SELECT ROW_COUNT() AS stockSnapshotsRemoved;

DELETE movement
FROM stockmovements movement
JOIN conversion_stock_targets target
  ON target.warehouseId = movement.warehouseId
 AND target.ingredientId = movement.ingredientId
 AND target.unitId = movement.unitId;
SELECT ROW_COUNT() AS stockMovementsRemoved;

DELETE stock
FROM currentstock stock
JOIN conversion_stock_targets target
  ON target.warehouseId = stock.warehouseId
 AND target.ingredientId = stock.ingredientId
 AND target.unitId = stock.unitId;
SELECT ROW_COUNT() AS stockRowsRemoved;

SELECT COUNT(*) AS remainingInvalidStockRows
FROM currentstock stock
JOIN ingredients ingredient ON ingredient.ingredientId = stock.ingredientId
JOIN units sourceUnit ON sourceUnit.unitId = stock.unitId
JOIN units targetUnit ON targetUnit.unitId = ingredient.unitId
WHERE sourceUnit.unitId <> targetUnit.unitId
  AND NOT (
    sourceUnit.convertRateToBase > 0
    AND targetUnit.convertRateToBase > 0
    AND UPPER(COALESCE(NULLIF(TRIM(sourceUnit.baseUnitCode), ''), TRIM(sourceUnit.unitCode))) =
        UPPER(COALESCE(NULLIF(TRIM(targetUnit.baseUnitCode), ''), TRIM(targetUnit.unitCode)))
  );

SELECT COUNT(*) AS remainingInvalidReceiptLines
FROM inventoryreceiptlines line
JOIN ingredients ingredient ON ingredient.ingredientId = line.ingredientId
JOIN units sourceUnit ON sourceUnit.unitId = line.unitId
JOIN units targetUnit ON targetUnit.unitId = ingredient.unitId
WHERE sourceUnit.unitId <> targetUnit.unitId
  AND NOT (
    sourceUnit.convertRateToBase > 0
    AND targetUnit.convertRateToBase > 0
    AND UPPER(COALESCE(NULLIF(TRIM(sourceUnit.baseUnitCode), ''), TRIM(sourceUnit.unitCode))) =
        UPPER(COALESCE(NULLIF(TRIM(targetUnit.baseUnitCode), ''), TRIM(targetUnit.unitCode)))
  );
