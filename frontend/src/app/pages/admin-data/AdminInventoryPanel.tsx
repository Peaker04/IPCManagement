import { QueryErrorAlert, SectionPanel, StockMovementTable } from '@/components/common';
import { toNextReportCursor } from '@/api/workflowApi';
import type { AdminDataPageModel } from './useAdminDataPageModel';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, effectiveActiveView, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <>
      {effectiveActiveView === 'inventory' && (
        <SectionPanel title="Điều chỉnh tồn và thông báo">
          <div id="admin-inventory-panel" role="tabpanel" aria-labelledby="admin-inventory-tab">
          {stockMovementResult.isError && (
            <QueryErrorAlert
              title="Không tải được lịch sử điều chỉnh tồn"
              isRetrying={stockMovementResult.isFetching}
              onRetry={stockMovementResult.refetch}
            >
              Danh sách bút toán đang trống vì lỗi tải dữ liệu, không phải vì kho không có điều chỉnh nào.
            </QueryErrorAlert>
          )}
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
          </div>
        </SectionPanel>
      )}


    </>
  );
}
