import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DishBomBatchImportModal } from '../components/workbench/DishBomBatchImportModal';
import { bomApi, type BomImportPreviewResult } from '../api/bomApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';

vi.mock('../api/bomApi', () => ({
  bomApi: {
    getSupportedPriceTiers: vi.fn().mockResolvedValue([25000, 30000, 34000]),
    getBomTemplateUrl: vi.fn().mockReturnValue('/api/Dishes/bom-template?PriceTier=25000'),
    previewBomImport: vi.fn(),
    commitBomImport: vi.fn(),
  },
}));

vi.mock('../api/weeklyMenuApi', () => ({
  weeklyMenuApi: {
    getCustomers: vi.fn().mockResolvedValue([
      { customerId: 'c-1', customerCode: 'ANV', customerName: 'AMANN' },
    ]),
  },
}));

describe('DishBomBatchImportModal Component Tests (Rule TA-2 & TA-4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks BOM import when supported price tiers cannot be loaded, and retries the metadata request', async () => {
    vi.mocked(bomApi.getSupportedPriceTiers).mockRejectedValueOnce(new Error('Không thể tải mốc giá'));
    render(<DishBomBatchImportModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Chọn file Excel định mức BOM'), { target: { files: [new File(['bom'], 'bom.xlsx')] } });

    expect(await screen.findByText('Không thể tải mốc giá')).toBeVisible();
    expect(screen.queryByRole('radio', { name: /25.000 ₫/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
    expect(bomApi.previewBomImport).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại mốc giá' }));
    await userEvent.click(await screen.findByRole('radio', { name: /30.000 ₫/ }));
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeEnabled();
  });

  it('renders 3 canonical price tiers radio buttons and template download button', async () => {
    render(
      <DishBomBatchImportModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nhập định mức BOM hàng loạt từ file Excel')).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /25.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /30.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /34.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải Excel món thiếu theo phạm vi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải file toàn danh mục theo phạm vi' })).toBeInTheDocument();
  });

  it('explains that a customer recipe replaces the full shared recipe', async () => {
    render(<DishBomBatchImportModal isOpen onClose={vi.fn()} initialCustomerId="c-1" initialPriceTier={25000} />);

    expect(await screen.findByRole('option', { name: /AMANN/ })).toBeInTheDocument();
    expect(screen.getByText('BOM riêng của khách hàng')).toBeVisible();
    expect(screen.getByText(/toàn bộ công thức của khách hàng thay cho công thức dùng chung/)).toBeVisible();
  });

  it('toggles price tiers and previews excel import file', async () => {
    const mockPreview: BomImportPreviewResult = {
      generatedAt: '2026-10-28T12:00:00Z',
      priceTier: 30000,
      bomScope: 'global',
      canCommit: true,
      totalRows: 15,
      validRows: 15,
      errorRows: 0,
      warningRows: 0,
      rows: [
        {
          rowNumber: 2,
          dishCode: 'MON-01',
          dishName: 'Thịt kho tàu',
          ingredientCode: 'NL-THIT',
          ingredientName: 'Thịt heo ba chỉ',
          unitCode: 'KG',
          grossQtyPerServing: 0.000123,
          wasteRatePercent: 5,
          effectiveFrom: '2026-01-01',
          status: 'valid', action: 'create', errors: [], warnings: [],
        },
      ],
      warnings: [],
    };

    vi.mocked(bomApi.previewBomImport).mockResolvedValueOnce(mockPreview);

    render(
      <DishBomBatchImportModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Switch tier to 30.000 ₫
    const tier30kBtn = await screen.findByRole('radio', { name: /30.000 ₫/ });
    fireEvent.click(tier30kBtn);
    expect(tier30kBtn).toHaveAttribute('aria-checked', 'true');

    // Attach file
    const file = new File(['dummy xlsx content'], 'bom-template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = screen.getByLabelText('Chọn file Excel định mức BOM');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click Preview
    const previewBtn = screen.getByRole('button', { name: 'Xem trước' });
    await waitFor(() => expect(previewBtn).toBeEnabled());
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Thịt kho tàu')).toBeInTheDocument();
      expect(screen.getByText('Thịt heo ba chỉ')).toBeInTheDocument();
      expect(screen.getByText('0,000123')).toBeInTheDocument();
      expect(screen.getByText('Hợp lệ để nhập')).toBeInTheDocument();
    });

    // A scope change during a read must not promote its delayed result to a new scope.
    fireEvent.click(screen.getByRole('radio', { name: /25.000 ₫/ }));
    let finishPreview!: (value: BomImportPreviewResult) => void;
    vi.mocked(bomApi.previewBomImport).mockImplementationOnce(() => new Promise((resolve) => { finishPreview = resolve; }));
    await userEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
    fireEvent.click(tier30kBtn);
    await act(async () => { finishPreview({ ...mockPreview, priceTier: 25000 }); });
    expect(screen.queryByRole('button', { name: 'Xác nhận nhập BOM hàng loạt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Thịt kho tàu')).not.toBeInTheDocument();
  });


  it('shows customer-load failure and retries without treating it as a successful global catalog', async () => {
    vi.mocked(weeklyMenuApi.getCustomers).mockRejectedValueOnce(new Error('Không thể tải khách hàng'));
    render(<DishBomBatchImportModal isOpen onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải khách hàng');
    expect(screen.getByRole('combobox', { name: 'Phạm vi áp dụng BOM' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại khách hàng' }));
    expect(await screen.findByRole('option', { name: /AMANN/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Phạm vi áp dụng BOM' })).toBeEnabled();
  });

  it('counts created and updated BOM rows without counting archives as imports', async () => {
    const mockPreview: BomImportPreviewResult = {
      generatedAt: '2026-10-28T12:00:00Z',
      priceTier: 25000,
      bomScope: 'global',
      canCommit: true,
      totalRows: 3,
      validRows: 3,
      errorRows: 0,
      warningRows: 0,
      rows: [],
      warnings: [],
    };

    const mockCommit = {
      ...mockPreview,
      createdRows: 2,
      updatedRows: 1,
      archivedRows: 2,
      auditBatchCode: 'BOM-20261029-001',
    };

    vi.mocked(bomApi.previewBomImport).mockResolvedValueOnce(mockPreview);
    let finishCommit!: (value: typeof mockCommit) => void;
    vi.mocked(bomApi.commitBomImport).mockImplementationOnce(() => new Promise((resolve) => { finishCommit = resolve; }));

    const onImportSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <DishBomBatchImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
      />
    );

    const file = new File(['dummy xlsx content'], 'bom-template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = screen.getByLabelText('Chọn file Excel định mức BOM');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const previewBtn = screen.getByRole('button', { name: 'Xem trước' });
    await user.click(previewBtn);

    const commitBtn = await screen.findByRole('button', { name: 'Xác nhận nhập BOM hàng loạt' });
    await user.click(commitBtn);
    expect(screen.getByRole('radio', { name: /30.000 ₫/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Phạm vi áp dụng BOM' })).toBeDisabled();
    expect(fileInput).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { finishCommit(mockCommit); });

    await waitFor(() => {
      expect(bomApi.commitBomImport).toHaveBeenCalled();
      expect(onImportSuccess).toHaveBeenCalled();
      expect(screen.getByText('Đã nhập thành công 3 dòng BOM (2 tạo mới, 1 cập nhật) cho catalog.')).toBeVisible();
    });
  });
});
