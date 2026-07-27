import { describe, expect, it } from 'vitest';
import bomSource from './AdminBomPanel.tsx?raw';
import inventorySource from './AdminInventoryPanel.tsx?raw';
import modelSource from './useAdminDataPageModel.ts?raw';

describe('AdminDataPage query ownership contract', () => {
  it('classifies every AdminData query owner through QueryView', () => {
    expect(modelSource.match(/toAdminView\(/g)).toHaveLength(14);
    expect(modelSource).not.toContain('const queryErrors =');
  });

  it('loads current stock for both Inventory and Statistics', () => {
    expect(modelSource).toContain('{ skip: !isInventoryView && !isStatisticsView }');
    expect(inventorySource).toContain("{ label: 'tồn kho hiện tại', view: queryViews.currentStock }");
  });

  it('loads customer contracts for both Contracts and BOM', () => {
    expect(modelSource).toContain('{ skip: !isContractView && !isBomView }');
  });

  it('keeps the manual BOM dialog behind authoritative catalog state', () => {
    expect(bomSource.match(/<AdminQueryBoundary/g)).toHaveLength(2);
  });
});
