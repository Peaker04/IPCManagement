import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { apiClient } from '../api/client';
import { MrxSupplementalDemandForm } from '../features/warehouse/MrxSupplementalDemandForm';
import type { MrxSupplementalDemand, MrxSupplementalDishOptions } from '../api/mrxApi';

vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), apiClient: vi.fn() }));
const batchId = '20000000-0000-0000-0000-000000000001';
const dishId = '30000000-0000-0000-0000-000000000001';
const day = '2026-11-30';
const choices: MrxSupplementalDishOptions = { batchId, batchVersion: 2, serviceDate: day, canCreate: true, requiresApproval: true,
  dishes: [{ dishId, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory' }] };
const draft: MrxSupplementalDemand = { demandId: dishId, batchId, serviceDate: day, batchVersion: 2, status: 'DRAFT', version: 1,
  reason: 'Khách tăng suất', snapshotFingerprint: 'FROZEN', createdBy: dishId, createdAt: '2026-11-16T07:00:00Z',
  dishes: [{ demandDishId: dishId, dishId, dishCode: 'DISH-1', dishName: 'Bầu nấu tôm', shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 }],
  materials: [{ demandMaterialId: dishId, dailyLineId: 'daily-1', ingredientId: dishId, canonicalUnitId: dishId, requiredQuantity: 0.000004 }] };
let writes: Array<{ url: string; body: Record<string, unknown> }>;
let failCreate = false;
let wrongScope = false;
let modeVersion = 1;
beforeEach(() => {
  localStorage.clear(); writes = []; failCreate = false; wrongScope = false; modeVersion = 1;
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  localStorage.setItem('ipc_v3_token', 'fixture-only');
  localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: dishId, username: 'warehouse', fullName: 'Thủ kho', roleCode: 'WAREHOUSE', roleName: 'WarehouseStaff',
    isActive: true, isAdminFullAccess: false, permissions: [] }));
  vi.mocked(apiClient).mockImplementation(async (url, init) => {
    if (url === '/system-operation-mode') return { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: modeVersion,
      updatedAt: '2026-11-16T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } } as never;
    if (url.endsWith(`/dish-options?serviceDate=${day}`)) return (wrongScope ? { ...choices, serviceDate: '2026-12-01' } : choices) as never;
    if (init?.method === 'POST') {
      writes.push({ url, body: JSON.parse(String(init.body)) });
      if (failCreate) throw new Error('Mất phản hồi');
      return (url.endsWith('/submit') ? { ...draft, demandId: url.split('/').at(-2), status: 'PENDING', version: 2 }
        : { ...draft, demandId: JSON.parse(String(init.body)).commandId }) as never;
    }
    throw new Error(`Unconfigured API ${url}`);
  });
});
function open(onSubmitted?: () => Promise<void>) {
  return render(<AuthProvider><MemoryRouter><MrxSupplementalDemandForm batchId={batchId} serviceDate={day}
    materialLabels={[{ dailyLineId: 'daily-1', ingredientName: 'Bầu', canonicalUnitName: 'Kilogram' }]}
    onLockChange={vi.fn()} onSubmitted={onSubmitted} /></MemoryRouter></AuthProvider>);
}
async function fill() {
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Menu hoặc tùy chọn 1' }), 'CUSTOM');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Món, ca và loại suất 1' }), JSON.stringify([dishId, 'MORNING', 'savory']));
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Suất tăng thêm 1' }), '10');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do tăng suất' }), 'Khách tăng suất');
}
it.each([
  ['MORNING', 'savory'],
  ['MORNING', 'vegetarian'],
  ['AFTERNOON', 'savory'],
  ['AFTERNOON', 'vegetarian'],
])('expands the entire %s %s frozen menu without opening the custom picker', async (shiftName, menuVariant) => {
  const base = vi.mocked(apiClient).getMockImplementation()!;
  const firstDish = { ...choices.dishes[0], shiftName, menuVariant };
  const secondDish = { ...firstDish, dishId: '20000000-0000-0000-0000-000000000002', dishName: 'Canh bầu' };
  const unrelated = { ...secondDish, shiftName: shiftName === 'MORNING' ? 'AFTERNOON' : 'MORNING' };
  vi.mocked(apiClient).mockImplementation(async (url, init) => url.endsWith(`/dish-options?serviceDate=${day}`)
    ? { ...choices, dishes: [firstDish, secondDish, unrelated] } as never
    : base(url, init));
  open();
  const menu = await screen.findByRole('combobox', { name: 'Menu hoặc tùy chọn 1' });
  await userEvent.selectOptions(menu, shiftName + ':' + menuVariant);
  expect(screen.queryByRole('combobox', { name: 'Món, ca và loại suất 1' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('spinbutton', { name: 'Suất tăng thêm 1' }), '10');
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do tăng suất' }), 'Khách tăng suất');
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  expect(writes[0].body.dishes).toEqual([dishId, secondDish.dishId].map(id =>
    ({ dishId: id, shiftName, menuVariant, extraServings: 10 })));
});
it('previews exact server quantities before submitting demand to the manager hub without issuing inventory', async () => {
  open(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  expect(await screen.findByText('0,000004')).toBeInTheDocument();
  expect(writes).toHaveLength(1);
  expect(writes[0].body.dishes).toEqual([{ dishId, shiftName: 'MORNING', menuVariant: 'savory', extraServings: 10 }]);
  await userEvent.click(screen.getByRole('button', { name: 'Gửi duyệt nhu cầu' }));
  await screen.findByText('Đã gửi duyệt nhu cầu');
  expect(screen.queryByRole('link', { name: 'Xem đề nghị tại Duyệt vận hành' })).not.toBeInTheDocument();
  const demandId = writes[0].body.commandId;
  expect(writes.map(x => x.url)).toEqual(['/reconciliation/supplemental-demands', `/reconciliation/supplemental-demands/${demandId}/submit`]);
  const base = vi.mocked(apiClient).getMockImplementation()!;
  vi.mocked(apiClient).mockImplementation(async (url, init) => {
    if (url === '/reconciliation/supplemental-demands/' + demandId && !init?.method)
      return { ...draft, demandId, status: 'APPROVED', version: 3, batchVersion: 3 } as never;
    return base(url, init);
  });
  await userEvent.click(screen.getByRole('button', { name: 'Cập nhật trạng thái đề nghị' }));
  expect(await screen.findByText('Nhu cầu đã được duyệt')).toBeInTheDocument();
  expect(writes).toHaveLength(2);
});
it('retains an uncertain proposal after the mode version changes and blocks rebuilding it as a new command', async () => {
  failCreate = true;
  const first = open(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  await screen.findByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' });
  first.unmount(); modeVersion = 2; localStorage.setItem('ipc_v3_mode_version', '2');
  open();
  const recovery = await screen.findByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' });
  await userEvent.click(recovery);
  expect(await screen.findByText('Phiên bản chế độ đã thay đổi. Cần đối chiếu đề nghị đã gửi trước khi xử lý tiếp.')).toBeInTheDocument();
  expect(writes).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'Lý do tăng suất' })).toBeDisabled();
});
it('freezes uncertain proposals and retries the exact same command instead of creating another request', async () => {
  failCreate = true; open(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  expect(await screen.findByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Lý do tăng suất' })).toBeDisabled();
  failCreate = false;
  await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi duyệt nhu cầu' })).toBeEnabled());
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
});
it('refuses dish options from another service date instead of offering them in the current proposal', async () => {
  wrongScope = true; open();
  expect(await screen.findByText('Danh sách món không đúng lô/ngày đang chọn.')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Món, ca và loại suất 1' })).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it('keeps acknowledged submission locked when refreshing the warehouse fails and never offers another command', async () => {
  const refresh = vi.fn(async () => { throw new Error('Read failed'); });
  open(refresh); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  expect(refresh).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('button', { name: 'Gửi duyệt nhu cầu' }));
  await screen.findByText('Nhu cầu đã được ghi nhận. Chưa tải lại được dữ liệu Kho; hãy tải lại trước khi xuất bổ sung.');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Lý do tăng suất' })).toBeDisabled();
  expect(writes).toHaveLength(2);
});


it('uses server direct-confirm authority for Admin and accepts approved submit without another review', async () => {
  const base = vi.mocked(apiClient).getMockImplementation()!;
  vi.mocked(apiClient).mockImplementation(async (url, init) => {
    if (url.endsWith('/dish-options?serviceDate=' + day)) return { ...choices, requiresApproval: false } as never;
    if (url.endsWith('/submit')) {
      writes.push({ url, body: JSON.parse(String(init?.body)) });
      return { ...draft, demandId: url.split('/').at(-2), status: 'APPROVED', version: 2,
        batchVersion: 3, decidedBy: dishId, decidedAt: '2026-11-16T07:05:00Z' } as never;
    }
    return base(url, init);
  });
  open(); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Ghi nhận suất phát sinh' }));
  expect(await screen.findByText('Admin đã ghi nhận nhu cầu')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Gửi duyệt nhu cầu' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Kiểm tra lại lệnh đã gửi' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Lý do tăng suất' })).toBeDisabled();
  const previousId = writes[0].body.commandId;
  await userEvent.click(screen.getByRole('button', { name: 'Lập đề nghị mới' }));
  await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Tính nhu cầu và lưu nháp' }));
  await screen.findByRole('button', { name: 'Ghi nhận suất phát sinh' });
  expect(writes).toHaveLength(3);
  expect(writes[2].url).toBe('/reconciliation/supplemental-demands');
  expect(writes[2].body.commandId).not.toBe(previousId);
});
