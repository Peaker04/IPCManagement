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

DROP TEMPORARY TABLE IF EXISTS invalid_future_receipt_line_targets;
CREATE TEMPORARY TABLE invalid_future_receipt_line_targets AS
SELECT line.receiptLineId, line.receiptId
FROM inventoryreceiptlines line
JOIN inventoryreceipts receipt ON receipt.receiptId = line.receiptId
WHERE receipt.receiptDate > CURRENT_DATE()
  AND receipt.receiptCode LIKE 'RCP-SAMPLE-%'
  AND line.purchaseRequestLineId IS NULL;

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
SELECT COUNT(*) AS invalidFutureReceiptLinesToRemove
FROM invalid_future_receipt_line_targets;
SELECT COUNT(*) AS stockMovementsToRemove
FROM stockmovements movement
JOIN conversion_stock_targets target
  ON target.warehouseId = movement.warehouseId
 AND target.ingredientId = movement.ingredientId
 AND target.unitId = movement.unitId;
SELECT COUNT(*) AS receiptLinkedStockMovementsToRemove
FROM stockmovements movement
JOIN conversion_receipt_line_targets target
  ON target.receiptLineId = movement.refId
WHERE LOWER(movement.refTable) = 'inventoryreceiptlines';
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

DELETE movement
FROM stockmovements movement
JOIN conversion_receipt_line_targets target
  ON target.receiptLineId = movement.refId
WHERE LOWER(movement.refTable) = 'inventoryreceiptlines';
SELECT ROW_COUNT() AS receiptLinkedStockMovementsRemoved;

DELETE movement
FROM stockmovements movement
JOIN invalid_future_receipt_line_targets target
  ON target.receiptLineId = movement.refId
WHERE LOWER(movement.refTable) = 'inventoryreceiptlines';
SELECT ROW_COUNT() AS invalidFutureReceiptStockMovementsRemoved;

DELETE line
FROM inventoryreceiptlines line
JOIN conversion_receipt_line_targets target ON target.receiptLineId = line.receiptLineId;
SELECT ROW_COUNT() AS receiptLinesRemoved;

DELETE line
FROM inventoryreceiptlines line
JOIN invalid_future_receipt_line_targets target ON target.receiptLineId = line.receiptLineId;
SELECT ROW_COUNT() AS invalidFutureReceiptLinesRemoved;

DELETE receipt
FROM inventoryreceipts receipt
JOIN (SELECT DISTINCT receiptId FROM conversion_receipt_line_targets) target
  ON target.receiptId = receipt.receiptId
WHERE NOT EXISTS (
  SELECT 1 FROM inventoryreceiptlines remaining WHERE remaining.receiptId = receipt.receiptId
);
SELECT ROW_COUNT() AS emptyReceiptsRemoved;

DELETE receipt
FROM inventoryreceipts receipt
WHERE receipt.receiptDate > CURRENT_DATE()
  AND receipt.receiptCode LIKE 'RCP-SAMPLE-%'
  AND NOT EXISTS (
    SELECT 1 FROM inventoryreceiptlines remaining WHERE remaining.receiptId = receipt.receiptId
  );
SELECT ROW_COUNT() AS emptyInvalidFutureReceiptsRemoved;

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

-- A receipt-line delete may leave ledger rows behind because this legacy schema
-- intentionally has no FK from stockmovements.refId to inventoryreceiptlines.
DELETE movement
FROM stockmovements movement
LEFT JOIN inventoryreceiptlines line ON line.receiptLineId = movement.refId
WHERE LOWER(movement.refTable) = 'inventoryreceiptlines'
  AND movement.refId IS NOT NULL
  AND line.receiptLineId IS NULL;
SELECT ROW_COUNT() AS orphanReceiptStockMovementsRemoved;

-- Rebuild a canonical current-stock row only when every surviving movement is
-- already in the ingredient unit. This preserves valid ledger evidence without
-- guessing any package conversion rate.
INSERT INTO currentstock(warehouseId, ingredientId, unitId, currentQty, lastUpdated)
SELECT movement.warehouseId,
       movement.ingredientId,
       ingredient.unitId,
       SUM(movement.quantityIn - movement.quantityOut),
       MAX(movement.movementDate)
FROM stockmovements movement
JOIN ingredients ingredient ON ingredient.ingredientId = movement.ingredientId
LEFT JOIN currentstock stock
  ON stock.warehouseId = movement.warehouseId
 AND stock.ingredientId = movement.ingredientId
WHERE stock.ingredientId IS NULL
GROUP BY movement.warehouseId, movement.ingredientId, ingredient.unitId
HAVING SUM(movement.unitId <> ingredient.unitId) = 0
   AND SUM(movement.quantityIn - movement.quantityOut) > 0.000010;
SELECT ROW_COUNT() AS canonicalCurrentStockRowsRebuilt;

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
