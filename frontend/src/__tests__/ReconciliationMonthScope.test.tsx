import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { MOCK_RECONCILIATION_BATCH_DTO } from '../test/fixtures';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

const customers = [
  { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
  { customerId: 'customer-2', customerCode: 'ANV', customerName: 'AMANN' },
];
function batch(id: string, week = '2026-09-21', customer = customers[0]) {
  const lines = MOCK_RECONCILIATION_BATCH_DTO.lines.map(line => ({ ...line, serviceDate: week, ingredientName: `Nguyên liệu ${id}` }));
  return { ...MOCK_RECONCILIATION_BATCH_DTO, batchId: id, customerId: customer.customerId, customerCode: customer.customerCode,
    customerName: customer.customerName, weekStartDate: week, weekEndDate: week, quantityImportBatchId: `import-${id}`,
    lines, dailyReview: { ...MOCK_RECONCILIATION_BATCH_DTO.dailyReview!, lines } };
}
type Batch = ReturnType<typeof batch>;
const page = (items: Batch[], number: number, size: number) => ({ items: items.slice((number - 1) * size, number * size), totalCount: items.length,
  pageNumber: number, pageSize: size, totalPages: Math.ceil(items.length / size), hasPrev: number > 1, hasNext: number * size < items.length });
function Location() { return <output aria-label="Địa chỉ đối soát">{useLocation().search}</output>; }
function open(url = '/reconciliation?customerId=customer-1&date=2026-09-21') {
  const router = createMemoryRouter([{ path: '/reconciliation', element: <><ReconciliationPage /><Location /></> }], { initialEntries: [url] });
  return { ...render(<AuthProvider><RouterProvider router={router} /></AuthProvider>), router };
}
function transport(all: Batch[], extra?: (url: URL) => Promise<Response> | undefined) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = new URL(String(input), 'http://localhost');
    const custom = extra?.(url); if (custom) return custom;
    let data: unknown;
    if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-09-21', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
    else if (url.pathname.endsWith('/coordination/customers')) data = customers;
    else if (url.pathname.endsWith('/reconciliation/batches')) {
      const rows = all.filter(item => item.customerId === url.searchParams.get('CustomerId') &&
        item.weekStartDate >= (url.searchParams.get('WeekFrom') || '') && item.weekStartDate <= (url.searchParams.get('WeekTo') || '9999-12-31'))
        .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate) || b.createdAt.localeCompare(a.createdAt) || a.batchId.localeCompare(b.batchId));
      data = page(rows, Number(url.searchParams.get('PageNumber') || 1), Number(url.searchParams.get('PageSize') || 100));
    } else if (url.pathname.includes('/reconciliation/batches/')) data = all.find(item => url.pathname.endsWith(`/${item.batchId}`));
    else if (url.pathname.includes('/reports/transactions-history')) data = page([], 1, 25);
    else if (url.pathname.includes('/reports/variance-register')) data = { rows: [], totalCount: 0 };
    else if (url.pathname.includes('/reports/audit-trail')) data = { rows: [], totalCount: 0, pageNumber: 1, pageSize: 50, totalPages: 0 };
    else if (url.pathname.includes('/source-changes')) data = [];
    else throw new Error(`Unexpected month-scope request: ${url.pathname}`);
    if (data === undefined) throw new Error(`Unknown batch: ${url.pathname}`);
    return Response.json({ success: true, data });
  });
}
async function chooseMonth(month: string, year = '2026') {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Năm đối soát' }), year);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tháng đối soát' }), month);
}

