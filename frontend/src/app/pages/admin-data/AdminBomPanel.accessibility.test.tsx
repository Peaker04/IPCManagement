import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminBomPanel } from './AdminBomPanel';
import type { AdminDataPageModel } from './useAdminDataPageModel';

const readyQuery = <T,>(data: T) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
});

vi.mock('@/api/dishCatalogApi', () => ({
  useAddDishBomLineMutation: () => [vi.fn(), { isLoading: false }],
  useCloseDishBomLineMutation: () => [vi.fn(), { isLoading: false }],
  useCommitBomImportMutation: () => [vi.fn(), { isLoading: false }],
  useDownloadBomTemplateMutation: () => [vi.fn(), { isLoading: false }],
  useGetAdminDishCatalogQuery: () => readyQuery([]),
  useGetIngredientsQuery: () => readyQuery([]),
  usePreviewBomImportMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateDishBomLineMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => <input type={type} {...props} />,
}));

function createMinimalBomModel(overrides?: Partial<AdminDataPageModel>): AdminDataPageModel {
  const readyView = { phase: 'ready', data: [], isRefreshing: false, truncation: null } as const;
  return {
    bomForm: { dishId: '', ingredientId: '', grossQtyPerServing: '', wasteRatePercent: '', bomStatus: 'PUBLISHED', effectiveFrom: '2026-07-30', effectiveTo: '', reason: '' },
    bomFormErrors: {},
    bomImportCustomerId: '',
    bomImportEffectiveFrom: '2026-07-30',
    bomImportFeedback: null,
    bomImportFile: null,
    bomImportPreview: null,
    bomImportTier: 25000,
    bomPanelMode: 'active',
    bomPreviewPagination: { page: 1, pageSize: 8, totalPages: 1, totalItems: 0, pagedItems: [] },
    bomSearch: '',
    bomTemplateDishId: '',
    closeDishBomLineState: { isLoading: false },
    closingBom: null,
    commitBomImportState: { isLoading: false },
    currentBomPagination: { page: 1, pageSize: 8, totalPages: 1, totalItems: 0, pagedItems: [] },
    currentBomRows: [],
    customerContracts: [],
    dishCatalog: [],
    downloadBomTemplateState: { isLoading: false },
    editingBom: null,
    effectiveActiveView: 'bom-import',
    handleCloseBomLine: vi.fn(),
    handleCommitBomImport: vi.fn(),
    handleDownloadBomTemplate: vi.fn(),
    handlePreviewBomImport: vi.fn(),
    handleSaveBomLine: vi.fn(),
    ingredientCatalog: [],
    isBomDialogOpen: false,
    isDishCatalogLoading: false,
    isIngredientCatalogLoading: false,
    isSavingBom: false,
    openCreateBomDialog: vi.fn(),
    openEditBomDialog: vi.fn(),
    previewBomImportState: { isLoading: false },
    queryViews: { dishCatalog: readyView, ingredientCatalog: readyView, contracts: readyView },
    setBomForm: vi.fn(),
    setBomImportCustomerId: vi.fn(),
    setBomImportEffectiveFrom: vi.fn(),
    setBomImportFile: vi.fn(),
    setBomImportPreview: vi.fn(),
    setBomImportTier: vi.fn(),
    setBomSearch: vi.fn(),
    setClosingBom: vi.fn(),
    setIsBomDialogOpen: vi.fn(),
    ...overrides,
  } as unknown as AdminDataPageModel;
}

