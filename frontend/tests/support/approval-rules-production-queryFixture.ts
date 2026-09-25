/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from '../uiAuditContract';
import { isLedgerRequest } from '../uiAuditEvidence';
import { identityKey, UI_AUDIT_VIEWPORTS } from '../uiAuditInventory';
import { UI_AUDIT_RULE_IDS } from '../uiAuditOracleRegistry';
import { APPROVAL_RULES_QUERY_DISPOSITION_REASONS, expandProductionQueryIdentities, registerApprovalRulesQueryIdentity } from '../uiAuditProductionQueryAdapter';

export type MeasuredState = 'initial-loading' | 'populated' | 'truly-empty' | 'error-no-data';
export const endpoint = '/api/approval-rules';
export const profile = { userId: 'admin-phase28-rules', username: 'admin-phase28-rules', fullName: 'Quản trị Phase 28', role: 'admin', roleCode: 'ADMIN', roleName: 'Quản trị viên', isAdminFullAccess: true, permissions: ['*'] };
export const rule = { ruleId: 'rule-phase28', ruleName: 'Quy tắc Phase 28', documentType: 'purchase-request', minAmount: 10000000, maxAmount: null, slaHours: 24, isActive: true, approvalassignments: [{ assignmentId: 'assignment-phase28', sequence: 1, approverRole: 'quanly', approverUserId: null, approverUser: null, isRequired: true }] };
export const identities = expandProductionQueryIdentities().filter(({ route }) => route === '/admin/rules').map(registerApprovalRulesQueryIdentity);

export async function json(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) });
}
export async function installApi(page: Page, state: MeasuredState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolveRelease) => { release = resolveRelease; });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/auth/profile') return json(route, profile);
    if (path === '/api/purchase-orders/page') return json(route, { page: { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }, orderCountByRequest: {} });
    if (path === '/api/admin/employees') return json(route, { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false });
    if (path !== endpoint) throw new Error(`unstubbed Approval Rules production GET dependency: ${path}`);
    if (state === 'initial-loading') await deferred;
    if (state === 'error-no-data') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Approval Rules Phase 28 failure' }) });
    return json(route, state === 'populated' ? [rule] : []);
  });
  return release;
}
export async function login(page: Page) {
  await page.addInitScript((user) => {
    localStorage.clear(); sessionStorage.clear();
    sessionStorage.setItem('token', 'dev-login-fallback-token-phase28-approval-rules');
    localStorage.setItem('user', JSON.stringify({ ...user, id: user.userId }));
  }, profile);
  await page.goto('/admin/rules', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/admin\/rules/);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
  await page.addStyleTag({ content: 'nav[aria-label="Điều hướng chính"]{pointer-events:none!important}' });
}
export function seam(page: Page, state: MeasuredState): Locator {
  if (state === 'initial-loading') return page.getByText('Đang tải cấu hình...');
  if (state === 'populated') return page.getByRole('heading', { name: 'Quy tắc Phase 28' });
  if (state === 'truly-empty') return page.getByText('Chưa có quy tắc phê duyệt', { exact: true });
  return page.getByRole('heading', { name: 'Không tải được quy tắc phê duyệt' });
}
export function dispositionFindings(row: ReturnType<typeof registerApprovalRulesQueryIdentity>): UiAuditFinding[] {
  if (row.disposition.kind === 'measure') throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({ ruleId, identity, verdict: row.disposition.kind === 'not-applicable' ? 'NOT_APPLICABLE' : 'NEEDS_EVIDENCE', measured: { productionRouteMeasured: false, reason: row.disposition.reason } }));
}
