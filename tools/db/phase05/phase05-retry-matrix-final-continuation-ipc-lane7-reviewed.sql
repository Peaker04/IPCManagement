-- Final append-only continuation: preserve committed A/B attempts, keep C pending, add 1 kg + demand D for physical proof.
DELIMITER $$
DROP PROCEDURE IF EXISTS p05_append_retry_matrix_final_continuation$$
CREATE PROCEDURE p05_append_retry_matrix_final_continuation()
BEGIN
    DECLARE v_warehouse_id BINARY(16) DEFAULT UNHEX('A0530000000000000000000000000001');
    DECLARE v_ingredient_id BINARY(16) DEFAULT UNHEX('65B8047268F5AE489108B1A6043DFBC3');
    DECLARE v_unit_id BINARY(16) DEFAULT UNHEX('70D2453FDE9E9849BD19B38C55A2B31B');
    DECLARE v_admin_id BINARY(16) DEFAULT UNHEX('00000010000000000000000000000001');
    DECLARE v_movement_id BINARY(16) DEFAULT UNHEX('A0550000000000000000000000000003');
    DECLARE v_request_id BINARY(16) DEFAULT UNHEX('A0550000000000000000000000000011');
    DECLARE v_line_id BINARY(16) DEFAULT UNHEX('A0550000000000000000000000000012');
    DECLARE v_plan_id BINARY(16) DEFAULT UNHEX('07AFB1C8E6A7864881087F79B533CD88');
    DECLARE v_plan_line_id BINARY(16) DEFAULT UNHEX('330F355E9DBC984A8083F7B9CCAEECAA');

    IF BINARY DATABASE() <> BINARY 'ipc_lane7' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final continuation accepts only ipc_lane7.'; END IF;
    IF (SELECT COUNT(*) FROM __EFMigrationsHistory) <> 70 OR NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE migrationId='20260813171032_AddMenuAmendmentDecisionFanRemediations') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Migration precondition failed.'; END IF;
    IF (SELECT COUNT(*) FROM inventoryissues WHERE materialRequestId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'))) <> 2
       OR (SELECT COUNT(*) FROM lifecyclecommandreceipts WHERE aggregateType='InventoryIssue' AND aggregateId IN (UNHEX('A0530000000000000000000000000011'),UNHEX('A0530000000000000000000000000021'))) <> 2
       OR (SELECT COUNT(*) FROM inventoryissues WHERE materialRequestId=UNHEX('A0540000000000000000000000000011')) <> 0
       OR (SELECT currentQty FROM currentstock WHERE warehouseId=v_warehouse_id AND ingredientId=v_ingredient_id) <> 1.000000 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A/B/C lineage precondition failed.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM productionplanlines WHERE planLineId=v_plan_line_id AND planId=v_plan_id)
       OR EXISTS (SELECT 1 FROM materialrequests WHERE requestId=v_request_id OR requestCode='MR-P05-RETRY-D')
       OR EXISTS (SELECT 1 FROM stockmovements WHERE movementId=v_movement_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final continuation collision/master precondition failed.'; END IF;

    UPDATE currentstock SET currentQty=currentQty+1.000000,lastUpdated=UTC_TIMESTAMP() WHERE warehouseId=v_warehouse_id AND ingredientId=v_ingredient_id;
    UPDATE currentstocklots SET currentQty=currentQty+1.000000,lastUpdated=UTC_TIMESTAMP() WHERE lotStockId=UNHEX('A0530000000000000000000000000002');
    INSERT INTO stockmovements
      (movementId,movementDate,warehouseId,ingredientId,unitId,movementType,refTable,refId,quantityIn,quantityOut,reason,note,performedBy,lotNumber,manufactureDate,expiredDate,beforeQty,afterQty)
    VALUES (v_movement_id,UTC_TIMESTAMP(),v_warehouse_id,v_ingredient_id,v_unit_id,'ADJUSTMENT','phase05retryfinal',v_warehouse_id,1,0,'Bổ sung tồn final continuation.','Append-only; giữ A/B attempts.',v_admin_id,'P05-RETRY-LOT','2026-08-14','2026-08-20',1,2);
    INSERT INTO materialrequests (requestId,requestCode,planId,requestDate,requestScope,status,createdBy,approvedBy,approvedAt)
    VALUES (v_request_id,'MR-P05-RETRY-D',v_plan_id,'2026-08-15','MORNING','SENTTOWAREHOUSE',v_admin_id,v_admin_id,UTC_TIMESTAMP());
    INSERT INTO materialrequestlines
      (requestLineId,requestId,planLineId,ingredientId,unitId,totalServings,grossQtyPerServing,bomRatePercent,totalRequiredQty,currentStockQty,suggestedPurchaseQty,appliedPortionRatePercent,appliedPortionRuleSource,bomScope,priceTierAmount)
    VALUES (v_line_id,v_request_id,v_plan_line_id,v_ingredient_id,v_unit_id,1,1,100,1,2,0,100,'CONTRACT_DEFAULT','global',25000);
END$$
DELIMITER ;
CALL p05_append_retry_matrix_final_continuation();
DROP PROCEDURE p05_append_retry_matrix_final_continuation;
