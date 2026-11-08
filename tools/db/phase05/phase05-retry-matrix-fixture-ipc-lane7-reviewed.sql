-- Phase 5 Task 3 retry-matrix fixture. Exact disposable lane only.
-- Appends one isolated warehouse with 2 kg and two independent 1 kg demands.
DELIMITER $$
DROP PROCEDURE IF EXISTS p05_append_retry_matrix_fixture$$
CREATE PROCEDURE p05_append_retry_matrix_fixture()
BEGIN
    DECLARE v_collision_count INT DEFAULT 0;
    DECLARE v_warehouse_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000001');
    DECLARE v_lot_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000002');
    DECLARE v_movement_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000003');
    DECLARE v_request_a_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000011');
    DECLARE v_line_a_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000012');
    DECLARE v_request_b_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000021');
    DECLARE v_line_b_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000022');
    DECLARE v_anv_plan_id BINARY(16) DEFAULT UNHEX('85847E3F6C4AA74EBB6BCB33B3B2B3D7');
    DECLARE v_anv_plan_line_id BINARY(16) DEFAULT UNHEX('443EAAD3AB0FF2408105051DF843C740');
    DECLARE v_dav_plan_id BINARY(16) DEFAULT UNHEX('07AFB1C8E6A7864881087F79B533CD88');
    DECLARE v_dav_plan_line_id BINARY(16) DEFAULT UNHEX('1662C5CCEA5A124C838065CF06F090C1');
    DECLARE v_ingredient_id BINARY(16) DEFAULT UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    DECLARE v_unit_id BINARY(16) DEFAULT UNHEX('70D2453FDE9E9849BD19B38C55A2B31B');
    DECLARE v_admin_id BINARY(16) DEFAULT UNHEX('00000010000000000000000000000001');

    IF BINARY DATABASE() <> BINARY 'ipc_lane7' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture accepts only exact ipc_lane7.';
    END IF;
    IF (SELECT COUNT(*) FROM __EFMigrationsHistory) <> 70
       OR NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE migrationId='20260813171032_AddMenuAmendmentDecisionFanRemediations') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Migration head/count precondition failed.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM productionplanlines WHERE planLineId=v_anv_plan_line_id AND planId=v_anv_plan_id)
       OR NOT EXISTS (SELECT 1 FROM productionplanlines WHERE planLineId=v_dav_plan_line_id AND planId=v_dav_plan_id)
       OR NOT EXISTS (SELECT 1 FROM ingredients WHERE ingredientId=v_ingredient_id AND ingredientName='Thịt bằm' AND unitId=v_unit_id)
       OR NOT EXISTS (SELECT 1 FROM users WHERE userId=v_admin_id AND username='admin') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Master lineage precondition failed.';
    END IF;

    SELECT
      (SELECT COUNT(*) FROM warehouses WHERE warehouseId=v_warehouse_id OR warehouseCode='P05-RETRY') +
      (SELECT COUNT(*) FROM materialrequests WHERE requestId IN (v_request_a_id,v_request_b_id) OR requestCode IN ('MR-P05-RETRY-A','MR-P05-RETRY-B')) +
      (SELECT COUNT(*) FROM materialrequestlines WHERE requestLineId IN (v_line_a_id,v_line_b_id)) +
      (SELECT COUNT(*) FROM stockmovements WHERE movementId=v_movement_id) +
      (SELECT COUNT(*) FROM currentstocklots WHERE lotStockId=v_lot_id)
    INTO v_collision_count;
    IF v_collision_count <> 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Retry fixture already exists; duplicate append denied.';
    END IF;

    INSERT INTO warehouses (warehouseId,warehouseCode,warehouseName,warehouseType,note)
    VALUES (v_warehouse_id,'P05-RETRY','Kho kiểm thử gửi lại lệnh','KHAC','Fixture Phase 5 retry/stale/concurrent.');
    INSERT INTO currentstock (warehouseId,ingredientId,unitId,currentQty,lastUpdated)
    VALUES (v_warehouse_id,v_ingredient_id,v_unit_id,2.000000,UTC_TIMESTAMP());
    INSERT INTO currentstocklots (lotStockId,warehouseId,ingredientId,unitId,lotNumber,manufactureDate,expiredDate,currentQty,lastUpdated)
    VALUES (v_lot_id,v_warehouse_id,v_ingredient_id,v_unit_id,'P05-RETRY-LOT','2026-08-14','2026-08-20',2.000000,UTC_TIMESTAMP());
    INSERT INTO stockmovements
      (movementId,movementDate,warehouseId,ingredientId,unitId,movementType,refTable,refId,quantityIn,quantityOut,
       reason,note,performedBy,lotNumber,manufactureDate,expiredDate,beforeQty,afterQty)
    VALUES
      (v_movement_id,UTC_TIMESTAMP(),v_warehouse_id,v_ingredient_id,v_unit_id,'ADJUSTMENT','phase05retry',v_warehouse_id,
       2.000000,0.000000,'Khởi tạo tồn kiểm thử cô lập cho retry matrix.','Không thuộc chứng từ Golden.',v_admin_id,
       'P05-RETRY-LOT','2026-08-14','2026-08-20',0.000000,2.000000);

    INSERT INTO materialrequests
      (requestId,requestCode,planId,requestDate,requestScope,status,createdBy,approvedBy,approvedAt)
    VALUES
      (v_request_a_id,'MR-P05-RETRY-A',v_anv_plan_id,'2026-08-15','MORNING','SENTTOWAREHOUSE',v_admin_id,v_admin_id,UTC_TIMESTAMP()),
      (v_request_b_id,'MR-P05-RETRY-B',v_dav_plan_id,'2026-08-15','MORNING','SENTTOWAREHOUSE',v_admin_id,v_admin_id,UTC_TIMESTAMP());
    INSERT INTO materialrequestlines
      (requestLineId,requestId,planLineId,ingredientId,unitId,totalServings,grossQtyPerServing,bomRatePercent,
       totalRequiredQty,currentStockQty,suggestedPurchaseQty,appliedPortionRatePercent,appliedPortionRuleSource,bomScope,priceTierAmount)
    VALUES
      (v_line_a_id,v_request_a_id,v_anv_plan_line_id,v_ingredient_id,v_unit_id,1,1.000000,100.00,1.000000,2.000000,0.000000,100.00,'CONTRACT_DEFAULT','global',25000.00),
      (v_line_b_id,v_request_b_id,v_dav_plan_line_id,v_ingredient_id,v_unit_id,1,1.000000,100.00,1.000000,2.000000,0.000000,100.00,'CONTRACT_DEFAULT','global',25000.00);
END$$
DELIMITER ;

CALL p05_append_retry_matrix_fixture();
DROP PROCEDURE p05_append_retry_matrix_fixture;

-- Forward recovery pointer (only before either request has an issue/lifecycle receipt):
-- delete fixture rows in reverse FK order using the A053 IDs above.
