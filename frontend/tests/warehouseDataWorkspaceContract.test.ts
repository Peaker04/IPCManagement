import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertWarehouseFixture, currentStockRows, mixedEmptyFixture, stockMovementRows, warehouseDocuments, warehouseFixtureRecordIds } from './warehouseDataWorkspaceFixture';
import {
  validateWarehouseAiFinding, validateWarehouseCapture, validateWarehouseCaptureManifest, warehouseDataWorkspaceContract,
  WAREHOUSE_CONTRACT_VERSION, WAREHOUSE_SCENARIOS, WAREHOUSE_VIEWPORTS, type WarehouseCapture,
} from './warehouseDataWorkspaceContract';

const validCapture = (state: WarehouseCapture['state'] = 'ready', viewport = WAREHOUSE_VIEWPORTS[0]): WarehouseCapture => {
  const forbidden = state === 'route-forbidden';
  const ids = forbidden ? ['warehouse-route-forbidden'] : warehouseDataWorkspaceContract.regions.map(({ id }) => id);
  return {
    schemaVersion: 2, identity: `${WAREHOUSE_CONTRACT_VERSION}/warehouse-ready/v1/${forbidden ? 'no-warehouse-read' : 'warehouse-keeper'}/${state}/${viewport.id}`,
    contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: 'warehouse-ready/v1', route: forbidden ? '/403' : '/warehouse',
    activeTab: forbidden ? null : 'Luân chuyển', actor: forbidden ? 'no-warehouse-read' : 'warehouse-keeper', state,
    viewport: { ...viewport }, fixtureRecordIds: forbidden ? [] : warehouseFixtureRecordIds, screenshotPath: `controlled/${state}.png`,
    ariaSnapshot: '- heading "Kho nguyên liệu" [level=1] [box=0,0,100,20]', ariaSnapshotOptions: { mode: 'ai', boxes: true },
    geometry: Object.fromEntries(ids.map((id, index) => [id, { box: { x: index * 20, y: index * 20, width: 10, height: 10 }, scroll: { clientWidth: 10, scrollWidth: 10, clientHeight: 10, scrollHeight: 10 }, style: { display: 'block', overflowX: 'visible', paddingLeft: '16px', paddingRight: '16px' } }])),
    document: { clientWidth: viewport.width, scrollWidth: viewport.width, h1Count: 1, headingLevels: [1, 3, 3], primaryActionCount: 0 },
    domOrder: ids, focusOrder: ['tab', 'stock-search', 'history-search'], activeElement: 'BODY', consoleErrors: [], pageErrors: [], nonGetRequests: [],
    owners: Object.fromEntries(ids.map((id) => [id, id === 'warehouse-route-forbidden' ? 'RoleGuard' : 'owner'])),
  };
};

const validManifest = () => ({
  schemaVersion: 2, contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: 'warehouse-ready/v1',
  captures: WAREHOUSE_SCENARIOS.flatMap((scenario) => WAREHOUSE_VIEWPORTS.map((viewport) => validCapture(scenario, viewport))),
});

describe('Warehouse Data Workspace contract', () => {
  it('freezes the bounded Warehouse-only contract', () => {
    expect(warehouseDataWorkspaceContract.archetype).toBe('Data Workspace');
    expect(warehouseDataWorkspaceContract.regions.map(({ role }) => role)).toEqual(['primary-dataset', 'supporting-history', 'tab-document-rail']);
    expect(warehouseDataWorkspaceContract.tabs).toEqual(['Luân chuyển', 'Nhu cầu xuất', 'Ngoại lệ']);
    expect(warehouseDataWorkspaceContract.domAndFocusOrder).toEqual(['warehouse-current-stock', 'warehouse-movement-history', 'warehouse-document-rail']);
    expect(WAREHOUSE_VIEWPORTS.map(({ id }) => id)).toEqual(['1920x1080', '1440x900', '1366x768', '1365x900', '1280x900']);
    expect(warehouseDataWorkspaceContract.spacing.tolerance).toBe(0.5);
  });

  it('keeps the representative fixture domain-valid and mixed-empty isolated', () => {
    expect(assertWarehouseFixture).not.toThrow(); expect(currentStockRows).toHaveLength(8); expect(stockMovementRows).toHaveLength(8); expect(warehouseDocuments.length).toBeGreaterThan(1);
    expect(mixedEmptyFixture.currentStockRows).toEqual([]); expect(mixedEmptyFixture.stockMovementRows).toBe(stockMovementRows); expect(mixedEmptyFixture.warehouseDocuments).toBe(warehouseDocuments);
  });

  it('validates exactly fifteen unique composite captures with stable ready fixture IDs', () => {
    const manifest = validManifest();
    expect(() => validateWarehouseCaptureManifest(manifest)).not.toThrow();
    expect(manifest.captures).toHaveLength(15);
    expect(() => validateWarehouseCaptureManifest({ ...manifest, captures: manifest.captures.slice(1) })).toThrow();
    expect(() => validateWarehouseCaptureManifest({ ...manifest, captures: [...manifest.captures.slice(0, 14), manifest.captures[0]] })).toThrow();
    const drifted = structuredClone(manifest); drifted.captures.find(({ state }) => state === 'ready')!.fixtureRecordIds = ['drift'];
    expect(() => validateWarehouseCaptureManifest(drifted)).toThrow('Warehouse ready fixture identity drifted');
  });

  it('fails closed when capture evidence or the route-forbidden boundary is missing', () => {
    expect(() => validateWarehouseCapture(validCapture())).not.toThrow();
    expect(() => validateWarehouseCapture({ ...validCapture(), ariaSnapshot: '' })).toThrow('Invalid Warehouse capture');
    expect(() => validateWarehouseCapture({ ...validCapture('route-forbidden'), route: '/warehouse' })).toThrow('Invalid Warehouse scenario boundary');
  });

  it('locks loading, refreshing, error, all-empty and forbidden to the production phase union', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/warehouse/pages/WarehouseMovementPanel.tsx'), 'utf8');
    expect(source).toContain("phase: 'uninitialized' | 'loading' | 'ready' | 'error' | 'forbidden'");
    expect(source).toContain("currentStockView.phase === 'ready' && currentStockView.isRefreshing");
    expect(source).toContain("stockMovementView.phase === 'ready' && stockMovementView.isRefreshing");
    expect(source).toContain('Chưa có dữ liệu tồn kho');
    expect(source).toContain('Không tải được tồn kho hiện tại');
    expect(source).toContain('Không có quyền xem tồn kho hiện tại');
    expect(source).not.toContain("phase: 'refreshing'");
  });

  it('accepts only schema-valid non-PASS AI findings', () => {
    const finding = { id: 'WH-001', verdict: 'FAIL', evidence: ['capture/ready'], expected: 'rail side by side', actual: 'rail stacked', severity: 'high', owner: { level: 'layout' }, confidence: 0.8 };
    expect(() => validateWarehouseAiFinding(finding)).not.toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, verdict: 'PASS' })).toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, confidence: 0.79 })).toThrow();
  });
});
