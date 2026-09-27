import { describe, expect, it } from 'vitest';
import warehouseMovementPanelSource from './WarehouseMovementPanel.tsx?raw';

describe('WarehouseMovementPanel contract', () => {
  it('phase27-baseline-responsive-wide-rail-stacked: uses the bounded responsive rail and keeps one tab-level Phiếu kho owner', () => {
    expect(warehouseMovementPanelSource).toMatch(/<SplitWorkbench\s+wideDetailRail/);
    expect(warehouseMovementPanelSource.match(/detailLabel="Phiếu kho"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource).not.toMatch(/tabIndex|\border\s*:/);
  });

  it('keeps current-stock failure ownership to one explanatory surface', () => {
    expect(warehouseMovementPanelSource).not.toContain("currentStockView.phase === 'forbidden' ? 'Không có quyền xem tồn kho' : isCurrentStockError ? 'Không tải được tồn kho'");
  });

  it('uses business table semantics for the BOTH-mode warehouse movement family', () => {
    expect(warehouseMovementPanelSource).toContain('scope="col"')
    expect(warehouseMovementPanelSource).toContain('data-cell-role="numeric"')
    expect(warehouseMovementPanelSource).toContain('ariaLabel="Tồn kho hiện tại theo kho và nguyên liệu"')
    expect(warehouseMovementPanelSource).toContain('caption="Snapshot tồn kho hiện tại theo kho và nguyên liệu"')
    expect(warehouseMovementPanelSource).toContain('ariaLabel="Sổ luân chuyển kho"')
    expect(warehouseMovementPanelSource).toContain('caption="Các bút toán nhập, xuất, trả và điều chỉnh kho"')
    expect(warehouseMovementPanelSource).toContain('emptyTitle="Chưa phát sinh bút toán luân chuyển kho."')
    expect(warehouseMovementPanelSource).toContain('Chưa có snapshot tồn kho hiện tại.')
  })

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
