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

export type WarehouseHeadingOwner = 'shell-header' | 'main' | 'other-shell' | 'overlay' | 'hidden-keepalive' | 'hidden-other';
export type WarehouseHeadingRecord = {
  domOrder: number;
  level: number;
  name: string;
  selector: string;
  visible: boolean;
  owner: WarehouseHeadingOwner;
};
export type WarehouseHeadingEvidence = {
  records: WarehouseHeadingRecord[];
  visibleRecords: WarehouseHeadingRecord[];
  levels: number[];
  names: string[];
  selectors: string[];
};

export function collectWarehouseHeadingEvidence(root: Document = document): WarehouseHeadingEvidence {
  const selectorFor = (element: Element): string => {
    if (element.id) return `#${element.id}`;
    const parts: string[] = [];
    let node: Element | null = element;
    while (node && node.tagName.toLowerCase() !== 'body') {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) { parts.unshift(tag); break; }
      const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === node!.tagName);
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  };
  const nameOf = (element: Element): string => {
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    if (ariaLabel) return ariaLabel;
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const label = labelledBy.split(/\s+/).map((id) => root.getElementById(id)?.textContent ?? '').join(' ').trim();
      if (label) return label;
    }
    return element.textContent?.trim() ?? '';
  };
  const isVisible = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if ((node as HTMLElement).hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const main = root.querySelector('#ipc-main-content') ?? root.querySelector('main');
  const records = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((element, domOrder): WarehouseHeadingRecord => {
    const visible = isVisible(element);
    const owner: WarehouseHeadingOwner = !visible
      ? element.closest('[role="tabpanel"]') ? 'hidden-keepalive' : 'hidden-other'
      : element.closest('[role="dialog"],[data-slot="drawer-content"]') ? 'overlay'
      : element.closest('header') && !main?.contains(element) ? 'shell-header'
      : main?.contains(element) ? 'main'
      : 'other-shell';
    return { domOrder, level: Number(element.tagName.slice(1)), name: nameOf(element), selector: selectorFor(element), visible, owner };
  });
  const visibleRecords = (['shell-header', 'main', 'other-shell', 'overlay'] as const)
    .flatMap((owner) => records.filter((record) => record.visible && record.owner === owner));
  return {
    records,
    visibleRecords,
    levels: visibleRecords.map(({ level }) => level),
    names: visibleRecords.map(({ name }) => name),
    selectors: visibleRecords.map(({ selector }) => selector),
  };
}

export type WarehouseEvidenceRun = { directory: 'baseline' | 'after'; runId?: string };

export async function collectWarehouseEvidence(
  page: Page,
  signals: WarehouseRuntimeSignals,
  scenario: WarehouseScenario,
  viewport: WarehouseViewport,
  run: WarehouseEvidenceRun = { directory: 'baseline' },
): Promise<{ record: WarehouseCapture; path: string }> {
  const artifactDirectory = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', run.directory, 'captures', scenario, viewport.id);
  await mkdir(artifactDirectory, { recursive: true });
  const screenshotPath = resolve(artifactDirectory, `${scenario}-${viewport.id}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  const ariaSnapshot = await page.locator('body').ariaSnapshot({ mode: 'ai', boxes: true });
  const definitions = scenario === 'route-forbidden' ? [forbiddenDefinition] : regionDefinitions;
  const probes = await page.evaluate((items) => {
    const allRegions = Array.from(document.querySelectorAll<HTMLElement>('section,aside,[role="region"],main'));
    const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    const find = (name: string) => allRegions.find((node) => node.getAttribute('aria-label') === name)
      ?? headings.find((node) => node.textContent?.trim() === name)?.closest<HTMLElement>('section,aside,main')
      ?? allRegions.find((node) => node.textContent?.includes(name));
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
  const headingEvidence = await page.evaluate<WarehouseHeadingEvidence>(`(${collectWarehouseHeadingEvidence.toString()})(document)`);
  const documentFacts = await page.evaluate((headings) => ({
    clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    h1Count: headings.visibleRecords.filter(({ level }) => level === 1).length,
    headingLevels: headings.levels,
    headingNames: headings.names,
    headingSelectors: headings.selectors,
    headingRecords: headings.records,
    primaryActionCount: document.querySelector('.ipc-split-primary')?.querySelectorAll('[data-variant="primary"],.ipc-button-primary').length ?? 0,
  }), headingEvidence);
  const activeElement = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || document.activeElement?.tagName || 'BODY');
  const geometry = Object.fromEntries(probes);
  const owners = Object.fromEntries(definitions.map(({ id, owner }) => [id, owner]));
  const actor = scenario === 'route-forbidden' ? 'no-warehouse-read' : 'warehouse-keeper';
  const route = scenario === 'route-forbidden' ? '/403' : '/warehouse';
  const record: WarehouseCapture = {
    schemaVersion: 2,
    identity: `${run.runId ? `${run.runId}/` : ''}${WAREHOUSE_CONTRACT_VERSION}/${WAREHOUSE_FIXTURE_VERSION}/${actor}/${scenario}/${viewport.id}`,
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

export async function writeWarehouseCaptureManifest(captures: WarehouseCapture[], run: WarehouseEvidenceRun = { directory: 'baseline' }) {
  const manifest: WarehouseCaptureManifest = { schemaVersion: 2, contractVersion: WAREHOUSE_CONTRACT_VERSION, fixtureVersion: WAREHOUSE_FIXTURE_VERSION, captures };
  validateWarehouseCaptureManifest(manifest);
  const path = resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', run.directory, 'manifest.json');
  await mkdir(resolve(process.cwd(), 'test-results', 'warehouse-data-workspace', run.directory), { recursive: true });
  const temporary = `${path}.tmp`; await writeFile(temporary, JSON.stringify(manifest, null, 2)); await rename(temporary, path);
  return { manifest, path };
}
