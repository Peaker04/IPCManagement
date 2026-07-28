import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const viewports = [
  { name: 's-390', width: 390, height: 844 },
  { name: 'm-768', width: 768, height: 1024 },
  { name: 'l-1280', width: 1280, height: 900 },
  { name: 'xl-1440', width: 1440, height: 900 },
] as const;

const chevron = (direction: 'left' | 'right') => `
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}"></path>
  </svg>
`;

const paginator = ({
  label,
  page,
  previousDisabled = false,
  nextDisabled = false,
  state,
  withTools = false,
  pending = false,
}: {
  label: string;
  page: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  state: string;
  withTools?: boolean;
  pending?: boolean;
}) => `
  <nav class="ipc-pagination-bar${pending ? ' is-pending' : ''}" aria-label="${label}" data-state="${state}" ${pending ? 'aria-busy="true"' : ''}>
    <div class="ipc-pagination-range">${label}</div>
    ${withTools ? '<div class="ipc-pagination-tools"><label class="ipc-pagination-size"><span>Số dòng</span><select aria-label="Số dòng mỗi trang"><option>20</option><option>50</option><option>100</option></select></label>' : ''}
      <div class="ipc-pagination-actions">
        <button type="button" class="ipc-pagination-button" aria-label="Trang trước" ${pending || previousDisabled ? 'disabled' : ''}>${chevron('left')}</button>
        <span class="ipc-pagination-page" aria-live="polite">${pending ? '<svg class="ipc-pagination-spinner" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="18 10"></circle></svg>' : ''}${page}</span>
        <button type="button" class="ipc-pagination-button" aria-label="Trang sau" ${pending || nextDisabled ? 'disabled' : ''}>${chevron('right')}</button>
      </div>
      ${withTools ? '<form class="ipc-pagination-jump"><input type="number" value="4" aria-label="Đi đến trang"><button type="button">Đi</button></form></div>' : ''}
    ${pending ? `<span class="sr-only" role="status">Đang tải ${page.toLowerCase()}</span>` : ''}
  </nav>
`;

const auditMarkup = `
  <main class="ipc-pagination-audit">
    <header class="ipc-pagination-audit-header">
      <p>IPC MANAGEMENT · SAP FIORI WEB DENSITY</p>
      <h1>Ma trận kiểm thử phân trang</h1>
      <span>Numbered · Cursor · Grouped stepper</span>
    </header>

    <section class="ipc-pagination-audit-section" aria-labelledby="numbered-title">
      <div class="ipc-pagination-audit-title"><h2 id="numbered-title">Danh sách có tổng số trang</h2><span>Local / server page-number</span></div>
      <div class="ipc-pagination-audit-table" aria-hidden="true"><span>Mã chứng từ</span><span>Nguyên liệu</span><span>Trạng thái</span></div>
      <div class="ipc-pagination-audit-states">
        ${paginator({ label: 'Đang xem 1–20 trên tổng 145 nguyên liệu', page: 'Trang 1/8', previousDisabled: true, state: 'numbered-first', withTools: true })}
        ${paginator({ label: 'Đang xem 61–80 trên tổng 145 nguyên liệu', page: 'Trang 4/8', state: 'numbered-middle-focus', withTools: true })}
        ${paginator({ label: 'Đang xem 141–145 trên tổng 145 nguyên liệu', page: 'Trang 8/8', nextDisabled: true, state: 'numbered-last', withTools: true })}
      </div>
    </section>

    <section class="ipc-pagination-audit-section" aria-labelledby="cursor-title">
      <div class="ipc-pagination-audit-title"><h2 id="cursor-title">Dữ liệu tiếp nối</h2><span>Cursor, không giả lập tổng số trang</span></div>
      <div class="ipc-pagination-audit-table" aria-hidden="true"><span>Thời điểm</span><span>Biến động kho</span><span>Phụ trách</span></div>
      <div class="ipc-pagination-audit-states">
        ${paginator({ label: 'Dữ liệu tiếp nối', page: 'Trang 1', previousDisabled: true, state: 'cursor-first' })}
        ${paginator({ label: 'Dữ liệu tiếp nối', page: 'Trang 3', state: 'cursor-middle', pending: true })}
        ${paginator({ label: 'Đã tải hết dữ liệu', page: 'Trang 6', nextDisabled: true, state: 'cursor-terminal' })}
      </div>
    </section>

    <section class="ipc-pagination-audit-section" aria-labelledby="stepper-title">
      <div class="ipc-pagination-audit-title"><h2 id="stepper-title">Nhóm kế hoạch sản xuất</h2><span>Grouped-page stepper</span></div>
      <div class="ipc-pagination-audit-table" aria-hidden="true"><span>Ngày phục vụ</span><span>Ca sản xuất</span><span>Kế hoạch</span></div>
      <div class="ipc-pagination-audit-states">
        ${paginator({ label: 'Kế hoạch sản xuất', page: 'Nhóm 1/5', previousDisabled: true, state: 'stepper-first' })}
        ${paginator({ label: 'Kế hoạch sản xuất', page: 'Nhóm 3/5', state: 'stepper-middle' })}
        ${paginator({ label: 'Kế hoạch sản xuất', page: 'Nhóm 5/5', nextDisabled: true, state: 'stepper-last' })}
      </div>
    </section>
  </main>
`;

