import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { apiClient } from '../api/client';
import { MrxHistoricalPurposeModal } from '../features/warehouse/MrxHistoricalPurposeModal';

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiClient: vi.fn() }));
const batchId = 'b2ae14d2-b894-4c7f-ab6f-d1dda84f6541';
const issueLineId = '36427243-e92b-4a1e-ad7a-f944fa648a10';
const date = '2026-11-30';
const candidate = { issueLineId, issueCode: 'ISS-MRX-1', ingredientName: 'Bầu', unitName: 'kg',
  unallocatedQuantity: 2.25, returnedQuantity: 0, demands: [], batchVersion: 4 };

it('requires complete allocation and recovers the same MRX command after remount', async () => {
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  localStorage.setItem('ipc_v3_mode_version', '1');
  const actor = JSON.parse(localStorage.getItem('ipc_v3_user')!);
  localStorage.setItem('ipc_v3_user', JSON.stringify({ ...actor, roleCode: 'WAREHOUSE', isAdminFullAccess: false }));
  const commands: string[] = [];
  vi.mocked(apiClient).mockImplementation(async (url, init) => {
    if (url === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', version: 1, capabilities: { navigation: [], pageTabs: {} } } as never;
    if (url.includes('/historical-purpose/batches/')) return [candidate] as never;
    if (url === '/reconciliation/historical-purpose' && init?.method === 'POST') {
      const body = String(init.body);
      commands.push(body);
      if (commands.length === 1) throw new TypeError('Phản hồi bị gián đoạn');
      return { ...JSON.parse(body), proposalId: JSON.parse(body).commandId, status: 'PENDING',
        issueCode: candidate.issueCode, ingredientName: candidate.ingredientName } as never;
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const open = () => render(<MemoryRouter><AuthProvider><MrxHistoricalPurposeModal batchId={batchId} date={date}
    onClose={() => {}} /></AuthProvider></MemoryRouter>);
  const view = open();
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Dòng phiếu xuất' }), issueLineId);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mục đích 1' }), 'BASELINE_SHORTAGE');
  await userEvent.type(screen.getByRole('textbox', { name: 'Căn cứ phân bổ' }), 'Theo phiếu gốc');
  const submit = screen.getByRole('button', { name: 'Gửi đề xuất phân bổ' });
  await userEvent.type(screen.getByRole('textbox', { name: 'Lượng phân bổ 1' }), '2');
  expect(submit).toBeDisabled();
  await userEvent.type(screen.getByRole('textbox', { name: 'Lượng phân bổ 1' }), ',25');
  await userEvent.click(submit);
  await screen.findByText('Chưa xác định kết quả phân bổ');
  view.unmount();
  open();
  await userEvent.click(await screen.findByRole('button', { name: 'Kiểm tra lệnh đã gửi' }));
  await screen.findByText('Đã gửi đề xuất phân bổ');
  expect(commands).toHaveLength(2);
  expect(commands[0]).toBe(commands[1]);
  expect(JSON.parse(commands[0])).toMatchObject({ batchId, serviceDate: date, issueLineId, expectedBatchVersion: 4,
    reason: 'Theo phiếu gốc', allocations: [{ purpose: 'BASELINE_SHORTAGE', quantity: 2.25 }] });
});
