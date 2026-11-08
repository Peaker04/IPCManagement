-- Read-only Phase 29 evidence contract. The runner substitutes controlled batch/scope IDs.
SELECT 'purchaseRequests' AS invariantName, COUNT(*) AS currentCount FROM purchaserequests;
SELECT 'purchaseOrders' AS invariantName, COUNT(*) AS currentCount FROM purchaseorders;
SELECT 'receipts' AS invariantName, COUNT(*) AS currentCount FROM inventoryreceipts;
SELECT 'issues' AS invariantName, COUNT(*) AS currentCount FROM inventoryissues;
SELECT 'movements' AS invariantName, COUNT(*) AS currentCount FROM stockmovements;
SELECT 'lots' AS invariantName, COUNT(*) AS currentCount FROM currentstocklots;
SELECT 'snapshots' AS invariantName, COUNT(*) AS currentCount FROM stocksnapshots;
SELECT 'currentStock' AS invariantName, COUNT(*) AS currentCount FROM currentstocks;
SELECT 'immutableHistory' AS invariantName, COUNT(*) AS completedCount FROM reconciliationbatches WHERE status = 'COMPLETED';
