import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as transport from '../api/client';
import type { BomImportPreviewResult } from '../api/bomApi';
import { DishBomBatchImportModal } from '../components/workbench/DishBomBatchImportModal';

const rows = Array.from({ length: 60 }, (_, index) => ({
  rowNumber: index + 2, dishCode: `MON-${index + 1}`, dishName: `Món ${index + 1}`,
  ingredientCode: `NL-${index + 1}`, ingredientName: `Nguyên liệu ${index + 1}`,
  unitCode: 'KG', grossQtyPerServing: 0.1, wasteRatePercent: 0, effectiveFrom: '2026-01-01',
  status: 'valid', action: 'create', errors: [] as string[], warnings: [] as string[],
}));

let preview: BomImportPreviewResult;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(transport, 'apiClient').mockImplementation(async (endpoint, options) => {
    if (endpoint === '/Dishes/bom-price-tiers') return [25000, 30000, 34000];
    if (endpoint === '/coordination/customers') return [{ customerId: 'c-1', customerCode: 'ANV', customerName: 'AMANN' }];
    if (endpoint === '/Dishes/bom-import/preview' && options?.method === 'POST') return preview;
    throw new Error(`Unexpected BOM request ${options?.method ?? 'GET'} ${endpoint}`);
  });
});

async function openPreview() {
  render(<DishBomBatchImportModal isOpen onClose={vi.fn()} initialTemplateType="missing" />);
  fireEvent.change(screen.getByLabelText('Chọn file Excel định mức BOM'), { target: { files: [new File(['bom'], 'bom.xlsx')] } });
  await screen.findByRole('radio', { name: /25.000 ₫/ });
  fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
}

it('shows a late row error from the backend and blocks commit', async () => {
  preview = {
    generatedAt: '2026-10-28T12:00:00Z', priceTier: 25000, bomScope: 'global', canCommit: false,
    totalRows: 60, validRows: 59, errorRows: 1, warningRows: 0, warnings: [],
    rows: rows.map((row, index) => index === 59 ? { ...row, status: 'error', action: 'blocked', errors: ['Mã đơn vị không tồn tại.'] } : row),
  };
  await openPreview();
  expect(await screen.findByText('Mã đơn vị không tồn tại.')).toBeVisible();
  expect(screen.getByText('Món 60')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Xác nhận nhập BOM hàng loạt' })).toBeDisabled();
});

it('pages through valid rows to show a late new-ingredient warning', async () => {
  preview = {
    generatedAt: '2026-10-28T12:00:00Z', priceTier: 25000, bomScope: 'global', canCommit: true,
    totalRows: 60, validRows: 60, errorRows: 0, warningRows: 1, warnings: [],
    rows: rows.map((row, index) => index === 59 ? { ...row, status: 'warning', warnings: ['Nguyên liệu mới sẽ được tạo khi xác nhận nhập: ING-RAURAM.'] } : row),
  };
  await openPreview();
  expect(await screen.findByText('Trang 1/2')).toBeVisible();
  expect(screen.queryByText('Món 60')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  expect(screen.getByText('Món 60')).toBeVisible();
  expect(screen.getByText('Nguyên liệu mới sẽ được tạo khi xác nhận nhập: ING-RAURAM.')).toBeVisible();
});

it('keeps a generated long ingredient code copyable without covering its name', async () => {
  const generatedCode = 'ING-NGUYENLIEUEXCELMWG27MNB';
  preview = {
    generatedAt: '2026-10-28T12:00:00Z', priceTier: 25000, bomScope: 'global', canCommit: true,
    totalRows: 1, validRows: 1, errorRows: 0, warningRows: 1, warnings: [],
    rows: [{ ...rows[0], ingredientCode: generatedCode, ingredientName: 'Nguyên liệu Excel cần đọc rõ', warnings: ['Nguyên liệu mới sẽ được tạo.'] }],
  };
  await openPreview();
  const code = await screen.findByRole('button', { name: `Sao chép ${generatedCode}` });
  expect(code).toHaveAttribute('title', generatedCode);
  expect(code).toHaveTextContent('ING-NG…7MNB');
  expect(screen.getByText('Nguyên liệu Excel cần đọc rõ')).toHaveAttribute('title', 'Nguyên liệu Excel cần đọc rõ');
});

it('downloads MRX missing BOM by the selected customer, week and source version', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['xlsx']), headers: new Headers(), status: 200 });
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: () => 'blob:bm', revokeObjectURL: () => undefined }));
  render(<DishBomBatchImportModal isOpen onClose={vi.fn()} initialTemplateType="missing"
    initialCustomerId="c-1" mrxWeekStartDate="2026-07-06" mrxMenuVersionId="v-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tải Excel món thiếu của tuần MRX' }));
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get('TemplateType')).toBe('mrx-missing');
  expect(url.searchParams.get('CustomerId')).toBe('c-1');
  expect(url.searchParams.get('WeekStartDate')).toBe('2026-07-06');
  expect(url.searchParams.get('MenuVersionId')).toBe('v-1');
  vi.unstubAllGlobals();
});
