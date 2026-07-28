import { SectionPanel, StockMovementTable } from '@/components/common';
import { toNextReportCursor } from '@/api/workflowApi';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, effectiveActiveView, queryViews, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <>
      {effectiveActiveView === 'inventory' && (
        <SectionPanel title="Điều chỉnh tồn và thông báo">
          <div id="admin-inventory-panel" role="tabpanel" aria-labelledby="admin-inventory-tab">
          <AdminQueryBoundary queries={[
            { label: 'tồn kho hiện tại', view: queryViews.currentStock },
            { label: 'lịch sử điều chỉnh tồn', view: queryViews.stockMovements },
          ]}>
            <StockMovementTable
            movements={adjustmentMovements}
            cursorPagination={{
              page: stockMovementCursors.length + 1,
              hasNext: stockMovementResult.data?.hasNext ?? false,
              isPending: stockMovementResult.isFetching,
              onPrevious: () => setStockMovementCursors((current) => current.slice(0, -1)),
              onNext: () => {
                const nextCursor = toNextReportCursor(stockMovementResult.data);
                if (nextCursor) setStockMovementCursors((current) => [...current, nextCursor]);
              },
              ariaLabel: 'Phân trang lịch sử điều chỉnh tồn',
            }}
            />
          </AdminQueryBoundary>
          </div>
        </SectionPanel>
      )}


    </>
  );
}
