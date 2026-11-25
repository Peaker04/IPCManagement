import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Network fixtures render the actual app shell and approval owner. This is UI evidence,
// not a production workflow or persistence qualification.
const id = '20000000-0000-0000-0000-000000000001';
const item = { serviceDates: [], inboxItemId: `material-demand-${id}`, targetType: 'material-demand', targetId: id,
  targetCode: 'MR-20261116', itemType: 'material-demand', title: 'Duyệt nhu cầu nguyên liệu ca sáng',
  source: 'AMANN', ownerRole: 'Quản lý', submittedBy: 'Điều phối', dueDate: '2026-11-16',
  status: 'DRAFT', reason: 'Chuẩn bị nguyên liệu theo thực đơn đã bàn giao.', nextAction: 'Duyệt', tone: 'warning', route: '/approvals',
  submittedAt: '2026-11-16T06:00:00Z', materials: [{ name: 'Bầu', quantity: 8.77503, unit: 'Kilogram' },
    { name: 'Chuối', quantity: 225.3812, unit: 'Quả' }] };
const targets = [{ targetType: 'material-demand', label: 'Nhu cầu nguyên liệu', mode: 'DEFAULT', permission: 'material-demand.approve' }];

for (const scenario of ['approval', 'stocktake', 'legacy application'] as const) {
for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 720 }, { width: 600, height: 480 }, { width: 1440, height: 960, zoom: 2 }]) {
  test(`${scenario} queue and detail ${viewport.width}x${viewport.height}`, async ({ page: fixturePage }, info) => {
    let zoomContext: BrowserContext | undefined;
    const page = 'zoom' in viewport
      ? (zoomContext = await chromium.launchPersistentContext(info.outputPath('native-zoom-profile'), {
          channel: 'chrome', headless: true, viewport: { width: viewport.width, height: viewport.height },
        })).pages()[0]!
      : fixturePage;
    try {
    // Chrome settings are available in a dedicated persistent profile, never the user's profile.
    // Native browser zoom changes layout viewport and DPR; CSS zoom does neither faithfully.
    if ('zoom' in viewport) {
      await page.goto('chrome://settings/appearance');
      await page.waitForFunction('typeof chrome.settingsPrivate?.setDefaultZoom === "function"');
      await page.evaluate('new Promise(resolve => chrome.settingsPrivate.setDefaultZoom(2, resolve))');
    }
    const capture = async (name: string) => {
      if ('zoom' in viewport) {
        // Playwright's fullPage clip uses CSS dimensions at native zoom, cropping the
        // physical screenshot. Capture the compositor viewport without that clip.
        const session = await page.context().newCDPSession(page);
        try {
          const shot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
          await writeFile(info.outputPath(name), Buffer.from(shot.data, 'base64'));
        } finally { await session.detach(); }
      } else await page.screenshot({ path: info.outputPath(name), fullPage: true });
    };
    const subject = scenario === 'approval' ? item : { ...item, targetType: scenario === 'stocktake' ? 'stocktake' : 'legacy-lineage-disposition',
      itemType: scenario === 'stocktake' ? 'stocktake' : 'legacy-lineage-disposition', materials: [],
      targetCode: scenario === 'stocktake' ? 'KK-20261116' : 'LG-20000000', title: scenario === 'stocktake' ? 'Duyệt chênh lệch kiểm kê' : 'Đối chiếu liên kết chứng từ cũ',
      status: scenario === 'stocktake' ? 'REVIEWING' : 'APPROVED',
      source: scenario === 'stocktake' ? 'Kho IPC' : 'Dòng xuất kho · ISS-20261116', submittedBy: scenario === 'stocktake' ? 'Thủ kho' : 'Admin',
      ownerRole: scenario === 'stocktake' ? 'Manager' : 'Admin', reason: scenario === 'stocktake' ? 'Kiểm đếm thực tế' : 'Đối chiếu chứng từ gốc' };
    const targetRegistry = scenario === 'approval' ? targets : [{ targetType: subject.targetType, label: subject.title, mode: 'DEFAULT', permission: 'inventory.issue.approve' }];
    const mainAction = scenario === 'legacy application' ? 'Áp dụng liên kết' : 'Phê duyệt hồ sơ';
    const additionalDetail = scenario === 'legacy application' ? { legacyLineage: {
      dispositionId: id, legacyLineType: 'ISSUE_LINE', legacyLineId: '30000000-0000-0000-0000-000000000001',
      targetMaterialRequestLineId: '40000000-0000-0000-0000-000000000001', targetIssueLineId: null, status: 'APPROVED',
      reason: 'Đối chiếu chứng từ gốc', reviewReason: 'Đúng dòng nguồn', createdBy: id, createdAt: item.submittedAt,
      reviewedBy: '50000000-0000-0000-0000-000000000001', reviewedAt: item.submittedAt, appliedBy: null, appliedAt: null, version: 1,
    } } : scenario === 'stocktake' ? { stocktake: { stocktakeId: id, stocktakeCode: subject.targetCode, warehouseId: id, warehouseName: 'Kho IPC',
      status: 'REVIEWING', createdBy: id, createdAt: item.submittedAt, lines: [{ lineId: id, ingredientId: id, ingredientName: 'Bầu',
      unitId: id, unitName: 'Kilogram', systemQty: 10.77503, actualQty: 8.5, discrepancyQty: -2.27503, reason: 'Kiểm đếm thực tế' }] } } : {};
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.setViewportSize(viewport);
    await page.addInitScript(role => {
      localStorage.setItem('ipc_v3_token', 'approval-ui-fixture');
      localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: role.toLowerCase(),
        fullName: 'Quản lý · Kiểm thử giao diện', roleCode: role.toUpperCase(), roleName: role, isActive: true,
        permissions: ['material-demand.approve', 'inventory.issue.approve'] }));
      localStorage.setItem('ipc_v3_mode', 'DEFAULT');
      localStorage.setItem('ipc_v3_mode_version', '1');
    }, scenario === 'legacy application' ? 'Admin' : 'Manager');
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/api/')) { await route.continue(); return; }
      let data: unknown;
      if (path === '/api/system-operation-mode') data = { mode: 'DEFAULT', label: 'Mặc định', version: 1,
        updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue','history'] } } };
      else if (path === '/api/operational-approvals/inbox') data = { mode: 'DEFAULT', modeVersion: 1, unavailableSources: [], targets: targetRegistry, items: [subject], limit: 20, hasNext: false, nextCursor: null };
      else if (path.endsWith('/history')) data = scenario === 'legacy application' ? [{ historyId: id, targetType: subject.targetType, targetId: id,
        decision: 'APPROVED', oldStatus: 'PENDING_MANAGER_REVIEW', newStatus: 'APPROVED', reason: 'Đúng dòng nguồn',
        actionBy: '50000000-0000-0000-0000-000000000001', actionByName: 'Quản lý', actionAt: item.submittedAt }] : [];
      else if (path === `/api/operational-approvals/${subject.targetType}/${id}`) data = { mode: 'DEFAULT', modeVersion: 1, item: subject,
        sourceDishNames: {}, fingerprint: 'ABC', allowedActions: scenario === 'legacy application' ? ['APPLY'] : ['APPROVE', 'REJECT'], blockedReasons: [], materialImpact: [], ...additionalDetail };
      else { unexpected.push(path); await route.fulfill({ status: 404, json: { success: false, message: 'Unconfigured UI fixture' } }); return; }
      await route.fulfill({ json: { success: true, data, message: '' } });
    });
    await page.goto('/approvals');
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scale: visualViewport?.scale }));
    if ('zoom' in viewport) {
      expect(metrics.width).toBe(viewport.width / 2);
      expect(metrics.dpr).toBe(2);
      expect(metrics.scale).toBe(1);
    }
    await info.attach('viewport-metrics.json', { body: JSON.stringify({ ...metrics, nativeZoom: 'zoom' in viewport ? 200 : 100, dataSource: 'HTTP fixtures' }), contentType: 'application/json' });
    await expect(page.getByRole('button', { name: 'Xem xét' })).toBeVisible({ timeout: 20_000 });
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Xem xét' }) });
    // clientHeight excludes the half-pixel painted hairline of collapsed table borders.
    expect(await row.evaluate(element => element.clientHeight)).toBeLessThanOrEqual(40);
    for (const header of await page.getByRole('columnheader').all()) {
      const box = await header.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(metrics.width);
    }
    await expect(page.getByRole('button', { name: 'Xem xét' })).toBeInViewport();
    await capture('queue.png');
    await page.getByRole('button', { name: 'Xem xét' }).click();
    if (scenario === 'legacy application') await expect(page.getByText('Dòng chứng từ cũ', { exact: true })).toBeVisible();
    else await expect(page.getByText('Kilogram', { exact: true })).toBeVisible();
    if (scenario === 'approval') await expect(page.getByText('Quả', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: mainAction, exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: mainAction, exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await capture('detail.png');
    await page.getByRole('button', { name: mainAction, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.getByLabel('Căn cứ quyết định').fill('Đã kiểm tra định lượng');
    await capture('confirmation.png');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeVisible();
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(page.getByLabel('Căn cứ quyết định')).toHaveValue('Đã kiểm tra định lượng');
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
    } finally { await zoomContext?.close(); }
  });
}

}

