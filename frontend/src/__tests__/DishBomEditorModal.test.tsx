import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DishBomEditorModal } from '../components/workbench/DishBomEditorModal';
import type { DishBomLine } from '../api/bomApi';
import * as transport from '../api/client';

const dish = { dishId: 'dish-1', dishCode: 'MON-BO-01', dishName: 'Bò lúc lắc' };
const original: DishBomLine = {
  bomId: 'b-1', ...dish, ingredientId: 'ing-1', ingredientCode: 'NL-BO-01', ingredientName: 'Thịt bò phi lê',
  unitId: 'unit-kg', unitCode: 'KG', unitName: 'kg', grossQtyPerServing: 0.123456,
  wasteRatePercent: 0, referencePrice: 220000, bomStatus: 'PUBLISHED', bomStatusLabel: 'Đã phát hành',
  priceTierAmount: 25000, bomScope: 'global', effectiveFrom: '2026-01-01',
};
let lines: DishBomLine[];
let rejectUpdate: Error | null;
let reloadFailure: boolean;
let finishUpdate: (() => void) | null;
let holdUpdate: boolean;
let updateAccepted: boolean;

it('reserves a deferred cold table and keeps tier loading outside visual layout', () => {
  vi.mocked(transport.apiClient).mockImplementation(() => new Promise(() => {}));
  render(<DishBomEditorModal isOpen dish={dish} onClose={vi.fn()} readOnly />);
  expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('data-loading-phase', 'reserved');
  expect(screen.getByText('Đang tải mốc giá BOM…')).toHaveClass('sr-only');
  expect(screen.getByRole('radiogroup', { name: 'Mốc giá BOM' })).toHaveClass('min-h-7');
});

beforeEach(() => {
  vi.restoreAllMocks();
  lines = [];
  rejectUpdate = null;
  reloadFailure = false;
  holdUpdate = false;
  updateAccepted = false;
  finishUpdate = null;
  vi.spyOn(transport, 'apiClient').mockImplementation(async (endpoint, options) => {
    const url = new URL(endpoint, 'http://localhost');
    if (url.pathname === '/Dishes/bom-price-tiers') return [25000, 30000, 34000];
    if (url.pathname === '/ingredients') return {
      items: [{ ingredientId: 'ing-1', ingredientCode: 'NL-BO-01', ingredientName: 'Thịt bò phi lê', unitId: 'unit-kg', unitName: 'kg', warehouseId: 'warehouse-1', referencePrice: 220000, isActive: true }],
      totalCount: 1, pageNumber: 1, pageSize: 200, totalPages: 1, hasPrev: false, hasNext: false,
    };
    if (url.pathname === '/coordination/customers') return [];
    if (url.pathname === '/Dishes/dish-1/bom' && !options?.method && updateAccepted && reloadFailure) throw new transport.ApiError(503, 'Không tải được nguồn');
    if (url.pathname === '/Dishes/dish-1/bom' && !options?.method) return updateAccepted
      ? [{ ...original, effectiveTo: '2026-01-31' }, { ...original, bomId: 'version-2', grossQtyPerServing: 0.234567, effectiveFrom: '2026-02-01' }]
      : lines;
    if (url.pathname === '/Dishes/dish-1/bom' && options?.method === 'POST') return { ...original, bomId: 'created', ...JSON.parse(String(options.body)) };
    if (url.pathname === '/Dishes/dish-1/bom/b-1' && options?.method === 'PUT') {
      if (rejectUpdate) throw rejectUpdate;
      if (holdUpdate) await new Promise<void>(resolve => { finishUpdate = resolve; });
      updateAccepted = true;
      return { ...original, bomId: 'version-2', grossQtyPerServing: 0.234567, effectiveFrom: '2026-02-01' };
    }
    throw new Error(`Unexpected BOM request ${options?.method ?? 'GET'} ${endpoint}`);
  });
});

const writes = () => vi.mocked(transport.apiClient).mock.calls.filter(([, options]) => options?.method === 'PUT');

it('shows empty BOM guidance for a dish with no lines', async () => {
  render(<DishBomEditorModal isOpen onClose={vi.fn()} dish={dish} />);
  expect(screen.getByText('Định mức BOM: Bò lúc lắc')).toBeVisible();
  expect(await screen.findByText(/Món ăn chưa có BOM/)).toBeVisible();
});

it('guards dirty Escape and footer close, preserves cancel, and clears confirmed discard', async () => {
  const onClose = vi.fn();
  const page = render(<DishBomEditorModal isOpen onClose={onClose} dish={dish} />);
  await screen.findByText(/Món ăn chưa có BOM/);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Định mức / suất' }), { target: { value: '0.123' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(screen.getByRole('spinbutton', { name: 'Định mức / suất' })).toHaveValue(0.123);
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  page.rerender(<DishBomEditorModal isOpen onClose={onClose} dish={dish} />);
  expect(screen.getByRole('spinbutton', { name: 'Định mức / suất' })).toHaveValue(null);
});

