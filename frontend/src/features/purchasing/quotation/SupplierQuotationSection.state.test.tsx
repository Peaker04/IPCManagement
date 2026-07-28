import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QueryView } from '@/lib/queryView';
import type { useSupplierQuotations } from './useSupplierQuotations';
import { SupplierQuotationSection } from './SupplierQuotationSection';

type SupplierQuotationWorkflow = ReturnType<typeof useSupplierQuotations>;

const quotation = {
  quotationId: 'quotation-1',
  supplierId: 'supplier-1',
  supplierName: 'Nhà cung cấp Minh An',
  ingredientId: 'ingredient-1',
  ingredientName: 'Gạo',
  unitPrice: 20_000,
  effectiveFrom: '2026-07-20',
  effectiveTo: '2026-07-31',
  note: null,
  isActive: true,
  isBestPrice: true,
};

const quotationPage = {
  items: [quotation],
  totalCount: 1,
  pageNumber: 1,
  pageSize: 8,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
};

const readyView = <T,>(data: T, isRefreshing = false): QueryView<T> => ({
  phase: 'ready',
  data,
  isRefreshing,
  truncation: null,
});

const buildWorkflow = (
  quotationView: QueryView<typeof quotationPage>,
  overrides: Record<string, unknown> = {},
): SupplierQuotationWorkflow => ({
  ingredients: [{ ingredientId: 'ingredient-1', ingredientCode: 'NL-01', ingredientName: 'Gạo' }],
  ingredientSearch: '',
  setIngredientSearch: vi.fn(),
  suppliers: [{ supplierId: 'supplier-1', supplierCode: 'NCC-01', supplierName: 'Nhà cung cấp Minh An' }],
  selectedIngredientId: 'ingredient-1',
  selectIngredient: vi.fn(),
  page: 1,
  setPage: vi.fn(),
  response: quotationView.phase === 'ready' ? quotationView.data : undefined,
  ingredientView: readyView([]),
  supplierView: readyView([]),
  quotationView,
  isFetching: quotationView.phase === 'ready' && quotationView.isRefreshing,
  isLookupError: false,
  isLookupForbidden: false,
  isQuotationError: quotationView.phase === 'error',
  isQuotationForbidden: quotationView.phase === 'forbidden',
  retryQuotations: vi.fn(),
  rows: quotationView.phase === 'ready' ? quotationView.data.items : [],
  form: { supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' },
  setForm: vi.fn(),
  editingId: null,
  resetForm: vi.fn(),
  submit: vi.fn((event: { preventDefault: () => void }) => event.preventDefault()),
  edit: vi.fn(),
  isCreating: false,
  deactivateTargetId: null,
  setDeactivateTargetId: vi.fn(),
  confirmDeactivate: vi.fn(),
  ...overrides,
} as unknown as SupplierQuotationWorkflow);

describe('SupplierQuotationSection query state boundary', () => {
  it('renders an instruction before a quotation query is initialized', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(
      { phase: 'uninitialized', instruction: 'Chọn một nguyên liệu để xem báo giá.' },
      { selectedIngredientId: '' },
    )} />);

    expect(screen.getByText('Chưa chọn nguyên liệu')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có báo giá nào cho nguyên liệu này')).toBeNull();
  });

  it('renders quotation forbidden without a retry action', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow({
      phase: 'forbidden',
      message: 'Bạn không có quyền xem báo giá nhà cung cấp.',
    })} />);

    expect(screen.getByText('Bạn không có quyền xem báo giá nhà cung cấp.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Chưa có báo giá nào cho nguyên liệu này')).toBeNull();
  });

  it('keeps a non-forbidden quotation error retryable', () => {
    const retry = vi.fn();
    render(<SupplierQuotationSection workflow={buildWorkflow({
      phase: 'error',
      message: 'Không tải được báo giá.',
      retry,
      isRetrying: false,
    })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps stale quotation rows visible while refreshing', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(readyView(quotationPage, true))} />);

    expect(screen.getAllByText('Nhà cung cấp Minh An').length).toBeGreaterThan(0);
    expect(screen.getByText('Đang cập nhật báo giá')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có báo giá nào cho nguyên liệu này')).toBeNull();
  });
});
