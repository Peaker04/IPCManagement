import { expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReconciliationVariancesBranch } from '../features/reconciliation/branches/ReconciliationVariancesBranch';
import { ReconciliationAuditBranch } from '../features/reconciliation/branches/ReconciliationAuditBranch';
import type { MrxSourceChangeItem, MrxVarianceRegisterReport } from '../api/mrxApi';

it('finds variance rows locally and restores unchanged canonical quantities on clear', () => {
  // MrxVarianceRegisterRowDto / MrxVarianceRegisterReportDto, ReconciliationContracts.cs.
  const row: MrxVarianceRegisterReport['rows'][number] = {
    batchId: 'batch-1', customerName: 'Khách A', serviceDate: '2026-10-19', shiftName: 'MORNING',
    ingredientCode: 'GAO', ingredientName: 'Gạo tẻ', canonicalUnitName: 'kg',
    requiredQuantity: 1.5, issuedQuantity: 2.25, difference: 0.75, varianceType: 'OVER_ISSUED',
    dispositionCategory: null, dispositionReason: null, disposedBy: null, disposedAt: null, issueNotes: [],
  };
  const view = render(<ReconciliationVariancesBranch batchId="batch-1" report={{ rows: [], totalCount: 0 }} />);
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.getByText('Chưa ghi nhận chênh lệch xuất kho')).toBeVisible();
  view.rerender(<ReconciliationVariancesBranch batchId="batch-1" report={{ rows: [row, { ...row, ingredientCode: 'DAU', ingredientName: 'Đậu hạt' }], totalCount: 2 }} />);
  const quantities = within(screen.getByRole('row', { name: /Gạo tẻ/ })).getAllByRole('cell').slice(4, 7).map(cell => cell.textContent);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong sổ chênh lệch' }), { target: { value: '  DAU  HAT ' } });
  expect(screen.queryByText('Gạo tẻ')).not.toBeInTheDocument();
  expect(screen.getByText('Đậu hạt')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  expect(within(screen.getByRole('row', { name: /Gạo tẻ/ })).getAllByRole('cell').slice(4, 7).map(cell => cell.textContent)).toEqual(quantities);
});

it('finds complete source history by its displayed reason without discarding original audit facts', () => {
  // ReconciliationSourceChangeDto, ReconciliationContracts.cs.
  const change: MrxSourceChangeItem = {
    changeId: 'change-1', changedAt: '2026-10-19T05:00:00Z', actor: 'Điều phối', businessArea: 'WeeklyMenu',
    entityName: 'MenuItem', entityId: null, fieldName: 'Servings', oldValue: '100', newValue: '120', reason: 'Điều chỉnh số suất',
  };
  render(<ReconciliationAuditBranch auditSubTab="source" auditReport={null} sourceChanges={[change, { ...change, changeId: 'change-2', reason: 'Đổi nguyên liệu', oldValue: 'Gạo', newValue: 'Đậu hạt' }]} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong lịch sử nguồn và BOM' }), { target: { value: '  DOI  NGUYEN LIEU ' } });
  expect(screen.queryByText('Điều chỉnh số suất')).not.toBeInTheDocument();
  expect(screen.getByText('Đổi nguyên liệu')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  expect(screen.getByText('Điều chỉnh số suất')).toBeVisible();
  expect(screen.getByText('100')).toBeVisible();
  expect(screen.getByText('120')).toBeVisible();
});