it('edits the exact published line with six-decimal quantity, explicit effective date and reason without losing failed or pending drafts', async () => {
  lines = [original, { ...original, bomId: 'other-tier', priceTierAmount: 30000, grossQtyPerServing: 0.25 }];
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<DishBomEditorModal isOpen onClose={onClose} onSaved={onSaved} dish={dish} />);
  expect(await screen.findByRole('cell', { name: '0,123456' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa Thịt bò phi lê' }));
  expect(screen.getByRole('spinbutton', { name: 'Định mức / suất' })).toHaveValue(0.123456);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Định mức / suất' }), { target: { value: '0.234567' } });
  const date = screen.getByRole('textbox', { name: 'Ngày hiệu lực BOM' });
  fireEvent.change(date, { target: { value: '01/01/2026' } });
  fireEvent.blur(date);
  fireEvent.change(screen.getByRole('textbox', { name: 'Lý do chỉnh sửa BOM' }), { target: { value: 'Điều chỉnh định lượng đã duyệt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi BOM' }));
  expect(writes()).toHaveLength(0);
  fireEvent.change(date, { target: { value: '01/02/2026' } });
  fireEvent.blur(date);
  rejectUpdate = new transport.ApiError(400, 'Ngày hiệu lực không được chấp nhận');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi BOM' }));
  expect(await screen.findByText('Ngày hiệu lực không được chấp nhận')).toBeVisible();
  expect(screen.getByRole('spinbutton', { name: 'Định mức / suất' })).toHaveValue(0.234567);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(onClose).not.toHaveBeenCalled();
  rejectUpdate = null;
  reloadFailure = true;
  holdUpdate = true;
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi BOM' }));
  await waitFor(() => expect(finishUpdate).not.toBeNull());
  expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
  finishUpdate!();
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Chưa tải lại được định mức BOM. Hãy thử tải lại, không gửi lại thay đổi.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Thêm vào BOM' })).toBeDisabled();
  reloadFailure = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu BOM' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Tải lại dữ liệu BOM' })).not.toBeInTheDocument());
  expect(screen.getByRole('cell', { name: '0,234567' })).toBeVisible();
  expect(screen.getByRole('cell', { name: '0,123456' })).toBeVisible();
  expect(writes()).toHaveLength(2);
  expect(JSON.parse(String(writes()[1][1]?.body))).toEqual({ grossQtyPerServing: 0.234567, effectiveFrom: '2026-02-01', reason: 'Điều chỉnh định lượng đã duyệt' });
  expect(vi.mocked(transport.apiClient).mock.calls.some(([, options]) => ['POST', 'DELETE'].includes(options?.method ?? ''))).toBe(false);
});

it('blocks replay after an unknown write outcome until an explicit source reload', async () => {
  lines = [original];
  rejectUpdate = new TypeError('Failed to fetch');
  render(<DishBomEditorModal isOpen onClose={vi.fn()} dish={dish} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa Thịt bò phi lê' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Định mức / suất' }), { target: { value: '0.234567' } });
  const date = screen.getByRole('textbox', { name: 'Ngày hiệu lực BOM' });
  fireEvent.change(date, { target: { value: '01/02/2026' } });
  fireEvent.blur(date);
  fireEvent.change(screen.getByRole('textbox', { name: 'Lý do chỉnh sửa BOM' }), { target: { value: 'Điều chỉnh đã duyệt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi BOM' }));
  expect(await screen.findByText('Chưa xác định kết quả lưu. Hãy tải lại định mức và kiểm tra, không gửi lại thay đổi.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Lưu thay đổi BOM' })).toBeDisabled();
  expect(screen.getByRole('spinbutton', { name: 'Định mức / suất' })).toHaveValue(0.234567);
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu BOM' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu thay đổi BOM' })).not.toBeInTheDocument());
  expect(screen.getByRole('cell', { name: '0,123456' })).toBeVisible();
  expect(writes()).toHaveLength(1);
});

it('submits a new BOM line through the existing add endpoint', async () => {
  const onSaved = vi.fn();
  render(<DishBomEditorModal isOpen onClose={vi.fn()} dish={dish} onSaved={onSaved} />);
  await screen.findByText(/Món ăn chưa có BOM/);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Định mức / suất' }), { target: { value: '0.2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm vào BOM' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(transport.apiClient).toHaveBeenCalledWith('/Dishes/dish-1/bom', expect.objectContaining({ method: 'POST', body: JSON.stringify({ ingredientId: 'ing-1', grossQtyPerServing: 0.2, unitId: 'unit-kg', priceTierAmount: 25000, bomScope: 'global' }) }));
});
