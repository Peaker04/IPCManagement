import { describe, expect, it } from 'vitest';
import pageSource from '../AdminDataPage.tsx?raw';
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

  it('loads customer contracts for DEFAULT Contracts and BOM only when the owner is enabled', () => {
    expect(contractsModelSource).toContain("skip: !enabled || (activeView !== 'contracts' && activeView !== 'bom-import')");
  });

  it('keeps the manual BOM dialog behind authoritative catalog state', () => {
    expect(bomSource.match(/<AdminQueryBoundary/g)).toHaveLength(2);
  });

  it('keeps BOM summary facts single-owned and user-facing', () => {
    expect(bomSource).not.toContain('<ContextStrip');
    expect(modelSource).toContain('bomModel.bomImportPreview.totalRows');
    for (const technicalCopy of ['trước khi preview', 'Preview hợp lệ', 'có thể commit', 'Chỉ commit', 'Commit import', 'Đã import BOM', 'archive ${', 'tạo version điều chỉnh']) {
      expect(bomModelSource).not.toContain(technicalCopy);
    }
  });

  it('composes every panel model unconditionally through the compatibility facade', () => {
    expect(modelSource.match(/useAdmin(?:Bom|Contracts|Cleanup|Inventory|Statistics|Audit|Employees)PanelModel\(/g)).toHaveLength(7);
    expect(modelSource).toContain('export type AdminDataPageModel = ReturnType<typeof useAdminDataPageModel>');
  });

  it('keeps the admin work area shrinkable and confines dense BOM actions locally', () => {
    expect(pageSource).toContain('className="min-w-0 [&_.text-slate-400]:text-slate-700! [&_.text-slate-500]:text-slate-700!"');
    expect(bomSource).toContain('grid-cols-1 gap-2 sm:grid-cols-3');
    expect(bomSource).toContain('grid-cols-1 gap-2 sm:grid-cols-2');
    expect(bomSource).toContain('ariaLabel="BOM hiện tại theo đơn giá"');
  });
});
