import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReconciliationHeaderBranch } from '../features/reconciliation/branches/ReconciliationHeaderBranch';
import { MrxBatchHeaderBranch } from '../features/weekly-menu/branches/MrxBatchHeaderBranch';
import { MrxDailyHeaderBranch } from '../features/warehouse/branches/MrxDailyHeaderBranch';
import type { MrxBatch, MrxBatchSummary } from '../api/mrxApi';

describe('Zero-Jitter Header Geometry & Reserved Badge Anchors', () => {
  it('reserves fixed badge anchor slot when batchStatus is null, maintaining layout geometry', () => {
    const { container: emptyContainer } = render(
      <ReconciliationHeaderBranch
        activeReportTab="lines"
        customerCode="ANV"
        customers={[{ customerId: 'c1', customerCode: 'ANV', customerName: 'Amann' }]}
        onSelectCustomer={vi.fn()}
        batchId="b1"
        batches={[{
          batchId: 'b1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-14T00:00:00Z',
          customerId: 'c1', customerCode: 'ANV', customerName: 'Amann', weekStartDate: '2026-09-14', weekEndDate: '2026-09-20',
        } satisfies MrxBatchSummary]}
        onSelectBatch={vi.fn()}
        serviceDate="2026-09-14"
        onSelectDate={vi.fn()}
        batchStatus={undefined}
        statusLabels={{ IN_PROGRESS: 'Đang đối chiếu' }}
        isRefreshing={false}
        onRefresh={vi.fn()}
        canComplete={false}
        onOpenComplete={vi.fn()}
        needsReviewCount={0}
      />
    );

    // Reserved anchor slot exists with min-w-[110px]
    const slot = emptyContainer.querySelector('.min-w-\\[110px\\]');
    expect(slot).toBeInTheDocument();
    // Badge inside is not rendered yet
    expect(slot?.children.length).toBe(0);
  });

  it('renders badge inside reserved anchor slot without shifting surrounding elements', () => {
    const { container: populatedContainer } = render(
      <MrxBatchHeaderBranch
        customers={[{ customerId: 'c1', customerCode: 'ANV', customerName: 'Amann' }]}
        customerId="c1"
        onSelectCustomer={vi.fn()}
        weekStartDate="2026-09-14"
        onSelectWeekStartDate={vi.fn()}
        batch={{
          batchId: 'b1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-14T00:00:00Z',
          menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1', lines: [],
        } satisfies MrxBatch}
        source={null}
        statusLabels={{ IN_PROGRESS: 'Đang xuất ca' }}
        isSubmitting={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
        onOpenImport={vi.fn()}
        onOpenDishes={vi.fn()}
        isAdmin={false}
        changeInboxCount={0}
        onOpenReviewRequest={vi.fn()}
        hasSourceLines={false}
        onOpenSourceChange={vi.fn()}
        primaryAction={null}
      />
    );

    const slot = populatedContainer.querySelector('.min-w-\\[110px\\]');
    expect(slot).toBeInTheDocument();
    expect(slot?.querySelector('.animate-in')).toBeInTheDocument();
    expect(screen.getByText('Đang xuất ca')).toBeInTheDocument();
  });

  it('MrxDailyHeaderBranch: reserves badge anchor slot preserving header layout', () => {
    const { container } = render(
      <MrxDailyHeaderBranch
        batches={[{
          batchId: 'b1', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-21T00:00:00Z',
          customerId: 'c1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-09-21', weekEndDate: '2026-09-27',
        } satisfies MrxBatchSummary]}
        activeBatchId="b1"
        onSelectBatch={vi.fn()}
        activeDate="2026-09-21"
        onSelectDate={vi.fn()}
        isWeeklyAll={false}
        hasInitialIssue={false}
        onOpenSupplemental={vi.fn()}
        onFillAll={vi.fn()}
        onSubmit={vi.fn()}
        canSubmit={false}
        saving={false}
        linesCount={5}
      />
    );

    const slot = container.querySelector('.min-w-\\[110px\\]');
    expect(slot).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
  });
});
