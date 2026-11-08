import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SupplierEvidenceCandidate } from '@/api/workflowApiTypes';
import { SupplierEvidenceList } from './PurchaseDecisionPanel';

const quotation: SupplierEvidenceCandidate = {
  evidenceType: 'EffectiveQuotation',
  evidenceId: 'quotation-1',
  supplierId: 'supplier-quotation',
  supplierName: 'Công ty Thực phẩm An Phát',
  ingredientId: 'ingredient-1',
  unitId: 'unit-kg',
  unitName: 'kg',
  unitPrice: 42_000,
  evidenceDate: '2026-09-01',
  effectiveFrom: '2026-09-01',
  effectiveTo: '2026-09-30',
};

const receipt: SupplierEvidenceCandidate = {
  evidenceType: 'LatestValidReceipt',
  evidenceId: 'receipt-1',
  supplierId: 'supplier-receipt',
  supplierName: 'Nhà cung cấp Minh Tâm',
  ingredientId: 'ingredient-1',
  unitId: 'unit-box',
  unitName: 'thùng',
  unitPrice: 315_000,
  evidenceDate: '2026-09-12',
};

function ControlledSupplierEvidenceList({ onSelect }: { onSelect: (candidate: SupplierEvidenceCandidate) => void }) {
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>();

  return (
    <SupplierEvidenceList
      candidates={[quotation, receipt]}
      selectedEvidenceId={selectedEvidenceId}
      onSelect={(candidate) => {
        onSelect(candidate);
        setSelectedEvidenceId(candidate.evidenceId);
      }}
    />
  );
}

describe('SupplierEvidenceList presentation', () => {
  it('keeps evidence identity visible and reserves the status pill for the selected candidate', () => {
    const onSelect = vi.fn();
    render(<ControlledSupplierEvidenceList onSelect={onSelect} />);

    const quotationButton = screen.getByRole('button', {
      name: 'Chọn Công ty Thực phẩm An Phát, Báo giá hiệu lực đến 30/09/2026',
    });
    const receiptButton = screen.getByRole('button', {
      name: 'Chọn Nhà cung cấp Minh Tâm, Phiếu nhập gần nhất ngày 12/09/2026',
    });
    const evidenceRegion = screen.getByLabelText('Bằng chứng nhà cung cấp');

    expect(within(evidenceRegion).getByText('Công ty Thực phẩm An Phát')).toBeVisible();
    expect(within(evidenceRegion).getByText('Nhà cung cấp Minh Tâm')).toBeVisible();
    expect(quotationButton).toHaveTextContent('Báo giá hiệu lực đến 30/09/2026. 42.000 ₫/kg');
    expect(receiptButton).toHaveTextContent('Phiếu nhập gần nhất ngày 12/09/2026. 315.000 ₫/thùng');
    expect(within(evidenceRegion).queryByText('Bằng chứng')).not.toBeInTheDocument();
    expect(quotationButton).toHaveAttribute('aria-pressed', 'false');
    expect(receiptButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(receiptButton);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(receipt);
    expect(quotationButton).toHaveAttribute('aria-pressed', 'false');
    expect(receiptButton).toHaveAttribute('aria-pressed', 'true');
    expect(within(evidenceRegion).getAllByText('Đang chọn')).toHaveLength(1);
  });
});
