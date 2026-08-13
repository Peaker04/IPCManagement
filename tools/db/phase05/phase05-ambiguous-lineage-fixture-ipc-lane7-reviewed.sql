-- Phase 5 Task 3 controlled compatibility fixture. Exact disposable lane only.
-- Append-only zero-quantity legacy issue line; no stock movement or canonical source line is changed.
DELIMITER $$
DROP PROCEDURE IF EXISTS p05_append_ambiguous_lineage_fixture$$
CREATE PROCEDURE p05_append_ambiguous_lineage_fixture()
BEGIN
    DECLARE v_migration_count INT DEFAULT 0;
    DECLARE v_candidate_count INT DEFAULT 0;
    DECLARE v_fixture_count INT DEFAULT 0;
    DECLARE v_request_id BINARY(16);
    DECLARE v_ingredient_id BINARY(16);
    DECLARE v_unit_id BINARY(16);
    DECLARE v_warehouse_id BINARY(16);
    DECLARE v_admin_id BINARY(16);
    DECLARE v_issue_id BINARY(16) DEFAULT UNHEX('A0510000000000000000000000000001');
    DECLARE v_issue_line_id BINARY(16) DEFAULT UNHEX('A0510000000000000000000000000002');

    IF BINARY DATABASE() <> BINARY 'ipc_lane7' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture accepts only exact ipc_lane7.';
    END IF;

    SELECT COUNT(*) INTO v_migration_count
    FROM __EFMigrationsHistory
    WHERE migrationId = '20260813171032_AddMenuAmendmentDecisionFanRemediations';
    IF v_migration_count <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Migration head precondition failed.';
    END IF;

    SELECT mr.requestId, mrl.ingredientId, mrl.unitId, COUNT(*)
    INTO v_request_id, v_ingredient_id, v_unit_id, v_candidate_count
    FROM materialrequestlines mrl
    JOIN materialrequests mr ON mr.requestId = mrl.requestId
    JOIN productionplanlines pll ON pll.planLineId = mrl.planLineId
    JOIN productionplans p ON p.planId = mr.planId
    JOIN customers c ON c.customerId = pll.customerId
    JOIN ingredients i ON i.ingredientId = mrl.ingredientId
    WHERE c.customerCode = 'ANV'
      AND p.planDate = '2026-08-11'
      AND pll.shiftName = 'AFTERNOON'
      AND mr.requestCode = 'MR-ANV-20260811-FULLDAY'
      AND i.ingredientName = 'Thịt bằm'
    GROUP BY mr.requestId, mrl.ingredientId, mrl.unitId;
    IF v_candidate_count <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ambiguous candidate precondition must be exactly two.';
    END IF;

    SELECT COUNT(*) INTO v_fixture_count FROM inventoryissues
    WHERE issueId = v_issue_id OR issueCode = 'ISS-P05-AMBIGUOUS-ANV-20260811';
    IF v_fixture_count <> 0 OR EXISTS (SELECT 1 FROM inventoryissuelines WHERE issueLineId = v_issue_line_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture already exists; no duplicate append is allowed.';
    END IF;

    SELECT warehouseId INTO v_warehouse_id FROM warehouses ORDER BY warehouseName, warehouseId LIMIT 1;
    SELECT userId INTO v_admin_id FROM users WHERE username = 'admin' LIMIT 1;
    IF v_warehouse_id IS NULL OR v_admin_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture master-data precondition failed.';
    END IF;

    INSERT INTO inventoryissues
        (issueId, issueCode, issueDate, shiftName, warehouseId, materialRequestId, issuedBy, createdAt)
    VALUES
        (v_issue_id, 'ISS-P05-AMBIGUOUS-ANV-20260811', '2026-08-11', 'AFTERNOON', v_warehouse_id, v_request_id, v_admin_id, UTC_TIMESTAMP());

    INSERT INTO inventoryissuelines
        (issueLineId, issueId, ingredientId, unitId, requestedQty, issuedQty, materialRequestLineId)
    VALUES
        (v_issue_line_id, v_issue_id, v_ingredient_id, v_unit_id, 0.000000, 0.000000, NULL);
END$$
DELIMITER ;

CALL p05_append_ambiguous_lineage_fixture();
DROP PROCEDURE p05_append_ambiguous_lineage_fixture;

-- Forward recovery pointer (run only if no disposition has been created):
-- DELETE FROM inventoryissuelines WHERE issueLineId = UNHEX('A0510000000000000000000000000002');
-- DELETE FROM inventoryissues WHERE issueId = UNHEX('A0510000000000000000000000000001');
