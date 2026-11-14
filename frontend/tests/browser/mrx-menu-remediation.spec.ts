import { expect, test, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { MrxBatch, MrxBatchDishSummary, MrxMaterialInspectionPage, MrxPlanInspectionPage, MrxPreparation, MrxWarehouseDaily } from '../../src/api/mrxApi';

// BROWSER_FIXTURE only: isolated HTTP fixtures, never persisted/live business evidence.
test('BROWSER_FIXTURE: scoped read leaves survive reload and responsive contributor navigation', async ({ page }) => {
  const actor = { userId: 'fixture-coordinator', username: 'fixture', fullName: 'Điều phối thử giao diện', roleCode: 'MANAGER', roleName: 'Quản lý', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read', 'reconciliation.warehouse.read'] };
  await page.addInitScript(actor => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, actor);
  const material: MrxMaterialInspectionPage = {
    menuVersionId: 'version-1', contentFingerprint: 'fixture-fingerprint', fingerprintFormatVersion: 3, diagnostics: [],
    page: { totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false, items: [{
      ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Gạo tẻ dùng cho cơm và món ăn theo thực đơn tuần', canonicalUnitId: 'kg', canonicalUnitName: 'kg', requiredQuantity: 1.2,
      contributions: [{ serviceDate: '2026-10-19', shift: 'MORNING', quantityPlanLineId: 'line-1', dishId: 'dish-1', dishName: 'Cơm thịt theo thực đơn tuần', dishSlot: 'savory-main', finalServings: 100,
        material: { dishBomId: 'bom-1', ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Gạo tẻ', grossQuantityPerServing: 0.012, sourceUnitId: 'kg', sourceUnitName: 'kg', requiredQuantity: 1.2, canonicalUnitId: 'kg', canonicalUnitName: 'kg' } }],
    }] },
  };
  const plans: MrxPlanInspectionPage = {
    menuVersionId: 'version-1', contentFingerprint: 'fixture-fingerprint', fingerprintFormatVersion: 3, diagnostics: [],
    page: { totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false, items: [{ serviceDate: '2026-10-19', planCode: 'KH01', line: {
      quantityPlanLineId: 'line-1', menuScheduleId: 'schedule-1', customerId: 'customer-1', menuId: 'menu-1', shift: 'MORNING', finalServings: 100, menuCode: 'TD01', menuName: 'Thực đơn tuần đã chọn', dishes: [],
    } }] },
  };
  const unexpected: string[] = [];
  const calls: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);
    const data = url.pathname === '/api/system-operation-mode'
      ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : url.pathname === '/api/Auth/me' ? actor
      : url.pathname === '/api/coordination/customers' ? [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Khách hàng thử giao diện có tên tiếng Việt dài' }]
      : url.pathname === '/api/reconciliation/weekly-menu' ? { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Khách hàng thử giao diện', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'version-1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [], validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] } }
      : url.pathname === '/api/reconciliation/batches/quantity-import/materials' ? material
      : url.pathname === '/api/reconciliation/preparation' ? { serviceDate: url.searchParams.get('weekStartDate'), batches: [], aggregatedLines: [] }
      : url.pathname === '/api/reconciliation/batches/quantity-import/plans' ? plans : null;
    if (request.method() !== 'GET' || !data) {
      unexpected.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected request in isolated remediation fixture.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/weekly-menu?view=mrx-materials&customerId=customer-1&weekStartDate=2026-10-19');
    await expect(page.getByRole('heading', { name: 'Định lượng nguyên liệu', exact: true })).toBeVisible();
    const customer = await page.getByRole('combobox', { name: 'Chọn khách hàng MRX' }).boundingBox();
    const week = await page.getByRole('textbox', { name: 'Tuần MRX bắt đầu' }).boundingBox();
    expect(customer).not.toBeNull();
    expect(week).not.toBeNull();
    expect(Math.abs(customer!.y - week!.y)).toBeLessThanOrEqual(2);
    await page.getByRole('cell', { name: /Gạo tẻ dùng cho cơm/ }).click();
    await expect(page.getByRole('heading', { name: /Nguồn tính/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /0,012/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /19\/10\/2026.*Sáng/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.getByRole('columnheader').evaluateAll(headers => headers.filter(header => header.scrollWidth > header.clientWidth + 1).map(header => header.textContent))).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-materials-${viewport.width}.png`) });
    const plansLink = page.getByRole('link', { name: 'Kế hoạch theo ca', exact: true });
    await expect(plansLink).toHaveAttribute('href', /customerId=customer-1.*weekStartDate=2026-10-19/);
    await plansLink.click();
    await expect(page.getByRole('cell', { name: 'Thực đơn tuần đã chọn', exact: true })).toBeVisible();
    await expect(page.getByText('KH01', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xem món ngày 19/10/2026 · Sáng' })).toHaveText('Xem');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Kế hoạch theo ca', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kế hoạch theo ca', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Định lượng nguyên liệu', exact: true })).not.toHaveAttribute('aria-current', 'page');
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-plans-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Kho nguyên liệu', exact: true }).click();
    await page.getByRole('link', { name: 'Chuẩn bị và xuất Excel', exact: true }).click();
    const preparationDate = page.getByRole('textbox', { name: 'Tuần chuẩn bị' });
    await preparationDate.fill('05/11/2026');
    await preparationDate.press('Enter');
    await expect(preparationDate).toHaveValue('02/11/2026');
    const weeklyNavigation = page.getByRole('button', { name: 'Thực đơn tuần', exact: true });
    if (await weeklyNavigation.getAttribute('aria-expanded') === 'false') await weeklyNavigation.click();
    for (const name of ['Định lượng nguyên liệu', 'Kế hoạch theo ca']) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', /customerId=customer-1.*weekStartDate=2026-10-19/);
    }
    await page.getByRole('link', { name: 'Định lượng nguyên liệu', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('19/10/2026');
    await page.reload();
    await expect(page.getByRole('cell', { name: /Gạo tẻ dùng cho cơm/ })).toBeVisible();
  }
  expect(unexpected).toEqual([]);
  expect(calls.some(call => call.endsWith('/quantity-import/preview'))).toBe(false);
});

test('BROWSER_FIXTURE: preparation scope at desktop/tablet and verified native browser 200% zoom', async ({ page, browser }) => {
  const actor = { userId: 'fixture-warehouse', username: 'fixture', fullName: 'Thủ kho thử giao diện', roleCode: 'WAREHOUSE', roleName: 'Thủ kho', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.warehouse.read'] };
  await page.addInitScript(actor => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, actor);
  let preparation: MrxPreparation = {
    serviceDate: '2026-11-16',
    batches: [{ batchId: 'batch-1', customerId: 'customer-1', customerCode: 'KH01', customerName: 'Khách hàng thử bố cục có tên tiếng Việt dài', batchStatus: 'TRANSFERRED', batchVersion: 2, isApplicable: true, hasExistingIssue: false, requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5 }],
    aggregatedLines: [{ ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Gạo tẻ', canonicalUnitId: 'kg', canonicalUnitName: 'kg', totalRequiredQuantity: 5, totalIssuedQuantity: 0, totalRemainingQuantity: 5,
      allocations: [{ batchId: 'batch-1', batchLineId: 'batch-line-1', dailyLineId: 'daily-line-1', customerId: 'customer-1', customerCode: 'KH01', customerName: 'Khách hàng thử bố cục có tên tiếng Việt dài', requiredQuantity: 5, issuedQuantity: 0, remainingQuantity: 5, status: 'UNTOUCHED' }] }],
  };
  const unexpected: string[] = [];
  let holdDayRead = false;
  let releaseDayRead!: () => void;
  const heldDayRead = new Promise<void>(resolve => { releaseDayRead = resolve; });
  const fulfillPreparation = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const day = url.searchParams.get('serviceDate');
    if (holdDayRead && day === '2026-11-23') await heldDayRead;
    const dayData: MrxPreparation | null = path === '/api/reconciliation/preparation' && day && !url.searchParams.has('weekStartDate') ? {
      serviceDate: day,
      batches: [{ ...preparation.batches[0], requiredQuantity: 2, issuedQuantity: 0, remainingQuantity: 2 }],
      aggregatedLines: [{ ...preparation.aggregatedLines[0], totalRequiredQuantity: 2, totalIssuedQuantity: 0, totalRemainingQuantity: 2,
        allocations: [{ ...preparation.aggregatedLines[0].allocations[0], requiredQuantity: 2, issuedQuantity: 0, remainingQuantity: 2 }] }],
    } : null;
    const data = path === '/api/Auth/me' ? actor
      : path === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-11-16T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/reconciliation/preparation' ? dayData ?? (url.searchParams.get('weekStartDate') === '2026-11-16' && !day ? preparation : null) : null;
    if (request.method() !== 'GET' || !data) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected fixture request.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  };
  await page.route(url => url.pathname.startsWith('/api/'), fulfillPreparation);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/warehouse?view=mrx-preparation&date=2026-11-16');
    const selection = page.getByRole('button', { name: /Khách hàng:/ });
    const search = page.getByRole('searchbox', { name: 'Tìm nguyên liệu chuẩn bị' });
    await expect(search).toBeVisible();
    await expect(page.getByText('Tuần chuẩn bị', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader')).toHaveCount(2);
    const selectionBounds = await selection.boundingBox();
    const searchBounds = await search.boundingBox();
    expect(selectionBounds).not.toBeNull();
    expect(searchBounds).not.toBeNull();
    expect(selectionBounds!.height).toBeGreaterThanOrEqual(36);
    expect(selectionBounds!.height).toBeLessThanOrEqual(40);
    expect(selectionBounds!.y).toBeLessThanOrEqual(searchBounds!.y);
    await expect(page.getByRole('textbox', { name: /Nhà cung cấp/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cả tuần (Tổng hợp)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('combobox', { name: 'Phạm vi xuất' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Xác nhận xuất/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByRole('columnheader').evaluateAll(headers => headers.filter(header => header.scrollWidth > header.clientWidth + 1).map(header => header.textContent))).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-preparation-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'T4 (18/11)', exact: true }).click();
    const date = page.getByRole('textbox', { name: 'Tuần chuẩn bị' });
    await expect(page.getByRole('cell', { name: '2 kg', exact: true }).first()).toBeVisible();
    await expect(date).toHaveValue('16/11/2026');
    await expect(page.getByRole('button', { name: 'T4 (18/11)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-preparation-day-${viewport.width}.png`) });
    if (viewport.width === 1440) {
      const find = page.getByRole('searchbox', { name: 'Tìm nguyên liệu chuẩn bị' });
      await find.fill('gao');
      const before = await page.getByRole('columnheader', { name: 'Nguyên liệu', exact: true }).boundingBox();
      holdDayRead = true;
      const request = page.waitForRequest(request => new URL(request.url()).searchParams.get('serviceDate') === '2026-11-23');
      const evidence: Record<string, unknown> = { fixture: true, viewport, before };
      try {
        await date.fill('23/11/2026');
        await date.press('Enter');
        await request;
        evidence.pendingHeader = await page.locator('header').filter({ has: page.getByRole('heading', { name: 'Chuẩn bị nguyên liệu đa khách hàng' }) }).boundingBox();
        evidence.searchValue = await find.evaluateAll(elements => (elements[0] as HTMLInputElement | undefined)?.value ?? null);
        const pending = await page.getByRole('columnheader', { name: 'Nguyên liệu', exact: true }).evaluateAll(elements => elements[0]?.getBoundingClientRect().toJSON() ?? null);
        evidence.pending = pending;
        await expect(find).toHaveValue('gao', { timeout: 1500 });
        await expect(page.getByRole('button', { name: /Khách hàng:/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeDisabled();
        await expect(page.locator('[aria-busy="true"]').filter({ has: page.getByRole('table') })).toBeVisible();
        expect(pending!.y).toBe(before!.y);
        await page.screenshot({ path: test.info().outputPath('BROWSER_FIXTURE-filter-pending-1440.png') });
      } finally {
        releaseDayRead();
        writeFileSync(test.info().outputPath('FILTER-TRANSITION.json'), JSON.stringify(evidence, null, 2));
      }
      await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
      await expect(find).toHaveValue('gao');
      await date.fill('16/11/2026');
      await date.press('Enter');
      await page.getByRole('button', { name: 'T4 (18/11)', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    }
    await page.reload();
    await expect(page.getByRole('button', { name: 'T4 (18/11)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: 'Tuần chuẩn bị' })).toHaveValue('16/11/2026');
    await page.getByRole('button', { name: 'Cả tuần (Tổng hợp)', exact: true }).click();
    await expect(page.getByRole('cell', { name: '5 kg', exact: true }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /Khách hàng:/ }).click();
  await expect(page.getByRole('searchbox', { name: 'Tìm khách hàng hoặc mã' })).toBeFocused();
  await page.getByRole('checkbox', { name: /Khách hàng thử bố cục/ }).uncheck();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Khách hàng: Chọn khách hàng/ })).toBeFocused();
  await expect(page.getByRole('searchbox', { name: 'Tìm nguyên liệu chuẩn bị' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeDisabled();
  await expect(page.getByText('Chọn ít nhất một lô để xem nguyên liệu cần chuẩn bị.')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('BROWSER_FIXTURE-preparation-zero.png') });
  const firstBatch = preparation.batches[0];
  const firstAllocation = preparation.aggregatedLines[0].allocations[0];
  preparation = { ...preparation,
    batches: [firstBatch, { ...firstBatch, batchId: 'batch-2', requiredQuantity: 3, remainingQuantity: 3 },
      { ...firstBatch, batchId: 'batch-3', customerId: 'customer-2', customerCode: 'KH02', customerName: 'Khách chưa chuyển kho', batchStatus: 'READY', isApplicable: false, requiredQuantity: 0, remainingQuantity: 0 },
      { ...firstBatch, batchId: 'batch-4', customerId: 'customer-3', customerCode: 'KH03', customerName: 'Khách đã xuất', batchStatus: 'IN_PROGRESS', hasExistingIssue: true, issuedQuantity: 5, remainingQuantity: 0 }],
    aggregatedLines: [{ ...preparation.aggregatedLines[0], totalRequiredQuantity: 13, totalIssuedQuantity: 5, totalRemainingQuantity: 8,
      allocations: [firstAllocation,
        { ...firstAllocation, batchId: 'batch-2', batchLineId: 'batch-line-2', dailyLineId: 'daily-line-2', requiredQuantity: 3, remainingQuantity: 3 },
        { ...firstAllocation, batchId: 'batch-4', batchLineId: 'batch-line-4', dailyLineId: 'daily-line-4', customerId: 'customer-3', customerName: 'Khách đã xuất', issuedQuantity: 5, remainingQuantity: 0, status: 'EXACT' }] }],
  };
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const trigger = page.getByRole('button', { name: 'Khách hàng: 4 lô đã chọn', exact: true });
    await trigger.click();
    await expect(page.getByRole('columnheader')).toHaveCount(6);
    await expect(page.getByRole('columnheader', { name: /Lô 1/ })).toHaveCount(1);
    await expect(page.getByRole('columnheader', { name: /Lô 2/ })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const first = page.getByRole('checkbox', { name: /Lô 1/ });
    const second = page.getByRole('checkbox', { name: /Lô 2/ });
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Khách chưa chuyển kho/ })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: /Khách đã xuất/ })).toBeEnabled();
    const filter = page.getByRole('searchbox', { name: 'Tìm khách hàng hoặc mã' });
    await filter.fill('không tồn tại');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    await filter.fill('KH01');
    await first.uncheck();
    await expect(second).toBeChecked();
    await expect(page.getByRole('button', { name: 'Xuất Excel chuẩn bị' })).toBeEnabled();
    await expect(page.getByRole('cell', { name: '8 kg', exact: true }).first()).toBeVisible();
    await first.check();
    await filter.clear();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-preparation-many-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    expect(await page.getByRole('columnheader').evaluateAll(headers => headers.every(header => header.getBoundingClientRect().height <= 40))).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-preparation-many-table-${viewport.width}.png`) });
    const firstHeader = page.getByRole('columnheader', { name: 'Nguyên liệu', exact: true });
    const firstX = (await firstHeader.boundingBox())!.x;
    await page.getByRole('table').evaluate(table => { table.parentElement!.scrollLeft = table.parentElement!.scrollWidth; });
    expect((await firstHeader.boundingBox())!.x).toBe(firstX);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-preparation-many-scrolled-${viewport.width}.png`) });
    await page.getByRole('table').evaluate(table => { table.parentElement!.scrollLeft = 0; });
    await trigger.click();
    await page.getByRole('heading', { name: 'Chuẩn bị nguyên liệu đa khách hàng', exact: true }).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }
  // Real Chrome zoom: normal native window, OS-owned Ctrl+NumAdd; never deviceScaleFactor/pageScaleFactor.
  await page.close();
  const zoomContext = await browser.newContext({ viewport: null });
  const zoomPage = await zoomContext.newPage();
  const chrome = await browser.newBrowserCDPSession();
  let ownedPid: number | undefined;
  const zoomEvidence: Record<string, unknown> = { scope: 'BROWSER_FIXTURE preparation only', method: 'Set-MrxChromeZoom.ps1 / native Ctrl+NumAdd', target: '200%' };
  try {
    await zoomPage.addInitScript(actor => {
      localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
      localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    }, actor);
    await zoomPage.route(url => url.pathname.startsWith('/api/'), fulfillPreparation);
    await zoomPage.goto('/warehouse?view=mrx-preparation&date=2026-11-16');
    await expect(zoomPage.getByRole('button', { name: 'Khách hàng: 4 lô đã chọn', exact: true })).toBeVisible();
    const pageChrome = await zoomContext.newCDPSession(zoomPage);
    const { windowId } = await pageChrome.send('Browser.getWindowForTarget');
    await chrome.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await chrome.send('Browser.setWindowBounds', { windowId, bounds: { width: 1440, height: 1000 } });
    await zoomPage.bringToFront();
    const { processInfo } = await chrome.send('SystemInfo.getProcessInfo');
    ownedPid = processInfo.find(process => process.type === 'browser')?.id;
    if (!ownedPid) throw new Error('Could not identify the dedicated Chrome process; no OS keys sent.');
    const before = await zoomPage.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, height: innerHeight, outerWidth }));
    zoomEvidence.browserPid = ownedPid;
    zoomEvidence.before = before;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/mrx-evidence/Set-MrxChromeZoom.ps1', '-BrowserPid', String(ownedPid), '-Steps', '5'], { timeout: 15_000 });
    await expect.poll(() => zoomPage.evaluate(() => devicePixelRatio)).toBeCloseTo(before.dpr * 2, 1);
    const after = await zoomPage.evaluate(() => ({ dpr: devicePixelRatio, width: innerWidth, height: innerHeight, outerWidth }));
    zoomEvidence.after = after;
    expect(before.width / after.width).toBeCloseTo(2, 1);
    const trigger = zoomPage.getByRole('button', { name: 'Khách hàng: 4 lô đã chọn', exact: true });
    await trigger.click();
    const search = zoomPage.getByRole('searchbox', { name: 'Tìm khách hàng hoặc mã' });
    await expect(search).toBeFocused();
    await search.press('Tab');
    await expect(zoomPage.getByRole('checkbox', { name: /Lô 1/ })).toBeFocused();
    await zoomPage.keyboard.press('Space');
    await expect(zoomPage.getByRole('checkbox', { name: /Lô 2/ })).toBeChecked();
    expect(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await zoomPage.screenshot({ path: test.info().outputPath('BROWSER_FIXTURE-preparation-NATIVE-200.png') });
    await zoomPage.keyboard.press('Escape');
    await expect(zoomPage.getByRole('button', { name: /Khách hàng:/ })).toBeFocused();
    expect(unexpected).toEqual([]);
    zoomEvidence.status = 'PASS';
  } catch (cause) {
    zoomEvidence.status = 'FAIL_OR_NEEDS_EVIDENCE';
    zoomEvidence.error = String(cause);
    throw cause;
  } finally {
    try {
      if (ownedPid) execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/mrx-evidence/Set-MrxChromeZoom.ps1', '-BrowserPid', String(ownedPid), '-Steps', '0'], { timeout: 15_000 });
    } finally {
      writeFileSync(test.info().outputPath('NATIVE-browser-zoom.json'), JSON.stringify(zoomEvidence, null, 2));
      await chrome.detach();
      await zoomContext.close();
    }
  }
});

