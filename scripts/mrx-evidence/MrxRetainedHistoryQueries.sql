-- PLAN: transaction_issue_page
SET @batch_id = (SELECT BatchId FROM reconciliationbatches ORDER BY CreatedAt DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT il.IssueLineId, i.IssueDate, i.CreatedAt
FROM inventoryissues i
JOIN inventoryissuelines il ON il.IssueId = i.IssueId
WHERE i.ReconciliationBatchId = @batch_id
  AND i.IssueDate BETWEEN '2020-01-01' AND '2099-12-31'
ORDER BY i.CreatedAt DESC, i.IssueCode, il.IssueLineId
LIMIT 25;

-- PLAN: transaction_return_page
SET @batch_id = (SELECT BatchId FROM reconciliationbatches ORDER BY CreatedAt DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT rl.ReturnLineId, r.ReturnDate, r.CreatedAt
FROM inventoryissues i
JOIN inventoryreturns r ON r.IssueId = i.IssueId
JOIN inventoryreturnlines rl ON rl.ReturnId = r.ReturnId
WHERE i.ReconciliationBatchId = @batch_id
  AND r.ReturnDate BETWEEN '2020-01-01' AND '2099-12-31'
ORDER BY r.CreatedAt DESC, r.ReturnCode, rl.ReturnLineId
LIMIT 25;

-- PLAN: provision_lookup
SET @issue_id = (SELECT IssueId FROM inventoryissues WHERE ReconciliationBatchId IS NOT NULL ORDER BY CreatedAt DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT MovementId, IngredientId, UnitId, QuantityIn
FROM stockmovements
WHERE MovementType = 'ADJUSTMENT'
  AND RefTable = 'inventoryissues'
  AND RefId = @issue_id
  AND Reason = 'Bảo đảm đủ tồn kho cho chế độ đối chiếu nguyên liệu'
  AND Note LIKE 'Tự động bổ sung phần thiếu cho lô %';

-- PLAN: active_contributor
SET @batch_id = (SELECT BatchId FROM reconciliationbatches ORDER BY CreatedAt DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT c.ContributorId
FROM reconciliationbatchcontributors c
JOIN reconciliationbatchlines l ON l.BatchLineId = c.BatchLineId
WHERE l.BatchId = @batch_id AND c.InvalidatedAt IS NULL;

-- PLAN: active_disposition
SET @batch_id = (SELECT BatchId FROM reconciliationbatches ORDER BY CreatedAt DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT d.DispositionId
FROM reconciliationdispositions d
JOIN reconciliationbatchlines l ON l.BatchLineId = d.BatchLineId
WHERE l.BatchId = @batch_id AND d.InvalidatedAt IS NULL;

-- PLAN: net_issued
SET @daily_line_id = (SELECT DailyLineId FROM reconciliationbatchdailylines ORDER BY ServiceDate DESC LIMIT 1);
EXPLAIN FORMAT=JSON
SELECT il.IssueLineId, il.IssuedQty,
  COALESCE(SUM(CASE WHEN r.ReceivedAt IS NOT NULL THEN rl.Quantity ELSE 0 END), 0) AS ReceivedReturnQty
FROM inventoryissuelines il
LEFT JOIN inventoryreturnlines rl ON rl.SourceIssueLineId = il.IssueLineId
LEFT JOIN inventoryreturns r ON r.ReturnId = rl.ReturnId
WHERE il.ReconciliationBatchDailyLineId = @daily_line_id
GROUP BY il.IssueLineId, il.IssuedQty;
