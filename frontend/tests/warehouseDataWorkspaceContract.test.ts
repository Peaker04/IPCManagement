import { describe, expect, it } from 'vitest';
import { assertWarehouseFixture, currentStockRows, mixedEmptyFixture, stockMovementRows, warehouseDocuments, warehouseFixtureRecordIds } from './warehouseDataWorkspaceFixture';
import { validateWarehouseAiFinding, validateWarehouseCapture, warehouseDataWorkspaceContract, WAREHOUSE_CONTRACT_VERSION, WAREHOUSE_VIEWPORTS } from './warehouseDataWorkspaceContract';

const validCapture = () => ({
  schemaVersion: 2, identity: `${WAREHOUSE_CONTRACT_VERSION}/warehouse-ready/v1/warehouse-keeper/ready/1920x1080`, contractVersion: WAREHOUSE_CONTRACT_VERSION,
  fixtureVersion: 'warehouse-ready/v1', route: '/warehouse', activeTab: 'Luân chuyển', actor: 'warehouse-keeper', state: 'ready',
  viewport: { id: '1920x1080', width: 1920, height: 1080 }, fixtureRecordIds: warehouseFixtureRecordIds, screenshotPath: 'controlled/ready.png',
  ariaSnapshot: '- heading "Kho nguyên liệu" [level=1] [box=0,0,100,20]', ariaSnapshotOptions: { mode: 'ai', boxes: true },
  geometry: { stock: { x: 0, y: 0, width: 1, height: 1 }, history: { x: 0, y: 2, width: 1, height: 1 }, rail: { x: 2, y: 0, width: 1, height: 3 } },
  computedStyles: { stock: { display: 'block', overflowX: 'visible', paddingLeft: '16px', paddingRight: '16px' }, history: { display: 'block', overflowX: 'visible', paddingLeft: '16px', paddingRight: '16px' }, rail: { display: 'block', overflowX: 'visible', paddingLeft: '16px', paddingRight: '16px' } },
  domOrder: ['stock', 'history', 'rail'], focusOrder: ['tab', 'stock-search', 'history-search'], activeElement: 'BODY', consoleErrors: [], pageErrors: [], nonGetRequests: [], owners: { stock: 'owner', history: 'owner', rail: 'owner' },
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

  it('validates a complete AI-mode capture and rejects missing evidence', () => {
    expect(() => validateWarehouseCapture(validCapture())).not.toThrow();
    expect(() => validateWarehouseCapture({ ...validCapture(), ariaSnapshot: '' })).toThrow('Invalid Warehouse capture');
    expect(() => validateWarehouseCapture({ ...validCapture(), nonGetRequests: undefined })).toThrow('Invalid Warehouse capture');
  });

  it('accepts only schema-valid non-PASS AI findings', () => {
    const finding = { id: 'WH-001', verdict: 'FAIL', evidence: ['capture/ready'], expected: 'rail side by side', actual: 'rail stacked', severity: 'high', owner: { level: 'layout' }, confidence: 0.8 };
    expect(() => validateWarehouseAiFinding(finding)).not.toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, verdict: 'PASS' })).toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, confidence: 0.79 })).toThrow();
    for (const verdict of ['NEEDS_EVIDENCE', 'UNRESOLVED']) expect(() => validateWarehouseAiFinding({ ...finding, verdict, confidence: 0.4 })).not.toThrow();
  });
});
