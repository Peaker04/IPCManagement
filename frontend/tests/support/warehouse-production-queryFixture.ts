/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seriousViolationsWithBrowserPlaceholderEvidence } from '../uiAuditAxe';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from '../uiAuditContract';
import { UI_AUDIT_RULE_IDS } from '../uiAuditOracleRegistry';
import { identityKey, REGION_INVENTORY, UI_AUDIT_VIEWPORTS } from '../uiAuditInventory';
import { expandProductionQueryIdentities, registerWarehouseQueryIdentity, WAREHOUSE_QUERY_DISPOSITION_REASONS } from '../uiAuditProductionQueryAdapter';
import { isLedgerRequest } from '../uiAuditEvidence';

export type CreatedState = 'initial-loading' | 'populated' | 'truly-empty' | 'error-no-data';
export type Region = (typeof REGION_INVENTORY)['/warehouse'][number];

export const profile = { userId: 'phase28-keeper', username: 'phase28-keeper', fullName: 'Thủ kho Phase 28', role: 'thukho', roleCode: 'WAREHOUSE_KEEPER', roleName: 'Thủ kho', isAdminFullAccess: false, permissions: ['warehouse.read'] };
export const owners: Record<Region, { endpoint: string; ownership: string }> = {
  'warehouse-current-stock': { endpoint: '/api/workflow-reports/current-stock/page', ownership: 'movement-active-first' },
  'warehouse-purchase-receipts': { endpoint: '/api/inventory-receipts', ownership: 'always-mounted-receipt-lifecycle' },
  'warehouse-issues': { endpoint: '/api/workflow-reports/material-request-candidates/page', ownership: 'movement-active-first-command-query' },
  'warehouse-movements': { endpoint: '/api/workflow-reports/stock-movements/page', ownership: 'movement-active-first' },
};
export const pageData = (items: unknown[], pageSize = 8) => ({ items, totalCount: items.length, pageNumber: 1, pageSize, totalPages: items.length ? 1 : 0, hasPrev: false, hasNext: false });
export const stock = { warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', ingredientId: 'ingredient-p28', ingredientName: 'Gạo Phase 28', unitId: 'unit-kg', unitName: 'kg', currentQty: 12, lastUpdated: '2026-08-23T01:00:00Z' };
export const movement = { movementId: 'movement-phase28', movementType: 'RECEIPT', ingredientId: 'ingredient-p28', ingredientName: 'Gạo Phase 28', unitId: 'unit-kg', unitName: 'kg', warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', quantityIn: 12, quantityOut: 0, beforeQty: 0, afterQty: 12, movementDate: '2026-08-23T01:00:00Z', refTable: 'InventoryReceipt', refId: 'receipt-phase28', reason: 'Nhập kho Phase 28' };
export const receipt = { receiptId: 'receipt-phase28', receiptCode: 'REC-P28', purchaseOrderId: 'po-phase28', purchaseOrderCode: 'PO-P28', supplierName: 'Nhà cung cấp Phase 28', warehouseId: 'warehouse-p28', warehouseName: 'Kho Phase 28', receiptDate: '2026-08-23', status: 'DRAFT', qualityStatus: 'PENDING_INSPECTION', version: 0, lines: [] };
export const candidate = { materialRequestId: 'request-phase28', materialRequestCode: 'MR-P28', customerId: 'customer-p28', customerName: 'Khách hàng Phase 28', requestDate: '2026-08-23', shiftName: 'MORNING', remainingLineCount: 1 };

export async function json(route: Route, data: unknown) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) }); }
export function dataFor(path: string, populated: boolean) {
  if (path === '/api/workflow-reports/current-stock/page') return pageData(populated ? [stock] : []);
  if (path === '/api/workflow-reports/stock-movements/page') return { items: populated ? [movement] : [], limit: 8, hasNext: false, nextCursorOffset: 0 };
  if (path === '/api/inventory-receipts') return pageData(populated ? [receipt] : [], 6);
  if (path === '/api/inventory-receipts/receipt-phase28') return receipt;
  if (path === '/api/workflow-reports/material-request-candidates/page') return pageData(populated ? [candidate] : []);
  if (path === '/api/workflow-reports/workflow-documents') return [];
  if (path === '/api/purchase-orders/page') return { page: pageData([]), orderCountByRequest: {} };
  if (path === '/api/warehouses/selector') return [];
  if (path === '/api/workflow-reports/kitchen-issues') return [];
  if (path === '/api/workflow-reports/ingredient-demand/aggregate/page') return { ...pageData([]), shortageCount: 0 };
  throw new Error(`unstubbed Warehouse production GET dependency: ${path}`);
}
export const apiPatterns = [
  '**/api/auth/profile', '**/api/workflow-reports/current-stock/page**', '**/api/workflow-reports/stock-movements/page**',
  '**/api/inventory-receipts?**', '**/api/inventory-receipts/receipt-phase28', '**/api/workflow-reports/material-request-candidates/page**', '**/api/workflow-reports/workflow-documents**',
  '**/api/purchase-orders/page**', '**/api/warehouses/selector', '**/api/workflow-reports/kitchen-issues**',
  '**/api/workflow-reports/ingredient-demand/aggregate/page**',
];
export async function installApi(page: Page, region: Region, state: CreatedState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolveRelease) => { release = resolveRelease; });
  const owned = owners[region].endpoint;
  const handler = async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/profile') return json(route, profile);
    if (path === owned && state === 'initial-loading') await deferred;
    if (path === owned && state === 'error-no-data') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: `${region} Phase 28 failure` }) });
    return json(route, dataFor(path, path === owned && (state === 'populated' || state === 'initial-loading')));
  };
  for (const pattern of apiPatterns) await page.route(pattern, handler);
  return release;
}
export async function login(page: Page) {
  await page.addInitScript((user) => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('token', 'dev-login-fallback-token-phase28-warehouse'); localStorage.setItem('user', JSON.stringify({ ...user, id: user.userId })); }, profile);
  await page.goto('/warehouse', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/warehouse/);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
}
export function seam(page: Page, region: Region, state: CreatedState): Locator {
  if (region === 'warehouse-current-stock') {
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được tồn kho hiện tại' });
    return state === 'initial-loading' ? page.locator('.ipc-warehouse-table-shell .animate-pulse').first() : page.getByText(state === 'populated' ? 'Gạo Phase 28' : 'Chưa có dữ liệu tồn kho');
  }
  if (region === 'warehouse-movements') {
    if (state === 'initial-loading') return page.getByRole('status', { name: 'Đang tải sổ luân chuyển kho' });
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được sổ luân chuyển kho' });
    return state === 'populated' ? page.getByText('Gạo Phase 28') : page.getByText('Chưa có dữ liệu để hiển thị').first();
  }
  if (region === 'warehouse-purchase-receipts') {
    if (state === 'error-no-data') return page.getByRole('heading', { name: 'Không tải được phiếu nhập cần xử lý' });
    if (state === 'populated') return page.getByRole('cell', { name: 'REC-P28', exact: true });
    return page.getByText(state === 'initial-loading' ? 'Đang tải phiếu nhập…' : 'Chưa có phiếu nhập cần xử lý trong trang này.');
  }
  if (state === 'initial-loading') return page.getByRole('button', { name: 'Đang kiểm tra nhu cầu' });
  if (state === 'error-no-data') return page.getByText(/Không tải được danh sách nhu cầu đủ điều kiện xuất kho/);
  return page.getByRole('button', { name: 'Tạo phiếu xuất kho' });
}
export function dispositionFindings(row: ReturnType<typeof registerWarehouseQueryIdentity>): UiAuditFinding[] {
  if (row.disposition.kind === 'measure') throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({ ruleId, identity, verdict: row.disposition.kind === 'not-applicable' ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE', measured: { productionRouteMeasured: false, reason: row.disposition.reason } }));
}
