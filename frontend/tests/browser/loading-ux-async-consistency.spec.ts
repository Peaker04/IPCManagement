import { test, expect, type Page } from '@playwright/test';
import { CANONICAL_ROUTES } from '../../src/routes/routeRegistry';
import { isRouteEligible } from '../../src/routes/navigationEligibility';
import type { OperationalMode, UserInfo } from '../../src/types';

interface Frame { time: number; blank: boolean; headerMissing: boolean; paintedSkeletonMarks: number; dividerIndicatorOpacity: number; headerY: number | null; headerH: number | null; tableY: number | null; findY: number | null; tableOpacity: number | null; tableScroll: number | null; activeTag: string | null; dialog: { x: number; y: number; width: number; height: number } | null }
interface Probe { frames: Frame[]; shifts: { value: number; recentInput: boolean }[]; stop: () => void; reset: () => void }
interface ProbeWindow extends Window { __flashProbe?: Probe }
let session: { token: string; user: UserInfo; mode: OperationalMode };
const adminUrl = '/admin-data?view=ingredients';

async function resetProbe(page: Page) {
  await page.evaluate(() => (window as ProbeWindow).__flashProbe?.reset());
}
async function evidence(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).__flashProbe;
    if (!probe) throw new Error('Frame observer was not installed.');
    return { frames: probe.frames, shifts: probe.shifts };
  });
}
async function catalogueResponse(page: Page) {
  return page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/ingredients'));
}
async function painted(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function readyTable(page: Page) {
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByLabel('Đang tải nội dung')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

test.beforeAll(async ({ request }) => {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const api = process.env.FLASH_API_URL;
  if (!username || !password || !api || !['localhost', '127.0.0.1'].includes(new URL(api).hostname)) {
    throw new Error('BLOCKED: supply confirmed local FLASH_API_URL and E2E_ADMIN_USERNAME/E2E_ADMIN_PASSWORD; no auth fallback.');
  }
  const response = await request.post(`${api}/auth/login`, { data: { username, password } });
  expect(response.ok(), 'Real login must succeed').toBe(true);
  const login = await response.json();
  expect(login.success).toBe(true);
  expect(login.data?.accessToken).toBeTruthy();
  expect(login.data?.user?.userId).toBeTruthy();
  const modeResponse = await request.get(`${api}/system-operation-mode`, { headers: { Authorization: `Bearer ${login.data.accessToken}` } });
  expect(modeResponse.ok()).toBe(true);
  const snapshot = await modeResponse.json();
  expect(snapshot.success).toBe(true);
  expect(['DEFAULT', 'MATERIAL_RECONCILIATION']).toContain(snapshot.data?.mode);
  session = { token: login.data.accessToken, user: login.data.user, mode: snapshot.data.mode };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token, user, mode }) => {
    localStorage.setItem('ipc_v3_token', token);
    localStorage.setItem('ipc_v3_user', JSON.stringify(user));
    localStorage.setItem('ipc_v3_mode', mode);
  }, session);
  await page.addInitScript(() => {
    const probe: Probe = { frames: [], shifts: [], stop: () => {}, reset: () => {} };
    let frame = 0;
    const sample = () => {
      const main = document.querySelector('main');
      const header = main?.querySelector('header')?.getBoundingClientRect();
      const table = main?.querySelector('table');
      let opacity = table ? 1 : null;
      for (let node: Element | null = table ?? null; node; node = node.parentElement) opacity! *= Number(getComputedStyle(node).opacity);
      const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
      const stroke = main?.querySelector('.h-0\\.5');
      const paintedSkeletonMarks = [...(main?.querySelectorAll('[data-skeleton-mark]') ?? [])].filter(node => {
        const css = getComputedStyle(node);
        return css.visibility !== 'hidden' && Number(css.opacity) > 0 && node.getBoundingClientRect().height > 0;
      }).length;
      if (probe.frames.length < 4096) probe.frames.push({ time: performance.now(),
        blank: Boolean(main && !main.querySelector('header, table, [data-skeleton-header], [role="dialog"]') && !main.textContent?.trim()),
        headerMissing: Boolean(main && (!header || header.height === 0)),
        paintedSkeletonMarks,
        dividerIndicatorOpacity: stroke ? Number(getComputedStyle(stroke).opacity) : 0,
        headerY: header?.y ?? null, headerH: header?.height ?? null,
        tableY: table?.getBoundingClientRect().y ?? null,
        tableOpacity: opacity, tableScroll: table?.parentElement?.scrollTop ?? null,
        activeTag: document.activeElement?.tagName ?? null,
        dialog: dialog ? { x: dialog.x, y: dialog.y, width: dialog.width, height: dialog.height } : null,
        findY: main?.querySelector('input[type="search"], .reconciliation-lines-toolbar')?.getBoundingClientRect().y ?? null });
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        probe.shifts.push({ value: shift.value, recentInput: shift.hadRecentInput });
      }
    });
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) observer.observe({ type: 'layout-shift', buffered: true });
    probe.reset = () => { probe.frames = []; probe.shifts = []; observer.takeRecords(); };
    probe.stop = () => { cancelAnimationFrame(frame); observer.disconnect(); };
    (window as ProbeWindow).__flashProbe = probe;
  });
});