describe('Reconciliation business-month scope', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-21T08:00:00Z'));
    serverStateCache.clearAll(); workspaceSessionStore.clearScope();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  });

  it('opens history beyond100 using server business-month bounds and a five-row query', async () => {
    const fetch = transport([...Array.from({ length: 100 }, (_, i) => batch(`recent-${i}`)), batch('old', '2020-01-06')]);
    open('/reconciliation?customerId=customer-1&date=2020-01-06');
    expect(await screen.findByText('Nguyên liệu old')).toBeVisible();
    const queries = fetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost')).filter(url => url.pathname.endsWith('/batches'));
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every(url => url.searchParams.get('WeekFrom') === '2020-01-01' && url.searchParams.get('WeekTo') === '2020-01-31' && url.searchParams.get('PageSize') === '5')).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Tuần đối soát' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Ngày đối soát' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tuần bắt đầu')).not.toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).getByRole('option', { name: 'DAV · 06/01/2020' })).toHaveValue('old');
    const days = screen.getByRole('group', { name: 'Ngày đối soát' });
    const blocker = screen.getByText(/(?:Chưa thể chốt đối soát|Sẵn sàng chốt đối soát):/).closest('[role="status"]')!;
    expect(blocker.compareDocumentPosition(days) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(days.compareDocumentPosition(screen.getByRole('button', { name: /Tất cả \(/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not substitute a cached batch from another month when the month is empty', async () => {
    serverStateCache.set('mrx_batches_customer-1', [batch('wrong')]);
    transport([batch('wrong')]); open('/reconciliation?customerId=customer-1&month=2026-10');
    expect(await screen.findByRole('heading', { name: /Chưa có lô đối soát.*tháng/ })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');
    expect(screen.queryByText('Nguyên liệu wrong')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát tuần' })).not.toBeInTheDocument();
  });

  it.each([500, 403])('does not present a catalogue HTTP%s as an empty month and retries the real query', async status => {
    let fail = true;
    transport([batch('recovered')], url => url.pathname.endsWith('/batches') && fail
      ? Promise.resolve(Response.json({ success: false, message: 'Không tải được danh sách lô.' }, { status })) : undefined);
    open();
    expect(await screen.findByText(status === 403 ? 'Truy cập bị hạn chế' : 'Không thể tải dữ liệu')).toBeVisible();
    expect(screen.queryByRole('heading', { name: /Chưa có lô đối soát/ })).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Nguyên liệu recovered')).toBeVisible();
  });

  it('does not let a remembered other-customer batch override an explicit customer/month URL', async () => {
    transport([batch('remembered')]);
    serverStateCache.set('snapshot:mrx_reconciliation', { customerCode: 'DAV', batchId: 'remembered', serviceDate: '2026-09-21', data: null });
    workspaceSessionStore.setScope({ customerCode: 'DAV', batchId: 'remembered', serviceDate: '2026-09-21' });
    open('/reconciliation?customerId=customer-2&date=2026-09-21');
    expect(await screen.findByRole('heading', { name: /Chưa có lô đối soát.*tháng/ })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('ANV');
    expect(screen.queryByText('Nguyên liệu remembered')).not.toBeInTheDocument();
  });

  it('opens the latest MRX session batch instead of an older page snapshot on a menu route', async () => {
    const older = batch('older', '2026-09-21');
    const latest = batch('latest', '2020-01-06');
    transport([older, latest, ...Array.from({ length: 6 }, (_, index) => batch(`recent-${index}`, '2020-01-20'))]);
    serverStateCache.set('snapshot:mrx_reconciliation', { customerCode: 'DAV', batchId: older.batchId, serviceDate: older.weekStartDate, data: null });
    workspaceSessionStore.setScope({ customerId: latest.customerId, customerCode: latest.customerCode, customerName: latest.customerName,
      batchId: latest.batchId, serviceDate: latest.weekStartDate, weekStartDate: latest.weekStartDate });
    open('/reconciliation');
    expect(await screen.findByText('Nguyên liệu latest')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue('latest');
    expect(screen.getByRole('combobox', { name: 'Năm đối soát' })).toHaveValue('2020');
    expect(screen.queryByText('Nguyên liệu older')).not.toBeInTheDocument();
    expect(screen.queryByText('Nguyên liệu recent-0')).not.toBeInTheDocument();
  });

  it('keeps the settled table during a year change without showing a transient loading badge', async () => {
    const current = batch('current');
    const older = batch('older', '2020-09-21');
    let release!: (response: Response) => void;
    transport([current, older], url => url.pathname.endsWith('/batches') && url.searchParams.get('WeekFrom') === '2020-09-01'
      ? new Promise(resolve => { release = resolve; }) : undefined);
    open();
    expect(await screen.findByText('Nguyên liệu current')).toBeVisible();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Năm đối soát' }), '2020');
    await waitFor(() => expect(release).toBeTypeOf('function'));
    expect(screen.getByText('Nguyên liệu current')).toBeVisible();
    expect(screen.getByText('Đang tải phạm vi mới')).toHaveClass('sr-only');
    expect(screen.queryByRole('heading', { name: /Chưa có lô đối soát/ })).not.toBeInTheDocument();
    await act(async () => release(Response.json({ success: true, data: page([older], 1, 5) })));
    expect(await screen.findByText('Nguyên liệu older')).toBeVisible();
    expect(screen.queryByText('Nguyên liệu current')).not.toBeInTheDocument();
  });

  it('keeps transaction rows in place while the next year and report resolve', async () => {
    const current = batch('current');
    const older = batch('older', '2020-09-21');
    let releaseCatalog!: (response: Response) => void;
    let releaseReport!: (response: Response) => void;
    transport([current, older], url => {
      if (url.pathname.endsWith('/batches') && url.searchParams.get('WeekFrom') === '2020-09-01') {
        return new Promise(resolve => { releaseCatalog = resolve; });
      }
      if (url.pathname.endsWith('/reports/transactions-history')) {
        const id = url.searchParams.get('batchId');
        const report = { items: [{ transactionType: 'INITIAL_ISSUE', documentCode: id === 'older' ? 'PX-OLD' : 'PX-CURRENT',
          date: '2026-09-21', batchId: id, customerName: 'Draxlmaier', ingredientCode: 'NL-01', ingredientName: 'Gạo',
          unitName: 'kg', quantity: 1, actorName: 'Thủ kho', createdAt: '2026-09-21T05:00:00Z', reason: null }],
          totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false };
        return id === 'older' ? new Promise(resolve => { releaseReport = resolve; })
          : Promise.resolve(Response.json({ success: true, data: report }));
      }
      return undefined;
    });
    open('/reconciliation?view=transactions&customerId=customer-1&date=2026-09-21');
    expect(await screen.findByText('PX-CURRENT')).toBeVisible();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Năm đối soát' }), '2020');
    await waitFor(() => expect(releaseCatalog).toBeTypeOf('function'));
    expect(screen.getByText('PX-CURRENT')).toBeVisible();
    await act(async () => releaseCatalog(Response.json({ success: true, data: page([older], 1, 5) })));
    await waitFor(() => expect(releaseReport).toBeTypeOf('function'));
    expect(screen.getByText('PX-CURRENT')).toBeVisible();
    await act(async () => releaseReport(Response.json({ success: true, data: {
      items: [{ transactionType: 'INITIAL_ISSUE', documentCode: 'PX-OLD', date: '2020-09-21', batchId: 'older',
        customerName: 'Draxlmaier', ingredientCode: 'NL-01', ingredientName: 'Gạo', unitName: 'kg', quantity: 1,
        actorName: 'Thủ kho', createdAt: '2020-09-21T05:00:00Z', reason: null }],
      totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
    } })));
    expect(await screen.findByText('PX-OLD')).toBeVisible();
    expect(screen.queryByText('PX-CURRENT')).not.toBeInTheDocument();
  });

  it('offers five batches only, reaches match101, and cancels paging without changing scope', async () => {
    transport(Array.from({ length: 101 }, (_, i) => batch(`choice-${String(i + 1).padStart(3, '0')}`)));
    open(); expect(await screen.findByText('Nguyên liệu choice-001')).toBeVisible();
    const select = screen.getByRole('combobox', { name: 'Chọn lô đối soát' });
    expect(within(select).getAllByRole('option').filter(option => !(option as HTMLOptionElement).disabled && option.getAttribute('value') !== '__all__')).toHaveLength(5);
    await userEvent.selectOptions(select, '__all__');
    const dialog = screen.getByRole('dialog', { name: 'Danh sách lô trong tháng' });
    const pager = within(dialog).getByRole('navigation', { name: 'Phân trang lô trong tháng' });
    for (let i = 0; i < 4; i++) {
      await waitFor(() => expect(within(pager).getByRole('button', { name: 'Trang sau' })).toBeEnabled());
      await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
      await waitFor(() => expect(pager).toHaveTextContent(`Trang ${i + 2}/5`));
    }
    expect(await within(dialog).findByText('choice-101')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }));
    expect(screen.getByText('Nguyên liệu choice-001')).toBeVisible();
    await userEvent.selectOptions(select, '__all__');
    const reopened = screen.getByRole('dialog', { name: 'Danh sách lô trong tháng' });
    const reopenedPager = within(reopened).getByRole('navigation', { name: 'Phân trang lô trong tháng' });
    for (let i = 0; i < 4; i++) {
      await waitFor(() => expect(within(reopenedPager).getByRole('button', { name: 'Trang sau' })).toBeEnabled());
      await userEvent.click(within(reopenedPager).getByRole('button', { name: 'Trang sau' }));
      await waitFor(() => expect(reopenedPager).toHaveTextContent(`Trang ${i + 2}/5`));
    }
    await userEvent.click(await within(reopened).findByRole('button', { name: 'Xem lô choice-101' }));
    expect(await screen.findByText('Nguyên liệu choice-101')).toBeVisible();
    expect(select).toHaveValue('choice-101');
    expect(within(select).getAllByRole('option').filter(option => !(option as HTMLOptionElement).disabled && option.getAttribute('value') !== '__all__')).toHaveLength(5);
  });

  it('keeps a crossing-week December day in November scope and restores month through history', async () => {
    const fetch = transport([batch('crossing', '2026-11-30'), batch('december', '2026-12-07')]);
    const { router } = open('/reconciliation?customerId=customer-1&date=2026-11-30');
    await screen.findByText('Nguyên liệu crossing');
    await userEvent.click(screen.getByRole('button', { name: 'T3 · 01/12/2026' }));
    expect(screen.getByLabelText('Địa chỉ đối soát')).toHaveTextContent('date=2026-12-01');
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('11');
    expect(screen.getByRole('button', { name: 'T3 · 01/12/2026' })).toHaveAttribute('aria-pressed', 'true');
    await chooseMonth('12'); expect(await screen.findByText('Nguyên liệu december')).toBeVisible();
    await act(async () => { await router.navigate(-1); });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('11'));
    expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue('crossing');
    expect(fetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost')).some(url => url.searchParams.get('WeekFrom') === '2026-11-01' && url.searchParams.get('WeekTo') === '2026-11-30')).toBe(true);
  });

  it.each(['batch', 'customer'] as const)('keeps the shell and resets batch-local drafts only when a new %s resolves', async scope => {
    const a = { ...batch('a'), status: 'COMPLETED' };
    const b = { ...batch('b', '2026-09-21', scope === 'customer' ? customers[1] : customers[0]), status: 'DRAFT' };
    let resolve!: (value: Response) => void;
    transport([a, b], url => url.pathname.endsWith('/batches/b') ? new Promise(done => { resolve = done; }) : undefined);
    open();
    await screen.findByText('Nguyên liệu a');
    const search = screen.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' });
    await userEvent.click(search);
    const input = screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' });
    await userEvent.type(input, 'Nguyên liệu a');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toBeEnabled());
    if (scope === 'customer') await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'ANV');
    else await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn lô đối soát' }), 'b');
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).toBe(input);
    expect(input).toHaveValue('Nguyên liệu a');
    expect(screen.getByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' }).querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.queryByText('Lô đối soát tuần đã hoàn tất và đóng băng số liệu.')).not.toBeInTheDocument();
    await act(async () => resolve(Response.json({ success: true, data: b })));
    expect(await screen.findByText('Nguyên liệu b')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' })).toBe(search);
    expect(within(screen.getByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).getByText('Chuẩn bị').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps the same search and status controls across a raw-empty day and back', async () => {
    transport([batch('continuity')]);
    open();
    await screen.findByText('Nguyên liệu continuity');
    const searchToggle = screen.getByRole('button', { name: 'Mở tìm kiếm nguyên liệu' });
    const all = screen.getByRole('button', { name: /Tất cả \(/ });
    await userEvent.click(searchToggle);
    await userEvent.type(screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' }), 'continuity');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm nguyên liệu' }));
    await userEvent.click(screen.getByRole('button', { name: 'T3 · 22/09/2026' }));
    await screen.findByRole('heading', { name: 'Chưa có dữ liệu rà soát dòng ngày' });
    expect(screen.getByRole('button', { name: 'Tìm kiếm nguyên liệu đang lọc' })).toBe(searchToggle);
    expect(screen.getByRole('button', { name: 'Tất cả (0)' })).toBe(all);
    expect(screen.getAllByRole('group', { name: 'Ngày đối soát' })).toHaveLength(1);
    await userEvent.click(searchToggle);
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm nguyên liệu đối soát' })).toHaveValue('continuity');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm nguyên liệu' }));
    await userEvent.click(screen.getByRole('button', { name: 'T2 · 21/09/2026' }));
    expect(await screen.findByText('Nguyên liệu continuity')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tìm kiếm nguyên liệu đang lọc' })).toBe(searchToggle);
    expect(screen.getByRole('button', { name: /Tất cả \(/ })).toBe(all);
  });

  it('queries leap February and retains month when changing customer', async () => {
    const fetch = transport([batch('leap', '2024-02-26'), batch('other', '2024-02-19', customers[1])]);
    open('/reconciliation?customerId=customer-1&month=2024-02');
    expect(await screen.findByText('Nguyên liệu leap')).toBeVisible();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'ANV');
    expect(await screen.findByText('Nguyên liệu other')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('2');
    expect(screen.getByRole('combobox', { name: 'Năm đối soát' })).toHaveValue('2024');
    expect(fetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost')).filter(url => url.pathname.endsWith('/batches')).every(url => url.searchParams.get('WeekTo') === '2024-02-29')).toBe(true);
  });

  it.each(['success', 'error'])('ignores a late previous-month %s', async outcome => {
    let settle!: (response: Response) => void;
    transport([batch('initial'), batch('latest', '2026-11-02')], url => url.pathname.endsWith('/batches') && url.searchParams.get('WeekFrom') === '2026-10-01' ? new Promise(resolve => { settle = resolve; }) : undefined);
    open(); await screen.findByText('Nguyên liệu initial');
    await chooseMonth('10'); await waitFor(() => expect(settle).toBeTypeOf('function'));
    await chooseMonth('11'); expect(await screen.findByText('Nguyên liệu latest')).toBeVisible();
    await act(async () => settle(outcome === 'error' ? new Response('late-error', { status: 500 }) : Response.json({ success: true, data: page([batch('late', '2026-10-05')], 1, 5) })));
    expect(screen.getByText('Nguyên liệu latest')).toBeVisible();
    expect(screen.queryByText('Nguyên liệu late')).not.toBeInTheDocument();
  });

  it.each(['lines', 'transactions', 'variances', 'audit'])('resolves an explicit outside-five other-customer link for %s', async view => {
    transport([...Array.from({ length: 5 }, (_, i) => batch(`recent-${i}`, '2020-01-27', customers[1])), batch('linked', '2020-01-06', customers[1])]);
    workspaceSessionStore.setScope({ customerCode: 'DAV', customerId: 'customer-1', serviceDate: '2026-09-21' });
    open(`/reconciliation?batchId=linked&view=${view}`);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('ANV'));
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('1');
      expect(screen.getByRole('combobox', { name: 'Năm đối soát' })).toHaveValue('2020');
    });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Chọn lô đối soát' })).toHaveValue('linked'));
    expect(screen.getByLabelText('Địa chỉ đối soát')).toHaveTextContent('batchId=linked');
  });
});
