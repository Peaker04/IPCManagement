import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DishBomBatchImportModal } from '../features/admin/DishBomBatchImportModal';
import { bomApi } from '../api/bomApi';

vi.mock('../api/bomApi', () => ({
  bomApi: {
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

  it('renders 3 canonical price tiers radio buttons and template download button', async () => {
    render(
      <DishBomBatchImportModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nhập định mức BOM hàng loạt từ file Excel')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /25.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /30.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /34.000 ₫/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải file Excel các món thiếu BOM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải file mẫu toàn bộ' })).toBeInTheDocument();
  });

  it('toggles price tiers and previews excel import file', async () => {
    const mockPreview = {
      canCommit: true,
      totalRows: 15,
      validRows: 15,
      errorRows: 0,
      warningRows: 0,
      dishesCovered: 5,
      rows: [
        {
          rowNumber: 2,
          dishCode: 'MON-01',
          dishName: 'Thịt kho tàu',
          ingredientCode: 'NL-THIT',
          ingredientName: 'Thịt heo ba chỉ',
          unitCode: 'KG',
          grossQtyPerServing: 0.12,
          wasteRatePercent: 5,
          effectiveFrom: '2026-01-01',
        },
      ],
      warnings: [],
    };

    vi.mocked(bomApi.previewBomImport).mockResolvedValueOnce(mockPreview as any);

    render(
      <DishBomBatchImportModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Switch tier to 30.000 ₫
    const tier30kBtn = screen.getByRole('radio', { name: /30.000 ₫/ });
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
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByText('Thịt kho tàu')).toBeInTheDocument();
      expect(screen.getByText('Thịt heo ba chỉ')).toBeInTheDocument();
      expect(screen.getByText('Hợp lệ để nhập')).toBeInTheDocument();
    });
  });

  it('commits batch BOM import when confirmed', async () => {
    const mockPreview = {
      canCommit: true,
      totalRows: 15,
      validRows: 15,
      errorRows: 0,
      warningRows: 0,
      dishesCovered: 5,
      rows: [],
      warnings: [],
    };

    const mockCommit = {
      totalCommittedRows: 15,
      createdRows: 15,
      updatedRows: 0,
      archivedRows: 0,
      auditBatchCode: 'BOM-20261029-001',
    };

    vi.mocked(bomApi.previewBomImport).mockResolvedValueOnce(mockPreview as any);
    vi.mocked(bomApi.commitBomImport).mockResolvedValueOnce(mockCommit as any);

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

    await waitFor(() => {
      expect(bomApi.commitBomImport).toHaveBeenCalled();
      expect(onImportSuccess).toHaveBeenCalled();
    });
  });
});
