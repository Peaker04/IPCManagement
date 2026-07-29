import { describe, expect, it } from 'vitest';
import bomSource from './AdminBomPanel.tsx?raw';
import inventorySource from './AdminInventoryPanel.tsx?raw';
import auditModelSource from './useAdminAuditPanelModel.ts?raw';
import bomModelSource from './useAdminBomPanelModel.ts?raw';
import cleanupModelSource from './useAdminCleanupPanelModel.ts?raw';
import contractsModelSource from './useAdminContractsPanelModel.ts?raw';
import employeesModelSource from './useAdminEmployeesPanelModel.ts?raw';
import inventoryModelSource from './useAdminInventoryPanelModel.ts?raw';
import modelSource from './useAdminDataPageModel.ts?raw';
import statisticsModelSource from './useAdminStatisticsPanelModel.ts?raw';

const panelModelSources = [
  auditModelSource,
  bomModelSource,
  cleanupModelSource,
  contractsModelSource,
  employeesModelSource,
  inventoryModelSource,
  statisticsModelSource,
].join('\n');

describe('AdminDataPage query ownership contract', () => {
  it('classifies every AdminData query owner through QueryView', () => {
    expect(panelModelSources.match(/toAdminView\(/g)).toHaveLength(14);
    expect(`${modelSource}\n${panelModelSources}`).not.toContain('const queryErrors =');
  });

  it('loads current stock for both Inventory and Statistics', () => {
    expect(inventoryModelSource).toContain("{ skip: activeView !== 'inventory' && activeView !== 'statistics' }");
    expect(inventorySource).toContain("{ label: 'tồn kho hiện tại', view: queryViews.currentStock }");
  });

  it('loads customer contracts for both Contracts and BOM', () => {
    expect(contractsModelSource).toContain("skip: activeView !== 'contracts' && activeView !== 'bom-import'");
  });

  it('keeps the manual BOM dialog behind authoritative catalog state', () => {
    expect(bomSource.match(/<AdminQueryBoundary/g)).toHaveLength(2);
  });

  it('composes every panel model unconditionally through the compatibility facade', () => {
    expect(modelSource.match(/useAdmin(?:Bom|Contracts|Cleanup|Inventory|Statistics|Audit|Employees)PanelModel\(/g)).toHaveLength(7);
    expect(modelSource).toContain('export type AdminDataPageModel = ReturnType<typeof useAdminDataPageModel>');
  });
});
