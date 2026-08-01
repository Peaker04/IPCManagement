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
  validationErrors: {},
  saveError: null,
  deactivateError: null,
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
    expect(screen.getAllByText('Không có quyền xem báo giá', { exact: true })).toHaveLength(1);
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
    expect(screen.getAllByText('Không tải được báo giá của nguyên liệu này', { exact: true })).toHaveLength(1);
  });

  it('renders the initial quotation loading state once', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow({ phase: 'loading' })} />);

    expect(screen.getAllByText('Đang tải báo giá', { exact: true })).toHaveLength(1);
  });

  it('keeps stale quotation rows visible while refreshing', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(readyView(quotationPage, true))} />);

    expect(screen.getAllByText('Nhà cung cấp Minh An').length).toBeGreaterThan(0);
    expect(screen.getByText('Đang cập nhật báo giá')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có báo giá nào cho nguyên liệu này')).toBeNull();
  });

  it('associates quotation validation feedback with the affected fields', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(
      readyView(quotationPage),
      {
        validationErrors: {
          ingredientId: { title: 'Thiếu nguyên liệu', message: 'Vui lòng chọn nguyên liệu trước khi nhập báo giá.' },
          supplierId: { title: 'Thiếu nhà cung cấp', message: 'Vui lòng chọn nhà cung cấp cho báo giá.' },
          unitPrice: { title: 'Đơn giá chưa hợp lệ', message: 'Vui lòng nhập đơn giá lớn hơn 0.' },
          effectiveFrom: { title: 'Thiếu ngày bắt đầu', message: 'Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.' },
        },
      },
    )} />);

    expect(screen.getByLabelText('Nguyên liệu:')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nhà cung cấp')).toHaveAccessibleDescription('Thiếu nhà cung cấp Vui lòng chọn nhà cung cấp cho báo giá.');
    expect(screen.getByLabelText('Đơn giá')).toHaveAccessibleDescription('Đơn giá chưa hợp lệ Vui lòng nhập đơn giá lớn hơn 0.');
    expect(screen.getByLabelText('Hiệu lực từ')).toHaveAccessibleDescription('Thiếu ngày bắt đầu Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.');
  });

  it('renders ingredient and supplier labels in closed select triggers', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(
      readyView(quotationPage),
      { form: { supplierId: 'supplier-1', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' } },
    )} />);

    expect(screen.getByRole('combobox', { name: 'Nguyên liệu:' })).toHaveTextContent('Gạo');
    expect(screen.getByRole('combobox', { name: 'Nhà cung cấp' })).toHaveTextContent('Nhà cung cấp Minh An');
  });

  it('keeps a save failure beside the quotation form', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(
      readyView(quotationPage),
      { saveError: 'Khoảng hiệu lực bị trùng với báo giá hiện có.' },
    )} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Chưa thể lưu báo giá');
    expect(screen.getByRole('alert')).toHaveTextContent('Khoảng hiệu lực bị trùng với báo giá hiện có.');
  });

  it('keeps a deactivate failure inside the open confirmation dialog', () => {
    render(<SupplierQuotationSection workflow={buildWorkflow(
      readyView(quotationPage),
      {
        deactivateTargetId: 'quotation-1',
        deactivateError: 'Báo giá đang được dùng cho giao dịch mới.',
      },
    )} />);

    expect(screen.getByRole('dialog', { name: 'Ngừng báo giá này?' })).toHaveTextContent('Chưa thể ngừng báo giá');
    expect(screen.getByRole('dialog', { name: 'Ngừng báo giá này?' })).toHaveTextContent('Báo giá đang được dùng cho giao dịch mới.');
  });
});
