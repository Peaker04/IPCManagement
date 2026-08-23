import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapStockMovement } from '@/api/reportMappers';
import { mapCurrentStock } from '@/api/reportsApiMappers';
import { assertWarehouseFixture, currentStockRows, mixedEmptyFixture, stockMovementRows, warehouseDocuments, warehouseFixtureRecordIds } from './warehouseDataWorkspaceFixture';
import {
  validateWarehouseAiFinding, validateWarehouseAiReviewInput, validateWarehouseCapture, validateWarehouseCaptureManifest, warehouseDataWorkspaceContract,
  WAREHOUSE_CONTRACT_VERSION, WAREHOUSE_SCENARIOS, WAREHOUSE_VIEWPORTS, type WarehouseCapture,
} from './warehouseDataWorkspaceContract';
import { buildWarehouseSelectionManifest, classifyRailRelation, evaluateWarehouseManifest, splitWorkbenchConsumerInventory } from './warehouseDeterministicRules';

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
    owners: Object.fromEntries(ids.map((id) => [id, id === 'warehouse-route-forbidden' ? 'RoleGuard' : id === 'warehouse-document-rail' ? 'SplitWorkbench/DocumentRail' : 'WarehouseMovementPanel/SectionPanel'])),
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
    const mappedCurrentStock = currentStockRows.map(mapCurrentStock);
    expect(mappedCurrentStock.every((row, index) => row.warehouse.length > 0 && row.warehouse !== currentStockRows[index].warehouseId
      && row.ingredient.length > 0 && row.ingredient !== currentStockRows[index].ingredientId
      && row.unit.length > 0 && Number.isFinite(row.currentQty) && Boolean(row.lastUpdated))).toBe(true);
    const mappedMovements = stockMovementRows.map(mapStockMovement);
    expect(mappedMovements.every(({ material, documentNo, quantity }) => material.length > 0 && documentNo.startsWith('PX-P27-') && Number.isFinite(quantity))).toBe(true);
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

  it('evaluates known evidence before AI and preserves the expected wide responsive failure', () => {
    const manifest = validManifest();
    const wide = manifest.captures.find(({ state, viewport }) => state === 'ready' && viewport.id === '1920x1080')!;
    wide.geometry['warehouse-current-stock'].box = { x: 0, y: 0, width: 100, height: 100 };
    wide.geometry['warehouse-movement-history'].box = { x: 0, y: 116, width: 100, height: 100 };
    wide.geometry['warehouse-document-rail'].box = { x: 0, y: 232, width: 100, height: 50 };
    expect(classifyRailRelation(wide)).toBe('stacked');
    const report = evaluateWarehouseManifest(manifest);
    const responsive = report.findings.find(({ id }) => id === 'WH-RESPONSIVE-ready-1920x1080');
    expect(responsive).toMatchObject({ verdict: 'FAIL', expected: 'side-by-side', actual: 'stacked', selector: expect.any(String), owner: { level: 'layout', source: 'SplitWorkbench/DocumentRail' } });
    expect(responsive?.boxes).toBeDefined();
    expect(report.verdict).toBe('FAIL');
  });

  it('fails closed when deterministic evidence is missing', () => {
    const manifest = validManifest();
    const capture = manifest.captures[0];
    delete capture.geometry['warehouse-document-rail'];
    const report = evaluateWarehouseManifest(manifest);
    expect(report.findings.find(({ id }) => id === 'WH-REGIONS-ready-1920x1080')?.verdict).toBe('FAIL');
    expect(report.findings.find(({ id }) => id === 'WH-RESPONSIVE-ready-1920x1080')?.verdict).toBe('NEEDS_EVIDENCE');
  });

  it('does not misclassify visible rail content extent as clipping', () => {
    const manifest = validManifest();
    const rail = manifest.captures[0].geometry['warehouse-document-rail'];
    rail.scroll.scrollWidth = rail.scroll.clientWidth + 100;
    rail.style.overflowX = 'visible';
    const report = evaluateWarehouseManifest(manifest);
    expect(report.findings.find(({ id }) => id === 'WH-CLIPPING-ready-1920x1080')?.verdict).toBe('PASS');
  });

  it('inventories every direct SplitWorkbench consumer without changing shared production', () => {
    expect(splitWorkbenchConsumerInventory.reduce((total, { instances }) => total + instances, 0)).toBe(4);
    for (const { source, instances } of splitWorkbenchConsumerInventory) {
      const text = readFileSync(resolve(process.cwd(), '..', source), 'utf8');
      expect((text.match(/<SplitWorkbench/g) ?? []).length).toBe(instances);
    }
  });

  it('selects only the reasoned bounded machine-evidence packet after deterministic evaluation', () => {
    const manifest = validManifest(); const report = evaluateWarehouseManifest(manifest);
    const selection = buildWarehouseSelectionManifest(manifest, report);
    expect(selection.generatedAfter).toBe('deterministic-before-ai');
    expect(selection.selected.map(({ state, viewport }) => `${state}/${viewport}`)).toEqual([
      'ready/1920x1080', 'ready/1366x768', 'ready/1365x900', 'ready/1280x900', 'mixed-empty/1280x900', 'route-forbidden/1440x900',
    ]);
    expect(selection.selected.every(({ reasons }) => reasons.length > 0)).toBe(true);
    expect(selection.excluded).toHaveLength(9);
  });

  it('accepts only schema-valid non-PASS AI findings', () => {
    const finding = { id: 'WH-001', verdict: 'FAIL', evidence: ['capture/ready'], expected: 'rail side by side', actual: 'rail stacked', severity: 'high', ownerLevel: 'layout', confidence: 0.8 };
    expect(() => validateWarehouseAiFinding(finding)).not.toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, verdict: 'PASS' })).toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, confidence: 0.79 })).toThrow();
    expect(() => validateWarehouseAiFinding({ ...finding, autoFix: 'change CSS' })).toThrow();
  });

  it('attests the exact fresh reviewer packet and keeps its three FAILs as the authorization queue', () => {
    const base = resolve(process.cwd(), 'test-results/warehouse-data-workspace/baseline');
    const input = JSON.parse(readFileSync(resolve(base, 'ai-review-input.json'), 'utf8'));
    const output = JSON.parse(readFileSync(resolve(base, 'ai-findings.json'), 'utf8'));
    expect(() => validateWarehouseAiReviewInput(input)).not.toThrow();
    expect(input).toMatchObject({
      reviewerRunId: 'e6804529-8bd5-48a6-9246-fc667e0ac803', reviewerWorkflowChild: 'phase-27-baseline-review',
      wrapperDisposition: 'rejected', wrapperDispositionEffect: 'none-on-json-findings',
    });
    const sha256 = (path: string) => createHash('sha256').update(readFileSync(resolve(process.cwd(), '..', path))).digest('hex');
    for (const item of input.suppliedItems) expect(sha256(item.path)).toBe(item.sha256);
    for (const item of input.selectedEvidence) {
      expect(sha256(item.recordPath)).toBe(item.recordSha256);
      expect(sha256(item.screenshotPath)).toBe(item.screenshotSha256);
    }
    expect(output.findings).toHaveLength(3);
    output.findings.forEach(validateWarehouseAiFinding);
    expect(output.findings.map(({ verdict }: { verdict: string }) => verdict)).toEqual(['FAIL', 'FAIL', 'FAIL']);
    expect(output.findings.map(({ id }: { id: string }) => id)).toEqual([
      'phase27-baseline-responsive-wide-rail-stacked',
      'phase27-baseline-operational-data-presented-as-technical-placeholders',
      'phase27-baseline-forbidden-duplicate-h1',
    ]);
  });

  it('attests the fresh post-correction reviewer with three resolved findings', () => {
    const after = resolve(process.cwd(), 'test-results/warehouse-data-workspace/after');
    const input = JSON.parse(readFileSync(resolve(after, 'ai-rereview-input.json'), 'utf8'));
    const output = JSON.parse(readFileSync(resolve(after, 'ai-rereview.json'), 'utf8'));
    const attestation = JSON.parse(readFileSync(resolve(after, 'ai-rereview-attestation.json'), 'utf8'));
    const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

    expect(attestation).toMatchObject({ status: 'COMPLETE', context: 'fresh', mode: 'read-only' });
    expect(attestation.reviewerRunId).toBe(input.reviewerRunId);
    expect(attestation.output.sha256).toBe(digest(resolve(after, 'ai-rereview.json')));
    expect(output.findings.map(({ verdict }: { verdict: string }) => verdict)).toEqual(['RESOLVED', 'RESOLVED', 'RESOLVED']);
    expect(new Set(output.findings.map(({ id }: { id: string }) => id))).toEqual(new Set([
      'phase27-baseline-responsive-wide-rail-stacked',
      'phase27-baseline-operational-data-presented-as-technical-placeholders',
      'phase27-baseline-forbidden-duplicate-h1',
    ]));
  });
});
