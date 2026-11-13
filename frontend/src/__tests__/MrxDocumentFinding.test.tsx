import { expect, it, vi } from 'vitest';
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
  expect(screen.getByRole('searchbox', { name: 'Tìm trong sổ chênh lệch' })).toBeDisabled();
  expect(screen.getByText('Chưa ghi nhận chênh lệch xuất kho')).toBeVisible();
  view.rerender(<ReconciliationVariancesBranch batchId="batch-1" report={{ rows: [row, { ...row, ingredientCode: 'DAU', ingredientName: 'Đậu hạt' }, { ...row, ingredientCode: 'MUOI', ingredientName: 'Muối', shiftName: 'Cả ngày' }], totalCount: 3 }} />);
  const quantities = within(screen.getByRole('row', { name: /Gạo tẻ/ })).getAllByRole('cell').slice(4, 7).map(cell => cell.textContent);
  expect(within(screen.getByRole('row', { name: /Gạo tẻ/ })).getByText('Sáng')).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong sổ chênh lệch' }), { target: { value: 'sang' } });
  expect(screen.getByText('Gạo tẻ')).toBeVisible();
  expect(screen.getByText('Đậu hạt')).toBeVisible();
  expect(screen.queryByText('Muối')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong sổ chênh lệch' }), { target: { value: '  DAU  HAT ' } });
  expect(screen.queryByText('Gạo tẻ')).not.toBeInTheDocument();
  expect(screen.getByText('Đậu hạt')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  expect(within(screen.getByRole('row', { name: /Muối/ })).getByText('Cả ngày')).toBeVisible();
  expect(within(screen.getByRole('row', { name: /Gạo tẻ/ })).getAllByRole('cell').slice(4, 7).map(cell => cell.textContent)).toEqual(quantities);
});

it('forwards source-history search and renders server results without discarding original audit facts', () => {
  // ReconciliationSourceChangeDto, ReconciliationContracts.cs.
  const change: MrxSourceChangeItem = {
    changeId: 'change-1', changedAt: '2026-10-19T05:00:00Z', actor: 'Điều phối', businessArea: 'WeeklyMenu',
    entityName: 'MenuItem', entityId: null, fieldName: 'Servings', oldValue: '100', newValue: '120', reason: 'Điều chỉnh số suất',
  };
  const matching = { ...change, changeId: 'change-2', reason: 'Đổi nguyên liệu', oldValue: 'Gạo', newValue: 'Đậu hạt' };
  const onSearchChange = vi.fn();
  const view = render(<ReconciliationAuditBranch auditSubTab="source" auditReport={null} sourceChanges={[change, matching]} onSearchChange={onSearchChange} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm trong lịch sử nguồn và BOM' }), { target: { value: '  DOI  NGUYEN LIEU ' } });
  expect(onSearchChange).toHaveBeenCalledWith('  DOI  NGUYEN LIEU ');
  view.rerender(<ReconciliationAuditBranch auditSubTab="source" auditReport={null} sourceChanges={[matching]} sourceTotalCount={1} searchTerm="  DOI  NGUYEN LIEU " onSearchChange={onSearchChange} />);
  expect(screen.queryByText('Điều chỉnh số suất')).not.toBeInTheDocument();
  expect(screen.getByText('Đổi nguyên liệu')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
  expect(onSearchChange).toHaveBeenLastCalledWith('');
  view.rerender(<ReconciliationAuditBranch auditSubTab="source" auditReport={null} sourceChanges={[change, matching]} onSearchChange={onSearchChange} />);
  expect(screen.getByText('Điều chỉnh số suất')).toBeVisible();
  expect(screen.getByText('100 suất')).toBeVisible();
  expect(screen.getByText('120 suất')).toBeVisible();
  expect(screen.getByTitle('Gốc: 100 → 120')).toBeVisible();
});
