import { expect, test } from '@playwright/test';
import { reconcilePhase28BaselineFromDisk } from './uiAuditBaselineReconciliation';

test('phase 28 remediation / full D5+R2 identity matrix', async ({ page }) => {
  test.setTimeout(120_000);
  const outputRoot = process.env.UI_AUDIT_OUTPUT_ROOT;
  if (!outputRoot) throw new Error('UI_AUDIT_OUTPUT_ROOT is required');
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'dev-login-fallback-token-phase28-remediation');
    localStorage.setItem('user', JSON.stringify({ id: 'admin-phase28', userId: 'admin-phase28', username: 'admin-phase28', fullName: 'Quản trị Phase 28', role: 'admin', roleCode: 'ADMIN', roleName: 'Quản trị viên', isAdminFullAccess: true, permissions: ['*'] }));
  });
  await page.route('**/*', (route) => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.route('**/api/auth/profile', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: { userId: 'admin-phase28', username: 'admin-phase28', fullName: 'Quản trị Phase 28', roleCode: 'ADMIN', permissions: ['*'], isAdminFullAccess: true } }) }));
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('.ipc-app-shell')).toBeVisible();
  const result = reconcilePhase28BaselineFromDisk(process.cwd(), outputRoot, outputRoot);
  expect(result.combined.inventoryIdentityCount).toBe(2142);
  expect(result.combined.records).toHaveLength(2142);
  expect(result.combined.records.every(({ findings }) => findings.length === 32)).toBe(true);
  expect(result.manifest.nonGetOrHeadObservedRequestCount).toBe(0);
});
