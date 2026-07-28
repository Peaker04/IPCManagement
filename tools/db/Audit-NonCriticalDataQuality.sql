-- Read-only audit for IPCManagement High/Medium data-quality findings.
-- Safe statements only: SELECT / WITH. This file never mutates schema or data.
-- Run against an explicitly selected database, for example:
-- mysql --database=ipcmanagement --table < tools/db/Audit-NonCriticalDataQuality.sql

SELECT
    'runtime_identity' AS audit_section,
    DATABASE() AS database_name,
    NOW() AS observed_at,
    @@version AS mysql_version,
    @@read_only AS server_read_only;

-- Migration rows in the database. Compare these with source files by running
-- Compare-MigrationLineage.ps1; SQL alone cannot inspect the repository.
SELECT
    'migration_summary' AS audit_section,
    COUNT(*) AS applied_migration_count,
    MIN(MigrationId) AS first_migration,
    MAX(MigrationId) AS latest_migration
FROM __EFMigrationsHistory;

SELECT
    'migration_history' AS audit_section,
    MigrationId
FROM __EFMigrationsHistory
ORDER BY MigrationId;

-- Quotation coverage for active master data.
SELECT
    'quotation_active_master_coverage' AS audit_section,
    COUNT(*) AS active_ingredient_count,
    COUNT(DISTINCT quotation.ingredientId) AS ingredients_with_current_quotation
FROM ingredients AS ingredient
LEFT JOIN supplierquotations AS quotation
    ON quotation.ingredientId = ingredient.ingredientId
   AND quotation.isActive = 1
   AND quotation.effectiveFrom <= CURDATE()
   AND (quotation.effectiveTo IS NULL OR quotation.effectiveTo >= CURDATE())
WHERE ingredient.isActive = 1;

-- Actionable quotation coverage: only open purchase-request lines that have not
-- yet become PO lines. Historical evidence remains visible but is never promoted
-- to an effective quotation by this audit.
WITH open_purchase_need AS (
    SELECT
        request_line.ingredientId,
        MIN(request.purchaseForDate) AS earliest_purchase_date,
        SUM(request_line.purchaseQty) AS open_purchase_qty,
        COUNT(DISTINCT request.purchaseRequestId) AS purchase_request_count
    FROM purchaserequestlines AS request_line
    JOIN purchaserequests AS request
        ON request.purchaseRequestId = request_line.purchaseRequestId
    LEFT JOIN purchaseorderlines AS order_line
        ON order_line.purchaseRequestLineId = request_line.purchaseRequestLineId
    WHERE request.status IN ('DRAFT', 'SENTTOSUPPLIER', 'APPROVED')
      AND request_line.purchaseQty > 0
      AND order_line.purchaseOrderLineId IS NULL
    GROUP BY request_line.ingredientId
)
SELECT
    'quotation_open_purchase_coverage' AS audit_section,
    HEX(ingredient.ingredientId) AS ingredient_id_hex,
    ingredient.ingredientCode,
    ingredient.ingredientName,
    need.earliest_purchase_date,
    need.open_purchase_qty,
    need.purchase_request_count,
    COUNT(DISTINCT CASE
        WHEN quotation.isActive = 1
         AND supplier.isActive = 1
         AND quotation.effectiveFrom <= need.earliest_purchase_date
         AND (quotation.effectiveTo IS NULL OR quotation.effectiveTo >= need.earliest_purchase_date)
        THEN quotation.quotationId
    END) AS effective_quote_count,
    MAX(CASE
        WHEN quotation.effectiveFrom <= need.earliest_purchase_date
        THEN quotation.effectiveFrom
    END) AS latest_historical_effective_from,
    CASE
        WHEN COUNT(DISTINCT CASE
            WHEN quotation.isActive = 1
             AND supplier.isActive = 1
             AND quotation.effectiveFrom <= need.earliest_purchase_date
             AND (quotation.effectiveTo IS NULL OR quotation.effectiveTo >= need.earliest_purchase_date)
            THEN quotation.quotationId
        END) > 0 THEN 'COVERED'
        ELSE 'MISSING_EFFECTIVE_QUOTATION'
    END AS coverage
FROM open_purchase_need AS need
JOIN ingredients AS ingredient
    ON ingredient.ingredientId = need.ingredientId