const auditCss = `
  body { margin: 0; background: var(--ipc-slate-100, #f1f5f9); }
  .ipc-pagination-audit { display: grid; gap: 24px; width: min(100%, 1180px); margin: 0 auto; padding: 24px; }
  .ipc-pagination-audit-header { display: grid; gap: 4px; }
  .ipc-pagination-audit-header p, .ipc-pagination-audit-header span { margin: 0; color: var(--ipc-slate-600); font-size: 12px; }
  .ipc-pagination-audit-header h1 { margin: 0; color: var(--ipc-slate-900); font-size: 20px; font-weight: 600; }
  .ipc-pagination-audit-section { display: grid; gap: 8px; min-width: 0; }
  .ipc-pagination-audit-title { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .ipc-pagination-audit-title h2 { margin: 0; color: var(--ipc-slate-900); font-size: 14px; font-weight: 600; }
  .ipc-pagination-audit-title span { color: var(--ipc-slate-600); font-size: 12px; }
  .ipc-pagination-audit-table { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--ipc-border, #d8e2ef); border-radius: var(--ipc-radius-lg); background: var(--ipc-slate-100); color: var(--ipc-slate-600); font-size: 12px; padding: 8px 16px; }
  .ipc-pagination-audit-states { display: grid; gap: 8px; }
  @media (max-width: 599px) {
    .ipc-pagination-audit { gap: 24px; padding: 16px; }
    .ipc-pagination-audit-title { align-items: flex-start; flex-direction: column; gap: 4px; }
  }
`;

for (const viewport of viewports) {
  test(`pagination visual contract ${viewport.name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')).toHaveCount(0);
    await page.evaluate((markup) => { document.body.innerHTML = markup; }, auditMarkup);
    await page.addStyleTag({ content: auditCss });
    await page.locator('[data-state="numbered-middle-focus"] .ipc-pagination-button:last-child').focus();

    const stage = process.env.PAGINATION_AUDIT_STAGE;
    if (stage) {
      const outputDir = resolve(process.cwd(), '..', '.planning', 'ui-reviews', 'pagination', stage);
      mkdirSync(outputDir, { recursive: true });
      await page.screenshot({ path: resolve(outputDir, `${viewport.name}.png`), fullPage: true });
    } else {
      await expect(page).toHaveScreenshot(`pagination-${viewport.name}.png`, { fullPage: true });
    }

    const buttons = page.locator('.ipc-pagination-button');
    const minimumTarget = viewport.width <= 599 ? 44 : 36;
    for (let index = 0; index < await buttons.count(); index += 1) {
      const box = await buttons.nth(index).boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(minimumTarget);
      expect(box?.height).toBeGreaterThanOrEqual(minimumTarget);
    }

    const auxiliaryControls = page.locator('.ipc-pagination-size select, .ipc-pagination-jump input, .ipc-pagination-jump button');
    for (let index = 0; index < await auxiliaryControls.count(); index += 1) {
      const box = await auxiliaryControls.nth(index).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(minimumTarget);
    }

    const style = await page.locator('.ipc-pagination-bar').first().evaluate((element) => {
      const computed = getComputedStyle(element);
      return { fontSize: computed.fontSize, fontWeight: computed.fontWeight };
    });
    expect(style).toEqual({ fontSize: '14px', fontWeight: '400' });
    expect(consoleErrors).toEqual([]);
  });
}
