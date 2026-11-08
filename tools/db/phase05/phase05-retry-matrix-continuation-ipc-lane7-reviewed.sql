-- Phase 5 Task 3 retry-matrix continuation after the headed A attempt committed before runner capture failed.
-- Append-only: add 1 kg and an independent customer demand C; do not rewrite attempt A.
DELIMITER $$
DROP PROCEDURE IF EXISTS p05_append_retry_matrix_continuation$$
CREATE PROCEDURE p05_append_retry_matrix_continuation()
BEGIN
    DECLARE v_warehouse_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000001');
    DECLARE v_ingredient_id BINARY(16) DEFAULT UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    DECLARE v_unit_id BINARY(16) DEFAULT UNHEX('70D2453FDE9E9849BD19B38C55A2B31B');
    DECLARE v_admin_id BINARY(16) DEFAULT UNHEX('00000010000000000000000000000001');
    DECLARE v_movement_id BINARY(16) DEFAULT UNHEX('A0540000000000000000000000000003');
    DECLARE v_request_c_id BINARY(16) DEFAULT UNHEX('A0540000000000000000000000000011');
    DECLARE v_line_c_id BINARY(16) DEFAULT UNHEX('A0540000000000000000000000000012');
    DECLARE v_plan_id BINARY(16) DEFAULT UNHEX('85847E3F6C4AA74EBB6BCB33B3B2B3D7');
    DECLARE v_plan_line_id BINARY(16) DEFAULT UNHEX('49B7A55A69C1BF468AFD1355EB1CA306');

    IF BINARY DATABASE() <> BINARY 'ipc_lane7' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Continuation accepts only exact ipc_lane7.';
    END IF;
    IF (SELECT COUNT(*) FROM __EFMigrationsHistory) <> 70
       OR NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE migrationId='20260813171032_AddMenuAmendmentDecisionFanRemediations') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Migration head/count precondition failed.';
    END IF;
    IF (SELECT COUNT(*) FROM inventoryissues WHERE materialRequestId=UNHEX('A0530000000000000000000000000011')) <> 1
       OR (SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='InventoryIssue' AND aggregateId=UNHEX('A0530000000000000000000000000011')) <> 1
       OR (SELECT COUNT(*) FROM inventoryissues WHERE materialRequestId=UNHEX('A0530000000000000000000000000021')) <> 0
       OR (SELECT currentQty FROM currentstock WHERE warehouseId=v_warehouse_id AND ingredientId=v_ingredient_id) <> 1.000000 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attempt A / pending B precondition failed.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM productionplanlines WHERE planLineId=v_plan_line_id AND planId=v_plan_id)
       OR EXISTS (SELECT 1 FROM materialrequests WHERE requestId=v_request_c_id OR requestCode='MR-P05-RETRY-C')
       OR EXISTS (SELECT 1 FROM stockmovements WHERE movementId=v_movement_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Continuation master/collision precondition failed.';
    END IF;

    UPDATE currentstock SET currentQty=currentQty+1.000000,lastUpdated=UTC_TIMESTAMP()
    WHERE warehouseId=v_warehouse_id AND ingredientId=v_ingredient_id;
    UPDATE currentstocklots SET currentQty=currentQty+1.000000,lastUpdated=UTC_TIMESTAMP()
    WHERE lotStockId=UNHEX('A0530000000000000000000000000002');
    INSERT INTO stockmovements
      (movementId,movementDate,warehouseId,ingredientId,unitId,movementType,refTable,refId,quantityIn,quantityOut,
       reason,note,performedBy,lotNumber,manufactureDate,expiredDate,beforeQty,afterQty)
    VALUES
      (v_movement_id,UTC_TIMESTAMP(),v_warehouse_id,v_ingredient_id,v_unit_id,'ADJUSTMENT','phase05retrycontinuation',v_warehouse_id,
       1.000000,0.000000,'Bổ sung tồn continuation sau attempt A đã commit.','Append-only; không rewrite attempt A.',v_admin_id,
       'P05-RETRY-LOT','2026-08-14','2026-08-20',1.000000,2.000000);

    INSERT INTO materialrequests
      (requestId,requestCode,planId,requestDate,requestScope,status,createdBy,approvedBy,approvedAt)
    VALUES
      (v_request_c_id,'MR-P05-RETRY-C',v_plan_id,'2026-08-15','MORNING','SENTTOWAREHOUSE',v_admin_id,v_admin_id,UTC_TIMESTAMP());
    INSERT INTO materialrequestlines
      (requestLineId,requestId,planLineId,ingredientId,unitId,totalServings,grossQtyPerServing,bomRatePercent,
       totalRequiredQty,currentStockQty,suggestedPurchaseQty,appliedPortionRatePercent,appliedPortionRuleSource,bomScope,priceTierAmount)
    VALUES
      (v_line_c_id,v_request_c_id,v_plan_line_id,v_ingredient_id,v_unit_id,1,1.000000,100.00,1.000000,2.000000,0.000000,100.00,'CONTRACT_DEFAULT','global',25000.00);
END$$
DELIMITER ;

CALL p05_append_retry_matrix_continuation();
DROP PROCEDURE p05_append_retry_matrix_continuation;
