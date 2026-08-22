import type { Page } from '@playwright/test';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  validateWarehouseCapture, validateWarehouseCaptureManifest, WAREHOUSE_ACTIVE_TAB, WAREHOUSE_CONTRACT_VERSION,
  type WarehouseCapture, type WarehouseCaptureManifest, type WarehouseScenario, type WarehouseViewport,
} from './warehouseDataWorkspaceContract';
import { WAREHOUSE_FIXTURE_VERSION, warehouseFixtureRecordIds } from './warehouseDataWorkspaceFixture';

const regionDefinitions = [
  { id: 'warehouse-current-stock', name: 'Tồn kho hiện tại', owner: 'WarehouseMovementPanel/SectionPanel/TableViewport/PaginationBar' },
  { id: 'warehouse-movement-history', name: 'Luân chuyển kho', owner: 'WarehouseMovementPanel/SectionPanel/StockMovementTable' },
  { id: 'warehouse-document-rail', name: 'Phiếu kho', owner: 'SplitWorkbench/DocumentRail' },
] as const;
const forbiddenDefinition = { id: 'warehouse-route-forbidden', name: 'Không đủ quyền truy cập', owner: 'RoleGuard' } as const;

export type WarehouseRuntimeSignals = { consoleErrors: string[]; pageErrors: string[]; nonReadRequests: string[] };

export async function collectWarehouseEvidence(
  page: Page,
  signals: WarehouseRuntimeSignals,
  scenario: WarehouseScenario,
  viewport: WarehouseViewport,
): Promise<{ record: WarehouseCapture; path: string }> {
  const artifactDirectory = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'baseline', 'captures', scenario, viewport.id);
  await mkdir(artifactDirectory, { recursive: true });
  const screenshotPath = resolve(artifactDirectory, `${scenario}-${viewport.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  const ariaSnapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
  const definitions = scenario === 'route-forbidden' ? [forbiddenDefinition] : regionDefinitions;
  const probes = await page.evaluate((items) => {
    const allRegions = Array.from(document.querySelectorAll<HTMLElement>('section,aside,[role="region"],main'));
    const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    const find = (name: string) => headings.find((node) => node.textContent?.trim() === name)?.closest<HTMLElement>('section,aside,main')
      ?? allRegions.find((node) => node.getAttribute('aria-label') === name || node.textContent?.includes(name));
    return items.map(({ id, name }) => {
      const node = find(name);
      if (!node) throw new Error(`Missing Warehouse evidence owner: ${name}`);
      const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
      return [id, {
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        scroll: { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight },
        style: { display: style.display, overflowX: style.overflowX, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight },
      }] as const;
    });
  }, definitions);
  const focusOrder = await page.locator('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]').evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => node.getAttribute('aria-label') || node.textContent?.trim() || node.id || node.tagName));
  const documentFacts = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    h1Count: document.querySelectorAll('h1').length,
    headingLevels: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((node) => Number(node.tagName.slice(1))),
    primaryActionCount: document.querySelectorAll('[data-variant="primary"],.ipc-button-primary').length,
  }));
  const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || document.activeElement?.tagName || 'BODY');
  const geometry = Object.fromEntries(probes);
  const owners = Object.fromEntries(definitions.map(({ id, owner }) => [id, owner]));
  const actor = scenario === 'route-forbidden' ? 'no-warehouse-read' : 'warehouse-keeper';
  const route = scenario === 'route-forbidden' ? '/403' : '/warehouse';
  const record: WarehouseCapture = {
    schemaVersion: 2,
    identity: `${WAREHOUSE_CONTRACT_VERSION}/${WAREHOUSE_FIXTURE_VERSION}/${actor}/${scenario}/${viewport.id}`,
    contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: WAREHOUSE_FIXTURE_VERSION, route,
    activeTab: scenario === 'route-forbidden' ? null : WAREHOUSE_ACTIVE_TAB, actor, state: scenario,
    viewport: { ...viewport }, fixtureRecordIds: scenario === 'route-forbidden' ? [] : [...warehouseFixtureRecordIds],
    screenshotPath, ariaSnapshot, ariaSnapshotOptions: { mode: 'ai', boxes: true }, geometry, document: documentFacts,
    domOrder: definitions.map(({ id }) => id), focusOrder, activeElement,
    consoleErrors: [...signals.consoleErrors], pageErrors: [...signals.pageErrors], nonGetRequests: [...signals.nonReadRequests], owners,
  };
  validateWarehouseCapture(record);
  if (record.nonGetRequests.length || record.consoleErrors.length || record.pageErrors.length) throw new Error(`Warehouse capture runtime evidence is red: ${record.identity}`);
  const path = resolve(artifactDirectory, 'record.json'); const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2)); await rename(temporary, path);
  return { record, path };
}

export async function writeWarehouseCaptureManifest(captures: WarehouseCapture[]) {
  const manifest: WarehouseCaptureManifest = { schemaVersion: 2, contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: WAREHOUSE_FIXTURE_VERSION, captures };
  validateWarehouseCaptureManifest(manifest);
  const path = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'baseline', 'manifest.json');
  await mkdir(resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', 'baseline'), { recursive: true });
  const temporary = `${path}.tmp`; await writeFile(temporary, JSON.stringify(manifest, null, 2)); await rename(temporary, path);
  return { manifest, path };
}