test.afterEach(async ({ page }, info) => {
  if (page.isClosed() || !session || page.url() === 'about:blank') return;
  const result = await evidence(page);
  await info.attach('frame-evidence', { body: JSON.stringify({ url: new URL(page.url()).pathname, mode: session.mode,
    actorRole: session.user.roleCode, viewport: page.viewportSize(), controlledNetwork: info.title.includes('controlled'), ...result }), contentType: 'application/json' });
  await page.evaluate(() => (window as ProbeWindow).__flashProbe?.stop());
});

test('Cold Navigation: geometry-matched loading and authoritative settlement', async ({ page }) => {
  await page.goto(adminUrl);
  await readyTable(page);
  const result = await evidence(page);
  expect(result.frames.length).toBeGreaterThan(0);
  expect(result.frames.length).toBeLessThan(4096);
  expect(result.frames.filter(frame => frame.blank)).toHaveLength(0);
  expect(result.frames.filter(frame => frame.headerMissing)).toHaveLength(0);
  expect(result.shifts.filter(shift => !shift.recentInput).reduce((sum, shift) => sum + shift.value, 0)).toBeLessThanOrEqual(0.05);
});

test('Pagination: same table node survives page settlement', async ({ page }) => {
  await page.goto(adminUrl); await readyTable(page);
  const table = await page.getByRole('table').first().elementHandle();
  const next = page.getByRole('button', { name: 'Trang sau', exact: true });
  await expect(next, 'Existing read-only catalogue must have a second page').toBeEnabled();
  await resetProbe(page);
  const settled = catalogueResponse(page);
  await next.click(); await settled; await readyTable(page); await painted(page);
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
});

test('Manual Refresh: same table and stable header during refetch', async ({ page }) => {
  await page.goto(adminUrl); await readyTable(page);
  const table = await page.getByRole('table').first().elementHandle();
  await resetProbe(page);
  const settled = catalogueResponse(page);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await settled; await readyTable(page); await painted(page);
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
  const { frames } = await evidence(page);
  expect(frames.some(frame => frame.blank)).toBe(false);
  expect(frames.some(frame => frame.dividerIndicatorOpacity > 0)).toBe(false);
  const anchors = frames.filter(frame => frame.headerY !== null);
  expect(anchors.length, 'Must observe action frames').toBeGreaterThan(0);
  expect(Math.max(...anchors.map(frame => frame.headerY!)) - Math.min(...anchors.map(frame => frame.headerY!))).toBeLessThanOrEqual(1);
  for (const field of ['headerH', 'tableY', 'findY'] as const) {
    const values = frames.map(frame => frame[field]).filter((value): value is number => value !== null);
    if (field !== 'findY') expect(values.length, `Must observe ${field}`).toBeGreaterThan(0);
    if (values.length) expect(Math.max(...values) - Math.min(...values), field).toBeLessThanOrEqual(1);
  }
});

