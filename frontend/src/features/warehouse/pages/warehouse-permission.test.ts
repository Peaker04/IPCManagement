import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';

describe('WarehousePage permission contract', () => {
  it('uses the normalized thukho role for warehouse mutations', () => {
    expect(warehousePageSource).toContain("useHasRole(['thukho'])");
    expect(warehousePageSource).not.toContain("useHasRole(['warehouse'])");
  });

  it('does not crash when supplemental request data is missing its page items', () => {
    expect(warehousePageSource).toContain('supplementalRequests?.items?.find(');
  });

  it('waits for every issue allocation projection before allowing another stock issue', () => {
    expect(warehousePageSource).toContain('useGetKitchenIssuesQuery({ limit: 500 })');
    expect(warehousePageSource).toContain('isFetching: isFetchingKitchenIssues');
    expect(warehousePageSource).toContain('const isIssueAllocationRefreshing = isFetchingSelectedDemand');
    expect(warehousePageSource).toContain('refetchIssueCandidates()');
    expect(warehousePageSource).toContain('refetchKitchenIssues()');
    expect(warehousePageSource).toContain('refetchSelectedWarehouseStock()');
    expect(warehousePageSource).toContain('isIssueAllocationRefreshing || isAllocationSourceError');
  });

  it('searches stock snapshots and ledger events before their pagination boundaries', () => {
    expect(warehousePageSource).toContain('searchKeyword: deferredCurrentStockSearch || undefined');
    expect(warehousePageSource).toContain('searchKeyword: deferredStockMovementSearch || undefined');
    expect(warehousePageSource).toContain('setCurrentStockPage(1)');
    expect(warehousePageSource).toContain('setStockMovementCursors([])');
  });
});
