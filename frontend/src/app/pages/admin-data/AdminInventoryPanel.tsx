import { KeepAliveTabPanel, SearchField, SectionPanel } from '@/components/common';
import { StockMovementTable } from '@/components/common/StockMovementTable';
import { toNextReportCursor } from '@/api/workflowApiTypes';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, effectiveActiveView, inventoryMovementSearch, queryViews, setInventoryMovementSearch, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <KeepAliveTabPanel id="admin-inventory" active={effectiveActiveView === 'inventory'} className="flex flex-col gap-4">
      <SectionPanel
        title="Điều chỉnh tồn và thông báo"
        description="Theo dõi lịch sử các bút toán điều chỉnh tồn kho và số lượng tồn hiện hành."
        actions={
          <SearchField
            id="admin-inventory-movement-search"
            label="Tìm bút toán điều chỉnh tồn"
            hideLabel
            width="compact"
            value={inventoryMovementSearch}
            onChange={(event) => setInventoryMovementSearch(event.target.value)}
            placeholder="Tìm kho, nguyên liệu, lý do..."
            inputClassName="bg-slate-50 text-xs focus:bg-white"
          />
        }
      >
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
      </SectionPanel>
    </KeepAliveTabPanel>
  );
}