LEFT JOIN supplierquotations AS quotation
    ON quotation.ingredientId = need.ingredientId
LEFT JOIN suppliers AS supplier
    ON supplier.supplierId = quotation.supplierId
GROUP BY
    ingredient.ingredientId,
    ingredient.ingredientCode,
    ingredient.ingredientName,
    need.earliest_purchase_date,
    need.open_purchase_qty,
    need.purchase_request_count
ORDER BY coverage DESC, need.earliest_purchase_date, ingredient.ingredientCode;

-- Master catalog completeness. This is broader than actual scheduled demand.
SELECT
    'bom_active_master_gap' AS audit_section,
    COUNT(*) AS active_dishes_without_published_bom
FROM dishes AS dish
WHERE dish.isActive = 1
  AND NOT EXISTS (
      SELECT 1
      FROM dishbom AS bom
      WHERE bom.dishId = dish.dishId
        AND bom.bomStatus = 'PUBLISHED'
  );

-- Missing BOM coverage for dishes that are actually scheduled. Coverage follows
-- MaterialDemandService: published + effective + exact tier, preferring customer
-- BOM and falling back to global BOM. Rows are grouped to avoid duplicate menu slots.
WITH scheduled_dishes AS (
    SELECT DISTINCT
        schedule.customerId,
        schedule.weekStartDate,
        schedule.serviceDate,
        schedule.shiftName,
        schedule.menuPrice,
        schedule.status AS schedule_status,
        menu_item.dishId
    FROM menuschedules AS schedule
    JOIN menuitems AS menu_item ON menu_item.menuId = schedule.menuId
), scheduled_bom_coverage AS (
    SELECT
        scheduled.*,
        dish.dishCode,
        dish.dishName,
        (
            SELECT COUNT(*)
            FROM dishbom AS bom
            WHERE bom.dishId = scheduled.dishId
              AND bom.bomStatus = 'PUBLISHED'
              AND bom.effectiveFrom <= scheduled.serviceDate
              AND (bom.effectiveTo IS NULL OR bom.effectiveTo >= scheduled.serviceDate)
              AND bom.priceTierAmount = ROUND(scheduled.menuPrice, 0)
              AND bom.customerId = scheduled.customerId
        ) AS customer_bom_lines,
        (
            SELECT COUNT(*)
            FROM dishbom AS bom
            WHERE bom.dishId = scheduled.dishId
              AND bom.bomStatus = 'PUBLISHED'
              AND bom.effectiveFrom <= scheduled.serviceDate
              AND (bom.effectiveTo IS NULL OR bom.effectiveTo >= scheduled.serviceDate)
              AND bom.priceTierAmount = ROUND(scheduled.menuPrice, 0)
              AND bom.customerId IS NULL
        ) AS global_bom_lines
    FROM scheduled_dishes AS scheduled
    JOIN dishes AS dish ON dish.dishId = scheduled.dishId
)
SELECT
    'bom_scheduled_dish_gap' AS audit_section,
    HEX(customerId) AS customer_id_hex,
    weekStartDate,
    MIN(serviceDate) AS first_service_date,
    MAX(serviceDate) AS last_service_date,
    schedule_status,
    menuPrice AS price_tier,
    HEX(dishId) AS dish_id_hex,
    dishCode,
    dishName,
    COUNT(*) AS scheduled_service_slots
FROM scheduled_bom_coverage
WHERE customer_bom_lines = 0
  AND global_bom_lines = 0
GROUP BY
    customerId,
    weekStartDate,
    schedule_status,
    menuPrice,
    dishId,
    dishCode,
    dishName
ORDER BY weekStartDate, dishCode, customer_id_hex;

