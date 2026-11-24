import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { MrxMaterialInspectionPage, MrxPlanInspectionPage, MrxSourceHistoryEvent, MrxSourceHistoryDetail, MrxWarehouseDaily } from '../../src/api/mrxApi';

const week = '2026-11-23';
const materialsUrl = '/weekly-menu?view=mrx-materials&customerId=c-anv&weekStartDate=' + week;
const historyUrl = '/warehouse?view=mrx-issues';
const ok = (route: Route, data: unknown) => route.fulfill({ json: { success: true, data } });
const fail = (route: Route, message: string) => route.fulfill({ status: 500, json: { success: false, message } });
function paged<T>(items: T[], number: number, size: number, count: number) {
  const totalPages = Math.ceil(count / size);
  return { items, pageNumber: number, pageSize: size, totalCount: count, totalPages, hasPrev: number > 1, hasNext: number < totalPages };
}
async function install(page: Page, respond: (route: Route, url: URL) => Promise<unknown> | undefined) {
  await page.addInitScript(() => {
    localStorage.setItem('ipc_v3_token', 'mrx-interaction-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'fixture', fullName: 'Fixture', roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: ['*'] }));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/system-operation-mode') return ok(route, { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1, updatedAt: '2026-11-15T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    return respond(route, url) ?? route.fulfill({ status: 503, json: { success: false, message: 'Endpoint outside this fixture.' } });
  });
}
function materials(route: Route, url: URL) {
  if (url.pathname === '/api/coordination/customers') return ok(route, [{ customerId: 'c-anv', customerCode: 'ANV', customerName: 'AMANN' }]);
  if (url.pathname === '/api/reconciliation/weekly-menu') return ok(route, { customerId: 'c-anv', weekStartDate: week, menuVersionId: 'mv-w48', menuVersionStatus: 'PUBLISHED', menuVersionNo: 1, warnings: [] });
  if (url.pathname !== '/api/reconciliation/batches/quantity-import/materials') return;
  const number = Number(url.searchParams.get('PageNumber'));
  const size = Number(url.searchParams.get('PageSize'));
  const count = 51;
  const rows = Array.from({ length: Math.min(size, Math.max(0, count - (number - 1) * size)) }, (_, index) => {
    const ordinal = (number - 1) * size + index + 1;
    return { ingredientId: `i-${ordinal}`, ingredientCode: `NL-${ordinal}`, ingredientName: `Nguyên liệu ${ordinal}`, canonicalUnitId: 'kg', canonicalUnitName: 'Kilogram', requiredQuantity: 3, contributions: [] };
  });
  const data: MrxMaterialInspectionPage = { menuVersionId: 'mv-w48', contentFingerprint: 'v1', fingerprintFormatVersion: 3, diagnostics: [], page: paged(rows, number, size, count) };
  return ok(route, data);
}
const first: MrxSourceHistoryEvent = { eventId: 'amendment:aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', customerCode: 'ANV', customerName: 'AMANN', weekStartDate: week, occurredAt: '2026-11-24T08:00:00Z', actorName: 'Điều phối', status: 'PENDING_REVIEW', approvalStatus: 'PENDING', changeRoute: 'REQUEST', reason: 'Đổi món trong tuần', affectedLineCount: 26 };
const eventRows = Array.from({ length: 26 }, (_, i): MrxSourceHistoryEvent => ({ ...first, eventId: `amendment:aaaaaaaa-1111-4111-8111-${String(i + 1).padStart(12, '0')}`, customerCode: i === 25 ? 'BETA' : 'ANV', customerName: i === 25 ? 'Beta' : 'AMANN', occurredAt: new Date(Date.parse(first.occurredAt) - i * 60000).toISOString() }));
function history(route: Route, url: URL) {
  const number = Number(url.searchParams.get('PageNumber'));
  const size = Number(url.searchParams.get('PageSize'));
  if (url.pathname !== '/api/reconciliation/source-history') return;
  const customer = url.searchParams.get('CustomerCode');
  const exact = customer ? eventRows.filter(event => event.customerCode === customer) : eventRows;
  return ok(route, paged(exact.slice((number - 1) * size, number * size), number, size, exact.length));
}

test('materials: changes page size, navigates last page, and restores URL scope with Back', async ({ page }) => {
  const reads: string[] = [];
  await install(page, (route, url) => {
    if (url.pathname.endsWith('/quantity-import/materials')) reads.push(`${url.searchParams.get('PageNumber')}/${url.searchParams.get('PageSize')}`);
    return materials(route, url);
  });
  await page.goto(materialsUrl);
  const pager = page.getByRole('navigation', { name: 'Định lượng nguyên liệu', exact: true });
  await expect(page.getByText('Nguyên liệu 1', { exact: true })).toBeVisible();
  await expect(pager.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
  await pager.getByRole('combobox', { name: 'Số dòng mỗi trang' }).selectOption('25');
  await expect.poll(() => reads.at(-1)).toBe('1/25');
  await pager.getByRole('button', { name: 'Trang sau' }).press('Enter');
  await expect(page.getByText('Nguyên liệu 26', { exact: true })).toBeVisible();
  await pager.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByText('Nguyên liệu 51', { exact: true })).toBeVisible();
  await expect(pager.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  await expect.poll(() => reads.at(-1)).toBe('3/25');
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Nguyên liệu 26', { exact: true })).toBeVisible();
  await pager.getByRole('combobox', { name: 'Số dòng mỗi trang' }).selectOption('100');
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByText('Nguyên liệu 1', { exact: true })).toBeVisible();
  await expect.poll(() => reads.at(-1)).toBe('1/100');
});

test('materials: persistent page 2 error permits returning to confirmed page 1', async ({ page }) => {
  await install(page, (route, url) => url.pathname.endsWith('/quantity-import/materials') && url.searchParams.get('PageNumber') === '2'
    ? fail(route, 'Trang định lượng 2 tạm lỗi') : materials(route, url));
  await page.goto(materialsUrl);
  await expect(page.getByText('Nguyên liệu 1', { exact: true })).toBeVisible();
  const pager = page.getByRole('navigation', { name: 'Định lượng nguyên liệu', exact: true });
  await pager.getByRole('button', { name: 'Trang sau' }).click();
  await expect(page.getByRole('alert')).toContainText('Trang định lượng 2 tạm lỗi');
  await expect.poll(() => page.getByText('Nguyên liệu 1', { exact: true }).evaluate(node => Boolean(node.closest('[inert]')))).toBe(true);
  await expect(pager.getByRole('button', { name: 'Trang trước' })).toBeEnabled();
  await pager.getByRole('button', { name: 'Trang trước' }).click();
  await expect(page.getByText('Nguyên liệu 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('plans: a failed page can be left with the keyboard at a tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 900 });
  await install(page, (route, url) => {
    if (!url.pathname.endsWith('/quantity-import/plans')) return materials(route, url);
    if (url.searchParams.get('PageNumber') === '2') return fail(route, 'Trang kế hoạch 2 tạm lỗi');
    const rows = Array.from({ length: 50 }, (_, index) => ({
      serviceDate: week, planCode: `KH-${index + 1}`, line: {
        quantityPlanLineId: `line-${index + 1}`, menuScheduleId: 'schedule-1', customerId: 'c-anv', menuId: 'menu-1',
        shift: 'MORNING' as const, finalServings: 100, menuCode: 'TD01', menuName: `Thực đơn ca ${index + 1}`, dishes: [],
      },
    }));
    const data: MrxPlanInspectionPage = { menuVersionId: 'mv-w48', contentFingerprint: 'v1', fingerprintFormatVersion: 3, diagnostics: [], page: paged(rows, 1, 50, 51) };
    return ok(route, data);
  });
  await page.goto(materialsUrl.replace('mrx-materials', 'mrx-plans'));
  const pager = page.getByRole('navigation', { name: 'Kế hoạch theo ca', exact: true });
  const previous = pager.getByRole('button', { name: 'Trang trước' });
  await expect(page.getByText('Thực đơn ca 1', { exact: true })).toBeVisible();
  await pager.getByRole('button', { name: 'Trang sau' }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Trang kế hoạch 2 tạm lỗi');
  await expect(previous).toBeEnabled();
  await previous.press('Enter');
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Thực đơn ca 1', { exact: true })).toBeVisible();
});

for (const width of [390, 834, 1280]) {
test(`source history: pointer can reach footer with 25 events at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 720 });
  await install(page, history);
  await page.goto(historyUrl);
  await expect(page.getByRole('listitem')).toHaveCount(25);
  const next = page.getByRole('navigation', { name: 'Phân trang lịch sử thay đổi nguồn' }).getByRole('button', { name: 'Trang sau' });
  await expect(next).toBeEnabled();
  await expect(next).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (width === 390) {
    const customer = await page.getByRole('textbox', { name: 'Mã khách hàng lịch sử nguồn' }).boundingBox();
    const batch = await page.getByRole('textbox', { name: 'Mã lô lịch sử nguồn' }).boundingBox();
    expect(customer && batch && customer.y === batch.y && customer.x + customer.width <= batch.x).toBe(true);
  }
  const scrollRegion = page.getByRole('region', { name: 'Danh sách thay đổi nguồn' });
  const lastEvent = page.getByRole('listitem').last();
  await expect(lastEvent).not.toBeInViewport();
  await scrollRegion.press('End');
  await expect(lastEvent).toBeInViewport();
  await expect(next).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath(`source-history-${width}.png`) });
  await next.click({ timeout: 2500 });
  await expect(page.getByText('BETA · Beta')).toBeVisible();
});
}

test('source history: page 2 failure can be retried and page 1 remains reachable during that failure', async ({ page }) => {
  let attempts = 0;
  await install(page, (route, url) => url.pathname.endsWith('/source-history') && url.searchParams.get('PageNumber') === '2' && ++attempts === 1
    ? fail(route, 'Trang lịch sử 2 tạm lỗi') : history(route, url));
  await page.goto(historyUrl);
  const pager = page.getByRole('navigation', { name: 'Phân trang lịch sử thay đổi nguồn' });
  await pager.getByRole('button', { name: 'Trang sau' }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Trang lịch sử 2 tạm lỗi');
  const canGoBackWhileFailed = await pager.getByRole('button', { name: 'Trang trước' }).isEnabled();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('BETA · Beta')).toBeVisible();
  expect(attempts).toBe(2);
  await pager.getByRole('button', { name: 'Trang trước' }).press('Enter');
  await expect(page.getByRole('listitem')).toHaveCount(25);
  expect(canGoBackWhileFailed).toBe(true);
});

test('source history: draft filters apply only on Enter and Xem tất cả resets page and URL', async ({ page }) => {
  const reads: Array<string | null> = [];
  await install(page, (route, url) => {
    if (url.pathname.endsWith('/source-history')) reads.push(url.searchParams.get('CustomerCode'));
    return history(route, url);
  });
  await page.goto(historyUrl);
  const pager = page.getByRole('navigation', { name: 'Phân trang lịch sử thay đổi nguồn' });
  await pager.getByRole('button', { name: 'Trang sau' }).press('Enter');
  await expect(page.getByText('BETA · Beta')).toBeVisible();
  const customer = page.getByRole('textbox', { name: 'Mã khách hàng lịch sử nguồn' });
  await customer.fill(' ANV ');
  expect(reads).not.toContain('ANV');
  await customer.press('Enter');
  await expect(page).toHaveURL(/customerCode=ANV/);
  await expect.poll(() => reads.at(-1)).toBe('ANV');
  await expect(page.getByRole('listitem')).toHaveCount(25);
  await expect(page.getByText('BETA · Beta')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem tất cả' }).click();
  await expect(page).toHaveURL(/historyScope=all/);
  await expect(page).not.toHaveURL(/customerCode/);
  await expect(pager.getByText(/Trang 1\/2/)).toBeVisible();
  await expect(customer).toHaveValue('');
});

test('source detail: page 2 failure can be retried without crossing event identity, reopening resets the page', async ({ page }) => {
  const reads: Array<{ path: string; number: number }> = [];
  await install(page, (route, url) => {
    if (!url.pathname.includes('/source-history/')) return history(route, url);
    const number = Number(url.searchParams.get('PageNumber'));
    reads.push({ path: decodeURIComponent(url.pathname.split('/').at(-1)!), number });
    if (number === 2 && reads.filter(read => read.number === 2).length === 1) return fail(route, 'Chi tiết trang 2 tạm lỗi');
    const event = eventRows.find(entry => entry.eventId === reads.at(-1)!.path)!;
    const rows = Array.from({ length: number === 1 ? 25 : 1 }, (_, i) => ({ serviceDate: week, ingredientCode: `ING-${number}-${i}`, ingredientName: `Định lượng trang ${number} dòng ${i}`, unitName: 'Kilogram', previousQuantity: 1, newQuantity: 2, deltaQuantity: 1, isApplied: false }));
    const detail: MrxSourceHistoryDetail = { event, requesterName: 'Điều phối', requestedAt: event.occurredAt, reviewerName: null, reviewedAt: null, executorName: null, executedAt: null, revisions: [], materials: paged(rows, number, 25, 26) };
    return ok(route, detail);
  });
  await page.goto(historyUrl);
  const items = page.getByRole('listitem');
  const opener = items.first().getByRole('button', { name: /Xem chi tiết/ });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết thay đổi nguồn' });
  await expect(dialog.getByText('Định lượng trang 1 dòng 0')).toBeVisible();
  await dialog.getByRole('button', { name: 'Trang sau' }).press('Enter');
  await expect(dialog.getByRole('alert')).toContainText('Không tải được chi tiết');
  await dialog.getByRole('button', { name: 'Thử lại' }).click();
  await expect(dialog.getByText('Định lượng trang 2 dòng 0')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await items.nth(1).getByRole('button', { name: /Xem chi tiết/ }).click();
  await expect(dialog.getByText('Định lượng trang 1 dòng 0')).toBeVisible();
  expect(reads).toEqual([1, 2, 2, 1].map((number, i) => ({ path: eventRows[i === 3 ? 1 : 0].eventId, number })));
});

const chefUrl = '/chef?view=mrx-cooking&batchId=batch-1';
const chefBatch = { batchId: 'batch-1', customerId: 'customer-1', customerCode: 'KH01', customerName: 'Khách hàng thứ nhất', weekStartDate: week, weekEndDate: '2026-11-29', status: 'TRANSFERRED', version: 2, createdAt: '2026-11-23T00:00:00Z' };
const chefRow = { serviceDate: '2026-11-24', weekday: 'Thứ 3', shiftName: 'Ca chiều', menuVariant: 'Mặn', dishCode: 'MON-01', dishName: 'Cơm rang', servings: 100, ingredientCode: 'NL01', ingredientName: 'Gạo tẻ', unitName: 'kg', bomQuantityPerServing: 0.08, wasteRatePercent: 0, totalRequiredQuantity: 8 };
function chefCatalog(route: Route, url: URL) {
  if (url.pathname === '/api/reconciliation/batches') {
    const number = Number(url.searchParams.get('PageNumber') ?? 1);
    const rows = number === 1 ? Array.from({ length: 50 }, (_, i) => i === 0 ? chefBatch : ({ ...chefBatch, batchId: `batch-${i + 1}`, customerId: `customer-${i + 1}`, customerCode: `KH${i + 1}`, customerName: `Khách hàng ${i + 1}` })) : [{ ...chefBatch, batchId: 'batch-51', customerId: 'customer-51', customerCode: 'KH51', customerName: 'Khách cuối' }];
    return ok(route, paged(rows, number, 50, 51));
  }
  if (url.pathname === '/api/reconciliation/batches/batch-1/kitchen-cooking') return ok(route, { batchId: chefBatch.batchId, sourceVersion: chefBatch.version, rows: [chefRow] });
}

test('chef Excel: waiting locks the command, error keeps scope and retry downloads with the same parameters', async ({ page }) => {
  const exports: string[] = [];
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const workbook = readFileSync(new URL('../../../backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx', import.meta.url));
  await install(page, (route, url) => {
    if (url.pathname !== '/api/reconciliation/kitchen-cooking/xlsx') return chefCatalog(route, url);
    exports.push(url.search);
    return exports.length === 1 ? gate.then(() => fail(route, 'Không tạo được tệp Excel')) : route.fulfill({ body: workbook, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  });
  await page.goto(chefUrl);
  const opener = page.getByRole('button', { name: 'Xuất phiếu nấu Excel', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Xuất phiếu nấu Excel' });
  const firstBatch = dialog.getByRole('checkbox', { name: /lô đang xem/ });
  await firstBatch.uncheck();
  await expect(dialog.getByRole('button', { name: 'Tải Excel · 0 lô' })).toBeDisabled();
  await firstBatch.check();
  await dialog.getByRole('combobox', { name: 'Ngày phục vụ' }).selectOption('2026-11-24');
  await dialog.getByRole('combobox', { name: 'Ca phục vụ' }).selectOption('AFTERNOON');
  try {
    await dialog.getByRole('button', { name: 'Tải Excel · 1 lô' }).press('Enter');
    await expect.poll(() => exports.length).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Đang tải…' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(firstBatch).toBeDisabled();
  } finally { release(); }
  await expect(dialog.getByRole('alert')).toContainText(/không|lỗi/i);
  await expect(firstBatch).toBeChecked();
  await expect(dialog.getByRole('combobox', { name: 'Ca phục vụ' })).toHaveValue('AFTERNOON');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải Excel · 1 lô' }).click();
  expect((await download).suggestedFilename()).toBe('phieu-nau-2026-11-24.xlsx');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(exports).toHaveLength(2);
  expect(exports[1]).toBe(exports[0]);
  const sent = new URLSearchParams(exports[1]);
  expect(sent.getAll('batchIds')).toEqual(['batch-1']);
  expect(sent.get('serviceDate')).toBe('2026-11-24');
  expect(sent.get('shift')).toBe('AFTERNOON');
});

test('chef Excel: enabled next page must actually fetch after a catalog page 2 error', async ({ page }) => {
  let reads = 0;
  await install(page, (route, url) => {
    if (url.pathname === '/api/reconciliation/batches' && url.searchParams.get('PageNumber') === '2' && ++reads === 1) return fail(route, 'Danh sách lô trang 2 tạm lỗi');
    return chefCatalog(route, url);
  });
  await page.goto(chefUrl);
  await page.getByRole('button', { name: 'Xuất phiếu nấu Excel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất phiếu nấu Excel' });
  const next = dialog.getByRole('navigation', { name: 'Phân trang lô trong tuần' }).getByRole('button', { name: 'Trang sau' });
  await next.click();
  await expect(dialog.getByRole('alert')).toContainText('Danh sách lô trang 2 tạm lỗi');
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => reads).toBe(2);
  await expect(dialog.getByRole('checkbox', { name: /KH51/ })).toBeVisible();
});

test('chef Excel: explicit retry restores page 2 and selection survives paging', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  let attempts = 0;
  await install(page, (route, url) => {
    if (url.pathname === '/api/reconciliation/batches' && url.searchParams.get('PageNumber') === '2' && ++attempts === 1) return fail(route, 'Danh sách lô trang 2 tạm lỗi');
    return chefCatalog(route, url);
  });
  await page.goto(chefUrl);
  await page.getByRole('button', { name: 'Xuất phiếu nấu Excel', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xuất phiếu nấu Excel' });
  const pager = dialog.getByRole('navigation', { name: 'Phân trang lô trong tuần' });
  const lots = dialog.getByRole('region', { name: 'Danh sách lô để xuất Excel' });
  expect(await lots.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(100);
  await expect(pager.getByRole('button', { name: 'Trang sau' })).toBeInViewport();
  await pager.getByRole('button', { name: 'Trang sau' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Danh sách lô trang 2 tạm lỗi');
  await dialog.getByRole('button', { name: 'Thử lại' }).press('Enter');
  const last = dialog.getByRole('checkbox', { name: /KH51/ });
  await last.check();
  await expect(dialog.getByRole('button', { name: 'Tải Excel · 2 lô' })).toBeEnabled();
  await pager.getByRole('button', { name: 'Trang trước' }).click();
  await expect(dialog.getByRole('checkbox', { name: /lô đang xem/ })).toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Tải Excel · 2 lô' })).toBeEnabled();
  await pager.getByRole('button', { name: 'Trang sau' }).click();
  await expect(last).toBeChecked();
  await page.screenshot({ path: test.info().outputPath('chef-excel-390.png') });
  expect(attempts).toBe(3);
});

test('source history: denied filter hides previous rows and retry restores only the requested customer', async ({ page }) => {
  let attempts = 0;
  await install(page, (route, url) => {
    if (url.pathname.endsWith('/source-history') && url.searchParams.get('CustomerCode') === 'BETA' && ++attempts === 1) {
      return route.fulfill({ status: 403, json: { success: false, message: 'Không có quyền xem.' } });
    }
    return history(route, url);
  });
  await page.goto(historyUrl);
  await expect(page.getByText('ANV · AMANN', { exact: true })).toHaveCount(25);
  const customer = page.getByRole('textbox', { name: 'Mã khách hàng lịch sử nguồn' });
  await customer.fill('BETA');
  await customer.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Truy cập bị hạn chế');
  await expect(page.getByText('ANV · AMANN', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByText('BETA · Beta', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  expect(attempts).toBe(2);
});

const longIngredient = 'Gạo tẻ thơm dùng cho cơm rang phục vụ ca chiều tại bếp tập trung và các căn tin theo định lượng đã chốt';
const longDish = 'Cơm rang với rau củ và thịt gà dùng trong thực đơn tăng cường cho ca sản xuất buổi chiều';
const longUnit = 'Kilogram nguyên liệu đã sơ chế';

async function textFits(locator: Locator, edge: 'self' | 'cell' = 'self') {
  return locator.evaluate((node, bounds) => {
    const frame = (bounds === 'cell' ? node.closest('td,th')! : node).getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    return Array.from(range.getClientRects()).every(rect => rect.width === 0 ||
      rect.left >= frame.left - 1 && rect.right <= frame.right + 1 && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1);
  }, edge);
}

async function showLastColumn(table: Locator) {
  return table.evaluate(node => {
    const first = node.querySelector('tbody td')!;
    const last = node.querySelector('tbody td:last-child')!;
    const scrollport = node.parentElement!;
    const start = first.getBoundingClientRect().left;
    scrollport.scrollLeft = scrollport.scrollWidth;
    const frozen = first.getBoundingClientRect();
    const edge = scrollport.getBoundingClientRect().left + scrollport.clientWidth;
    const range = document.createRange();
    const text = document.createTreeWalker(last, NodeFilter.SHOW_TEXT);
    let readable = true;
    for (let fragment = text.nextNode(); fragment; fragment = text.nextNode()) {
      if (!fragment.textContent?.trim()) continue;
      range.selectNodeContents(fragment);
      readable &&= Array.from(range.getClientRects()).every(rect => rect.left >= frozen.right - 1 && rect.right <= edge + 1);
    }
    return {
      frozen: Math.abs(frozen.left - start) <= 1,
      readable,
    };
  });
}

test('material detail: a long ingredient heading fits without covering the table at narrow and split widths', async ({ page }) => {
  await install(page, (route, url) => {
    if (!url.pathname.endsWith('/quantity-import/materials')) return materials(route, url);
    const data: MrxMaterialInspectionPage = { menuVersionId: 'mv-w48', contentFingerprint: 'v1', fingerprintFormatVersion: 3, diagnostics: [],
      page: paged([{ ingredientId: 'i-1', ingredientCode: 'NL-1', ingredientName: longIngredient, canonicalUnitId: 'kg', canonicalUnitName: 'Kilogram', requiredQuantity: 3, contributions: [] }], 1, 50, 1) };
    return ok(route, data);
  });
  for (const width of [390, 834, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(materialsUrl);
    await page.getByRole('row', { name: new RegExp(longIngredient) }).press('Enter');
    const heading = page.getByRole('heading', { name: 'Nguồn tính · ' + longIngredient });
    await expect(heading).toBeVisible();
    expect.soft(await textFits(heading), `heading at ${width}px`).toBe(true);
    const headingBox = await heading.boundingBox();
    const columnBox = await page.getByRole('columnheader', { name: 'Ngày / ca', exact: true }).boundingBox();
    expect.soft(headingBox!.y + headingBox!.height, `header/table overlap at ${width}px`).toBeLessThanOrEqual(columnBox!.y + 1);
    if (width === 390) await page.screenshot({ path: test.info().outputPath('material-heading-390.png') });
  }
});

test('warehouse: long ingredient, quantity and status fit in daily and weekly columns', async ({ page }) => {
  const date = week;
  const quantity = 1234567.123456;
  const line = { dailyLineId: 'dl-1', batchLineId: 'bl-1', ingredientId: 'i-1', ingredientCode: 'NL-1', ingredientName: longIngredient, canonicalUnitId: 'kg', canonicalUnitName: longUnit, quantityStatus: 'UNTOUCHED' as const, requiredQuantity: quantity, issuedQuantity: null, returnedQuantity: 0, remainingQuantity: quantity, hasValidDisposition: false };
  const daily: MrxWarehouseDaily = { batchId: 'batch-1', batchStatus: 'TRANSFERRED', sourceVersion: 2, weeklyStatus: 'IN_PROGRESS',
    compatibility: { canRead: true, canIssueByDate: true }, dates: [{ serviceDate: date, status: 'UNTOUCHED', isApplicable: true, requiredQuantity: quantity, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: quantity, lines: [line] }] };
  await install(page, (route, url) => {
    if (url.pathname.endsWith('/warehouse-daily')) return ok(route, daily);
    if (url.pathname === '/api/inventory-issues') return ok(route, paged([], 1, 25, 0));
    return chefCatalog(route, url);
  });
  for (const width of [390, 834, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/warehouse?view=mrx-daily&batchId=batch-1&date=' + date);
    await expect(page.getByText(longIngredient, { exact: true })).toBeVisible();
    expect.soft(await textFits(page.getByText(longIngredient, { exact: true })), `daily name at ${width}px`).toBe(true);
    await page.getByRole('button', { name: 'Điền đủ toàn bộ' }).click();
    const status = page.getByText('Dự kiến xuất đủ', { exact: true });
    await expect(status).toBeVisible();
    expect.soft(await textFits(status, 'cell'), `status at ${width}px`).toBe(true);
    const table = page.getByRole('table').filter({ has: status });
    const columns = await table.getByRole('columnheader').allTextContents();
    expect.soft(columns).toEqual(['Nguyên liệu thực phẩm', 'Nhu cầu ca', 'Thực xuất cửa kho', 'Lý do chênh lệch (nếu vượt)', 'Trạng thái nghiệp vụ']);
    if (width === 390) {
      const scroll = page.getByRole('region', { name: 'Bảng định lượng xuất kho theo ngày' });
      const title = page.getByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' });
      const confirm = page.getByRole('button', { name: 'Xác nhận xuất kho' });
      const titleBox = await title.boundingBox();
      const commandBox = await confirm.boundingBox();
      expect.soft(await textFits(title)).toBe(true);
      expect.soft(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(commandBox!.y);
      await scroll.press('ArrowRight');
      await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      await scroll.evaluate(node => { node.scrollLeft = 0; });
    }
    expect.soft(await showLastColumn(table), `daily frozen column and status at ${width}px`).toEqual({ frozen: true, readable: true });
    await expect.soft(status).toBeInViewport();
    await page.getByRole('textbox', { name: 'Số lượng thực xuất ' + longIngredient }).fill('');
    await page.getByRole('button', { name: 'Cả tuần (Tổng hợp)', exact: true }).click();
    const weekly = page.getByRole('columnheader', { name: 'Còn lại phải xuất', exact: true });
    await expect(weekly).toBeVisible();
    expect.soft(await textFits(page.getByText(longIngredient, { exact: true })), `weekly name at ${width}px`).toBe(true);
    const remaining = page.getByRole('row').filter({ hasText: longIngredient }).getByRole('cell').last();
    expect.soft(await textFits(remaining), `weekly total at ${width}px`).toBe(true);
    expect.soft(await showLastColumn(page.getByRole('table').filter({ has: remaining })), `weekly frozen column and total at ${width}px`).toEqual({ frozen: true, readable: true });
    if (width === 390) await page.screenshot({ path: test.info().outputPath('warehouse-weekly-390.png') });
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('chef: long labels do not escape their panel and the final numeric column is reachable', async ({ page }) => {
  const code = 'MON-SAN-XUAT-THUC-DON-CA-CHIEU-00000001';
  await install(page, (route, url) => {
    if (!url.pathname.endsWith('/kitchen-cooking')) return chefCatalog(route, url);
    return ok(route, { batchId: chefBatch.batchId, sourceVersion: chefBatch.version, rows: [{ ...chefRow, dishName: longDish,
      dishCode: code, ingredientName: longIngredient, unitName: longUnit, totalRequiredQuantity: 1234567.123456 }] });
  });
  for (const width of [390, 834, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(chefUrl);
    await page.getByRole('button', { name: new RegExp(longDish) }).click();
    const heading = page.getByRole('heading', { name: 'Nguyên liệu · ' + longDish });
    await expect(heading).toBeVisible();
    expect.soft(await textFits(heading), `chef title at ${width}px`).toBe(true);
    const section = page.getByRole('region', { name: new RegExp('Nguyên liệu ' + longDish) });
    const metadata = section.getByText('(' + code + ')', { exact: true });
    const right = await section.evaluate(node => node.getBoundingClientRect().right);
    const metaBox = await metadata.boundingBox();
    expect.soft(metaBox!.x + metaBox!.width, `chef code at ${width}px`).toBeLessThanOrEqual(Math.min(width, right) + 1);
    const table = section.getByRole('table');
    expect.soft(await table.getByRole('columnheader').allTextContents()).toEqual(['Nguyên liệu', 'ĐVT', 'Định mức / suất', 'Hao hụt (%)', 'Tổng lượng cần']);
    const required = table.getByRole('row').last().getByRole('cell').last();
    expect.soft(await showLastColumn(table), `chef frozen column and total at ${width}px`).toEqual({ frozen: true, readable: true });
    await expect.soft(required).toBeInViewport();
    expect.soft(await textFits(required), `chef total at ${width}px`).toBe(true);
    expect.soft(await textFits(table.getByText(longUnit, { exact: true }), 'cell'), `chef unit at ${width}px`).toBe(true);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (width === 834) await page.screenshot({ path: test.info().outputPath('chef-quantity-834.png') });
  }
  await page.setViewportSize({ width: 720, height: 960 });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const printTable = page.getByRole('table');
  await expect(printTable.getByRole('columnheader', { name: 'Tổng lượng cần' })).toBeVisible();
  expect(await printTable.evaluate(table => table.getBoundingClientRect().right)).toBeLessThanOrEqual(721);
});
