import { test, expect } from '@playwright/test';

// Actual Vite source components; every business API is blocked. This verifies UI
// timing/identity, not authenticated production data or operational qualification.
test.beforeEach(async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Component verification: API disabled' }) }));
  page.on('pageerror', error => console.error(`Component probe: ${error.message}`));
  await page.goto('/');
  await page.addScriptTag({ type: 'module', content: `
    import React from '/node_modules/.vite/deps/react.js';
    import DOM from '/node_modules/.vite/deps/react-dom_client.js';
    const clientSource = await (await fetch('/node_modules/.vite/deps/react-dom_client.js')).text();
    const reactDomPath = clientSource.match(/from ["']([^"']*react-dom\\.js[^"']*)["']/)[1];
    const { default: ReactDOM } = await import(reactDomPath);
    const { flushSync } = ReactDOM;
    import { StateBoundary } from '/src/components/workbench/StateBoundary.tsx';
    import { LocalizedBoundary } from '/src/components/workbench/LocalizedBoundary.tsx';
    import { WorkbenchSkeleton } from '/src/components/workbench/WorkbenchSkeleton.tsx';
    import { ReconciliationBlockerStrip } from '/src/features/reconciliation/ReconciliationBlockerStrip.tsx';
    import { MrxBatchDishesModal } from '/src/components/workbench/MrxBatchDishesModal.tsx';
    import { mrxApi } from '/src/api/mrxApi.ts';
    import { WeeklyMenuImportModal } from '/src/features/weekly-menu/WeeklyMenuImportModal.tsx';
    import { weeklyMenuApi } from '/src/api/weeklyMenuApi.ts';
    import { bomApi } from '/src/api/bomApi.ts';
    import { DishBomEditorModal } from '/src/components/workbench/DishBomEditorModal.tsx';
    import { HistoricalScopeFilter } from '/src/components/workbench/HistoricalScopeFilter.tsx';
    import { ReconciliationAuditBranch } from '/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx';
    import { ReconciliationReportTables } from '/src/features/reconciliation/ReconciliationReportTables.tsx';
    import { AppShell } from '/src/components/workbench/AppShell.tsx';
    import { AuthContext } from '/src/store/useAuth.ts';
    import { DirtyNavigationProvider } from '/src/components/workbench/DirtyNavigation.tsx';
    const transformed = await (await fetch('/src/hooks/useHistoricalScope.ts')).text();
    const RR = await import(transformed.match(/from ["']([^"']*react-router-dom[^"']*)["']/)[1]);
    const h = React.createElement;
    const host = document.createElement('div'); host.className = 'fixed inset-0 z-50 flex flex-col bg-white'; document.body.append(host);
    const root = DOM.createRoot(host), ready = h('button', null, 'Ready content');
    const auditProps = { auditReport: { rows: [], totalCount: 0 }, sourceChanges: null };
    window.loadingHost = host;
    window.renderUnmarkedSkeleton = pending => flushSync(() => root.render(h(StateBoundary, { isLoading: pending, customSkeleton: h('div', { 'data-probe-skeleton': true, className: 'h-32 border-b border-slate-200 bg-slate-100' }, 'Unmarked loading decoration') }, ready)));
    window.renderBlocker = pending => root.render(h(ReconciliationBlockerStrip, { isPending: pending, isBlocked: true, needsReviewCount: 2, onFilterNeedsReview: () => {} }));
    window.renderFrozen = () => { mrxApi.getBatchDishes = () => new Promise(() => {}); root.render(h(MrxBatchDishesModal, { isOpen: true, batchId: 'fixture-cold', onClose: () => {} })); };
    window.renderFrozenReady = () => { mrxApi.getBatchDishes = async () => [{ dishId: 'dish-one', dishCode: 'MON-1', dishName: 'Món kiểm tra', scopes: [], materials: [] }]; root.render(h(MrxBatchDishesModal, { isOpen: true, batchId: 'fixture-ready', onClose: () => {} })); };
    window.renderBom = () => {
      bomApi.getSupportedPriceTiers = () => new Promise(resolve => { window.releaseBomTiers = () => resolve([25000, 30000, 34000]); });
      bomApi.getDishBomLines = () => new Promise(resolve => { window.releaseBomLines = () => resolve([]); });
      root.render(h(DishBomEditorModal, { isOpen: true, dish: { dishId: 'fixture-bom', dishCode: 'MON-1', dishName: 'Món kiểm tra' }, readOnly: true, onClose: () => {} }));
    };
    window.renderImportHistory = () => {
      bomApi.getSupportedPriceTiers = async () => [25000];
      const item = { menuVersionId: 'one', customerId: 'fixture', customerCode: 'ERP', customerName: 'Fixture', weekStartDate: '2026-11-09', versionNo: 1, status: 'DRAFT', sourceFileName: 'one.xlsx', createdAt: '2026-11-08T00:00:00Z', successRowCount: 1, errorRowCount: 0, warningRowCount: 0, canRollback: false };
      weeklyMenuApi.getImportHistory = () => new Promise(resolve => { window.releaseImportHistory = () => resolve({ items: [item, { ...item, menuVersionId: 'two', sourceFileName: 'two.xlsx' }], totalCount: 2 }); });
      const snapshot = id => ({ menuVersionId: id, customerId: 'fixture', weekStartDate: '2026-11-09', rows: [{ serviceDate: '2026-11-09', shiftName: 'Sáng', dishSlot: 'MAIN', dishId: id, dishName: 'Source ' + id, sourceOrder: 1 }] });
      weeklyMenuApi.getImportSnapshot = id => new Promise(resolve => { if (id === 'one') window.releaseColdSnapshot = () => resolve(snapshot(id)); else window.releaseImportSnapshot = () => resolve(snapshot(id)); });
      root.render(h(DirtyNavigationProvider, null, h(WeeklyMenuImportModal, { isOpen: true, onClose: () => {}, onImportSuccess: () => {}, customers: [{ customerId: 'fixture', customerCode: 'ERP', customerName: 'Fixture' }], initialCustomerId: 'fixture', initialWeekStartDate: '2026-11-09', currentWeekStartDate: '2026-11-09' })));
    };
    window.renderLoading = (kind, pending) => {
      if (kind === 'history') return root.render(h(RR.MemoryRouter, { initialEntries: ['/?period=YEAR&year=2024'] }, h(HistoricalScopeFilter)));
      if (kind === 'audit') return root.render(h(ReconciliationAuditBranch, { ...auditProps, auditReport: pending ? null : auditProps.auditReport, pending }));
      if (kind === 'report') return root.render(h(ReconciliationReportTables, { activeTab: 'audit', batchId: 'ui-scope', isReportLoading: pending, hasExactReport: true,
        ...auditProps, variancesReport: null, transactionsReport: null, transactionPage: 1, onTransactionPageChange: () => {} }));
      if (kind === 'localized') return root.render(h(LocalizedBoundary, { isLoading: pending }, ready));
      if (kind === 'widget') return root.render(h(StateBoundary, { scope: 'widget', isLoading: pending }, ready));
      const custom = kind === 'custom' ? h('div', null, h('span', { 'data-skeleton-mark': true, className: 'block h-5 w-60 bg-slate-200' }), h(WorkbenchSkeleton, { geometry: { kind: 'table', columns: 5, rows: 8 } })) : undefined;
      root.render(h(StateBoundary, { isLoading: kind !== 'warm' && pending, hasExistingData: kind === 'warm' || !pending, isPreviousData: kind === 'warm' && pending, customSkeleton: custom }, ready));
    };
    const lazyPage = React.lazy(() => new Promise(resolve => { window.releaseLoadingModule = () => resolve({ default: () => h('h1', null, 'Module ready') }); }));
    const auth = { user: { userId: 'ui-fixture', fullName: 'UI verification' }, logout: async () => {}, operationalMode: 'MATERIAL_RECONCILIATION', hasRole: () => true, canNavigate: () => true };
    window.renderLoadingShell = () => root.render(h(AuthContext.Provider, { value: auth }, h(RR.MemoryRouter, { initialEntries: ['/reconciliation?view=audit'] },
      h(DirtyNavigationProvider, null, h(AppShell, { navigation: [] }, h(lazyPage))))));
    window.sampleLoading = async (kind, duration) => {
      window.renderLoading('warm', false); await new Promise(resolve => setTimeout(resolve, 25));
      window.renderLoading(kind, true);
      const frames = [], started = performance.now();
      setTimeout(() => window.renderLoading(kind, false), duration);
      while (performance.now() - started < duration + 60) {
        await new Promise(requestAnimationFrame);
        const marks = [...host.querySelectorAll('[data-skeleton-mark]')].filter(node => getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().height > 0).length;
        const stroke = host.querySelector('.h-0\\\\.5');
        const paintedHeaders = [...host.querySelectorAll('[data-skeleton-header]')].filter(node => getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().height > 0).length;
        frames.push({ time: performance.now() - started, marks, paintedHeaders, strokeOpacity: stroke ? Number(getComputedStyle(stroke).opacity) : 0 });
      }
      return frames;
    };
    window.loadingReady = true;
  ` });
  await page.waitForFunction('window.loadingReady');
});