-- Missing BOM coverage already present in production plans. A NULL tier means
-- the plan line cannot be matched back to a unique schedule and needs review.
WITH planned_dishes AS (
    SELECT DISTINCT
        plan.planCode,
        plan.planDate,
        plan.status AS plan_status,
        plan_line.customerId,
        plan_line.shiftName,
        plan_line.dishId,
        schedule.menuPrice
    FROM productionplans AS plan
    JOIN productionplanlines AS plan_line ON plan_line.planId = plan.planId
    LEFT JOIN menuschedules AS schedule
        ON schedule.customerId = plan_line.customerId
       AND schedule.menuId = plan_line.menuId
       AND schedule.serviceDate = plan.planDate
       AND schedule.shiftName = plan_line.shiftName
), planned_bom_coverage AS (
    SELECT
        planned.*,
        dish.dishCode,
        dish.dishName,
        (
            SELECT COUNT(*)
            FROM dishbom AS bom
            WHERE bom.dishId = planned.dishId
              AND bom.bomStatus = 'PUBLISHED'
              AND bom.effectiveFrom <= planned.planDate
              AND (bom.effectiveTo IS NULL OR bom.effectiveTo >= planned.planDate)
              AND bom.priceTierAmount = ROUND(planned.menuPrice, 0)
              AND bom.customerId = planned.customerId
        ) AS customer_bom_lines,
        (
            SELECT COUNT(*)
            FROM dishbom AS bom
            WHERE bom.dishId = planned.dishId
              AND bom.bomStatus = 'PUBLISHED'
              AND bom.effectiveFrom <= planned.planDate
              AND (bom.effectiveTo IS NULL OR bom.effectiveTo >= planned.planDate)
              AND bom.priceTierAmount = ROUND(planned.menuPrice, 0)
              AND bom.customerId IS NULL
        ) AS global_bom_lines
    FROM planned_dishes AS planned
    JOIN dishes AS dish ON dish.dishId = planned.dishId
)
SELECT
    'bom_production_plan_gap' AS audit_section,
    planCode,
    planDate,
    plan_status,
    shiftName,
    menuPrice AS price_tier,
    HEX(dishId) AS dish_id_hex,
    dishCode,
    dishName,
    CASE
        WHEN menuPrice IS NULL THEN 'UNRESOLVED_SCHEDULE_TIER'
        ELSE 'MISSING_EFFECTIVE_BOM'
    END AS coverage
FROM planned_bom_coverage
WHERE menuPrice IS NULL
   OR (customer_bom_lines = 0 AND global_bom_lines = 0)
ORDER BY planDate, planCode, dishCode;

-- Missing demand traceability. requestDate is the only persisted business-date
-- discriminator; the generation audit timestamps are included so reviewers do
-- not silently equate service date with record creation time.
WITH demand_audit AS (
    SELECT
        entityId,
        MIN(changedAt) AS first_generation_audit_at,
        MAX(changedAt) AS latest_generation_audit_at
    FROM auditlogs
    WHERE businessArea = 'Demand'
      AND LOWER(entityName) = 'materialrequest'
      AND fieldName IN ('Generate', 'Recalculate')
    GROUP BY entityId
)
SELECT
    'demand_missing_bom_trace' AS audit_section,
    HEX(request.requestId) AS request_id_hex,
    request.requestCode,
    request.status,
    request.requestDate,
    plan.planCode,
    plan.weekStartDate,
    COUNT(*) AS lines_without_bom_trace,
    audit.first_generation_audit_at,
    audit.latest_generation_audit_at,
    CASE
        WHEN request.requestDate < DATE('2026-07-09')
            THEN 'SERVICE_DATE_BEFORE_BOM_TRACE_SCHEMA'
        ELSE 'SERVICE_DATE_ON_OR_AFTER_BOM_TRACE_SCHEMA_REVIEW_REQUIRED'
    END AS lineage_bucket
FROM materialrequestlines AS request_line
JOIN materialrequests AS request ON request.requestId = request_line.requestId
JOIN productionplans AS plan ON plan.planId = request.planId
LEFT JOIN demand_audit AS audit ON audit.entityId = request.requestId
WHERE request_line.bomId IS NULL
  AND request.status <> 'CANCELLED'
GROUP BY
    request.requestId,
    request.requestCode,
    request.status,
    request.requestDate,
    plan.planCode,
    plan.weekStartDate,
    audit.first_generation_audit_at,
    audit.latest_generation_audit_at
ORDER BY request.requestDate, request.requestCode;

