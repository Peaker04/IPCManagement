import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../api/client';
import { MrxSupplementalFulfillmentForm } from '../features/warehouse/MrxSupplementalFulfillmentForm';
import type { MrxSupplementalFulfillment, MrxSupplementalDemand } from '../api/mrxApi';

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiClient: vi.fn() }));
const batchId = '20000000-0000-0000-0000-000000000001';
const demandId = '30000000-0000-0000-0000-000000000001';
const balance: MrxSupplementalFulfillment = { batchId, serviceDate: '2026-11-30', pendingDemandCount: 0,
  lines: [{ dailyLineId: 'dl-1', ingredientId: 'i-1', canonicalUnitId: 'u-1', baselineRequiredQuantity: 8.77503,
    baselineIssuedQuantity: 2, baselineRemainingQuantity: 6.77503, netIssuedQuantity: 7,
    unplannedIssuedQuantity: 5, unallocatedIssuedQuantity: 0, hasIncompleteAllocation: false, hasAmbiguousReturn: false, isDemandFulfilled: false,
    extraDemands: [{ demandId, demandMaterialId: 'dm-1', requiredQuantity: 3, issuedQuantity: 1, remainingQuantity: 2 }] }] };
const approved: MrxSupplementalDemand = { demandId, batchId, serviceDate: '2026-11-30', batchVersion: 3, status: 'APPROVED', version: 3,
  reason: 'Khách tăng suất', snapshotFingerprint: 'FROZEN', createdBy: demandId, createdAt: '2026-11-16T07:00:00Z', dishes: [],
  materials: [{ demandMaterialId: 'dm-1', dailyLineId: 'dl-1', ingredientId: 'i-1', canonicalUnitId: 'u-1', requiredQuantity: 3 }] };
let response = balance;
beforeEach(() => {
  localStorage.clear();
  response = balance;
  vi.mocked(apiClient).mockImplementation(async url => {
    if (url.includes('/fulfillment?')) return response as never;
    if (url.endsWith(demandId)) return approved as never;
    throw new Error(`Unconfigured API ${url}`);
  });
});
it('requires explicit restoration of an actual draft after remount and clears it only after acknowledgment', async () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const key = 'ipc_draft_actor_mrx_supplemental_actual_batch_day';
  const view = () => <MrxSupplementalFulfillmentForm batchId={batchId} serviceDate="2026-11-30" draftKey={key}
    materialLabels={[{ dailyLineId: 'dl-1', ingredientName: 'Bầu', canonicalUnitName: 'Kilogram' }]}
    busy={false} outcomeUnknown={false} onSubmit={onSubmit} />;
  const first = render(view());
  await userEvent.type(await screen.findByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' }), '2');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' }), 'Bù phần thiếu');
  first.unmount();
  render(view());
  await userEvent.click(await screen.findByRole('button', { name: 'Khôi phục nháp xuất bổ sung' }));
  expect(screen.getByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' })).toHaveValue(2);
  expect(onSubmit).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' }));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
});
function open() {
  const onSubmit = vi.fn();
  render(<MrxSupplementalFulfillmentForm batchId={batchId} serviceDate="2026-11-30"
    materialLabels={[{ dailyLineId: 'dl-1', ingredientName: 'Bầu', canonicalUnitName: 'Kilogram' }]}
    busy={false} outcomeUnknown={false} onSubmit={onSubmit} />);
  return onSubmit;
}
it('shows the real baseline shortage despite unplanned issued amounts and submits only the selected purpose', async () => {
  const submit = open();
  expect(await screen.findByText('6,77503')).toBeInTheDocument();
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' }), '2');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' }), 'Bù phần thiếu');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' }));
  expect(submit).toHaveBeenCalledWith([{ dailyLineId: 'dl-1', quantity: 2, reason: 'Bù phần thiếu',
    allocations: [{ purpose: 'BASELINE_SHORTAGE', quantity: 2 }] }]);
});
it('requires the exact approved demand version and material when issuing additional servings', async () => {
  const submit = open();
  await screen.findByText('6,77503');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mục đích xuất bổ sung' }), demandId);
  const quantity = await screen.findByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' });
  await userEvent.type(quantity, '2');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do xuất bổ sung' }), 'Cấp nhu cầu đã duyệt');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' }));
  expect(submit).toHaveBeenCalledWith([{ dailyLineId: 'dl-1', quantity: 2, reason: 'Cấp nhu cầu đã duyệt',
    allocations: [{ purpose: 'APPROVED_EXTRA_DEMAND', quantity: 2, demandMaterialId: 'dm-1', expectedDemandVersion: 3 }] }]);
});
it('does not guess remaining shortage when legacy allocations are incomplete', async () => {
  response = { ...balance, lines: [{ ...balance.lines[0], hasIncompleteAllocation: true, baselineRemainingQuantity: null }] };
  open();
  expect(await screen.findByText(/Chưa đủ bằng chứng phân bổ/)).toBeInTheDocument();
  expect(screen.queryByRole('spinbutton', { name: 'Lượng xuất bổ sung Bầu' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xác nhận xuất bổ sung' })).toBeDisabled();
});
