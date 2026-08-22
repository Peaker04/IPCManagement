import type { Page } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { validateWarehouseCapture, WAREHOUSE_ACTIVE_TAB, WAREHOUSE_CONTRACT_VERSION, WAREHOUSE_ROUTE, type WarehouseCapture } from './warehouseDataWorkspaceContract';
import { WAREHOUSE_FIXTURE_VERSION, warehouseFixtureRecordIds } from './warehouseDataWorkspaceFixture';

const regionNames = ['Tồn kho hiện tại', 'Luân chuyển kho', 'Phiếu kho'] as const;
const regionIds = ['warehouse-current-stock', 'warehouse-movement-history', 'warehouse-document-rail'] as const;
const owners = {
  'warehouse-current-stock': 'WarehouseMovementPanel/SectionPanel/TableViewport/PaginationBar',
  'warehouse-movement-history': 'WarehouseMovementPanel/SectionPanel/StockMovementTable',
  'warehouse-document-rail': 'SplitWorkbench/DocumentRail',
};

export type WarehouseRuntimeSignals = { consoleErrors: string[]; pageErrors: string[]; nonReadRequests: string[] };
export async function collectWarehouseEvidence(page: Page, signals: WarehouseRuntimeSignals): Promise<{ record: WarehouseCapture; path: string }> {
  const artifactDirectory = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'ready', '1920x1080');
  await mkdir(artifactDirectory, { recursive: true });
  const screenshotPath = resolve(artifactDirectory, 'warehouse-ready-1920x1080.png');
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  const ariaSnapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
  const probes = await page.evaluate(({ names, ids }) => {
    const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    const find = (name: string) => headings.find((node) => node.textContent?.trim() === name)?.closest<HTMLElement>('section')
      ?? Array.from(document.querySelectorAll<HTMLElement>('section,aside,[role="region"]')).find((node) => node.getAttribute('aria-label') === name || node.textContent?.includes(name));
    return ids.map((id, index) => {
      const node = find(names[index]);
      if (!node) throw new Error(`Missing Warehouse region: ${names[index]}`);
      const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
      return [id, { box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, style: { display: style.display, overflowX: style.overflowX, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight } }] as const;
    });
  }, { names: regionNames, ids: regionIds });
  const geometry = Object.fromEntries(probes.map(([id, probe]) => [id, probe.box]));
  const computedStyles = Object.fromEntries(probes.map(([id, probe]) => [id, probe.style]));
  const focusOrder = await page.locator('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]').evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => node.getAttribute('aria-label') || node.textContent?.trim() || node.id || node.tagName));
  const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || document.activeElement?.tagName || 'BODY');
  const record: WarehouseCapture = {
    schemaVersion: 2, identity: `${WAREHOUSE_CONTRACT_VERSION}/${WAREHOUSE_FIXTURE_VERSION}/warehouse-keeper/ready/1920x1080`,
    contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: WAREHOUSE_FIXTURE_VERSION, route: WAREHOUSE_ROUTE,
    activeTab: WAREHOUSE_ACTIVE_TAB, actor: 'warehouse-keeper', state: 'ready', viewport: { id: '1920x1080', width: 1920, height: 1080 },
    fixtureRecordIds: warehouseFixtureRecordIds, screenshotPath, ariaSnapshot, ariaSnapshotOptions: { mode: 'ai', boxes: true }, geometry, computedStyles,
    domOrder: [...regionIds], focusOrder, activeElement, consoleErrors: [...signals.consoleErrors], pageErrors: [...signals.pageErrors], nonGetRequests: [...signals.nonReadRequests], owners,
  };
  validateWarehouseCapture(record);
  if (record.nonGetRequests.length) throw new Error(`Warehouse tracer made non-GET requests: ${record.nonGetRequests.join(', ')}`);
  const path = resolve(artifactDirectory, 'record.json'); const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2)); await rename(temporary, path);
  return { record, path };
}