for (const width of [960, 1920]) {
  test(`shared policy owns unmarked custom paint and resets each read at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const frames = await page.evaluate(async () => {
      const win = window as unknown as { renderUnmarkedSkeleton: (pending: boolean) => void };
      win.renderUnmarkedSkeleton(true);
      await new Promise(resolve => setTimeout(resolve, 180));
      const old = document.querySelector('[data-probe-skeleton]')!;
      if (getComputedStyle(old).visibility !== 'visible') throw new Error('First slow read must paint');
      // Settlement and new read occur in the same task, before any hide timer.
      win.renderUnmarkedSkeleton(false);
      if (!document.querySelector('button')?.textContent?.includes('Ready content') && document.querySelector('[data-probe-skeleton]')) throw new Error('Fixture settlement did not commit: ' + document.querySelector('[data-probe-skeleton]')?.parentElement?.outerHTML);
      win.renderUnmarkedSkeleton(true);
      const result = [], started = performance.now();
      while (performance.now() - started < 200) {
        const element = document.querySelector('[data-probe-skeleton]')!;
        result.push({ time: performance.now() - started, visibility: getComputedStyle(element).visibility, phase: element.closest('[data-loading-phase]')?.getAttribute('data-loading-phase'), height: element.getBoundingClientRect().height });
        await new Promise(requestAnimationFrame);
      }
      win.renderUnmarkedSkeleton(false);
      return result;
    });
    expect(frames.length).toBeGreaterThan(0);
    await info.attach('consecutive-read-paint', { body: JSON.stringify(frames), contentType: 'application/json' });
    expect(frames.filter(frame => frame.time < 145).every(frame => frame.visibility === 'hidden'), JSON.stringify(frames)).toBe(true);
    expect(frames.some(frame => frame.time >= 150 && frame.visibility === 'visible')).toBe(true);
    expect(frames.every(frame => frame.height === 128)).toBe(true);
  });
  test(`BOM cold read reserves controls and frozen dish buttons are independent at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate('window.renderBom()');
    const placeholder = page.getByRole('status', { name: 'Đang tải nội dung' });
    await expect(placeholder).toHaveAttribute('data-loading-phase', 'reserved');
    expect(await placeholder.locator('[data-skeleton-header]').evaluate(node => getComputedStyle(node).visibility)).toBe('hidden');
    const tiers = page.getByRole('radiogroup', { name: 'Mốc giá BOM' });
    const height = await tiers.evaluate(node => node.getBoundingClientRect().height);
    const title = page.getByRole('heading', { name: 'Định mức BOM: Món kiểm tra' });
    const frame = await title.evaluate(node => node.closest('.shadow-xl')!.getBoundingClientRect().toJSON());
    await expect(placeholder).toHaveAttribute('data-loading-phase', 'visible');
    await page.evaluate('window.releaseBomTiers(); window.releaseBomLines()');
    await expect(page.getByText(/Món ăn chưa có BOM/)).toBeVisible();
    expect(await tiers.evaluate(node => node.getBoundingClientRect().height)).toBe(height);
    expect(await title.evaluate(node => node.closest('.shadow-xl')!.getBoundingClientRect().toJSON())).toEqual(frame);
    await page.screenshot({ path: info.outputPath(`bom-ready-${width}.png`) });
    await page.evaluate('window.renderFrozenReady()');
    const select = page.getByRole('button', { name: /Món kiểm tra/ });
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    await expect(select.locator('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sao chép MON-1', exact: true })).toBeVisible();
    await select.focus();
    await page.keyboard.press('Space');
    await expect(select).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: info.outputPath(`frozen-ready-${width}.png`) });
  });
  test(`import source replacement retains table geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate('window.renderImportHistory()');
    await page.getByRole('button', { name: /Lịch sử nhập/ }).click();
    await page.waitForFunction('Boolean(window.releaseImportHistory)');
    await page.evaluate('window.releaseImportHistory()');
    await page.getByRole('button', { name: 'Xem nguồn', exact: true }).first().click();
    const coldSource = page.getByRole('status', { name: 'Đang tải nội dung' });
    await expect(coldSource).toHaveAttribute('data-loading-phase', 'reserved');
    expect(await coldSource.locator('[data-skeleton-header]').evaluate(node => getComputedStyle(node).visibility)).toBe('hidden');
    await page.evaluate('window.releaseColdSnapshot()');
    const row = page.getByText('Source one', { exact: true });
    await expect(row).toBeVisible();
    const before = await row.evaluate(node => { window.__sourceTable = node.closest('table'); return node.closest('table')!.getBoundingClientRect().toJSON(); });
    await page.getByRole('button', { name: 'Xem nguồn', exact: true }).nth(1).click();
    await expect(row).toBeVisible();
    expect(await row.evaluate(node => node.closest('table') === window.__sourceTable)).toBe(true);
    expect(await row.evaluate(node => node.closest('table')!.getBoundingClientRect().toJSON())).toEqual(before);
    await expect(page.getByRole('button', { name: 'Xem nguồn', exact: true }).first()).toBeDisabled();
    await page.evaluate('window.releaseImportSnapshot()');
    await expect(page.getByText('Source two', { exact: true })).toBeVisible();
    await expect(row).toHaveCount(0);
  });
  test(`caller strip and frozen modal preserve loading presentation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate('window.renderBlocker(false)');
    const action = page.getByRole('button', { name: 'Lọc dòng cần xử lý (2)' });
    await expect(action).toBeEnabled();
    const before = await action.evaluate(node => { window.__stripAction = node; const strip = node.closest('[role="status"]')!; const s = getComputedStyle(strip); return { background: s.backgroundColor, border: s.borderBottomColor, height: strip.getBoundingClientRect().height }; });
    await page.evaluate('window.renderBlocker(true)');
    await expect(action).toBeDisabled();
    const after = await action.evaluate(node => { const strip = node.closest('[role="status"]')!; const s = getComputedStyle(strip); return { background: s.backgroundColor, border: s.borderBottomColor, height: strip.getBoundingClientRect().height }; });
    expect(after).toEqual(before);
    expect(await action.evaluate(node => node === window.__stripAction)).toBe(true);
    await page.evaluate('window.renderFrozen()');
    const skeleton = page.getByRole('status', { name: 'Đang tải nội dung' });
    await expect(skeleton).toHaveAttribute('data-loading-phase', 'reserved');
    expect(await skeleton.locator('[data-skeleton-header]').evaluate(node => getComputedStyle(node).visibility)).toBe('hidden');
    await expect(skeleton).toHaveAttribute('data-loading-phase', 'visible');
    expect(await skeleton.locator('[data-skeleton-header]').evaluate(node => getComputedStyle(node).visibility)).toBe('visible');
  });
  test(`cold placeholders at ${width}px reserve geometry without painted marks for fast responses`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    for (const owner of ['cold', 'localized', 'audit', 'custom', 'widget']) for (const duration of [40, 80]) {
      const frames = await page.evaluate<Array<{ time: number; marks: number; paintedHeaders: number }>>(`window.sampleLoading('${owner}', ${duration})`);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every(frame => frame.marks === 0), `${owner}/${duration}`).toBe(true);
      expect(frames.every(frame => frame.paintedHeaders === 0), `${owner}/${duration}: no ghost table-header divider`).toBe(true);
      await info.attach(`${owner}-${duration}`, { body: JSON.stringify(frames), contentType: 'application/json' });
    }
    const slow = await page.evaluate<Array<{ time: number; marks: number }>>('window.sampleLoading("cold", 320)');
    expect(slow.some(frame => frame.marks > 0 && frame.time >= 150)).toBe(true);
    expect(slow.filter(frame => frame.time < 145).every(frame => frame.marks === 0)).toBe(true);
    expect(await page.getByRole('button', { name: 'Ready content' }).isVisible()).toBe(true);
  });

  test(`warm scope and report transitions at ${width}px never paint a progress stroke`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    for (const owner of ['warm', 'report']) for (const duration of [80, 180, 240]) {
      const frames = await page.evaluate<Array<{ strokeOpacity: number; marks: number }>>(`window.sampleLoading('${owner}', ${duration})`);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every(frame => frame.strokeOpacity === 0 && frame.marks === 0)).toBe(true);
      await info.attach(`${owner}-${duration}`, { body: JSON.stringify(frames), contentType: 'application/json' });
    }
  });
}

test('applying a year preserves form and input nodes and the clicked button focus', async ({ page }) => {
  await page.evaluate('window.renderLoading("history", false)');
  const year = page.getByRole('textbox', { name: 'Năm tra cứu' });
  await year.fill('2023');
  const input = await year.elementHandle();
  const form = await year.locator('xpath=ancestor::form').elementHandle();
  const apply = await page.getByRole('button', { name: 'Áp dụng kỳ' }).elementHandle();
  await apply!.click();
  expect(await input!.evaluate(node => node.isConnected)).toBe(true);
  expect(await form!.evaluate(node => node.isConnected)).toBe(true);
  expect(await apply!.evaluate(node => node === document.activeElement)).toBe(true);
});

test('a pending page module has a canonical visible title and no fake business action', async ({ page }) => {
  await page.evaluate('window.renderLoadingShell()');
  await expect(page.getByRole('heading', { name: 'Nhật ký kiểm toán' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Xác nhận xuất kho/ })).toHaveCount(0);
  await page.evaluate('window.releaseLoadingModule()');
  await expect(page.getByRole('heading', { name: 'Module ready' })).toBeVisible();
});
