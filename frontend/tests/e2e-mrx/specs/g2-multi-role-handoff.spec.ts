import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { loginRole, readQualificationCredentials, type MrxRole } from '../fixtures/authHelpers';

test('@G2-Admission five actual identities use server MRX authority; Manager is not Admin', async ({ browser, baseURL, viewport }, testInfo) => {
  test.setTimeout(180_000);
  expect(process.env.MRX_E2E_PROFILE).toBe('qualification');
  const credentials = readQualificationCredentials();
  const roles: Record<MrxRole, string> = { admin: 'ADMIN', dieuphoi: 'COORDINATOR', thukho: 'WAREHOUSESTAFF', beptruong: 'CHEF', manager: 'MANAGER' };
  const contexts = [];
  const observations = [];
  const inventory: object[] = [];
  const inventoryRoutes: Record<MrxRole, string[]> = {
    admin: ['ingredients', 'dishes', 'bom', 'customers'].map((view) => `/admin-data?view=${view}`),
    dieuphoi: ['/weekly-menu?view=mrx-batch'],
    thukho: ['/warehouse?view=mrx-daily', '/warehouse?view=mrx-preparation', '/warehouse?view=mrx-issues'],
    beptruong: ['/chef?view=mrx-cooking'],
    manager: ['/reconciliation', '/reconciliation?view=transactions', '/reconciliation?view=completed'],
  };
  try {
    for (const role of Object.keys(roles) as MrxRole[]) {
      const context = await browser.newContext({ baseURL, viewport });
      contexts.push(context);
      const page = await context.newPage();
      await loginRole(page, role);
      const identity = await page.evaluate(async () => {
        const token = localStorage.getItem('ipc_v3_token');
        const headers = { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' };
        const me = await fetch('/api/Auth/me', { headers });
        const mode = await fetch('/api/system-operation-mode', { headers });
        if (!me.ok || !mode.ok) throw new Error('Authenticated profile/mode read failed.');
        return { profile: (await me.json()).data, mode: (await mode.json()).data,
          localMode: localStorage.getItem('ipc_v3_mode'), localVersion: localStorage.getItem('ipc_v3_mode_version') };
      });
      expect(identity.profile.user.username).toBe(credentials[role].username);
      expect(identity.profile.user.roleCode).toBe(roles[role]);
      expect(identity.profile.user.isActive).toBe(true);
      expect(identity.mode.mode).toBe('MATERIAL_RECONCILIATION');
      expect(identity.localMode).toBe(identity.mode.mode);
      expect(identity.localVersion).toBe(String(identity.mode.version));
      if (role === 'manager') {
        expect(identity.profile.isAdmin).toBe(false);
        expect(identity.profile.permissions).toContain('reconciliation.read');
        expect(identity.profile.permissions).not.toContain('reconciliation.warehouse.read');
        expect(identity.profile.permissions).not.toContain('reconciliation.kitchen.read');
        const denied = await page.evaluate(async () => {
          const token = localStorage.getItem('ipc_v3_token');
          const statuses = [];
          for (const suffix of ['warehouse-daily', 'kitchen-cooking']) {
            const response = await fetch(`/api/reconciliation/batches/00000000-0000-0000-0000-000000000000/${suffix}`, {
              headers: { Authorization: `Bearer ${token}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
            });
            const body = await response.json();
            statuses.push({ status: response.status, success: body.success, hasData: body.data != null });
          }
          return statuses;
        });
        expect(denied).toEqual([
          { status: 403, success: false, hasData: false }, { status: 403, success: false, hasData: false },
        ]);
        for (const route of ['/warehouse?view=mrx-daily', '/chef?view=mrx-cooking']) {
          await page.goto(route);
          await expect(page).toHaveURL(/\/forbidden(?:\?|$)/);
        }
        const sourceStatus = await page.evaluate(async () => {
          const response = await fetch('/api/reconciliation/batches/draft-sources', {
            headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' },
          });
          return response.status;
        });
        expect(sourceStatus, 'BR-MRX-EDIT-1 Manager must reach source preparation before applying changes').toBe(200);
        expect(identity.profile.permissions).toContain('reconciliation.source.read');
        await page.goto('/weekly-menu?view=mrx-batch');
        await expect(page.getByRole('heading', { name: 'Chuẩn bị lô đối soát', exact: true })).toBeVisible();
        await page.goto('/reconciliation');
        await expect(page.getByRole('heading', { name: 'Đối soát nguyên liệu', exact: true })).toBeVisible();
      }
      for (const [index, route] of inventoryRoutes[role].entries()) {
        const responses: { endpoint: string; status: number; timeToHeadersMs: number }[] = [];
        const collect = (response: import('@playwright/test').Response) => {
          if (!new URL(response.url()).pathname.startsWith('/api/')) return;
          const timing = response.request().timing();
          responses.push({ endpoint: new URL(response.url()).pathname, status: response.status(), timeToHeadersMs: timing.responseStart });
        };
        page.on('response', collect);
        let readiness = 'OBSERVED';
        try {
          await page.bringToFront();
          await page.goto(route);
          await expect(page.getByRole('heading').first()).toBeVisible();
          try { await expect(page.locator('body')).not.toContainText('Đang tải'); }
          catch { readiness = 'NEEDS_EVIDENCE_LOADING'; }
          if (role === 'admin' && route.endsWith('view=bom')) {
            expect(await page.getByRole('row').count(), 'BOM coverage must not render the entire catalog').toBeLessThanOrEqual(52);
            const firstCode = await page.getByRole('row').nth(1).getByRole('cell').first().innerText();
            const grid = page.getByRole('table').locator('..');
            const lastDish = await page.evaluate(async () => {
              const response = await fetch('/api/Dishes/bom-coverage', { headers: { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}` } });
              if (!response.ok) throw new Error(`Coverage read ${response.status}`);
              const report = (await response.json()).data;
              return report.dishes[report.dishes.length - 1].dishCode as string;
            });
            await grid.evaluate((element) => { element.scrollTop = element.scrollHeight; });
            await expect(page.getByRole('cell').filter({ hasText: lastDish })).toBeVisible();
            await page.getByRole('textbox', { name: 'Tìm kiếm món ăn' }).fill(firstCode.trim());
            await expect(page.getByRole('row')).toHaveCount(2);
            await page.getByRole('textbox', { name: 'Tìm kiếm món ăn' }).fill('');
          }
          if (role === 'thukho' || role === 'beptruong') {
            expect(responses.filter((response) => response.endpoint === '/api/coordination/customers' && response.status === 403), 'Auth must not prefetch a catalog this role cannot read').toEqual([]);
          }
          const screenshot = path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `inventory-${role}-${index}.png`);
          await page.screenshot({ path: screenshot });
          inventory.push({ role, route, actualUrl: new URL(page.url()).pathname + new URL(page.url()).search,
            readiness, screenshot: path.basename(screenshot), responses,
            headings: await page.getByRole('heading').allTextContents(),
            visibleText: (await page.locator('body').innerText()).slice(0, 12000),
            actions: await page.getByRole('button').evaluateAll((buttons) => buttons.filter((button) => (button as HTMLElement).offsetParent !== null)
              .map((button) => ({ label: button.textContent?.trim(), disabled: (button as HTMLButtonElement).disabled }))),
          });
        } finally { page.off('response', collect); }
      }
      observations.push({ role, userId: identity.profile.user.userId, roleCode: identity.profile.user.roleCode,
        mode: identity.mode.mode, version: identity.mode.version, viewport: page.viewportSize() });
    }
    expect(new Set(observations.map((entry) => entry.userId)).size).toBe(5);
    await testInfo.attach('actual-actor-admission', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
  } finally {
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'bounded-route-inventory.json'), JSON.stringify(inventory, null, 2));
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test.describe('@G2-RBAC Multi-Role Handoff & Security Boundaries', () => {
  test('Bếp trưởng bị chặn không thể truy cập trạm Kho (RoleGuard redirect to /forbidden)', async ({ beptruongPage }) => {
    await beptruongPage.goto('/warehouse?view=mrx-daily');
    await beptruongPage.waitForTimeout(1500);

    // Bếp trưởng không có quyền Kho -> RoleGuard lập tức đá về /forbidden
    expect(beptruongPage.url()).toContain('/forbidden');
    await expect(beptruongPage.getByRole('heading', { name: /Truy cập bị từ chối/i })).toBeVisible();

    // Nhưng Bếp trưởng truy cập đúng trạm Bếp /chef thì hợp lệ
    await beptruongPage.goto('/chef?view=mrx-cooking');
    await beptruongPage.waitForSelector('header', { timeout: 15000 });
    expect(beptruongPage.url()).toContain('/chef?view=mrx-cooking');
  });

  test('Thủ kho bị chặn không thể truy cập trạm Thực đơn MRX (RoleGuard redirect to /forbidden)', async ({ thukhoPage }) => {
    await thukhoPage.goto('/weekly-menu?view=mrx-batch');
    await thukhoPage.waitForTimeout(1500);

    // Thủ kho không có quyền Thực đơn -> RoleGuard đá về /forbidden
    expect(thukhoPage.url()).toContain('/forbidden');
    await expect(thukhoPage.getByRole('heading', { name: /Truy cập bị từ chối/i })).toBeVisible();

    // Nhưng Thủ kho truy cập đúng trạm Kho /warehouse thì hợp lệ
    await thukhoPage.goto('/warehouse?view=mrx-daily');
    await thukhoPage.waitForSelector('header', { timeout: 15000 });
    expect(thukhoPage.url()).toContain('/warehouse?view=mrx-daily');
  });

  test('Điều phối viên đọc API lô nhưng không truy cập trạm quyết định hoặc danh mục giải trình', async ({ dieuphoiPage }) => {
    await dieuphoiPage.goto('/reconciliation');
    await expect(dieuphoiPage).toHaveURL(/\/forbidden(?:\?|$)/);
    const statuses = await dieuphoiPage.evaluate(async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' };
      const read = await fetch('/api/reconciliation/batches?pageSize=1', { headers });
      const decision = await fetch('/api/reconciliation/lines/disposition-categories', { headers });
      return { read: read.status, decision: decision.status };
    });
    expect(statuses).toEqual({ read: 200, decision: 403 });
    await dieuphoiPage.goto('/weekly-menu?view=mrx-batch');
    await expect(dieuphoiPage.getByRole('heading', { name: 'Chuẩn bị lô đối soát', exact: true })).toBeVisible();
  });

  test('Quản trị viên truy cập các trạm Đối soát, Thực đơn và Kho', async ({ adminPage }) => {
    await adminPage.goto('/reconciliation');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeVisible();

    await adminPage.goto('/weekly-menu?view=mrx-batch');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeVisible();

    await adminPage.goto('/warehouse?view=mrx-daily');
    await adminPage.waitForSelector('header', { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeVisible();
  });
});