describe('AdminBomPanel file input accessibility & selection contract', () => {
  it('does not block the BOM panel on the dialog-only ingredient query', () => {
    const uninitializedView = { phase: 'uninitialized', instruction: 'Chưa khởi tạo danh mục nguyên liệu' } as const;
    render(<AdminBomPanel model={createMinimalBomModel({
      isBomDialogOpen: false,
      queryViews: {
        dishCatalog: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
        ingredientCatalog: uninitializedView,
        contracts: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
      },
    } as unknown as Partial<AdminDataPageModel>)} />);

    expect(screen.getByRole('heading', { name: 'Import BOM theo đơn giá' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa khởi tạo danh mục nguyên liệu')).not.toBeInTheDocument();
  });

  it('preserves accessible names, valid extensions, and mutation-free file selection', () => {
    const handleCommitBomImport = vi.fn();
    const handlePreviewBomImport = vi.fn();
    const setBomImportFile = vi.fn();
    const model = createMinimalBomModel({ handleCommitBomImport, handlePreviewBomImport, setBomImportFile });

    const { container, rerender } = render(<AdminBomPanel model={model} />);

    // 1. Exactly one file input
    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(1);
    const fileInput = fileInputs[0] as HTMLInputElement;
    expect(fileInput.type).toBe('file');

    // 2. Initial accessible name is "Chọn file Excel" via label wrapping
    expect(fileInput).toHaveAccessibleName('Chọn file Excel');
    expect(screen.getByLabelText('Chọn file Excel')).toBe(fileInput);

    // 3. Accept attribute remains current spreadsheet extensions
    expect(fileInput.accept).toBe(
      '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
    );

    // 4. Selecting a file changes the accessible name to "Đổi file Excel"
    const mockFile = new File(['mock content'], 'bom-2026.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // File selection updates state without triggering upload/preview mutations
    expect(setBomImportFile).toHaveBeenCalledWith(mockFile);
    expect(handlePreviewBomImport).not.toHaveBeenCalled();
    expect(handleCommitBomImport).not.toHaveBeenCalled();

    // After state update, rerender with selected file confirms updated accessible name
    rerender(<AdminBomPanel model={createMinimalBomModel({ bomImportFile: mockFile })} />);
    const updatedFileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(updatedFileInput).toHaveAccessibleName('Đổi file Excel');
    expect(screen.getByLabelText('Đổi file Excel')).toBe(updatedFileInput);
  });

  it('nests the import guidance directly below the BOM work-surface heading', () => {
    render(<AdminBomPanel model={createMinimalBomModel()} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Import BOM theo đơn giá' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Chỉ cần nhập 3 thông tin' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 4, name: 'Chỉ cần nhập 3 thông tin' })).toBeNull();
  });

  it('keeps mixed preview decisions while leaving a valid row status cell empty', () => {
    const previewRows = [
      {
        rowNumber: 2,
        dishCode: 'MON-01',
        dishName: 'Cơm gà',
        ingredientCode: 'NL-01',
        ingredientName: 'Gạo',
        unitCode: 'KG',
        grossQtyPerServing: 0.12,
        wasteRatePercent: 5,
        effectiveFrom: '2026-07-30',
        effectiveTo: null,
        status: 'valid',
        action: 'INSERT',
        errors: [],
        warnings: [],
      },
      {
        rowNumber: 3,
        dishCode: 'MON-02',
        dishName: 'Canh rau',
        ingredientCode: 'NL-02',
        ingredientName: 'Rau cải',
        unitCode: 'KG',
        grossQtyPerServing: 0.08,
        wasteRatePercent: 10,
        effectiveFrom: '2026-07-30',
        effectiveTo: null,
        status: 'warning',
        action: 'UPDATE',
        errors: [],
        warnings: ['Nguyên liệu mới sẽ được tạo.'],
      },
      {
        rowNumber: 4,
        dishCode: 'MON-03',
        dishName: 'Cá kho',
        ingredientCode: 'NL-03',
        ingredientName: 'Cá',
        unitCode: 'KG',
        grossQtyPerServing: 0,
        wasteRatePercent: 0,
        effectiveFrom: '2026-07-30',
        effectiveTo: null,
        status: 'error',
        action: 'blocked',
        errors: ['Định lượng phải lớn hơn 0.'],
        warnings: [],
      },
    ];
    const preview = {
      generatedAt: '2026-07-30T00:00:00Z',
      priceTier: 25000,
      customerId: null,
      bomScope: 'global',
      totalRows: 3,
      validRows: 2,
      errorRows: 1,
      warningRows: 1,
      canCommit: false,
      rows: previewRows,
      warnings: [],
    };
    const model = createMinimalBomModel({
      bomImportPreview: preview as never,
      bomPanelMode: 'preview',
      bomPreviewPagination: {
        page: 1,
        pageSize: 20,
        totalPages: 1,
        totalItems: 3,
        rows: previewRows,
        setPage: vi.fn(),
      } as never,
    });

    render(<AdminBomPanel model={model} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Cơm gà')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Thêm mới')).toBeInTheDocument();
    expect(within(rows[0]).getAllByRole('cell').at(-1)).toBeEmptyDOMElement();
    expect(within(rows[1]).getByText('Nguyên liệu mới sẽ được tạo.')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Cập nhật')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Định lượng phải lớn hơn 0.')).toBeInTheDocument();
    expect(within(rows[2]).getByText('blocked')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu / ĐVT' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Định lượng / hao hụt' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('2Cơm gàMON-01GạoNL-01 · KGĐịnh lượng: 0,12Hao hụt: 5%Thêm mới');
    expect(screen.getByRole('button', { name: 'Nhập dữ liệu' })).toBeDisabled();
    expect(screen.queryByText('Hợp lệ')).not.toBeInTheDocument();
  });

  it('associates the effective-date label with the visible date input', () => {
    const setBomImportEffectiveFrom = vi.fn();
    const handlePreviewBomImport = vi.fn();
    const handleCommitBomImport = vi.fn();
    const model = createMinimalBomModel({
      bomImportEffectiveFrom: '2026-07-30',
      setBomImportEffectiveFrom,
      handlePreviewBomImport,
      handleCommitBomImport,
    });

    const { container } = render(<AdminBomPanel model={model} />);

    // 1. screen.getByLabelText('Hiệu lực từ') returns the input
    const dateInput = screen.getByLabelText('Hiệu lực từ') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();

    // 2. input has type="date"
    expect(dateInput.type).toBe('date');

    // 3. input has accessible name 'Hiệu lực từ'
    expect(dateInput).toHaveAccessibleName('Hiệu lực từ');

    // 4. exactly one visible date input for this field in the work surface
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(1);

    // 5. current value preserved
    expect(dateInput.value).toBe('2026-07-30');

    // 6. changing the date calls local setter/current handler
    fireEvent.change(dateInput, { target: { value: '2026-08-01' } });
    expect(setBomImportEffectiveFrom).toHaveBeenCalledWith('2026-08-01');

    // 7. does not invoke preview/commit/upload mutations
    expect(handlePreviewBomImport).not.toHaveBeenCalled();
    expect(handleCommitBomImport).not.toHaveBeenCalled();
  });
});