-- Duplicate ingredient preview. review_order is only a deterministic inspection
-- order; it is NOT a canonical-ID decision. All 15 known ingredient foreign-key
-- consumers are counted independently to avoid join multiplication.
WITH duplicate_ingredient_names AS (
    SELECT LOWER(TRIM(ingredientName)) AS normalized_name
    FROM ingredients
    WHERE isActive = 1
    GROUP BY LOWER(TRIM(ingredientName))
    HAVING COUNT(*) > 1
), duplicate_reference_counts AS (
    SELECT
        duplicate_name.normalized_name,
        ingredient.ingredientId,
        ingredient.ingredientCode,
        ingredient.ingredientName,
        ingredient.unitId,
        ingredient.warehouseId,
        ingredient.isActive,
        (SELECT COUNT(*) FROM currentstock AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS current_stock_refs,
        (SELECT COUNT(*) FROM currentstocklots AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS current_stock_lot_refs,
        (SELECT COUNT(*) FROM dishbom AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS bom_refs,
        (SELECT COUNT(*) FROM inventoryissuelines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS issue_line_refs,
        (SELECT COUNT(*) FROM inventoryreceiptlines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS receipt_line_refs,
        (SELECT COUNT(*) FROM inventoryreturnlines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS return_line_refs,
        (SELECT COUNT(*) FROM materialrequestlines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS demand_line_refs,
        (SELECT COUNT(*) FROM purchaserequestlines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS purchase_request_line_refs,
        (SELECT COUNT(*) FROM purchaseorderlines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS purchase_order_line_refs,
        (SELECT COUNT(*) FROM stockmovements AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS stock_movement_refs,
        (SELECT COUNT(*) FROM stocksnapshots AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS stock_snapshot_refs,
        (SELECT COUNT(*) FROM stocktakelines AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS stocktake_line_refs,
        (SELECT COUNT(*) FROM supplementalmaterialrequests AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS supplemental_request_refs,
        (SELECT COUNT(*) FROM supplierquotations AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS quotation_refs,
        (SELECT COUNT(*) FROM unitnormalizationreviews AS ref WHERE ref.ingredientId = ingredient.ingredientId) AS unit_review_refs
    FROM duplicate_ingredient_names AS duplicate_name
    JOIN ingredients AS ingredient
        ON ingredient.isActive = 1
       AND LOWER(TRIM(ingredient.ingredientName)) = duplicate_name.normalized_name
), ranked_duplicate_references AS (
    SELECT
        refs.*,
        current_stock_refs + current_stock_lot_refs + bom_refs + issue_line_refs +
        receipt_line_refs + return_line_refs + demand_line_refs + purchase_request_line_refs +
        purchase_order_line_refs + stock_movement_refs + stock_snapshot_refs + stocktake_line_refs +
        supplemental_request_refs + quotation_refs + unit_review_refs AS total_reference_rows
    FROM duplicate_reference_counts AS refs
)
SELECT
    'duplicate_ingredient_reference_preview' AS audit_section,
    normalized_name,
    ROW_NUMBER() OVER (
        PARTITION BY normalized_name
        ORDER BY total_reference_rows DESC, ingredientCode, HEX(ingredientId)
    ) AS review_order,
    HEX(ingredientId) AS ingredient_id_hex,
    ingredientCode,
    ingredientName,
    HEX(unitId) AS unit_id_hex,
    HEX(warehouseId) AS warehouse_id_hex,
    isActive,
    total_reference_rows,
    current_stock_refs,
    current_stock_lot_refs,
    bom_refs,
    issue_line_refs,
    receipt_line_refs,
    return_line_refs,
    demand_line_refs,
    purchase_request_line_refs,
    purchase_order_line_refs,
    stock_movement_refs,
    stock_snapshot_refs,
    stocktake_line_refs,
    supplemental_request_refs,
    quotation_refs,
    unit_review_refs
FROM ranked_duplicate_references
ORDER BY normalized_name, review_order;

WITH duplicate_dish_names AS (
    SELECT LOWER(TRIM(dishName)) AS normalized_name
    FROM dishes
    WHERE isActive = 1
    GROUP BY LOWER(TRIM(dishName))
    HAVING COUNT(*) > 1
)
SELECT
    'duplicate_dish_reference_preview' AS audit_section,
    duplicate_name.normalized_name,
    HEX(dish.dishId) AS dish_id_hex,
    dish.dishCode,
    dish.dishName,
    COUNT(DISTINCT bom.bomId) AS bom_lines,
    COUNT(DISTINCT menu_item.menuItemId) AS menu_references
FROM duplicate_dish_names AS duplicate_name
JOIN dishes AS dish
    ON dish.isActive = 1
   AND LOWER(TRIM(dish.dishName)) = duplicate_name.normalized_name
LEFT JOIN dishbom AS bom ON bom.dishId = dish.dishId
LEFT JOIN menuitems AS menu_item ON menu_item.dishId = dish.dishId
GROUP BY duplicate_name.normalized_name, dish.dishId, dish.dishCode, dish.dishName
ORDER BY duplicate_name.normalized_name, dish.dishCode;

SELECT
    'menu_status_summary' AS audit_section,
    'menuversions' AS entity,
    status,
    COUNT(*) AS row_count
FROM menuversions
GROUP BY status
UNION ALL
SELECT
    'menu_status_summary' AS audit_section,
    'menuschedules' AS entity,
    status,
    COUNT(*) AS row_count
FROM menuschedules
GROUP BY status
ORDER BY entity, status;

-- DRAFT menu versions with import lineage and downstream references. This does
-- not decide whether DRAFT is test data or whether it should be published.
SELECT
    'draft_menu_version_lineage' AS audit_section,
    HEX(version.menuVersionId) AS menu_version_id_hex,
    customer.customerCode,
    version.weekStartDate,
    version.versionNo,
    version.sourceFileName,
    version.sourceImportBatch,
    version.createdAt,
    version.updatedAt,
    version.publishedAt,
    COUNT(DISTINCT schedule.menuScheduleId) AS schedule_rows,
    COUNT(DISTINCT plan.planId) AS production_plan_refs,
    COUNT(DISTINCT request.requestId) AS material_request_refs
FROM menuversions AS version
JOIN customers AS customer ON customer.customerId = version.customerId
LEFT JOIN menuschedules AS schedule ON schedule.menuVersionId = version.menuVersionId
LEFT JOIN productionplans AS plan ON plan.menuVersionId = version.menuVersionId
LEFT JOIN materialrequests AS request ON request.planId = plan.planId
WHERE version.status = 'DRAFT'
GROUP BY
    version.menuVersionId,
    customer.customerCode,
    version.weekStartDate,
    version.versionNo,
    version.sourceFileName,
    version.sourceImportBatch,
    version.createdAt,
    version.updatedAt,
    version.publishedAt
ORDER BY version.weekStartDate, customer.customerCode, version.versionNo;

-- Cancelled demand lineage. Counts expose independent purchasing history; the
-- audit does not reopen or regenerate any record.
WITH cancellation_audit AS (
    SELECT entityId, changedAt, oldValue, newValue, reason
    FROM (
        SELECT
            audit.entityId,
            audit.changedAt,
            audit.oldValue,
            audit.newValue,
            audit.reason,
            ROW_NUMBER() OVER (PARTITION BY audit.entityId ORDER BY audit.changedAt DESC, audit.auditId DESC) AS row_no
        FROM auditlogs AS audit
        WHERE LOWER(audit.entityName) = 'materialrequest'
          AND audit.fieldName = 'Status'
          AND UPPER(COALESCE(audit.newValue, '')) = 'CANCELLED'
    ) AS ranked_audit
    WHERE row_no = 1
)
SELECT
    'cancelled_demand_lineage' AS audit_section,
    HEX(material_request.requestId) AS request_id_hex,
    material_request.requestCode,
    material_request.requestDate,
    cancellation.changedAt AS cancelled_at,
    cancellation.oldValue AS status_before_cancel,
    cancellation.reason AS cancellation_reason,
    COUNT(DISTINCT purchase_request.purchaseRequestId) AS linked_purchase_requests,
    COUNT(DISTINCT CASE WHEN purchase_request.status <> 'CANCELLED' THEN purchase_request.purchaseRequestId END) AS non_cancelled_purchase_requests,
    COUNT(DISTINCT supplier_decision.purchaseLineSupplierDecisionId) AS supplier_decision_rows,
    COUNT(DISTINCT purchase_order.purchaseOrderId) AS linked_purchase_orders,
    COUNT(DISTINCT receipt_line.receiptId) AS linked_inventory_receipts,
    GROUP_CONCAT(DISTINCT purchase_request.purchaseRequestCode ORDER BY purchase_request.purchaseRequestCode) AS purchase_request_codes
FROM materialrequests AS material_request
JOIN materialrequestlines AS material_line ON material_line.requestId = material_request.requestId
LEFT JOIN purchaserequestlines AS purchase_line ON purchase_line.materialRequestLineId = material_line.requestLineId
LEFT JOIN purchaserequests AS purchase_request ON purchase_request.purchaseRequestId = purchase_line.purchaseRequestId
LEFT JOIN purchaselinesupplierdecisions AS supplier_decision ON supplier_decision.purchaseRequestLineId = purchase_line.purchaseRequestLineId
LEFT JOIN purchaseorderlines AS order_line ON order_line.purchaseRequestLineId = purchase_line.purchaseRequestLineId
LEFT JOIN purchaseorders AS purchase_order ON purchase_order.purchaseOrderId = order_line.purchaseOrderId
LEFT JOIN inventoryreceiptlines AS receipt_line ON receipt_line.purchaseRequestLineId = purchase_line.purchaseRequestLineId
LEFT JOIN cancellation_audit AS cancellation ON cancellation.entityId = material_request.requestId
WHERE material_request.status = 'CANCELLED'
GROUP BY
    material_request.requestId,
    material_request.requestCode,
    material_request.requestDate,
    cancellation.changedAt,
    cancellation.oldValue,
    cancellation.reason
ORDER BY material_request.requestDate, material_request.requestCode;

SELECT
    'unit_normalization_review_summary' AS audit_section,
    status,
    confidence,
    COUNT(*) AS review_count
FROM unitnormalizationreviews
GROUP BY status, confidence
ORDER BY status, confidence;

-- Backup-table inventory and database-side consumers. table_rows is an InnoDB
-- estimate; retention and off-schema destination still require an operator decision.
WITH backup_tables AS (
    SELECT table_name, table_type, table_rows, create_time, data_length, index_length
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND (
          table_name LIKE 'backup\_%' ESCAPE '\\'
          OR table_name LIKE '%\_backup' ESCAPE '\\'
          OR table_name LIKE '%\_backup\_%' ESCAPE '\\'
      )
)
SELECT
    'backup_table_consumer_preview' AS audit_section,
    backup.table_name,
    backup.table_type,
    backup.table_rows AS estimated_rows,
    backup.create_time,
    backup.data_length,
    backup.index_length,
    (
        SELECT COUNT(*)
        FROM information_schema.key_column_usage AS relation
        WHERE relation.table_schema = DATABASE()
          AND relation.referenced_table_name IS NOT NULL
          AND (relation.table_name = backup.table_name OR relation.referenced_table_name = backup.table_name)
    ) AS foreign_key_consumers,
    (
        SELECT COUNT(*)
        FROM information_schema.views AS view_info
        WHERE view_info.table_schema = DATABASE()
          AND LOWER(view_info.view_definition) LIKE CONCAT('%', LOWER(backup.table_name), '%')
    ) AS view_consumers,
    (
        SELECT COUNT(*)
        FROM information_schema.triggers AS trigger_info
        WHERE trigger_info.trigger_schema = DATABASE()
          AND (
              trigger_info.event_object_table = backup.table_name
              OR LOWER(trigger_info.action_statement) LIKE CONCAT('%', LOWER(backup.table_name), '%')
          )
    ) AS trigger_consumers,
    (
        SELECT COUNT(*)
        FROM information_schema.routines AS routine_info
        WHERE routine_info.routine_schema = DATABASE()
          AND LOWER(COALESCE(routine_info.routine_definition, '')) LIKE CONCAT('%', LOWER(backup.table_name), '%')
    ) AS routine_consumers,
    (
        SELECT COUNT(*)
        FROM information_schema.events AS event_info
        WHERE event_info.event_schema = DATABASE()
          AND LOWER(COALESCE(event_info.event_definition, '')) LIKE CONCAT('%', LOWER(backup.table_name), '%')
    ) AS event_consumers
FROM backup_tables AS backup
ORDER BY backup.table_name;
