import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StateBoundary } from '../components/workbench/StateBoundary';
import { LocalizedBoundary } from '../components/workbench/LocalizedBoundary';
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { ReconciliationAuditBranch } from '../features/reconciliation/branches/ReconciliationAuditBranch';
import { ReconciliationReportTables } from '../features/reconciliation/ReconciliationReportTables';
import { ReconciliationBlockerStrip } from '../features/reconciliation/ReconciliationBlockerStrip';
import { MrxBatchDishesModal } from '../components/workbench/MrxBatchDishesModal';
import { mrxApi } from '../api/mrxApi';

describe('Shared loading presentation timing and interaction safety', () => {
  afterEach(() => vi.useRealTimers());

  it('preserves blocker tone and existing action identity during a pending day read', () => {
    const props = { needsReviewCount: 2, isBlocked: true, onFilterNeedsReview: vi.fn() };
    const view = render(<ReconciliationBlockerStrip {...props} />);
    const strip = screen.getByRole('status');
    const action = screen.getByRole('button', { name: 'Lọc dòng cần xử lý (2)' });
    view.rerender(<ReconciliationBlockerStrip {...props} isPending />);
    expect(screen.getByRole('button', { name: 'Lọc dòng cần xử lý (2)' })).toBe(action);
    expect(action).toBeDisabled();
    expect(strip).toHaveClass('bg-amber-50', 'border-amber-200');
    expect(strip).toHaveAttribute('aria-busy', 'true');
  });

  it('uses the shared nonpainting cold placeholder in the frozen-dishes dialog', () => {
    vi.spyOn(mrxApi, 'getBatchDishes').mockImplementation(() => new Promise(() => {}));
    render(<MrxBatchDishesModal isOpen batchId="cold-dialog" onClose={() => {}} />);
    const placeholder = screen.getByRole('status', { name: 'Đang tải nội dung' });
    expect(placeholder).toHaveAttribute('data-loading-phase', 'reserved');
    expect(screen.queryByText('Đang tải dữ liệu món ăn đông cứng…')).not.toBeInTheDocument();
  });

  it('reserves geometry immediately but never paints marks for a fast cold response', () => {
    vi.useFakeTimers();
    const view = render(<StateBoundary isLoading loadingGeometry={{ kind: 'table', columns: 4, rows: 5 }}><button>Ready action</button></StateBoundary>);
    const placeholder = screen.getByRole('status', { name: 'Đang tải nội dung' });
    expect(placeholder.querySelectorAll('[data-skeleton-row]')).toHaveLength(5);
    expect(placeholder).toHaveAttribute('data-loading-phase', 'reserved');
    act(() => vi.advanceTimersByTime(80));
    expect(placeholder).toHaveAttribute('data-loading-phase', 'reserved');
    view.rerender(<StateBoundary isLoading={false}><button>Ready action</button></StateBoundary>);
    expect(screen.getByRole('button', { name: 'Ready action' })).toBeEnabled();
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
  });

  it.each(['direct', 'localized', 'audit'] as const)('%s owner defers marks and settles without a minimum hold', owner => {
    vi.useFakeTimers();
    const element = owner === 'direct' ? <WorkbenchSkeleton geometry={{ kind: 'table' }} />
      : owner === 'localized' ? <LocalizedBoundary isLoading><div>Rows</div></LocalizedBoundary>
      : <ReconciliationAuditBranch pending auditReport={null} sourceChanges={null} />;
    const view = render(element);
    const placeholder = screen.getByRole('status', { name: 'Đang tải nội dung' });
    act(() => vi.advanceTimersByTime(149));
    expect(placeholder).toHaveAttribute('data-loading-phase', 'reserved');
    act(() => vi.advanceTimersByTime(1));
    expect(placeholder).toHaveAttribute('data-loading-phase', 'visible');
    view.rerender(<StateBoundary error={new Error('Read failed')}><div /></StateBoundary>);
    expect(screen.getByText('Read failed')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
  });

  it('keeps stale content inert without painting a divider-like progress stroke', () => {
    const view = render(<StateBoundary hasExistingData isPreviousData><button>Stale row action</button></StateBoundary>);
    expect(screen.getByRole('button', { name: 'Stale row action' }).parentElement).toHaveAttribute('inert');
    expect(view.container.querySelector('.h-0\\.5')).toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toHaveClass('sr-only');
  });

  it('owns the paint gate for a custom skeleton without caller-specific marks', () => {
    vi.useFakeTimers();
    const view = render(<StateBoundary isLoading customSkeleton={<div className="border bg-slate-100">Unmarked placeholder</div>}><div>Ready</div></StateBoundary>);
    const decoration = screen.getByText('Unmarked placeholder').closest('[data-skeleton-mark]');
    expect(decoration).not.toBeNull();
    expect(decoration?.closest('[data-loading-phase]')).toHaveAttribute('data-loading-phase', 'reserved');
    act(() => vi.advanceTimersByTime(160));
    view.rerender(<StateBoundary><div>Ready</div></StateBoundary>);
    view.rerender(<StateBoundary isLoading customSkeleton={<div>Unmarked placeholder</div>}><div>Ready</div></StateBoundary>);
    expect(screen.getByText('Unmarked placeholder').closest('[data-loading-phase]')).toHaveAttribute('data-loading-phase', 'reserved');
  });

  it('report paging retains its content and busy guard without a second painted stroke', () => {
    const view = render(<ReconciliationReportTables activeTab="audit" batchId="batch" isReportLoading hasExactReport
      variancesReport={null} transactionsReport={null} transactionPage={1} onTransactionPageChange={() => {}}
      auditReport={{ rows: [], totalCount: 0 }} />);
    expect(view.container.querySelector('[inert][aria-busy="true"]')).not.toBeNull();
    expect(view.container.querySelector('.h-0\\.5')).toBeNull();
  });
});
