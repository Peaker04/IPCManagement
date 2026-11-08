import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as warehouseFixture from './warehouse-production-query.spec';
import * as chefFixture from './chef-dashboard-production-query.spec';
import * as approvalFixture from './approval-rules-production-query.spec';
import * as weeklyFixture from './weekly-menu-production-query.spec';

const outputRoot = resolve(process.cwd(), '../.artifacts/shipyard-live/full-ui-remediation/phase31-convergence');
const viewports = [
  { name: 'S-390', width: 390, height: 844 },
  { name: 'M-768', width: 768, height: 1024 },
  { name: 'L-1280', width: 1280, height: 900 },
  { name: 'XL-1365', width: 1365, height: 900 },
];

async function systemMode(route: Route) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
    mode: 'DEFAULT', label: 'Mặc định', version: 7, updatedAt: '2026-09-02T00:00:00Z', reasonRequired: true,
    capabilities: { navigation: ['dashboard','weekly-menu','coordination','approvals','purchasing','warehouse','chef','reports','admin-data','approval-rules','advanced-settings'], pageTabs: { 'weekly-menu': ['schedule','demand','production-plan','purchase-summary','cost','dish-materials'], warehouse: ['movement','demand','exceptions'], chef: ['production','documents'], 'approval-rules': ['rules'] } },
  } }) });
}

async function installClsObserver(page: Page) {
  await page.addInitScript(() => {
    const state = { value: 0, entries: [] as Array<{ value: number; hadRecentInput: boolean }> };
    const observer = new PerformanceObserver((list) => {
      for (const raw of list.getEntries()) {
        const entry = raw as PerformanceEntry & { value: number; hadRecentInput: boolean };
        state.entries.push({ value: entry.value, hadRecentInput: entry.hadRecentInput, sources: ((entry as unknown as { sources?: Array<{ node?: Node }> }).sources ?? []).map((source) => (source.node as HTMLElement | undefined)?.outerHTML?.slice(0, 240) ?? null) } as never);
        if (!entry.hadRecentInput) state.value += entry.value;
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    Object.assign(window, { __phase31Cls: state, __phase31ClsObserver: observer });
  });
}

async function captureDom(page: Page) {
  return page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    width: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    bodyHeight: document.body.scrollHeight,
    focused: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 80) ?? null,
  }));
}

test('Weekly Menu schedule initial loading preserves the canonical production panel at S-390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const release = await weeklyFixture.installApi(page, 'weekly-schedule', 'initial-loading');
  await page.route('**/api/system-operation-mode', systemMode);
  await weeklyFixture.login(page);
  await page.getByRole('tab', { name: 'Kế hoạch tuần', exact: true }).click();
  await expect(weeklyFixture.target(page, 'weekly-schedule', 'initial-loading')).toBeVisible({ timeout: 5_000 });
  release();
});