test('BROWSER_FIXTURE: frozen daily hierarchy retains each date/rate and returns keyboard focus', async ({ page }) => {
  const actor = { userId: 'fixture-manager', username: 'fixture', fullName: 'Quản lý thử giao diện', roleCode: 'MANAGER', roleName: 'Quản lý', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.read'] };
  await page.addInitScript(actor => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, actor);
  const line = { batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'RAU', ingredientName: 'Rau cải dùng trong canh theo định mức từng ngày', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
    requiredQuantity: 0.4986, issuedQuantity: 0.4986, issuedRequiredDifference: 0, frozenTolerance: 0, purchasedQuantity: null, purchasedVersion: null, issuedVersion: 1,
    purchasedRequiredDifference: null, purchasedIssuedDifference: null, status: 'MATCHED', version: 1, triggers: [], issueNotes: [] };
  const batch: MrxBatch = { batchId: 'batch-frozen', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Khách hàng thử giao diện đóng băng', menuVersionId: 'version-1', quantityImportBatchId: 'quantity-import-1',
    weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 3, createdAt: '2026-10-18T00:00:00Z', readyAt: '2026-10-18T01:00:00Z', completedAt: null,
    lines: [line], dailyReview: { weeklyStatus: 'WEEK_COMPLETE', lines: [
      { ...line, dailyLineId: 'daily-1', serviceDate: '2026-10-19', requiredQuantity: 0.2586, issuedQuantity: 0.2586 },
      { ...line, dailyLineId: 'daily-2', serviceDate: '2026-10-20', requiredQuantity: 0.24, issuedQuantity: 0.24 },
    ] } };
  const dishes: MrxBatchDishSummary[] = [{ dishId: 'dish-1', dishCode: 'MON01', dishName: 'Canh rau có định mức nguồn khác nhau theo ngày phục vụ',
    scopes: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', frozenServings: 100, currentServings: 100, additionalServings: 0 },
      { serviceDate: '2026-10-20', shiftName: 'AFTERNOON', frozenServings: 80, currentServings: 80, additionalServings: 0 }],
    materials: [{ batchLineId: 'line-1', dailyLineId: 'daily-1', serviceDate: '2026-10-19', ingredientId: 'ingredient-1', ingredientCode: line.ingredientCode, ingredientName: line.ingredientName, canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', grossQtyPerServing: 0.002586 },
      { batchLineId: 'line-1', dailyLineId: 'daily-2', serviceDate: '2026-10-20', ingredientId: 'ingredient-1', ingredientCode: line.ingredientCode, ingredientName: line.ingredientName, canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', grossQtyPerServing: 0.003 }] }];
  const unexpected: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const data = path === '/api/Auth/me' ? actor
      : path === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/coordination/customers' ? [{ customerId: 'customer-1', customerCode: 'DAV', customerName: batch.customerName }]
      : path === '/api/reconciliation/batches' ? { items: [{ batchId: batch.batchId, customerId: batch.customerId, customerCode: batch.customerCode, customerName: batch.customerName, weekStartDate: batch.weekStartDate, weekEndDate: batch.weekEndDate, status: batch.status, version: batch.version, createdAt: batch.createdAt }], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false }
      : path === '/api/reconciliation/batches/batch-frozen' ? batch
      : path === '/api/reconciliation/batches/batch-frozen/dishes' ? dishes : null;
    if (request.method() !== 'GET' || !data) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected frozen fixture request.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/reconciliation?batchId=batch-frozen&date=2026-10-19');
    const trigger = page.getByRole('button', { name: 'Món & BOM đã đóng băng', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Món & BOM đã đóng băng', exact: true });
    await expect(dialog.getByRole('heading', { name: 'Định mức theo ngày', exact: true })).toBeVisible();
    await expect(dialog.getByRole('table', { name: 'Định mức ngày 19/10/2026', exact: true }).getByText('0,002586', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('table', { name: 'Định mức ngày 20/10/2026', exact: true }).getByText('0,003', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-frozen-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  expect(unexpected).toEqual([]);
});

test('BROWSER_FIXTURE: warehouse day scope and compact honest empty variance register', async ({ page }) => {
  const actor = { userId: 'fixture-admin', username: 'fixture', fullName: 'Quản trị thử giao diện', roleCode: 'ADMIN', roleName: 'Quản trị', isActive: true, isAdminFullAccess: true, permissions: [] };
  await page.addInitScript(actor => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    sessionStorage.setItem('ipc_mrx_workspace_session_scope', JSON.stringify({ customerId: 'customer-1', customerCode: 'DAV', batchId: 'other-batch', serviceDate: '2026-11-07', weekStartDate: '2026-11-02' }));
  }, actor);
  const line = { batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo tẻ', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg',
    requiredQuantity: 4, issuedQuantity: 2, issuedRequiredDifference: -2, frozenTolerance: 0, purchasedQuantity: null, purchasedVersion: null, issuedVersion: 1,
    purchasedRequiredDifference: null, purchasedIssuedDifference: null, status: 'UNDER_ISSUED', version: 1, triggers: [], issueNotes: [] };
  const batch: MrxBatch = { batchId: 'batch-scope', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Khách thử phạm vi ngày', menuVersionId: 'version-1', quantityImportBatchId: 'import-1',
    weekStartDate: '2026-11-16', weekEndDate: '2026-11-22', status: 'IN_PROGRESS', version: 3, createdAt: '2026-11-15T00:00:00Z', lines: [line],
    dailyReview: { weeklyStatus: 'IN_PROGRESS', lines: [
      { ...line, dailyLineId: 'daily-1', serviceDate: '2026-11-16', requiredQuantity: 2, issuedRequiredDifference: 0, status: 'MATCHED' },
      { ...line, dailyLineId: 'daily-2', serviceDate: '2026-11-17', requiredQuantity: 2, issuedQuantity: null, issuedRequiredDifference: null, status: 'UNTOUCHED' },
    ] } };
  const daily: MrxWarehouseDaily = { batchId: batch.batchId, batchStatus: batch.status, sourceVersion: batch.version, weeklyStatus: 'IN_PROGRESS', compatibility: { canRead: true, canIssueByDate: true },
    dates: [{ serviceDate: '2026-11-16', status: 'COMPLETE', isApplicable: true, requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0,
      lines: [{ dailyLineId: 'daily-1', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo tẻ', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 0, quantityStatus: 'EXACT', hasValidDisposition: false }] },
      { serviceDate: '2026-11-17', status: 'UNTOUCHED', isApplicable: true, requiredQuantity: 2, issuedQuantity: 0, returnedQuantity: 0, remainingQuantity: 2,
        lines: [{ dailyLineId: 'daily-2', batchLineId: 'line-1', ingredientId: 'ingredient-1', ingredientCode: 'GAO', ingredientName: 'Gạo tẻ', canonicalUnitId: 'unit-1', canonicalUnitName: 'kg', requiredQuantity: 2, issuedQuantity: null, returnedQuantity: 0, remainingQuantity: 2, quantityStatus: 'UNTOUCHED', hasValidDisposition: false }] },
    ] };
  const unexpected: string[] = [];
  const varianceQueries: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/variance-register')) varianceQueries.push(url.search);
    const data = path === '/api/Auth/me' ? actor
      : path === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-11-16T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/coordination/customers' ? [{ customerId: 'customer-1', customerCode: 'DAV', customerName: batch.customerName }]
      : path === '/api/reconciliation/batches' ? { items: [batch], totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false }
      : path === '/api/reconciliation/batches/batch-scope' ? batch
      : path === '/api/reconciliation/batches/batch-scope/warehouse-daily' ? daily
      : path === '/api/inventory-issues' ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false }
      : path === '/api/reconciliation/reports/variance-register' ? { rows: [], totalCount: 0 } : null;
    if (request.method() !== 'GET' || !data) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected scope/empty fixture request.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/warehouse?view=mrx-daily&batchId=batch-scope');
    await expect(page.getByRole('cell', { name: /Gạo tẻ/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ngày xuất kho', exact: true })).toHaveValue('16/11/2026');
    await page.goto('/warehouse?view=mrx-daily&batchId=batch-scope&date=2026-11-07');
    const emptyDay = page.getByRole('heading', { name: 'Không có định lượng cần xuất cho ngày đã chọn' });
    await expect(emptyDay).toBeVisible();
    const strip = page.getByRole('button', { name: 'Cả tuần (Tổng hợp)', exact: true });
    const gap = (await emptyDay.boundingBox())!.y - (await strip.boundingBox())!.y;
    expect(gap).toBeLessThan(160);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-empty-day-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Xem cả tuần của lô', exact: true }).click();
    await expect(strip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('cell', { name: /Gạo tẻ/ })).toBeVisible();
    await page.goto('/reconciliation?view=variances&batchId=batch-scope&date=2026-11-07');
    const emptyReport = page.getByRole('heading', { name: 'Chưa ghi nhận chênh lệch xuất kho' });
    await expect(emptyReport).toBeVisible();
    await expect(page.getByText('Xem tiến độ xuất kho tại Rà soát dòng ngày.', { exact: true })).toBeVisible();
    const bounds = await emptyReport.evaluate(element => {
      const state = element.parentElement!.getBoundingClientRect();
      const content = Array.from(element.parentElement!.children).map(child => child.getBoundingClientRect());
      return { center: state.y + state.height / 2, contentCenter: (Math.min(...content.map(box => box.y)) + Math.max(...content.map(box => box.bottom))) / 2 };
    });
    expect(Math.abs(bounds.center - bounds.contentCenter)).toBeLessThan(12);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-empty-variances-${viewport.width}.png`) });
    await page.goto('/reconciliation?batchId=batch-scope&date=2026-11-16');
    await page.getByRole('button', { name: 'Mở trạm Kho xuất ngày →', exact: true }).click();
    await expect(page).toHaveURL(/view=mrx-daily&batchId=batch-scope&date=2026-11-16/);
    await expect(page.getByRole('textbox', { name: 'Ngày xuất kho', exact: true })).toHaveValue('16/11/2026');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(varianceQueries.length).toBeGreaterThan(0);
  expect(varianceQueries.every(query => new URLSearchParams(query).get('batchId') === batch.batchId && !new URLSearchParams(query).has('weekStartDate'))).toBe(true);
  expect(unexpected).toEqual([]);
});

test('BROWSER_FIXTURE: customer-only form, dish-name inspection and six-day preparation', async ({ page }) => {
  const actor = { userId: 'fixture-seven', username: 'fixture', fullName: 'Quản trị thử giao diện', roleCode: 'ADMIN', roleName: 'Quản trị', isActive: true, isAdminFullAccess: true, permissions: [] };
  await page.addInitScript(actor => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(actor));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, actor);
  const unexpected: string[] = [];
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const { pathname: path, searchParams } = new URL(route.request().url());
    const tier = searchParams.get('priceTier');
    const data = path === '/api/Auth/me' ? actor
      : path === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-11-16T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : path === '/api/coordination/customer-contracts' ? [{ customerId: 'customer-1', customerCode: 'KH01', customerName: 'Khách hàng thử giao diện', isActive: true, shiftNames: ['MORNING', 'AFTERNOON'], activeWeekDays: ['t2'], defaultMenuPrice: 34000, defaultBomRatePercent: 100 }]
      : path === '/api/Dishes/bom-coverage' ? { priceTier: tier ? Number(tier) : null, generatedAt: '2026-11-16T00:00:00Z', totalDishes: 1, completeDishes: tier === '34000' ? 0 : 1, missingBomDishes: tier === '34000' ? 1 : 0, totalBomLines: tier === '34000' ? 0 : tier ? 1 : 2, dishes: [{ dishId: 'dish-1', dishCode: 'MON01', dishName: 'Cơm sườn nướng', bomLineCount: tier === '34000' ? 0 : tier ? 1 : 2, hasBom: tier !== '34000', status: tier === '34000' ? 'missing' : 'complete', statusLabel: tier === '34000' ? 'Thiếu định lượng' : 'Đủ BOM' }] }
      : path === '/api/ingredients' ? { items: [{ ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Sườn heo', unitId: 'kg', unitName: 'kg', isActive: true, referencePrice: 100000 }], totalCount: 1, pageNumber: 1, pageSize: 200, totalPages: 1, hasPrev: false, hasNext: false }
      : path === '/api/coordination/customers' ? []
      : path === '/api/Dishes/bom-price-tiers' ? [25000, 30000, 34000]
      : path === '/api/Dishes/bom-import/preview' ? {
        generatedAt: '2026-11-14T00:00:00Z', priceTier: 25000, bomScope: 'global',
        totalRows: 60, validRows: 60, errorRows: 0, warningRows: 0, canCommit: true, warnings: [],
        rows: Array.from({ length: 60 }, (_, index) => ({ rowNumber: index + 2, dishCode: `MON${String(index + 1).padStart(2, '0')}`, dishName: 'Cơm sườn nướng', ingredientCode: index === 0 ? 'ING-NGUYENLIEUEXCELMWG27MNB' : 'NL01',
          ingredientName: index === 0 ? 'Nguyên liệu Excel cần đọc rõ khi xem trước' : 'Sườn heo', unitCode: 'KG', grossQtyPerServing: 0.123456, wasteRatePercent: 0,
          effectiveFrom: '2026-11-16', status: 'valid', action: 'create', errors: [], warnings: [] })),
      }
      : path === '/api/Dishes/dish-1/bom' ? [{ bomId: 'bom-1', dishId: 'dish-1', dishCode: 'MON01', dishName: 'Cơm sườn nướng', ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Sườn heo', unitId: 'kg', unitCode: 'kg', unitName: 'kg', priceTierAmount: 25000, bomScope: 'global', grossQtyPerServing: 0.123456, wasteRatePercent: 0, bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành', effectiveFrom: '2026-01-01', referencePrice: 100000 },
        { bomId: 'bom-30', dishId: 'dish-1', dishCode: 'MON01', dishName: 'Cơm sườn nướng', ingredientId: 'ingredient-1', ingredientCode: 'NL01', ingredientName: 'Sườn heo', unitId: 'kg', unitCode: 'kg', unitName: 'kg', priceTierAmount: 30000, bomScope: 'global', grossQtyPerServing: 0.25, wasteRatePercent: 0, bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành', effectiveFrom: '2026-01-01', referencePrice: 100000 } ]
      : path === '/api/reconciliation/preparation' ? { serviceDate: '2026-11-16', batches: [], aggregatedLines: [] } : null;
    if ((route.request().method() !== 'GET' && !(path === '/api/Dishes/bom-import/preview' && route.request().method() === 'POST')) || data === null) {
      unexpected.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected seven-item fixture request.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin-data?view=customers');
    await expect(page.getByText('Khách hàng thử giao diện', { exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Mốc giá hợp đồng' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeDisabled();
    await expect(page.getByRole('columnheader', { name: 'Thao tác', exact: true })).toHaveCount(0);
    const customerRow = page.getByRole('row', { name: /Khách hàng thử giao diện/ });
    await customerRow.focus();
    await page.keyboard.press('Enter');
    await expect(customerRow).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Chỉnh sửa khách hàng', exact: true });
    await expect(edit.getByRole('textbox', { name: 'Ghi chú khách hàng' })).toBeVisible();
    await expect(edit.getByRole('checkbox', { name: 'Đang hoạt động' })).toBeChecked();
    await expect(edit.getByRole('textbox', { name: 'Tên khách hàng' })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-customer-edit-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Hủy bỏ', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm khách hàng mới', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Thêm khách hàng mới', exact: true });
    await expect(form.getByRole('textbox')).toHaveCount(3);
    await expect(form.getByRole('combobox')).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-customer-form-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(form).toHaveCount(0);
    await page.goto('/admin-data?view=bom');
    const dish = page.getByRole('button', { name: 'Cơm sườn nướng', exact: true });
    await dish.focus();
    await page.keyboard.press('Enter');
    const detail = page.getByRole('dialog', { name: 'Định mức BOM: Cơm sườn nướng', exact: true });
    await expect(detail.getByText('Sườn heo', { exact: true })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Thêm vào BOM' })).toHaveCount(0);
    await expect(detail.getByRole('button', { name: /Xóa .* khỏi BOM/ })).toHaveCount(0);
    await expect(detail.getByText('0,123456', { exact: true })).toBeVisible();
    await detail.getByRole('radio', { name: '30.000 ₫', exact: true }).click();
    await expect(detail.getByRole('cell', { name: '0,250000', exact: true })).toBeVisible();
    await expect(detail.getByRole('cell', { name: '0,123456', exact: true })).toHaveCount(0);
    await detail.getByRole('radio', { name: '34.000 ₫', exact: true }).click();
    await expect(detail.getByText('Món ăn chưa có BOM ở mốc giá 34.000 ₫', { exact: true })).toBeVisible();
    await detail.getByRole('radio', { name: '25.000 ₫', exact: true }).click();
    await expect(detail.getByRole('cell', { name: '0,123456', exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-dish-detail-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dish).toBeFocused();
    await page.getByRole('combobox', { name: 'Lọc mốc giá BOM' }).selectOption('30000');
    await expect(page.getByRole('row', { name: /Cơm sườn nướng/ })).toContainText('1 nguyên liệu');
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-bom-overview-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Nhập BOM Excel' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Nhập định mức BOM hàng loạt từ file Excel' });
    await importDialog.getByLabel('Chọn file Excel định mức BOM').setInputFiles({
      name: 'fixture-bom.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('browser fixture'),
    });
    await importDialog.getByRole('button', { name: 'Xem trước' }).click();
    const previewViewport = importDialog.getByTestId('bom-preview-viewport');
    const longCodeCell = previewViewport.locator('tbody tr').first().locator('td').nth(3);
    expect(await longCodeCell.evaluate(cell => cell.querySelector('button')!.getBoundingClientRect().right - cell.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    await expect(longCodeCell.getByRole('button', { name: 'Sao chép ING-NGUYENLIEUEXCELMWG27MNB' })).toHaveAttribute('title', 'ING-NGUYENLIEUEXCELMWG27MNB');
    const dishCodeCell = importDialog.getByRole('cell', { name: 'MON01' });
    await expect(dishCodeCell).toBeVisible();
    const beforeScroll = await dishCodeCell.boundingBox();
    await previewViewport.evaluate(element => { element.scrollLeft = 300; });
    expect(await previewViewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    const afterScroll = await dishCodeCell.boundingBox();
    expect(Math.abs(afterScroll!.x - beforeScroll!.x)).toBeLessThanOrEqual(1);
    const codeHeader = importDialog.getByRole('columnheader', { name: 'Mã món' });
    const headerBeforeScroll = await codeHeader.boundingBox();
    await previewViewport.evaluate(element => { element.scrollTop = 240; });
    expect(await previewViewport.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const headerAfterScroll = await codeHeader.boundingBox();
    expect(Math.abs(headerAfterScroll!.y - headerBeforeScroll!.y)).toBeLessThanOrEqual(1);
    expect(await codeHeader.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('th') === element;
    })).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-bom-preview-scrolled-${viewport.width}.png`) });
    if (viewport.width === 1440) {
      // 720 CSS px approximates a 1440 px desktop at 200% browser zoom.
      await page.setViewportSize({ width: 720, height: 450 });
      const dialogBounds = await importDialog.boundingBox();
      expect(dialogBounds).not.toBeNull();
      expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
      expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(720);
      await expect(importDialog.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt', exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('BROWSER_FIXTURE-bom-preview-effective-200-percent.png') });
      await importDialog.getByText(/Kết quả phân tích định mức BOM/).scrollIntoViewIfNeeded();
      await expect(previewViewport).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('BROWSER_FIXTURE-bom-preview-effective-200-percent-scrolled.png') });
      await page.setViewportSize(viewport);
    }
    await importDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Chỉnh sửa BOM', exact: true }).click();
    const bomEdit = page.getByRole('dialog', { name: 'Định mức BOM: Cơm sườn nướng', exact: true });
    await expect(bomEdit.getByRole('radio', { name: '30.000 ₫', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(bomEdit.getByRole('option', { name: 'Dùng chung toàn hệ thống', exact: true })).toHaveCount(1);
    await bomEdit.getByRole('button', { name: 'Chỉnh sửa Sườn heo', exact: true }).click();
    await bomEdit.getByRole('spinbutton', { name: 'Định mức / suất', exact: true }).fill('0.234567');
    await bomEdit.getByRole('textbox', { name: 'Ngày hiệu lực BOM', exact: true }).fill('01/02/2026');
    await bomEdit.getByRole('textbox', { name: 'Ngày hiệu lực BOM', exact: true }).press('Tab');
    await bomEdit.getByRole('textbox', { name: 'Lý do chỉnh sửa BOM', exact: true }).fill('Kiểm tra giao diện, không gửi ghi dữ liệu');
    await expect(bomEdit.getByRole('button', { name: 'Lưu thay đổi BOM', exact: true })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-bom-edit-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click();
    await expect(bomEdit.getByRole('spinbutton', { name: 'Định mức / suất', exact: true })).toHaveValue('0.234567');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click();
    await expect(bomEdit).toHaveCount(0);
    await page.goto('/warehouse?view=mrx-preparation&date=2026-11-16');
    await expect(page.getByRole('button', { name: /^T7/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^CN/ })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-six-day-${viewport.width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(unexpected).toEqual([]);
});

test('BROWSER_FIXTURE: follow-through same-mounted A/B Back/Forward and nonzero tiny-rate display at 1440/1024 with keyboard interaction', async ({ page }) => {
  const actor = {
    userId: 'fixture-followthrough',
    username: 'fixture',
    fullName: 'Quản trị đối soát MRX',
    roleCode: 'ADMIN',
    roleName: 'Quản trị',
    isActive: true,
    isAdminFullAccess: true,
    permissions: ['*'],
  };
  await page.addInitScript((user) => {
    localStorage.setItem('ipc_v3_token', 'isolated-browser-fixture');
    localStorage.setItem('ipc_v3_user', JSON.stringify(user));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  }, actor);

  const batchA: MrxBatch = {
    batchId: 'batch-a',
    customerId: 'customer-a',
    customerCode: 'KA',
    customerName: 'Khách hàng A',
    menuVersionId: 'ver-a',
    quantityImportBatchId: 'imp-a',
    weekStartDate: '2026-10-19',
    weekEndDate: '2026-10-25',
    status: 'TRANSFERRED',
    version: 1,
    createdAt: '2026-10-19T00:00:00Z',
    lines: [{
      batchLineId: 'bl-a-1',
      ingredientId: 'ing-a',
      ingredientCode: 'GAO-A',
      ingredientName: 'Gạo lô A',
      canonicalUnitId: 'u-kg',
      canonicalUnitName: 'kg',
      requiredQuantity: 0.0004,
      issuedQuantity: 0,
      issuedRequiredDifference: -0.0004,
      frozenTolerance: 0,
      purchasedQuantity: null,
      purchasedVersion: null,
      issuedVersion: null,
      purchasedRequiredDifference: null,
      purchasedIssuedDifference: null,
      status: 'UNTOUCHED',
      version: 1,
      triggers: [],
      issueNotes: [],
    }],
    dailyReview: {
      weeklyStatus: 'IN_PROGRESS',
      lines: [{
        dailyLineId: 'dl-a-1',
        batchLineId: 'bl-a-1',
        serviceDate: '2026-10-19',
        ingredientId: 'ing-a',
        ingredientCode: 'GAO-A',
        ingredientName: 'Gạo lô A',
        canonicalUnitId: 'u-kg',
        canonicalUnitName: 'kg',
        requiredQuantity: 0.0004,
        issuedQuantity: 0,
        issuedRequiredDifference: -0.0004,
        frozenTolerance: 0,
        purchasedQuantity: null,
        purchasedVersion: null,
        issuedVersion: null,
        purchasedRequiredDifference: null,
        purchasedIssuedDifference: null,
        status: 'UNTOUCHED',
        version: 1,
        triggers: [],
        issueNotes: [],
      }],
    },
  };

  const batchB: MrxBatch = {
    ...batchA,
    batchId: 'batch-b',
    customerId: 'customer-b',
    customerCode: 'KB',
    customerName: 'Khách hàng B',
    weekStartDate: '2026-10-26',
    weekEndDate: '2026-11-01',
    version: 2,
  };

  const dailyA: MrxWarehouseDaily = {
    batchId: 'batch-a',
    batchStatus: 'TRANSFERRED',
    sourceVersion: 1,
    weeklyStatus: 'IN_PROGRESS',
    compatibility: { canRead: true, canIssueByDate: true },
    dates: [{
      serviceDate: '2026-10-19',
      status: 'UNTOUCHED',
      isApplicable: true,
      requiredQuantity: 10,
      issuedQuantity: 0,
      returnedQuantity: 0,
      remainingQuantity: 10,
      lines: [{
        dailyLineId: 'dl-a-1',
        batchLineId: 'bl-a-1',
        ingredientId: 'ing-a',
        ingredientCode: 'GAO-A',
        ingredientName: 'Gạo lô A',
        canonicalUnitId: 'u-kg',
        canonicalUnitName: 'kg',
        requiredQuantity: 10,
        issuedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 10,
        quantityStatus: 'UNTOUCHED',
        hasValidDisposition: false,
      }],
    }],
  };

  const dailyB: MrxWarehouseDaily = {
    batchId: 'batch-b',
    batchStatus: 'TRANSFERRED',
    sourceVersion: 2,
    weeklyStatus: 'IN_PROGRESS',
    compatibility: { canRead: true, canIssueByDate: true },
    dates: [{
      serviceDate: '2026-10-26',
      status: 'UNTOUCHED',
      isApplicable: true,
      requiredQuantity: 25,
      issuedQuantity: 0,
      returnedQuantity: 0,
      remainingQuantity: 25,
      lines: [{
        dailyLineId: 'dl-b-1',
        batchLineId: 'bl-b-1',
        ingredientId: 'ing-b',
        ingredientCode: 'THIT-B',
        ingredientName: 'Thịt lô B',
        canonicalUnitId: 'u-kg',
        canonicalUnitName: 'kg',
        requiredQuantity: 25,
        issuedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 25,
        quantityStatus: 'UNTOUCHED',
        hasValidDisposition: false,
      }],
    }],
  };

  const dishesA: MrxBatchDishSummary[] = [{
    dishId: 'dish-tiny-1',
    dishCode: 'MON-TINY',
    dishName: 'Canh gia vị vi lượng',
    scopes: [{
      serviceDate: '2026-10-19',
      shiftName: 'MORNING',
      frozenServings: 1000,
      currentServings: 1000,
      additionalServings: 0,
    }],
    materials: [{
      batchLineId: 'bl-a-1',
      dailyLineId: 'dl-a-1',
      serviceDate: '2026-10-19',
      ingredientId: 'ing-a',
      ingredientCode: 'GAO-A',
      ingredientName: 'Muối i-ốt vi lượng',
      canonicalUnitId: 'u-kg',
      canonicalUnitName: 'kg',
      grossQtyPerServing: 0.0004,
      canonicalQtyPerServing: 0.0000004,
    }],
  }];

  const cookingA = {
    batchId: 'batch-a',
    sourceVersion: 1,
    rows: [{
      serviceDate: '2026-10-19',
      weekday: 'Thứ Hai',
      shiftName: 'Ca sáng',
      menuVariant: 'Mặn',
      dishCode: 'MON-TINY',
      dishName: 'Canh gia vị vi lượng',
      servings: 1000,
      ingredientCode: 'GAO-A',
      ingredientName: 'Muối i-ốt vi lượng',
      unitName: 'kg',
      bomQuantityPerServing: 0.0000004,
      wasteRatePercent: 5,
      totalRequiredQuantity: 0.0004,
    }],
  };

  const unexpected: string[] = [];
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const data = pathname === '/api/Auth/me' ? actor
      : pathname === '/api/system-operation-mode' ? { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 9, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } }
      : pathname === '/api/coordination/customers' ? [
        { customerId: 'customer-a', customerCode: 'KA', customerName: 'Khách hàng A' },
        { customerId: 'customer-b', customerCode: 'KB', customerName: 'Khách hàng B' },
      ]
      : pathname === '/api/reconciliation/batches' ? {
        items: [batchA, batchB],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 50,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      }
      : pathname === '/api/reconciliation/batches/batch-a' ? batchA
      : pathname === '/api/reconciliation/batches/batch-b' ? batchB
      : pathname === '/api/reconciliation/batches/batch-a/warehouse-daily' ? dailyA
      : pathname === '/api/reconciliation/batches/batch-b/warehouse-daily' ? dailyB
      : pathname === '/api/reconciliation/batches/batch-a/dishes' ? dishesA
      : pathname === '/api/reconciliation/batches/batch-a/kitchen-cooking' ? cookingA
      : pathname === '/api/inventory-issues' ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false }
      : null;

    if (request.method() !== 'GET' || !data) {
      unexpected.push(`${request.method()} ${pathname}`);
      return route.fulfill({ status: 503, json: { success: false, message: 'Unexpected follow-through fixture request.' } });
    }
    return route.fulfill({ json: { success: true, data } });
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);

    // 1. Same-mounted A -> B -> Back -> Forward with keyboard & dirty navigation guard
    await page.goto('/warehouse?view=mrx-daily&batchId=batch-a&date=2026-10-19');
    await expect(page.getByRole('cell', { name: /Gạo lô A/ })).toBeVisible();
    const batchSelect = page.getByRole('combobox', { name: 'Chọn lô đối soát xuất kho' });
    await expect(batchSelect).toHaveValue('batch-a');

    const qtyInputA = page.getByRole('spinbutton', { name: /Số lượng thực xuất Gạo lô A/i });
    await qtyInputA.fill('5');
    await expect(qtyInputA).toHaveValue('5');
    await batchSelect.selectOption('batch-b');

    const dirtyDialog = page.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' });
    await expect(dirtyDialog).toBeVisible();
    await dirtyDialog.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).press('Enter');
    await expect(dirtyDialog).toHaveCount(0);
    await expect(batchSelect).toHaveValue('batch-a');
    await expect(qtyInputA).toHaveValue('5');

    await batchSelect.selectOption('batch-b');
    await expect(dirtyDialog).toBeVisible();
    await dirtyDialog.getByRole('button', { name: 'Hủy thay đổi' }).press('Enter');
    await expect(page.getByRole('cell', { name: /Thịt lô B/ })).toBeVisible();
    await expect(batchSelect).toHaveValue('batch-b');
    await expect(page.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('26/10/2026');

    await page.goBack();
    await expect(page.getByRole('cell', { name: /Gạo lô A/ })).toBeVisible();
    await expect(batchSelect).toHaveValue('batch-a');
    await expect(page.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('19/10/2026');

    await page.goForward();
    await expect(page.getByRole('cell', { name: /Thịt lô B/ })).toBeVisible();
    await expect(batchSelect).toHaveValue('batch-b');
    await expect(page.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('26/10/2026');
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-followthrough-warehouse-ab-${viewport.width}.png`) });

    // 2. Nonzero tiny rate (0,0000004) in Reconciliation frozen BOM modal with keyboard Escape focus return
    await page.goto('/reconciliation?batchId=batch-a&date=2026-10-19');
    const bomTrigger = page.getByRole('button', { name: 'Món & BOM đã đóng băng', exact: true });
    await bomTrigger.focus();
    await page.keyboard.press('Enter');
    const bomDialog = page.getByRole('dialog', { name: 'Món & BOM đã đóng băng', exact: true });
    await expect(bomDialog.getByRole('table', { name: 'Định mức ngày 19/10/2026', exact: true }).getByText('0,0000004', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-followthrough-reconciliation-tiny-rate-${viewport.width}.png`) });
    await page.keyboard.press('Escape');
    await expect(bomDialog).toHaveCount(0);
    await expect(bomTrigger).toBeFocused();

    // 3. Nonzero tiny rate (0,0000004) + 6-decimal total (0,0004) in Chef cooking station
    await page.goto('/chef?view=mrx-cooking&batchId=batch-a&date=2026-10-19');
    await expect(page.getByRole('cell', { name: '0,0000004', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '0,0004', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`BROWSER_FIXTURE-followthrough-chef-tiny-rate-${viewport.width}.png`) });
  }
  expect(unexpected).toEqual([]);
});
