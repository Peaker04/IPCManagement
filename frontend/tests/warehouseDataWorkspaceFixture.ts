export const WAREHOUSE_FIXTURE_VERSION = 'warehouse-ready/v1' as const;
export const warehouseKeeperActor = {
  userId: 'warehouse-keeper-phase27', username: 'warehouse-keeper-phase27', fullName: 'Thủ kho kiểm thử Phase 27',
  role: 'warehouse', roleCode: 'WAREHOUSE', roleName: 'Thủ kho', isAdminFullAccess: false,
  permissions: ['warehouse.read'],
} as const;
export const noWarehouseReadActor = {
  userId: 'no-warehouse-read-phase27', username: 'no-warehouse-read-phase27', fullName: 'Thu mua kiểm thử Phase 27',
  role: 'procurement', roleCode: 'PROCUREMENT', roleName: 'Thu mua', isAdminFullAccess: false,
  permissions: ['purchase.read'],
} as const;

export const currentStockRows = Array.from({ length: 8 }, (_, index) => ({
  id: `stock-phase27-${index + 1}`, warehouseId: 'warehouse-phase27-main', warehouse: index === 7 ? 'Kho nguyên liệu sản xuất trung tâm' : 'Kho chính',
  ingredientId: `ingredient-phase27-${index + 1}`, ingredient: index === 6 ? 'Nấm mèo khô loại một đã sơ chế' : ['Gạo tẻ', 'Dầu ăn', 'Cá nục', 'Đu đủ xanh'][index % 4],
  currentQty: index === 0 ? 0.125 : 1250 + index * 17.5, unit: 'kg', lastUpdated: `2026-08-${String(10 + index).padStart(2, '0')}T08:30:00Z`,
}));
export const stockMovementRows = Array.from({ length: 8 }, (_, index) => {
  const isIssue = index % 2 === 1;
  const quantity = index + 0.5;
  return {
    movementId: `movement-phase27-${index + 1}`,
    movementType: isIssue ? 'ISSUE' : 'RECEIPT',
    movementDate: `2026-08-${String(10 + index).padStart(2, '0')}T09:00:00Z`,
    warehouseId: 'warehouse-phase27-main',
    warehouseName: 'Kho chính',
    ingredientId: currentStockRows[index].ingredientId,
    ingredientName: currentStockRows[index].ingredient,
    unitId: 'unit-kg',
    unitName: 'kg',
    quantityIn: isIssue ? 0 : quantity,
    quantityOut: isIssue ? quantity : 0,
    beforeQty: 100 + index,
    afterQty: 100 + index + (isIssue ? -quantity : quantity),
    refTable: `PX-P27-${String(index + 1).padStart(3, '0')}`,
    refId: null,
    kitchenReceiptStatus: isIssue ? 'RECEIVED' : null,
    reason: isIssue ? 'Xuất nguyên liệu theo ca phục vụ' : 'Nhập từ đơn mua đã duyệt',
    note: null,
  };
});
export const warehouseDocuments = [
  { documentId: 'document-phase27-receipt', documentCode: 'PN-P27-001', documentType: 'Phiếu nhập', documentDate: '2026-08-17', status: 'POSTED', ownerLane: 'Kho', summary: 'Nhập nguyên liệu theo đơn mua đã duyệt', route: '/warehouse?purchaseOrderId=po-phase27-1' },
  { documentId: 'document-phase27-issue', documentCode: 'PX-P27-001', documentType: 'Phiếu xuất', documentDate: '2026-08-17', status: 'RECEIVED', ownerLane: 'Kho', summary: 'Xuất nguyên liệu cho ca phục vụ', route: '/warehouse' },
] as const;
export const warehouseFixtureRecordIds = [...currentStockRows.map(({ id }) => id), ...stockMovementRows.map(({ movementId }) => movementId), ...warehouseDocuments.map(({ documentId }) => documentId)];

export function assertWarehouseFixture() {
  const ids = warehouseFixtureRecordIds;
  if (currentStockRows.length !== 8 || stockMovementRows.length !== 8 || warehouseDocuments.length < 2 || new Set(ids).size !== ids.length) throw new Error('Invalid Warehouse fixture');
  if (currentStockRows.some((row) => row.currentQty < 0) || stockMovementRows.some((row) => row.quantityIn <= 0 && row.quantityOut <= 0)) throw new Error('Warehouse fixture contains invalid quantity');
}

export const readyFixture = { currentStockRows, stockMovementRows, warehouseDocuments } as const;
export const mixedEmptyFixture = { currentStockRows: [], stockMovementRows, warehouseDocuments } as const;
