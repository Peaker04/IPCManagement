import { describe, expect, it } from 'vitest';
import warehouseMovementPanelSource from './WarehouseMovementPanel.tsx?raw';

describe('WarehouseMovementPanel contract', () => {
  it('phase27-baseline-responsive-wide-rail-stacked: uses the bounded responsive rail and keeps one tab-level Phiếu kho owner', () => {
    expect(warehouseMovementPanelSource).toContain('<SplitWorkbench\n      wideDetailRail');
    expect(warehouseMovementPanelSource.match(/detailLabel="Phiếu kho"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource).not.toMatch(/tabIndex|\border\s*:/);
  });

  it('retains independent current-stock and movement-history controls and states', () => {
    expect(warehouseMovementPanelSource.match(/title="Tồn kho hiện tại"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource.match(/title="Luân chuyển kho"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource).toContain('warehouse-current-stock-search');
    expect(warehouseMovementPanelSource).toContain('warehouse-stock-movement-search');
    expect(warehouseMovementPanelSource).toContain('onCurrentStockPageChange');
    expect(warehouseMovementPanelSource).toContain('onStockMovementNext');
    for (const phase of ['loading', 'ready', 'error', 'forbidden', 'uninitialized']) {
      expect(warehouseMovementPanelSource).toContain(`phase === '${phase}'`);
    }
  });
});