test('Warehouse and Chef populated loading-to-ready CLS stays within the 0.1 budget', async ({ browser }) => {
  test.setTimeout(240_000);
  mkdirSync(outputRoot, { recursive: true });
  const records: unknown[] = [];
  for (const viewport of viewports) {
    for (const routeName of ['warehouse', 'chef'] as const) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5177' });
      const page = await context.newPage();
      await installClsObserver(page);
      const release = routeName === 'warehouse'
        ? await warehouseFixture.installApi(page, 'warehouse-current-stock', 'initial-loading')
        : await chefFixture.installApi(page, 'chef-production', 'initial-loading');
      await page.route('**/api/system-operation-mode', systemMode);
      if (routeName === 'warehouse') {
        await warehouseFixture.login(page);
        await expect(warehouseFixture.seam(page, 'warehouse-current-stock', 'initial-loading')).toBeVisible();
      } else {
        await chefFixture.login(page);
        await expect(chefFixture.seam(page, 'chef-production', 'initial-loading')).toBeVisible();
      }
      await page.waitForTimeout(100);
      const before = await captureDom(page);
      await page.evaluate(() => { const owned = window as unknown as { __phase31Cls: { value: number; entries: Array<{ value: number; hadRecentInput: boolean }> }; __phase31ClsObserver: PerformanceObserver }; owned.__phase31ClsObserver.disconnect(); owned.__phase31Cls.value = 0; owned.__phase31Cls.entries = []; owned.__phase31ClsObserver = new PerformanceObserver((list) => { for (const raw of list.getEntries()) { const entry = raw as PerformanceEntry & { value: number; hadRecentInput: boolean }; owned.__phase31Cls.entries.push({ value: entry.value, hadRecentInput: entry.hadRecentInput }); if (!entry.hadRecentInput) owned.__phase31Cls.value += entry.value; } }); owned.__phase31ClsObserver.observe({ type: 'layout-shift' }); });
      release();
      if (routeName === 'warehouse') await expect(warehouseFixture.seam(page, 'warehouse-current-stock', 'populated')).toBeVisible();
      else await expect(chefFixture.seam(page, 'chef-production', 'populated')).toBeVisible();
      await page.waitForTimeout(250);
      const after = await captureDom(page);
      const cls = await page.evaluate(() => (window as unknown as { __phase31Cls: { value: number; entries: unknown[] } }).__phase31Cls);
      const screenshot = resolve(outputRoot, `${routeName}-${viewport.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      records.push({ route: routeName, viewport, before, after, cls, screenshot });
      expect(after.overflow).toBe(0);
      await context.close();
    }
  }
  writeFileSync(resolve(outputRoot, 'cls-results.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
  expect(records.every((record) => (record as { cls: { value: number } }).cls.value < 0.1)).toBe(true);
});

test('Approval Rules create and edit dialogs preserve accessible non-mutating interaction ownership', async ({ browser }) => {
  test.setTimeout(120_000);
  mkdirSync(outputRoot, { recursive: true });
  const records: unknown[] = [];
  for (const viewport of [viewports[0], viewports[3]]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5177' });
    const page = await context.newPage();
    const mutations: string[] = [];
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`); });
    await approvalFixture.installApi(page, 'populated');
    await page.route('**/api/admin/employees*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0, hasPrev: false, hasNext: false } }) }));
    await page.route('**/api/system-operation-mode', systemMode);
    await approvalFixture.login(page);
    for (const kind of ['create', 'edit'] as const) {
      const trigger = kind === 'create' ? page.getByRole('button', { name: 'Thêm quy tắc' }) : page.getByRole('button', { name: 'Sửa', exact: true }).first();
      await trigger.focus(); await trigger.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const accessibleName = await dialog.getAttribute('aria-label');
      const metrics = await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        const active = document.activeElement as HTMLElement | null;
        const rect = dialog.getBoundingClientRect();
        const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20);
        return { activeInside: Boolean(active && dialog.contains(active)), activeLabel: active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 80), overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), contained: rect.left >= 0 && rect.right <= innerWidth, hitOwned: Boolean(center && dialog.contains(center)) };
      });
      expect(accessibleName).toBeTruthy(); expect(metrics.activeInside).toBe(true); expect(metrics.contained).toBe(true); expect(metrics.hitOwned).toBe(true); expect(metrics.overflow).toBe(0);
      await page.screenshot({ path: resolve(outputRoot, `approval-${kind}-${viewport.name}.png`), fullPage: true });
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
      records.push({ kind, viewport, accessibleName, metrics, escapeClosed: true, returnFocus: true });
    }
    expect(mutations).toEqual([]);
    await context.close();
  }
  writeFileSync(resolve(outputRoot, 'approval-dialog-results.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`);
});

test('Weekly Menu reachable command dialogs and non-submit validation preserve interaction ownership', async ({ browser }) => {
  test.setTimeout(120_000);
  mkdirSync(outputRoot, { recursive: true });
  const records: unknown[] = [];
  for (const viewport of [viewports[0], viewports[3]]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, baseURL: 'http://127.0.0.1:5177' });
    const page = await context.newPage();
    const requests: Array<{ method: string; path: string; classification: string }> = [];
    page.on('request', request => { const method=request.method(); const path=new URL(request.url()).pathname; if(path.startsWith('/api/')) requests.push({method,path,classification:['GET','HEAD'].includes(method)?'read':'unexpected-mutation'}); });
    await weeklyFixture.installApi(page, 'weekly-schedule', 'populated');
    await page.route('**/api/system-operation-mode', systemMode);
    await weeklyFixture.login(page);
    for (const overlay of [
      { trigger: 'Chỉnh sửa thực đơn', name: 'Chỉnh sửa thực đơn tuần', close: 'Hủy', validation: 'Lưu thay đổi' },
      { trigger: 'Nhập Excel', name: 'Nhập thực đơn từ Excel', close: 'Đóng', validation: 'Thêm file' },
    ]) {
      const trigger=page.getByRole('button',{name:overlay.trigger,exact:true}); await trigger.focus(); await trigger.click();
      const dialog=page.getByRole('dialog',{name:overlay.name}); await expect(dialog).toBeVisible();
      const validationControl=dialog.getByRole('button',{name:overlay.validation,exact:true}); await expect(validationControl).toBeDisabled();
      const metrics=await page.evaluate(()=>{const dialog=document.querySelector<HTMLElement>('[role="dialog"]')!;const active=document.activeElement as HTMLElement|null;const r=dialog.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,Math.min(r.bottom-10,r.top+30));return{activeInside:Boolean(active&&dialog.contains(active)),contained:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),hitOwned:Boolean(hit&&dialog.contains(hit))};});
      expect(metrics).toEqual(expect.objectContaining({activeInside:true,contained:true,overflow:0,hitOwned:true}));
      await page.screenshot({path:resolve(outputRoot,`weekly-${overlay.trigger==='Nhập Excel'?'import':'editor'}-${viewport.name}.png`),fullPage:true});
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
      records.push({viewport,overlay:overlay.name,accessibleName:overlay.name,validationControl:overlay.validation,validationDisabled:true,...metrics,escapeClosed:true,returnFocus:true});
    }
    expect(requests.filter(item=>item.classification==='unexpected-mutation')).toEqual([]);
    await context.close();
  }
  writeFileSync(resolve(outputRoot,'weekly-dialog-results.json'),`${JSON.stringify({generatedAt:new Date().toISOString(),controls:['Kế hoạch tuần','Nhu cầu','Kế hoạch sản xuất','Tổng hợp mua','Chi phí','Định lượng món','Chỉnh sửa thực đơn','Nhập Excel','Xuất bản tuần'],overlays:['Chỉnh sửa thực đơn tuần','Nhập thực đơn từ Excel'],records},null,2)}\n`);
});