test('Non-destructive error resilience: controlled refresh500 and retry preserve table identity', async ({ page }) => {
  await page.goto(adminUrl); await readyTable(page);
  const table = await page.getByRole('table').first().elementHandle();
  await page.route('**/api/ingredients*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Controlled refresh failure' }) }));
  await resetProbe(page); await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
  await page.unroute('**/api/ingredients*');
  const retried = catalogueResponse(page);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await retried; await readyTable(page); await painted(page);
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
});

test('MRX search/day continuity with existing authorized nonempty and empty days', async ({ page }) => {
  const url = process.env.FLASH_MRX_SCOPE_URL;
  const emptyDay = process.env.FLASH_MRX_EMPTY_DAY_LABEL;
  if (session.mode !== 'MATERIAL_RECONCILIATION' || !url?.startsWith('/reconciliation?') || !emptyDay) throw new Error('BLOCKED: confirm MRX scope URL and known empty-day accessible label in this mode.');
  await page.goto(url);
  await expect(page.getByRole('button', { name: /Tất cả \([1-9]/ })).toBeVisible();
  const selectedDay = await page.getByRole('group', { name: 'Ngày đối soát' }).getByRole('button', { pressed: true }).getAttribute('aria-label');
  const toggle = await page.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' }).elementHandle();
  await page.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' }).click();
  await page.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' }).fill('không khớp phép đo');
  await page.getByRole('button', { name: 'Đóng tìm kiếm nguyên liệu' }).click();
  await resetProbe(page); await page.getByRole('button', { name: emptyDay, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu rà soát dòng ngày' })).toBeVisible();
  expect(await toggle!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: selectedDay!, exact: true }).click();
  await expect(page.getByRole('button', { name: /Tất cả \([1-9]/ })).toBeVisible();
  await page.getByRole('button', { name: 'Tìm kiếm nguyên liệu đang lọc' }).click();
  await expect(page.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).toHaveValue('không khớp phép đo');
});

test('MRX reports: controlled delayed refresh and refresh500 preserve brightness, identity and scroll', async ({ page }) => {
  const scope = process.env.FLASH_MRX_SCOPE_URL;
  if (session.mode !== 'MATERIAL_RECONCILIATION' || !scope?.startsWith('/reconciliation?')) throw new Error('BLOCKED: confirm an existing MRX report scope with transactions.');
  const url = new URL(scope, 'http://localhost'); url.searchParams.set('view', 'transactions');
  await page.goto(url.pathname + url.search); await readyTable(page); await painted(page);
  await expect(page.getByRole('table').getByTitle('Bấm để xem chi tiết phiếu xuất kho').first(), 'BLOCKED: existing transaction rows required').toBeVisible();
  const table = await page.getByRole('table').elementHandle();
  const initialScroll = await table!.evaluate(node => node.parentElement!.scrollTop);
  let release!: () => void;
  let intercepted!: () => void;
  const requested = new Promise<void>(resolve => { intercepted = resolve; });
  const pattern = '**/api/reconciliation/reports/transactions-history?*';
  await page.route(pattern, async route => { await new Promise<void>(resolve => { release = resolve; intercepted(); }); await route.continue(); });
  await resetProbe(page);
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await requested;
  await expect(page.getByText('Đang tải trang báo cáo', { exact: true })).toBeVisible();
  await painted(page); release();
  await readyTable(page); await painted(page); await page.unroute(pattern);
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
  const result = await evidence(page);
  expect(result.frames.length).toBeGreaterThan(0); expect(result.frames.length).toBeLessThan(4096);
  expect(result.frames.some(frame => frame.blank)).toBe(false);
  expect(result.frames.some(frame => frame.dividerIndicatorOpacity > 0)).toBe(false);
  const opacities = result.frames.map(frame => frame.tableOpacity).filter((n): n is number => n !== null);
  expect(opacities.length).toBeGreaterThan(0); expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.999);
  for (const field of ['headerY', 'headerH', 'tableY'] as const) {
    const values = result.frames.map(frame => frame[field]).filter((n): n is number => n !== null);
    expect(values.length).toBeGreaterThan(0); expect(Math.max(...values) - Math.min(...values), field).toBeLessThanOrEqual(1);
  }
  await page.route(pattern, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Controlled report refresh failure' }) }));
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Controlled report refresh failure');
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
  expect(await table!.evaluate(node => node.parentElement!.scrollTop)).toBe(initialScroll);
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await readyTable(page); await painted(page);
  expect(await table!.evaluate(node => node.isConnected)).toBe(true);
});

test('MRX issue detail: controlled cold read keeps dialog bounds through settlement and restores opener focus', async ({ page }) => {
  const scope = process.env.FLASH_MRX_SCOPE_URL;
  if (session.mode !== 'MATERIAL_RECONCILIATION' || !scope?.startsWith('/reconciliation?')) throw new Error('BLOCKED: confirm existing MRX transactions and issue detail.');
  const url = new URL(scope, 'http://localhost'); url.searchParams.set('view', 'transactions');
  await page.goto(url.pathname + url.search); await readyTable(page); await painted(page);
  const opener = page.getByRole('table').getByTitle('Bấm để xem chi tiết phiếu xuất kho').first();
  await expect(opener, 'BLOCKED: existing readable issue is required').toBeVisible();
  let release!: () => void;
  let intercepted!: () => void;
  const requested = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route('**/api/inventory-issues/*?sourceFamily=MATERIAL_RECONCILIATION', async route => {
    await new Promise<void>(resolve => { release = resolve; intercepted(); }); await route.continue();
  });
  await opener.click(); await requested;
  const dialog = page.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' });
  await expect(dialog.getByLabel('Đang tải nội dung')).toBeVisible();
  await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  await painted(page); await resetProbe(page); await painted(page); release();
  await expect(dialog.getByRole('table')).toBeVisible(); await painted(page);
  const { frames } = await evidence(page);
  const bounds = frames.map(frame => frame.dialog).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  expect(bounds.length).toBeGreaterThan(0); expect(frames.length).toBeLessThan(4096);
  for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.max(...bounds.map(rect => rect[field])) - Math.min(...bounds.map(rect => rect[field])), field).toBeLessThanOrEqual(1);
  const viewport = page.viewportSize()!;
  expect(bounds.every(rect => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height)).toBe(true);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('MRX source: controlled two-stage cold read stays matrix-shaped until edit scope settles', async ({ page }) => {
  const url = process.env.FLASH_MRX_WEEKLY_SCOPE_URL;
  if (session.mode !== 'MATERIAL_RECONCILIATION' || !url?.startsWith('/weekly-menu?')) throw new Error('BLOCKED: confirm FLASH_MRX_WEEKLY_SCOPE_URL for an existing published source and eligible actor.');
  let release!: () => void;
  let intercepted!: () => void;
  const requested = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route('**/api/reconciliation/weekly-menu/edit-scope?*', async route => {
    await new Promise<void>(resolve => { release = resolve; intercepted(); }); await route.continue();
  });
  await page.goto(url); await requested;
  await expect(page.getByLabel('Đang tải nội dung')).toHaveAttribute('data-skeleton-kind', 'matrix');
  await expect(page.getByText('Đang tải dữ liệu nguồn…', { exact: true })).toHaveCount(0);
  await painted(page); release();
  await expect(page.getByLabel('Đang tải nội dung')).toHaveCount(0);
  await expect(page.getByRole('table').first(), 'Existing source must contain a rendered matrix').toBeVisible();
  await painted(page);
  const result = await evidence(page);
  expect(result.frames.length).toBeLessThan(4096);
  expect(result.frames.some(frame => frame.blank)).toBe(false);
});

test('MRX import history: controlled read keeps columns, unknown count and dialog frame through error and retry', async ({ page }) => {
  const url = process.env.FLASH_MRX_WEEKLY_SCOPE_URL;
  if (session.mode !== 'MATERIAL_RECONCILIATION' || !url?.startsWith('/weekly-menu?')) throw new Error('BLOCKED: confirm a source scope whose actor can open import history read-only.');
  await page.goto(url);
  await expect(page.getByLabel('Đang tải nội dung')).toHaveCount(0);
  const opener = page.getByRole('button', { name: /Nhập Excel/ });
  await expect(opener).toBeEnabled(); await opener.click();
  const dialog = page.getByRole('dialog');
  const history = dialog.getByRole('button', { name: /Lịch sử import & Khôi phục/ });
  let release!: () => void;
  let intercepted!: () => void;
  const requested = new Promise<void>(resolve => { intercepted = resolve; });
  const pattern = '**/api/coordination/weekly-menu/import-history?*';
  await page.route(pattern, async route => {
    await new Promise<void>(resolve => { release = resolve; intercepted(); });
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Controlled import history read failure' }) });
  });
  await history.click(); await requested;
  await expect(history).toContainText('(—)');
  const header = dialog.getByRole('columnheader', { name: 'Phiên bản / File' });
  await expect(header).toBeVisible();
  const headerNode = await header.elementHandle();
  await dialog.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  await painted(page); await resetProbe(page); await painted(page); release();
  await expect(dialog.getByRole('alert')).toContainText('Controlled import history read failure');
  expect(await headerNode!.evaluate(node => node.isConnected)).toBe(true);
  await page.unroute(pattern);
  await dialog.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click();
  await expect(dialog.getByText('Đang tải lịch sử nhập…')).toHaveCount(0);
  await expect(dialog.getByRole('alert')).toHaveCount(0); await painted(page);
  expect(await headerNode!.evaluate(node => node.isConnected)).toBe(true);
  const { frames } = await evidence(page);
  const bounds = frames.map(frame => frame.dialog).filter((rect): rect is NonNullable<typeof rect> => rect !== null);
  expect(bounds.length).toBeGreaterThan(0); expect(frames.length).toBeLessThan(4096);
  for (const field of ['x', 'y', 'width', 'height'] as const) expect(Math.max(...bounds.map(rect => rect[field])) - Math.min(...bounds.map(rect => rect[field])), field).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('Dashboard: authoritative mode selects the operational dashboard', async ({ page }) => {
  await page.goto('/');
  if (session.mode === 'MATERIAL_RECONCILIATION') {
    await expect(page.getByRole('heading', { name: 'Bàn điều hành đối soát' })).toBeVisible();
    await expect(page.getByLabel('Chỉ số điều hành đối soát')).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: 'Bàn điều hành hôm nay' })).toBeVisible();
    await expect(page.getByText('VIỆC CẦN XỬ LÝ TRƯỚC')).toBeVisible();
    await expect(page.getByText('TIẾN ĐỘ 4 CÔNG ĐOẠN')).toBeVisible();
  }
});

test('Production Plan: mode denial and readable shifts on an existing DEFAULT scope', async ({ page }) => {
  if (session.mode === 'MATERIAL_RECONCILIATION') {
    await page.goto('/weekly-menu?view=production-plan');
    await expect(page.getByRole('heading', { name: 'Truy cập bị từ chối' })).toBeVisible();
    return;
  }
  const url = process.env.FLASH_DEFAULT_PLAN_URL;
  if (!url?.startsWith('/weekly-menu?')) throw new Error('BLOCKED: confirm existing DEFAULT production-plan scope URL.');
  await page.goto(url);
  await expect(page.locator('tbody td').first(), 'Existing authorized plan data is required').toBeVisible();
  await expect(page.locator('tbody td').filter({ hasText: /^(MORNING|AFTERNOON|EVENING|FULLDAY)$/ })).toHaveCount(0);
  await expect(page.locator('tbody').getByText(/Sáng|Chiều|Tối|Cả ngày/).first()).toBeVisible();
});

for (const path of CANONICAL_ROUTES.map(route => route.path)) {
  test(`Route coverage (read only): ${path}`, async ({ page }, info) => {
    const allowed = path === '/login' || path === '/forbidden' || isRouteEligible(CANONICAL_ROUTES, path, '', session.user, session.mode);
    await page.goto(path);
    if (path === '/forbidden' || !allowed) await expect(page.getByRole('heading', { name: 'Truy cập bị từ chối' })).toBeVisible();
    else if (path === '/login') await expect(page.getByRole('button', { name: /Đăng nhập/ })).toBeVisible();
    else await expect(page.getByRole('main')).toBeVisible();
    await info.attach('route-classification', { body: JSON.stringify({ path, mode: session.mode, result: allowed ? 'NEEDS_EVIDENCE: route reached; per-view action journey still required' : 'DENIAL_VERIFIED_ONLY' }), contentType: 'application/json' });
  });
}