for (const viewport of [{ width: 1440, height: 900 }, { width: 600, height: 480 }]) {
  test(`supplemental demand review ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const mrxItem = { ...item, targetType: 'mrx-supplemental-demand', itemType: 'mrx-supplemental-demand',
    targetCode: 'PS-20000000', title: 'Nhu cầu suất phát sinh', status: 'PENDING', source: 'ANV · AMANN', submittedBy: 'Thủ kho', reason: 'Khách tăng suất',
    materials: [{ name: 'Bầu', quantity: 2, unit: 'Kilogram' }, { name: 'Tôm', quantity: 0.5, unit: 'Kilogram' }] };
    const demand = { demandId: id, batchId: id, serviceDate: '2026-11-30', status: 'PENDING', version: 2, batchVersion: 4,
      reason: 'Khách tăng suất', snapshotFingerprint: 'FROZEN', createdBy: id, createdAt: '2026-11-16T06:00:00Z',
      submittedAt: '2026-11-16T06:05:00Z', decidedBy: null, decidedAt: null, decisionReason: null, materials: [
        { demandMaterialId: id, dailyLineId: id, ingredientId: id, canonicalUnitId: id, requiredQuantity: 2 },
        { demandMaterialId: '20000000-0000-0000-0000-000000000002', dailyLineId: '20000000-0000-0000-0000-000000000002',
          ingredientId: '20000000-0000-0000-0000-000000000002', canonicalUnitId: id, requiredQuantity: 0.5 },
      ], dishes: [
        { demandDishId: id, dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 },
        { demandDishId: '20000000-0000-0000-0000-000000000002', dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'AFTERNOON', menuVariant: 'vegetarian', extraServings: 5 },
      ] };
    await page.addInitScript(() => {
      localStorage.setItem('ipc_v3_token', 'approval-ui-fixture');
      localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'manager',
        fullName: 'Quản lý · Kiểm thử giao diện', roleCode: 'MANAGER', roleName: 'Manager', isActive: true, permissions: [] }));
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION'); localStorage.setItem('ipc_v3_mode_version', '1');
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/api/')) { await route.continue(); return; }
      let data: unknown;
      if (path === '/api/system-operation-mode') data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát nguyên liệu', version: 1,
        updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue','history'] } } };
      else if (path === '/api/operational-approvals/inbox') data = { mode: 'MATERIAL_RECONCILIATION', modeVersion: 1,
        targets: [{ targetType: mrxItem.targetType, label: mrxItem.title, mode: 'MATERIAL_RECONCILIATION', permission: '' }],
        items: [mrxItem], limit: 20, hasNext: false, nextCursor: null };
      else if (path.endsWith('/history')) data = [];
      else if (path === `/api/operational-approvals/mrx-supplemental-demand/${id}`) data = { mode: 'MATERIAL_RECONCILIATION', modeVersion: 1,
        item: mrxItem, sourceDishNames: {}, fingerprint: 'ABC', allowedActions: ['APPROVE', 'REJECT'], blockedReasons: [], materialImpact: [], supplementalDemand: demand };
      else { errors.push(`Unconfigured UI fixture: ${path}`); await route.fulfill({ status: 404, json: { success: false } }); return; }
      await route.fulfill({ json: { success: true, data, message: '' } });
    });
    await page.goto('/approvals');
    await page.getByRole('button', { name: 'Xem xét' }).click();
    await expect(page.getByRole('heading', { name: 'Suất phát sinh đề nghị' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sáng · Mặn', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Chiều · Chay', exact: true })).toBeVisible();
    await expect(page.getByText('30/11/2026', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('supplemental-review.png'), fullPage: true });
    await page.getByRole('cell', { name: 'Chiều · Chay', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('supplemental-servings.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
}


for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 720 }, { width: 600, height: 480 }]) {
  test(`warehouse supplemental forms ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    const unexpected: string[] = []; const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('ipc_v3_token', 'warehouse-ui-fixture');
      localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'admin', fullName: 'Admin · UI fixture',
        roleCode: 'ADMIN', roleName: 'Admin', isActive: true, isAdminFullAccess: true, permissions: [] }));
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION'); localStorage.setItem('ipc_v3_mode_version', '1');
    });
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      let data: unknown;
      if (path === '/api/system-operation-mode') data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1,
        updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: ['warehouse','approvals'], pageTabs: { warehouse: ['mrx-daily'], approvals: ['queue','history'] } } };
      else if (path === '/api/reconciliation/batches') data = { items: [{ batchId: id, status: 'IN_PROGRESS', version: 3, createdAt: '2026-11-16T00:00:00Z',
        customerId: id, customerCode: 'ANV', customerName: 'AMANN', weekStartDate: '2026-11-30', weekEndDate: '2026-12-05' }], totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasNext: false, hasPrev: false };
      else if (path.endsWith('/warehouse-daily')) data = { batchId: id, batchStatus: 'IN_PROGRESS', sourceVersion: 3, weeklyStatus: 'IN_PROGRESS',
        compatibility: { canRead: true, canIssueByDate: true }, dates: [{ serviceDate: '2026-11-30', status: 'PARTIAL', isApplicable: true, requiredQuantity: 8.77503,
        issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 6.77503, lines: [{ dailyLineId: id, batchLineId: id, ingredientId: id, ingredientCode: 'ING-BAU', ingredientName: 'Bầu',
          canonicalUnitId: id, canonicalUnitName: 'Kilogram', requiredQuantity: 8.77503, frozenBaselineQuantity: 8.77503, approvedSupplementalQuantity: 0,
          issuedQuantity: 2, returnedQuantity: 0, remainingQuantity: 6.77503, quantityStatus: 'SHORT', hasValidDisposition: false }] }] };
      else if (path === '/api/inventory-issues') data = { items: [{ issueId: id, issueCode: 'PX-001', issueDate: '2026-11-30', warehouseId: id, issuedBy: id,
        sourceFamily: 'MATERIAL_RECONCILIATION', createdAt: '2026-11-16T00:00:00Z', provisions: [], lines: [{ issueLineId: id, ingredientId: id, unitId: id,
          reconciliationBatchDailyLineId: id, requestedQty: 8.77503, issuedQty: 2 }] }], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasNext: false, hasPrev: false };
      else if (path.endsWith('/fulfillment')) data = { batchId: id, serviceDate: '2026-11-30', pendingDemandCount: 0, lines: [{ dailyLineId: id, ingredientId: id, canonicalUnitId: id,
        baselineRequiredQuantity: 8.77503, baselineIssuedQuantity: 2, baselineRemainingQuantity: 6.77503, netIssuedQuantity: 2, unplannedIssuedQuantity: 0,
        unallocatedIssuedQuantity: 0, hasIncompleteAllocation: false, hasAmbiguousReturn: false, isDemandFulfilled: false, extraDemands: [] }] };
      else if (path.endsWith('/dish-options')) data = { batchId: id, batchVersion: 3, serviceDate: '2026-11-30', canCreate: true,
        dishes: [{ dishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory' }] };
      else if (path === '/api/reconciliation/supplemental-demands' && request.method() === 'POST') {
        const body = request.postDataJSON();
        data = { demandId: body.commandId, batchId: id, serviceDate: '2026-11-30', status: 'DRAFT', version: 1, batchVersion: 3,
          reason: body.reason, snapshotFingerprint: 'FROZEN', createdBy: id, createdAt: '2026-11-16T00:00:00Z',
          dishes: body.dishes.map((dish: object) => ({ ...dish, demandDishId: id, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm' })),
          materials: [{ demandMaterialId: id, dailyLineId: id, ingredientId: id, canonicalUnitId: id, requiredQuantity: 2.35 }] };
      } else { unexpected.push(path); await route.fulfill({ status: 404, json: { success: false, message: 'Unconfigured fixture' } }); return; }
      await route.fulfill({ json: { success: true, data, message: '' } });
    });
    await page.goto(`/warehouse?view=mrx-daily&batchId=${id}&date=2026-11-30`);
    await page.getByRole('button', { name: 'Xuất bổ sung ca' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('dialog').getByText('6,77503', { exact: true })).toBeVisible();
    const actualAction = page.getByRole('button', { name: 'Xác nhận xuất bổ sung' });
    const actualBox = await actualAction.boundingBox();
    expect(actualBox!.y + actualBox!.height).toBeLessThan(viewport.height);
    await page.screenshot({ path: info.outputPath('warehouse-shortage.png'), fullPage: true });
    await page.getByRole('button', { name: 'Đề nghị suất phát sinh' }).click();
    await page.getByRole('combobox', { name: 'Menu hoặc tùy chọn 1' }).selectOption('CUSTOM');
    await page.getByRole('combobox', { name: 'Món, ca và loại suất 1' }).selectOption(JSON.stringify([id, 'MORNING', 'savory']));
    await page.getByRole('spinbutton', { name: 'Suất tăng thêm 1' }).fill('10');
    await page.getByRole('textbox', { name: 'Lý do tăng suất' }).fill('Khách tăng suất đột xuất');
    await page.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }).click();
    await expect(page.getByRole('button', { name: 'Gửi duyệt nhu cầu' })).toBeVisible();
    await page.getByRole('dialog').getByText('2,35', { exact: true }).scrollIntoViewIfNeeded();
    const submitBox = await page.getByRole('button', { name: 'Gửi duyệt nhu cầu' }).boundingBox();
    expect(submitBox!.y + submitBox!.height).toBeLessThan(viewport.height);
    await page.screenshot({ path: info.outputPath('warehouse-proposal-preview.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]); expect(unexpected).toEqual([]);
  });
}

// MRX completion eligibility is independently exercised against persisted SQLite fixtures in backend tests.
// These captures verify the real UI with the resulting DTO, not a database workflow.
for (const width of [600, 960, 1440]) {
  test(`MRX completion-ready and creation history ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('ipc_v3_token', 'approval-ui-fixture');
      localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: '10000000-0000-0000-0000-000000000001', username: 'manager',
        fullName: 'Quản lý · Kiểm thử giao diện', roleCode: 'MANAGER', roleName: 'Manager', isActive: true, permissions: [] }));
      localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION'); localStorage.setItem('ipc_v3_mode_version', '1');
    });
    const subject = { ...item, targetType: 'mrx-batch-review', itemType: 'mrx-batch-review', title: 'Rà soát và chốt lô',
      status: 'COMPLETION_READY', targetCode: 'ANV', customerCode: 'ANV', weekStartDate: '2026-11-30',
      route: '/reconciliation?batchId=' + id, nextAction: 'Mở đối soát', materials: [] };
    const unexpected: string[] = [];
    let inboxReads = 0;
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown;
      if (path === '/api/system-operation-mode') data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát MRX', version: 1,
        updatedAt: item.submittedAt, reasonRequired: false, capabilities: { navigation: ['approvals'], pageTabs: { approvals: ['queue','history'] } } };
      else if (path === '/api/operational-approvals/inbox') data = { mode: 'MATERIAL_RECONCILIATION', modeVersion: 1,
        unavailableSources: ++inboxReads === 1 ? [
          { targetType: 'mrx-source-change', message: 'Chưa tải được yêu cầu đổi nguồn' },
          { targetType: 'mrx-historical-purpose', message: 'Chưa tải được đề xuất phân bổ phiếu lịch sử' },
        ] : [],
        targets: [{ targetType: subject.targetType, label: subject.title, mode: 'MATERIAL_RECONCILIATION', permission: '' }],
        items: [subject], limit: 20, hasNext: false, nextCursor: null };
      else if (path.endsWith('/history')) data = [{ historyId: id, targetType: subject.targetType, targetId: id,
        decision: 'DRAFT', newStatus: 'DRAFT', actionBy: id, actionByName: 'Admin', actionAt: item.submittedAt }];
      else if (path === '/api/operational-approvals/mrx-batch-review/' + id) data = { mode: 'MATERIAL_RECONCILIATION', modeVersion: 1,
        item: subject, fingerprint: 'BATCH', allowedActions: [], blockedReasons: ['Rà soát kết quả tại trạm đối soát trước khi chốt.'],
        materialImpact: [], sourceDishNames: {} };
      else { unexpected.push(path); await route.fulfill({ status: 500, json: { success: false, message: 'Unexpected request' } }); return; }
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/approvals');
    const retry = page.getByRole('button', { name: 'Tải lại hàng đợi', exact: true });
    await expect(retry).toHaveCount(1);
    await expect(page.getByText('Chưa tải được yêu cầu đổi nguồn', { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa tải được đề xuất phân bổ phiếu lịch sử', { exact: true })).toBeVisible();
    const review = page.getByRole('button', { name: 'Xem xét', exact: true });
    await expect(review).toBeEnabled();
    if (width === 1440) {
      await review.click();
      await expect(page.getByRole('heading', { name: subject.title, exact: true })).toBeVisible();
    }
    await retry.click();
    await expect(page.getByText('Hàng đợi chưa đầy đủ', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled();
    expect(inboxReads).toBe(2);
    if (width === 1440) await expect(page.getByRole('heading', { name: subject.title, exact: true })).toBeVisible();
    else await review.click();
    await expect(page.getByText('Đã tạo lô', { exact: true })).toBeVisible();
    await expect(page.getByText('Sẵn sàng chốt lô', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Mở đối soát', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Phê duyệt hồ sơ' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(unexpected).toEqual([]);
    await page.screenshot({ path: info.outputPath('mrx-completion-ready.png'), fullPage: true });
  });
}
