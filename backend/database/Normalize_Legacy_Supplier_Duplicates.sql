-- Deactivate duplicate supplier rows created by repeated sample imports.
--
-- Scope:
--   * Only active rows whose code ends with -2 are eligible.
--   * A matching active base code must exist (SUP-...-2 -> SUP-...).
--   * Supplier names must match after trim, case, and accent-insensitive collation.
--
-- Safety:
--   * Run against a disposable clone first.
--   * Historical foreign keys are intentionally preserved; this script does not
--     delete suppliers and does not rewrite receipt/order history.
--   * The script is idempotent. Re-running it produces zero new targets.
--   * Review the first SELECT result before allowing the UPDATE in a live lane.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS supplier_duplicate_targets;
CREATE TEMPORARY TABLE supplier_duplicate_targets AS
SELECT duplicateSupplier.supplierId AS duplicateSupplierId,
       duplicateSupplier.supplierCode AS duplicateSupplierCode,
       duplicateSupplier.supplierName AS duplicateSupplierName,
       canonicalSupplier.supplierId AS canonicalSupplierId,
       canonicalSupplier.supplierCode AS canonicalSupplierCode,
       canonicalSupplier.supplierName AS canonicalSupplierName
FROM suppliers duplicateSupplier
JOIN suppliers canonicalSupplier
  ON canonicalSupplier.supplierCode = LEFT(
       duplicateSupplier.supplierCode,
       CHAR_LENGTH(duplicateSupplier.supplierCode) - 2)
 AND LOWER(TRIM(canonicalSupplier.supplierName)) =
     LOWER(TRIM(duplicateSupplier.supplierName))
WHERE duplicateSupplier.isActive <> 0
  AND duplicateSupplier.supplierCode LIKE '%-2'
  AND canonicalSupplier.isActive <> 0
  AND duplicateSupplier.supplierId <> canonicalSupplier.supplierId;

-- Preflight evidence: inspect this result on the clone before applying.
SELECT target.duplicateSupplierCode,
       target.duplicateSupplierName,
       target.canonicalSupplierCode,
       target.canonicalSupplierName,
       (SELECT COUNT(*)
        FROM inventoryreceipts receipt
        WHERE receipt.supplierId = target.duplicateSupplierId) AS receiptReferences,
       (SELECT COUNT(*)
        FROM supplierquotations quotation
        WHERE quotation.supplierId = target.duplicateSupplierId) AS quotationReferences,
       (SELECT COUNT(*)
        FROM purchaserequestlines requestLine
        WHERE requestLine.supplierId = target.duplicateSupplierId) AS purchaseRequestReferences,
       (SELECT COUNT(*)
        FROM purchaselinesupplierdecisions decision
        WHERE decision.supplierId = target.duplicateSupplierId) AS supplierDecisionReferences,
       (SELECT COUNT(*)
        FROM purchaseorders purchaseOrder
        WHERE purchaseOrder.supplierId = target.duplicateSupplierId) AS purchaseOrderReferences
FROM supplier_duplicate_targets target
ORDER BY target.canonicalSupplierCode;

SELECT COUNT(*) AS eligibleDuplicateSupplierCount
FROM supplier_duplicate_targets;

-- Apply the reversible catalog-state change. Existing history continues to point
-- at the same row and still displays the same supplier name.
UPDATE suppliers duplicateSupplier
JOIN supplier_duplicate_targets target
  ON target.duplicateSupplierId = duplicateSupplier.supplierId
SET duplicateSupplier.isActive = 0;

SELECT ROW_COUNT() AS deactivatedSupplierCount;

-- Postcondition: no eligible active -2 duplicate remains.
SELECT duplicateSupplier.supplierCode,
       duplicateSupplier.supplierName
FROM suppliers duplicateSupplier
JOIN suppliers canonicalSupplier
  ON canonicalSupplier.supplierCode = LEFT(
       duplicateSupplier.supplierCode,
       CHAR_LENGTH(duplicateSupplier.supplierCode) - 2)
 AND LOWER(TRIM(canonicalSupplier.supplierName)) =
     LOWER(TRIM(duplicateSupplier.supplierName))
WHERE duplicateSupplier.isActive <> 0
  AND duplicateSupplier.supplierCode LIKE '%-2'
  AND canonicalSupplier.isActive <> 0;

COMMIT;
