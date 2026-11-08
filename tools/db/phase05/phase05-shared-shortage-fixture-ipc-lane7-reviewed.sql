-- Phase 5 Task 3 shared-shortage fixture. Exact disposable lane only.
-- Appends one isolated warehouse with 1 kg stock and two explicit 1 kg customer demands.
DELIMITER $$
DROP PROCEDURE IF EXISTS p05_append_shared_shortage_fixture$$
CREATE PROCEDURE p05_append_shared_shortage_fixture()
BEGIN
    DECLARE v_head_count INT DEFAULT 0;
    DECLARE v_master_count INT DEFAULT 0;
    DECLARE v_collision_count INT DEFAULT 0;
    DECLARE v_warehouse_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000001');
    DECLARE v_lot_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000002');
    DECLARE v_movement_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000003');
    DECLARE v_anv_request_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000011');
    DECLARE v_anv_line_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000012');
    DECLARE v_dav_request_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000021');
    DECLARE v_dav_line_id BINARY(16) DEFAULT UNHEX('A0520000000000000000000000000022');
    DECLARE v_anv_plan_id BINARY(16) DEFAULT UNHEX('85847E3F6C4AA74EBB6BCB33B3B2B3D7');
    DECLARE v_anv_plan_line_id BINARY(16) DEFAULT UNHEX('2FBF192060F67D4DB13F931E569CF5CC');
    DECLARE v_dav_plan_id BINARY(16) DEFAULT UNHEX('07AFB1C8E6A7864881087F79B533CD88');
    DECLARE v_dav_plan_line_id BINARY(16) DEFAULT UNHEX('1300786DF2E7C446829FC990BDA87493');
    DECLARE v_ingredient_id BINARY(16) DEFAULT UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    DECLARE v_unit_id BINARY(16) DEFAULT UNHEX('70D2453FDE9E9849BD19B38C55A2B31B');
    DECLARE v_admin_id BINARY(16) DEFAULT UNHEX('00000010000000000000000000000001');

    IF BINARY DATABASE() <> BINARY 'ipc_lane7' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture accepts only exact ipc_lane7.';
    END IF;

    SELECT COUNT(*) INTO v_head_count
    FROM __EFMigrationsHistory
    WHERE migrationId = '20260813171032_AddMenuAmendmentDecisionFanRemediations';
    IF v_head_count <> 1 OR (SELECT COUNT(*) FROM __EFMigrationsHistory) <> 70 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Migration head/count precondition failed.';
    END IF;

    SELECT COUNT(*) INTO v_master_count
    FROM productionplanlines pl
    JOIN productionplans p ON p.planId = pl.planId
    JOIN customers c ON c.customerId = pl.customerId
    WHERE (pl.planLineId = v_anv_plan_line_id AND p.planId = v_anv_plan_id AND p.planDate = '2026-08-15' AND c.customerCode = 'ANV')
       OR (pl.planLineId = v_dav_plan_line_id AND p.planId = v_dav_plan_id AND p.planDate = '2026-08-15' AND c.customerCode = 'DAV');
    IF v_master_count <> 2
       OR NOT EXISTS (SELECT 1 FROM ingredients WHERE ingredientId = v_ingredient_id AND ingredientName = 'Thịt bằm' AND unitId = v_unit_id)
       OR NOT EXISTS (SELECT 1 FROM users WHERE userId = v_admin_id AND username = 'admin') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Master lineage precondition failed.';
    END IF;

    SELECT
        (SELECT COUNT(*) FROM warehouses WHERE warehouseId = v_warehouse_id OR warehouseCode = 'P05-SHARED') +
        (SELECT COUNT(*) FROM materialrequests WHERE requestId IN (v_anv_request_id, v_dav_request_id) OR requestCode IN ('MR-P05-SHARED-ANV','MR-P05-SHARED-DAV')) +
        (SELECT COUNT(*) FROM materialrequestlines WHERE requestLineId IN (v_anv_line_id, v_dav_line_id)) +
        (SELECT COUNT(*) FROM stockmovements WHERE movementId = v_movement_id) +
        (SELECT COUNT(*) FROM currentstocklots WHERE lotStockId = v_lot_id)
    INTO v_collision_count;
    IF v_collision_count <> 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shared-shortage fixture already exists; duplicate append denied.';
    END IF;

    INSERT INTO warehouses (warehouseId, warehouseCode, warehouseName, warehouseType, note)
    VALUES (v_warehouse_id, 'P05-SHARED', 'Kho chia sẻ kiểm thử', 'KHAC', 'Fixture Phase 5: quyết định cấp tồn dùng chung.');

    INSERT INTO currentstock (warehouseId, ingredientId, unitId, currentQty, lastUpdated)
    VALUES (v_warehouse_id, v_ingredient_id, v_unit_id, 1.000000, UTC_TIMESTAMP());
    INSERT INTO currentstocklots (lotStockId, warehouseId, ingredientId, unitId, lotNumber, manufactureDate, expiredDate, currentQty, lastUpdated)
    VALUES (v_lot_id, v_warehouse_id, v_ingredient_id, v_unit_id, 'P05-SHARED-LOT', '2026-08-14', '2026-08-20', 1.000000, UTC_TIMESTAMP());
    INSERT INTO stockmovements
        (movementId, movementDate, warehouseId, ingredientId, unitId, movementType, refTable, refId,
         quantityIn, quantityOut, reason, note, performedBy, lotNumber, manufactureDate, expiredDate, beforeQty, afterQty)
    VALUES
        (v_movement_id, UTC_TIMESTAMP(), v_warehouse_id, v_ingredient_id, v_unit_id, 'ADJUSTMENT',
         'phase05sharedshortage', v_warehouse_id, 1.000000, 0.000000,
         'Khởi tạo tồn kiểm thử cô lập cho quyết định cấp dùng chung.', 'Không thuộc chứng từ Golden.',
         v_admin_id, 'P05-SHARED-LOT', '2026-08-14', '2026-08-20', 0.000000, 1.000000);

    INSERT INTO materialrequests
        (requestId, requestCode, planId, requestDate, requestScope, status, createdBy, approvedBy, approvedAt)
    VALUES
        (v_anv_request_id, 'MR-P05-SHARED-ANV', v_anv_plan_id, '2026-08-15', 'MORNING', 'SENTTOWAREHOUSE', v_admin_id, v_admin_id, UTC_TIMESTAMP()),
        (v_dav_request_id, 'MR-P05-SHARED-DAV', v_dav_plan_id, '2026-08-15', 'MORNING', 'SENTTOWAREHOUSE', v_admin_id, v_admin_id, UTC_TIMESTAMP());

    INSERT INTO materialrequestlines
        (requestLineId, requestId, planLineId, ingredientId, unitId, totalServings, grossQtyPerServing,
         bomRatePercent, totalRequiredQty, currentStockQty, suggestedPurchaseQty,
         appliedPortionRatePercent, appliedPortionRuleSource, bomScope, priceTierAmount)
    VALUES
        (v_anv_line_id, v_anv_request_id, v_anv_plan_line_id, v_ingredient_id, v_unit_id, 1, 1.000000,
         100.00, 1.000000, 1.000000, 0.000000, 100.00, 'CONTRACT_DEFAULT', 'global', 25000.00),
        (v_dav_line_id, v_dav_request_id, v_dav_plan_line_id, v_ingredient_id, v_unit_id, 1, 1.000000,
         100.00, 1.000000, 1.000000, 0.000000, 100.00, 'CONTRACT_DEFAULT', 'global', 25000.00);
END$$
DELIMITER ;

CALL p05_append_shared_shortage_fixture();
DROP PROCEDURE p05_append_shared_shortage_fixture;

-- Forward recovery pointer (only before either request has an issue/lifecycle receipt):
-- DELETE FROM materialrequestlines WHERE requestLineId IN (UNHEX('A0520000000000000000000000000012'),UNHEX('A0520000000000000000000000000022'));
-- DELETE FROM materialrequests WHERE requestId IN (UNHEX('A0520000000000000000000000000011'),UNHEX('A0520000000000000000000000000021'));
-- DELETE FROM stockmovements WHERE movementId=UNHEX('A0520000000000000000000000000003');
-- DELETE FROM currentstocklots WHERE lotStockId=UNHEX('A0520000000000000000000000000002');
-- DELETE FROM currentstock WHERE warehouseId=UNHEX('A0520000000000000000000000000001') AND ingredientId=UNHEX('65B8047268F5AE489108B1A6043DFBC3');
-- DELETE FROM warehouses WHERE warehouseId=UNHEX('A0520000000000000000000000000001');
