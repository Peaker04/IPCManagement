import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';
import warehouseMovementPanelSource from './WarehouseMovementPanel.tsx?raw';

describe('WarehousePage permission contract', () => {
  it('uses the normalized dieuphoi role for receipt draft creation', () => {
    expect(warehousePageSource).toContain("useHasRole(['dieuphoi'])");
    expect(warehousePageSource).not.toContain("useHasRole(['warehouse'])");
  });

  it('uses the normalized thukho role for inventory issue creation', () => {
    expect(warehousePageSource).toContain("const canCreateInventoryIssues = useHasRole(['thukho'])");
    expect(warehousePageSource).toContain('canManageWarehouse: canCreateInventoryIssues');
    expect(warehousePageSource).toContain('<WarehouseExceptionsWorkbench canManage={canCreateInventoryIssues} canDisposition={canDispositionReturns} />');
    expect(warehousePageSource).not.toContain('<WarehouseExceptionsWorkbench canManage={canReceivePurchases}');
  });

  it('does not request supplemental material data while creating a receipt draft', () => {
    expect(warehousePageSource).not.toContain('useGetSupplementalMaterialRequestsQuery');
    expect(warehousePageSource).not.toContain('preferredWarehouseId=');
  });

  it('waits for every issue allocation projection before allowing another stock issue', () => {
    expect(warehousePageSource).toContain('useGetKitchenIssuesQuery({ limit: 500 })');
    expect(warehousePageSource).toContain('isFetching: isFetchingKitchenIssues');
    expect(warehousePageSource).toContain('const isIssueAllocationRefreshing = isFetchingSelectedDemand');
    expect(warehousePageSource).toContain('refetchIssueCandidates()');
    expect(warehousePageSource).toContain('refetchKitchenIssues()');
    expect(warehousePageSource).toContain('refetchSelectedWarehouseStock()');
    expect(warehousePageSource).toContain('isIssueAllocationRefreshing || isAllocationSourceError');
    expect(warehousePageSource).toContain('commandId: issueCommandId');
    expect(warehousePageSource).toContain('expectedVersion: selectedIssueCandidate.concurrencyVersion');
  });

  it('searches stock snapshots and ledger events before their pagination boundaries', () => {
    expect(warehousePageSource).toContain('searchKeyword: deferredCurrentStockSearch || undefined');
    expect(warehousePageSource).toContain('searchKeyword: deferredStockMovementSearch || undefined');
    expect(warehousePageSource).toContain('setCurrentStockPage(1)');
    expect(warehousePageSource).toContain('setStockMovementCursors([])');
  });

  it('reserves the shared table geometry while asynchronous rows settle', () => {
    expect(warehouseMovementPanelSource).toContain('ipc-warehouse-table-shell min-h-[27rem]');
    expect(warehouseMovementPanelSource).toContain('className="min-h-[27rem]"');
  });
});
