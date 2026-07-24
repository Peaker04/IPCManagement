-- Revert the 2026-07-23 unit-code-only quantity normalization.
-- This uses the original audit values and fails closed on any intervening drift.
-- Caller owns the transaction: START TRANSACTION; SOURCE ...; COMMIT/ROLLBACK.

DROP TEMPORARY TABLE IF EXISTS inferred_quantity_revert_targets;
CREATE TEMPORARY TABLE inferred_quantity_revert_targets AS
SELECT log.entityId AS requestLineId,
       CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(log.oldValue, 'required=', -1), ';', 1) AS DECIMAL(18, 6)) AS originalRequiredQty,
       CAST(SUBSTRING_INDEX(log.oldValue, 'purchase=', -1) AS DECIMAL(18, 6)) AS originalPurchaseQty,
       CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(log.newValue, 'required=', -1), ';', 1) AS DECIMAL(18, 6)) AS normalizedRequiredQty,
       CAST(SUBSTRING_INDEX(log.newValue, 'purchase=', -1) AS DECIMAL(18, 6)) AS normalizedPurchaseQty
FROM auditlogs log
WHERE log.fieldName = 'OperationalQuantityNormalization'
  AND log.entityName = 'Materialrequestline'
  AND log.entityId IS NOT NULL;

SELECT COUNT(*) AS targetCount,
       SUM(line.totalRequiredQty <> target.normalizedRequiredQty
           OR line.suggestedPurchaseQty <> target.normalizedPurchaseQty) AS driftedMaterialLines,
       SUM(orderLine.receivedQty > 0) AS receivedOrderLines
FROM inferred_quantity_revert_targets target
JOIN materialrequestlines line ON line.requestLineId = target.requestLineId
LEFT JOIN purchaserequestlines purchaseLine ON purchaseLine.materialRequestLineId = target.requestLineId
LEFT JOIN purchaseorderlines orderLine ON orderLine.purchaseRequestLineId = purchaseLine.purchaseRequestLineId;

DROP TEMPORARY TABLE IF EXISTS inferred_quantity_revert_guard;
CREATE TEMPORARY TABLE inferred_quantity_revert_guard (
  isSafe TINYINT NOT NULL,
  CONSTRAINT chk_inferred_quantity_revert_safe CHECK (isSafe = 1)
);
SET @inferred_revert_target_count = (SELECT COUNT(*) FROM inferred_quantity_revert_targets);
SET @inferred_revert_has_drift = EXISTS (
  SELECT 1
  FROM inferred_quantity_revert_targets target
  JOIN materialrequestlines line ON line.requestLineId = target.requestLineId
  WHERE line.totalRequiredQty <> target.normalizedRequiredQty
     OR line.suggestedPurchaseQty <> target.normalizedPurchaseQty
);
SET @inferred_revert_has_received = EXISTS (
  SELECT 1
  FROM inferred_quantity_revert_targets target
  JOIN purchaserequestlines purchaseLine ON purchaseLine.materialRequestLineId = target.requestLineId
  JOIN purchaseorderlines orderLine ON orderLine.purchaseRequestLineId = purchaseLine.purchaseRequestLineId
  WHERE orderLine.receivedQty > 0
);
INSERT INTO inferred_quantity_revert_guard (isSafe)
SELECT CASE WHEN
  @inferred_revert_target_count = 25
  AND @inferred_revert_has_drift = 0
  AND @inferred_revert_has_received = 0
THEN 1 ELSE 0 END;

INSERT INTO auditlogs (
  auditId, changedAt, changedBy, businessArea, entityName, entityId,
  fieldName, oldValue, newValue, reason
)
SELECT UNHEX(REPLACE(UUID(), '-', '')),
       UTC_TIMESTAMP(),
       UNHEX('00000010000000000000000000000001'),
       'DataQuality',
       'Materialrequestline',
       target.requestLineId,
       'OperationalQuantityNormalizationRollback',
       CONCAT('required=', target.normalizedRequiredQty, '; purchase=', target.normalizedPurchaseQty),
       CONCAT('required=', target.originalRequiredQty, '; purchase=', target.originalPurchaseQty),
       'Hoàn tác normalization suy từ unit code; chờ provenance của từng lần import.'
FROM inferred_quantity_revert_targets target;

UPDATE purchaseorderlines orderLine
JOIN purchaserequestlines purchaseLine
  ON purchaseLine.purchaseRequestLineId = orderLine.purchaseRequestLineId
JOIN inferred_quantity_revert_targets target
  ON target.requestLineId = purchaseLine.materialRequestLineId
SET orderLine.orderedQty = target.originalPurchaseQty;

UPDATE purchaserequestlines purchaseLine
JOIN inferred_quantity_revert_targets target
  ON target.requestLineId = purchaseLine.materialRequestLineId
SET purchaseLine.requiredQty = target.originalRequiredQty,
    purchaseLine.purchaseQty = target.originalPurchaseQty;

UPDATE materialrequestlines line
JOIN inferred_quantity_revert_targets target ON target.requestLineId = line.requestLineId
SET line.totalRequiredQty = target.originalRequiredQty,
    line.suggestedPurchaseQty = target.originalPurchaseQty;

SELECT ROW_COUNT() AS materialRequestLinesReverted;
