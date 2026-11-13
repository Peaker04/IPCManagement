import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';

test('@MRX-ModalAcceptance import dialog keeps focus through nested discard confirmation', async ({ adminPage }) => {
  test.setTimeout(90_000);
  await adminPage.goto('/weekly-menu?view=mrx-batch');
  const trigger = adminPage.getByRole('button', { name: 'Nhập Excel', exact: true });
  await trigger.click();
  const dialog = adminPage.getByRole('dialog', { name: 'Nhập thực đơn tuần từ file Excel' });
  await expect(dialog).toBeVisible();
  const tiers = dialog.getByRole('radiogroup', { name: 'Mốc giá suất ăn' });
  const firstTier = tiers.getByRole('radio').first();
  await expect(firstTier).toBeEnabled();
  await firstTier.click();
  await expect(firstTier).toHaveAttribute('aria-checked', 'true');
  const close = dialog.getByRole('button', { name: 'Đóng hộp thoại' });
  await close.click();
  const discard = adminPage.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' });
  await expect(discard).toBeVisible();
  const keepEditing = discard.getByRole('button', { name: 'Tiếp tục chỉnh sửa' });
  const discardChanges = discard.getByRole('button', { name: 'Hủy thay đổi' });
  await expect(keepEditing).toBeFocused();
  await adminPage.keyboard.press('Tab');
  await expect(discardChanges).toBeFocused();
  await adminPage.keyboard.press('Tab');
  await expect(keepEditing).toBeFocused();
  await adminPage.keyboard.press('Escape');
  await expect(discard).toBeHidden();
  await expect(close).toBeFocused();
  await close.click();
  await expect(discard).toBeVisible();
  await discardChanges.click();
  await expect(discard).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('@MRX-UiAcceptance responsive controls across four stations', async ({adminPage, dieuphoiPage, thukhoPage, beptruongPage, managerPage, dbVerifier}) => {
  test.setTimeout(360000);
  const scope = scenarioScope(dbVerifier, 10);
  const {batchId} = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, afterTransfer: async () => {
    const banner = dieuphoiPage.getByRole('status').filter({hasText:/Đã bàn giao/});
    await expect(banner).toHaveCount(1);
    await expect(banner).toContainText('Chờ Kho xuất nguyên liệu');
    await expect(banner.getByRole('button',{name:'Đóng thông báo'})).toBeVisible();
    await dieuphoiPage.screenshot({path:path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!,'transfer-banner.png')});
  } }, scope);
  for (const [station,page,url] of [
    ['warehouse',thukhoPage,`/warehouse?view=mrx-daily&batchId=${batchId}&date=${scope.weekStartDate}`],
    ['chef',beptruongPage,`/chef?view=mrx-cooking&batchId=${batchId}`],
    ['coordinator',dieuphoiPage,dieuphoiPage.url()],
    ['reconciliation',managerPage,`/reconciliation?batchId=${batchId}`]
  ] as const) {
    await page.addInitScript(() => {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('ipc_l2_cache:') || key.startsWith('ipc_snapshot:')) sessionStorage.removeItem(key);
      }
      const frames: { header: boolean; height: number; skeleton: boolean; text: string }[] = [];
      Object.assign(window, { __coldFrames: frames });
      const sample = () => {
        const header = document.querySelector('.mrx-scope-header');
        frames.push({ header: !!header, height: header?.getBoundingClientRect().height ?? 0,
          skeleton: !!document.querySelector('[data-skeleton-kind]'), text: document.querySelector<HTMLSelectElement>('select[aria-label="Chọn lô đối soát"]')?.selectedOptions[0]?.textContent ?? '' });
        if (frames.length < 180) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto(url);
    const header = page.locator('.mrx-scope-header');
    await expect(header).toBeVisible();
    await page.waitForFunction(() => (window as unknown as { __coldFrames: unknown[] }).__coldFrames.length === 180);
    const cold = await page.evaluate(() => (window as unknown as { __coldFrames: { header: boolean; height: number; skeleton: boolean; text: string }[] }).__coldFrames);
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${station}-cold-frames.json`), JSON.stringify(cold));
    const firstHeader = cold.findIndex(frame => frame.header);
    expect(firstHeader).toBeGreaterThanOrEqual(0);
    expect(cold.slice(firstHeader).every(frame => frame.header), `${station}: header disappeared during cold entry`).toBe(true);
    if (station === 'reconciliation') {
      const expectedWeek = scope.weekStartDate.split('-').reverse().join('/');
      for (const frame of cold) {
        const week = frame.text.match(/· (\d\d\/\d\d\/\d{4})/u)?.[1];
        if (week) expect(week).toBe(expectedWeek);
      }
    }
    for (const width of [1920,960,1024,1280,1366,1440,1920]) {
      await page.setViewportSize({width,height:900});
      await page.screenshot({path:path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!,station+'-'+width+'.png')});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      for (const button of await header.locator('button:visible:enabled').all()) await button.click({trial:true});
      if (width === 1920) {
        for (let toggle = 0; toggle < 2; toggle++) {
          const positions = await header.evaluate(el => {
            const box = (slot: string) => el.querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect();
            const title = box('header-title'), scope = box('header-scope'), actions = box('header-command-region');
            return { aligned: Math.abs(title.y - scope.y) < 6, overlap: scope.right > actions.left + 1, height: el.getBoundingClientRect().height };
          });
          expect(positions.aligned, station).toBe(true);
          expect(positions.overlap, station).toBe(false);
          expect(positions.height, station).toBeLessThanOrEqual(64);
          await page.getByRole('button', { name: /^(Thu gọn|Mở rộng) sidebar$/ }).click();
        }
      }
    }
  }
  await beptruongPage.getByRole('button', { name: 'Tìm lô cũ' }).click();
  const batchHistory = beptruongPage.getByRole('dialog', { name: 'Tìm lô cũ' });
  await expect(batchHistory).toBeVisible();
  const chefViewport = beptruongPage.viewportSize()!;
  for (const width of [960, 1440]) {
    await beptruongPage.setViewportSize({ width, height: chefViewport.height });
    await expect(batchHistory.getByRole('columnheader', { name: 'Tuần bắt đầu' })).toBeVisible();
    await expect(batchHistory.getByRole('columnheader', { name: 'Thời điểm tạo' })).toHaveCount(0);
    await expect(batchHistory.getByLabel('Tuần từ')).toHaveAttribute('placeholder', 'dd/MM/yyyy');
    expect(await batchHistory.getByRole('table').evaluate(table => table.scrollWidth <= table.parentElement!.clientWidth + 1)).toBe(true);
  }
  await beptruongPage.setViewportSize(chefViewport);
  await batchHistory.getByRole('textbox', { name: 'Mã khách hàng' }).fill('ANV');
  await batchHistory.getByLabel('Tuần từ').fill(scope.weekStartDate);
  await batchHistory.getByLabel('Tuần đến').fill(scope.weekStartDate);
  await batchHistory.getByRole('textbox', { name: 'Mã lô đối soát' }).fill(batchId);
  const historicalLookup = beptruongPage.waitForResponse(response => response.url().includes('/reconciliation/batches?')
    && response.url().includes(`BatchId=${batchId}`) && response.request().method() === 'GET');
  await batchHistory.getByRole('button', { name: 'Tìm lô', exact: true }).click();
  expect((await historicalLookup).ok()).toBe(true);
  await expect(batchHistory.getByRole('button', { name: `Sao chép ${batchId}` })).toBeVisible();
  await expect(batchHistory.getByText('Đang xem', { exact: true })).toBeVisible();
  await batchHistory.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'mrx-batch-picker.png') });
  await beptruongPage.keyboard.press('Escape');
  await expect(batchHistory).toBeHidden();
  await expect(beptruongPage.getByRole('button', { name: 'Tìm lô cũ' })).toBeFocused();
  const frozenDishes = managerPage.getByRole('button', {name:'Món & BOM đã đóng băng',exact:true});
  await frozenDishes.click();
  const frozenDialog = managerPage.getByRole('dialog', {name:'Món & BOM đã đóng băng',exact:true});
  await expect(frozenDialog).toBeVisible();
  await expect(frozenDialog.locator('.animate-pulse')).toHaveCount(0);
  await managerPage.keyboard.press('Escape');
  await expect(frozenDialog).not.toBeVisible();
  await expect(frozenDishes).toBeFocused();
  // Search replaces the day selector: its slot must preserve toolbar geometry.
  for (const width of [960, 1920]) {
    await managerPage.setViewportSize({ width, height: 900 });
    const toolbar = managerPage.locator('.reconciliation-lines-toolbar');
    const before = await toolbar.boundingBox();
    const statusBefore = await managerPage.getByRole('toolbar', { name: 'Lọc trạng thái dòng' }).boundingBox();
    await managerPage.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' }).click();
    const search = managerPage.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' });
    await search.fill('khong-co-nguyen-lieu-nay');
    await expect(managerPage.locator('[data-skeleton-kind]')).toHaveCount(0);
    await expect(search).toBeFocused();
    const after = await toolbar.boundingBox();
    const statusAfter = await managerPage.getByRole('toolbar', { name: 'Lọc trạng thái dòng' }).boundingBox();
    expect(after!.height).toBe(before!.height);
    expect(statusAfter!.x).toBe(statusBefore!.x);
    await managerPage.getByRole('button', { name: 'Xóa bộ lọc đối soát' }).click();
    await expect(search).toBeFocused();
    await search.press('Escape');
    await expect(managerPage.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' })).toBeFocused();
    for (const label of [/^Cần xử lý/, /^Đã giải trình/, /^Khớp định mức/, /^Tất cả/]) {
      await managerPage.getByRole('button', { name: label }).click();
      await expect(managerPage.locator('[data-skeleton-kind]')).toHaveCount(0);
      expect((await toolbar.boundingBox())!.height).toBe(before!.height);
    }
  }
  // Hold real catalog responses to exercise a cold customer switch and late arrival.
  const customerSelect = managerPage.getByRole('combobox', { name: 'Chọn khách hàng đối soát' });
  const originalCustomer = await customerSelect.inputValue();
  const otherCustomer = await customerSelect.locator('option').evaluateAll((options, original) =>
    options.map(option => (option as HTMLOptionElement).value).find(value => value && value !== original), originalCustomer);
  expect(otherCustomer).toBeTruthy();
  const customerDays = managerPage.getByRole('group', { name: 'Ngày đối soát' });
  await expect(customerDays.getByRole('button')).toHaveCount(6);
  const beforeDays = await customerDays.boundingBox();
  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>(resolve => { releaseCatalog = resolve; });
  let heldRequests = 0;
  await managerPage.route('**/api/**', async route => {
    if (route.request().method() === 'GET') { heldRequests++; await catalogGate; }
    await route.continue();
  });
  try {
    await customerSelect.selectOption(otherCustomer!);
    await expect.poll(() => heldRequests).toBeGreaterThan(0);
    await expect(customerDays.getByRole('button')).toHaveCount(6);
    for (const button of await customerDays.getByRole('button').all()) await expect(button).toBeDisabled();
    await expect(managerPage.getByText('Đang xác minh trạng thái lô đã chọn…', { exact: true })).toBeVisible();
    const pendingDays = await customerDays.boundingBox();
    expect(pendingDays!.y).toBe(beforeDays!.y);
    expect(pendingDays!.height).toBe(beforeDays!.height);
    expect(pendingDays!.width).toBe(beforeDays!.width);
    await managerPage.screenshot({ path: path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'customer-switch-pending.png') });
    await customerSelect.selectOption(originalCustomer);
    releaseCatalog();
    await managerPage.unrouteAll({ behavior: 'wait' });
    await expect(customerSelect).toHaveValue(originalCustomer);
    await expect(managerPage.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue(batchId);
    await expect(customerDays.getByRole('button').first()).toBeEnabled();
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'customer-switch-geometry.json'), JSON.stringify({ beforeDays, pendingDays, heldRequests }));
  } finally {
    releaseCatalog();
    await managerPage.unrouteAll({ behavior: 'wait' });
  }
  await thukhoPage.setViewportSize({width:960,height:900});
  for (const view of ['variances', 'transactions', 'audit'] as const) {
    const frames = managerPage.locator('.mrx-scope-header').evaluate(async header => {
      const samples = [];
      for (let i = 0; i < 90; i++) {
        await new Promise(requestAnimationFrame);
        samples.push({ header: header.isConnected, top: header.getBoundingClientRect().y,
          pulse: [...document.querySelectorAll('[data-skeleton-kind] .animate-pulse')].some(node => getComputedStyle(node).animationName !== 'none') });
      }
      return samples;
    });
    await managerPage.locator(`a[href*="view=${view}"]`).first().click();
    await expect(managerPage).toHaveURL(new RegExp(`view=${view}`));
    const samples = await frames;
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `${view}-navigation.json`), JSON.stringify(samples));
    expect(samples.every(sample => sample.header && !sample.pulse)).toBe(true);
    expect(new Set(samples.map(sample => sample.top)).size).toBe(1);
  }
  const sourceChangesResponse = managerPage.waitForResponse(response =>
    response.url().endsWith(`/api/reconciliation/batches/${batchId}/source-changes`) && response.request().method() === 'GET');
  await managerPage.getByRole('button', { name: /Nguồn & BOM/ }).click();
  expect((await sourceChangesResponse).status()).toBe(200);
  await expect(managerPage.getByRole('searchbox', { name: 'Tìm trong lịch sử nguồn và BOM' })).toBeVisible();
  const row = thukhoPage.getByRole('row').filter({has:thukhoPage.getByRole('textbox',{name:/Số lượng thực xuất/})}).first();
  const nextDay=thukhoPage.getByTitle(/^T3 ·/);
  const dayFrames=thukhoPage.locator('.mrx-scope-header').evaluate(async header=>{
    const command=header.querySelector('[data-slot="header-command-region"]')!;
    const samples=[];
    for(let i=0;i<60;i++){
      await new Promise(requestAnimationFrame);
      samples.push({header:header.isConnected,commands:command.isConnected,y:command.getBoundingClientRect().y,
        table:!!document.querySelector('table')?.getBoundingClientRect().height});
    }
    return samples;
  });
  await nextDay.click();
  await expect(nextDay).toHaveAttribute('aria-pressed','true');
  const days=await dayFrames;
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!,'day-frames.json'),JSON.stringify(days));
  expect(days.every(f=>f.header && f.commands && f.table)).toBe(true);
  expect(Math.max(...days.map(f=>f.y))-Math.min(...days.map(f=>f.y))).toBeLessThanOrEqual(1);
  await thukhoPage.getByTitle(/^T2 ·/).click();
  const unit = row.getByText('Kilogram',{exact:true});
  await expect(unit).toBeVisible();
  expect(await unit.evaluate(el=>{
    const text=document.createRange(); text.selectNodeContents(el);
    const rect=text.getBoundingClientRect(), cell=el.closest('td')!.getBoundingClientRect();
    return rect.left>=cell.left && rect.right<=cell.right && rect.bottom<=cell.bottom;
  })).toBe(true);
  const copy = row.getByRole('button',{name:/Sao chép/});
  await thukhoPage.context().grantPermissions(['clipboard-read','clipboard-write']);
  await copy.focus();
  await thukhoPage.keyboard.press('Enter');
  expect(await thukhoPage.evaluate(()=>navigator.clipboard.readText())).toBe((await copy.getAttribute('aria-label'))!.replace('Sao chép ',''));
  await thukhoPage.getByRole('button',{name:'Điền đủ toàn bộ'}).click();
  await row.getByRole('textbox',{name:/Số lượng thực xuất/}).fill('1,5');
  await row.getByRole('textbox',{name:/Lý do chênh lệch/}).fill('Đối chiếu số lượng thực xuất');
  const [response]=await Promise.all([
    thukhoPage.waitForResponse(r=>r.url().endsWith('/api/inventory-issues') && r.request().method()==='POST'),
    thukhoPage.getByRole('button',{name:'Xác nhận xuất kho'}).click()
  ]);
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON().lines.some((line:{issuedQty:number})=>line.issuedQty===1.5)).toBe(true);
  await managerPage.goto(`/reconciliation?batchId=${batchId}&view=transactions`);
  const table = managerPage.getByRole('table').filter({has:managerPage.getByTitle('Bấm để xem chi tiết phiếu xuất kho')}).first();
  await expect(table).toBeVisible();
  const pattern = '**/api/reconciliation/reports/transactions-history?*';
  await managerPage.route(pattern, route => route.fulfill({status:500,json:{success:false,message:'MRX retry verification'}}));
  await managerPage.getByRole('button',{name:'Làm mới',exact:true}).click();
  const retry = managerPage.getByRole('button',{name:'Thử lại',exact:true});
  await expect(retry).toBeVisible();
  await managerPage.unroute(pattern);
  let release!: () => void;
  const hold = new Promise<void>(resolve => {release=resolve;});
  await managerPage.route(pattern, async route => {await hold; await route.continue();});
  const frames = table.evaluate(async node => {
    const alert=document.querySelector('[role="alert"]');
    const samples=[];
    for(let index=0;index<90;index++){
      await new Promise(requestAnimationFrame);
      samples.push({t:performance.now(),alert:!!alert?.isConnected,table:node.isConnected && node.getBoundingClientRect().height>0,y:node.getBoundingClientRect().y});
    }
    return samples;
  });
  try {
    await retry.click();
    const samples=await frames;
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!,'retry-frames.json'),JSON.stringify(samples));
    expect(samples.every(frame=>frame.table && frame.alert)).toBe(true);
    expect(Math.max(...samples.map(f=>f.y))-Math.min(...samples.map(f=>f.y))).toBeLessThanOrEqual(1);
  } finally {release();}
  await expect(managerPage.getByRole('alert').filter({hasText:'MRX retry verification'})).toHaveCount(0);

  // A settled report must stay in place while a different year's real catalog request is pending.
  const settledTable = managerPage.getByRole('table').first();
  await expect(settledTable).toBeVisible();
  const originalYear = await managerPage.getByRole('combobox', {name:'Năm đối soát'}).inputValue();
  const alternateYear = String(Number(originalYear) - 1);
  let releaseYear!: () => void;
  const yearGate = new Promise<void>(resolve => { releaseYear = resolve; });
  let yearRequests = 0;
  await managerPage.route('**/api/**', async route => {
    if (route.request().method() === 'GET') { yearRequests++; await yearGate; }
    await route.continue();
  });
  try {
    const yearFrames = settledTable.evaluate(async node => {
      const samples = [];
      for (let index=0; index<45; index++) {
        await new Promise(requestAnimationFrame);
        samples.push({ table: node.isConnected && node.getBoundingClientRect().height>0,
          skeleton: !!document.querySelector('[data-skeleton-kind]'),
          visibleLoadingBadge: [...document.querySelectorAll('[role="status"]')].some(el =>
            el.textContent?.includes('Đang tải phạm vi mới') && getComputedStyle(el).visibility !== 'hidden' &&
            el.getBoundingClientRect().width>4 && el.getBoundingClientRect().height>4) });
      }
      return samples;
    });
    await managerPage.getByRole('combobox', {name:'Năm đối soát'}).selectOption(alternateYear);
    await expect.poll(() => yearRequests).toBeGreaterThan(0);
    const samples = await yearFrames;
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'year-change-frames.json'), JSON.stringify({originalYear, alternateYear, yearRequests, samples}));
    expect(samples.every(frame => frame.table && !frame.skeleton && !frame.visibleLoadingBadge)).toBe(true);
  } finally {
    releaseYear();
    await managerPage.unrouteAll({behavior:'wait'});
  }

  // Select a real dashboard row, then open Chef without a batch query parameter.
  await adminPage.goto('/');
  const dashboardRow = adminPage.getByRole('row').filter({hasText:batchId});
  await expect(dashboardRow).toBeVisible();
  await dashboardRow.getByRole('button', {name:'Mở trạm làm việc'}).click();
  await adminPage.goto('/chef?view=mrx-cooking');
  await expect(adminPage.getByRole('combobox', {name:'Chọn lô đối soát'})).toHaveValue(batchId);
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'dashboard-chef-continuity.json'), JSON.stringify({batchId, chefUrl:adminPage.url()}));
});
