import { KeepAliveTabPanel, PaginatedTableFrame, PaginationBar, SearchField, SectionPanel } from '@/components/common';
import { StockMovementTable } from '@/components/common/StockMovementTable';
import { toNextReportCursor } from '@/api/workflowApiTypes';
import { formatDateTime, formatQuantityWithUnit } from '@/lib/formatters';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, currentStockPage, currentStockPageResponse, currentStockRows, effectiveActiveView, inventoryMovementSearch, queryViews, setCurrentStockPage, setInventoryMovementSearch, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <KeepAliveTabPanel id="admin-inventory" active={effectiveActiveView === 'inventory'} className="flex flex-col gap-4">
      <SectionPanel title="Tồn kho hiện tại">
        <AdminQueryBoundary queries={[{ label: 'tồn kho hiện tại', view: queryViews.currentStock }]}>
          <PaginatedTableFrame ariaLabel="Bảng snapshot tồn kho trong trang admin">
            <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
              <thead>
                <tr>
                  <th className="text-left">Kho</th>
                  <th className="text-left">Nguyên liệu</th>
                  <th className="text-right">Số lượng</th>
                  <th className="text-center">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {currentStockRows.length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.map((row) => (
                  <tr key={`${row.warehouseId}-${row.ingredientId}`}>
                    <td className="text-left text-slate-700">{row.warehouse}</td>
                    <td className="text-left font-medium text-slate-900">{row.ingredient}</td>
                    <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })}</td>
                    <td className="text-center tabular-nums text-slate-600">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={currentStockPageResponse?.pageNumber ?? currentStockPage}
            pageSize={currentStockPageResponse?.pageSize ?? 8}
            totalItems={currentStockPageResponse?.totalCount ?? 0}
            onPageChange={setCurrentStockPage}
          />
        </AdminQueryBoundary>
      </SectionPanel>

      <SectionPanel
        title="Lịch sử điều chỉnh tồn"
        description="Theo dõi các bút toán điều chỉnh tồn kho theo thời gian."
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
        <AdminQueryBoundary queries={[{ label: 'lịch sử điều chỉnh tồn', view: queryViews.stockMovements }]}>
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
