import { Search } from 'lucide-react';
import { SectionPanel, StockMovementTable } from '@/components/common';
import { toNextReportCursor } from '@/api/workflowApi';
import { Input } from '@/components/ui/input';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, effectiveActiveView, inventoryMovementSearch, queryViews, setInventoryMovementSearch, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <>
      {effectiveActiveView === 'inventory' && (
        <SectionPanel title="Điều chỉnh tồn và thông báo">
          <div id="admin-inventory-panel" role="tabpanel" aria-labelledby="admin-inventory-tab">
          <AdminQueryBoundary queries={[
            { label: 'tồn kho hiện tại', view: queryViews.currentStock },
            { label: 'lịch sử điều chỉnh tồn', view: queryViews.stockMovements },
          ]}>
            <label htmlFor="admin-inventory-movement-search" className="mb-3 grid max-w-xl gap-1 text-xs font-semibold text-slate-700">
              Tìm bút toán điều chỉnh tồn
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input id="admin-inventory-movement-search" type="search" value={inventoryMovementSearch} onChange={(event) => setInventoryMovementSearch(event.target.value)} placeholder="Kho, nguyên liệu, lý do hoặc ghi chú" className="h-9 pl-9" />
              </span>
            </label>
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