test('Approval Rules delete cancel and create edit validation/error states are deterministic', async ({ browser }) => {
  test.setTimeout(120_000); mkdirSync(outputRoot,{recursive:true}); const records:unknown[]=[];
  for(const viewport of [viewports[0],viewports[3]]){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},baseURL:'http://127.0.0.1:5177'});const page=await context.newPage();const mutations:Array<{method:string;path:string;classification:string}>=[];
    page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method()))mutations.push({method:request.method(),path,classification:'expected-error-probe'});});
    await approvalFixture.installApi(page,'populated');await page.route('**/api/system-operation-mode',systemMode);await approvalFixture.login(page);
    const deleteTrigger=page.getByRole('button',{name:'Xóa',exact:true}).first();await deleteTrigger.focus();await deleteTrigger.click();const confirm=page.getByRole('dialog',{name:'Xóa quy tắc duyệt?'});await expect(confirm).toBeVisible();
    const deleteMetrics=await page.evaluate(()=>{const d=document.querySelector<HTMLElement>('[role="dialog"]')!;const a=document.activeElement as HTMLElement|null;const r=d.getBoundingClientRect();return{activeInside:Boolean(a&&d.contains(a)),contained:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),hitOwned:Boolean(document.elementFromPoint(r.left+r.width/2,r.top+30)?.closest('[role="dialog"]'))};});
    expect(deleteMetrics).toEqual(expect.objectContaining({activeInside:true,contained:true,overflow:0,hitOwned:true}));await page.getByRole('button',{name:'Hủy',exact:true}).click();await expect(confirm).toBeHidden();expect(mutations).toEqual([]);
    for(const kind of ['create','edit'] as const){const trigger=kind==='create'?page.getByRole('button',{name:'Thêm quy tắc'}):page.getByRole('button',{name:'Sửa',exact:true}).first();await trigger.click();const dialog=page.getByRole('dialog',{name:kind==='create'?'Tạo quy tắc duyệt mới':'Cập nhật quy tắc duyệt'});const name=dialog.locator('#approval-rule-name');await name.fill('');await dialog.getByRole('button',{name:'Lưu cấu hình'}).click();await expect(name).toHaveAttribute('aria-invalid','true');await expect(dialog.locator('#approval-rule-name-error')).toBeVisible();expect(mutations).toEqual([]);await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();records.push({viewport,kind,validation:'blank-name',ariaInvalid:true,zeroMutation:true});}
    await page.route('**/api/approval-rules',route=>['POST','PUT'].includes(route.request().method())?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,message:'Lỗi lưu quy tắc Phase 31'})}):route.fallback());
    const errorTrigger=page.getByRole('button',{name:'Thêm quy tắc'});await errorTrigger.click();const errorDialog=page.getByRole('dialog',{name:'Tạo quy tắc duyệt mới'});await errorDialog.locator('#approval-rule-name').fill('Quy tắc lỗi có kiểm soát');await errorDialog.getByRole('button',{name:'Lưu cấu hình'}).click();await expect(errorDialog.getByRole('alert')).toContainText('Chưa thể lưu quy tắc');expect(mutations.slice(-1)).toEqual([{method:'POST',path:'/api/approval-rules',classification:'expected-error-probe'}]);await page.keyboard.press('Escape');await expect(errorDialog).toBeHidden();await expect(errorTrigger).toBeFocused();
    await context.close();records.push({viewport,kind:'delete-cancel',accessibleName:'Xóa quy tắc duyệt?',...deleteMetrics,zeroMutation:true},{viewport,kind:'create-save-error',accessibleName:'Tạo quy tắc duyệt mới',expectedMutation:'POST /api/approval-rules',errorAlert:true,escapeClosed:true,returnFocus:true});
  }
  writeFileSync(resolve(outputRoot,'approval-complete-results.json'),`${JSON.stringify({generatedAt:new Date().toISOString(),records},null,2)}\n`);
});
