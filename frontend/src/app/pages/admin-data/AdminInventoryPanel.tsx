import { KeepAliveTabPanel, PaginatedTableFrame, PaginationBar, SearchField, SectionPanel } from '@/components/common';
import { StockMovementTable } from '@/components/common/StockMovementTable';
import { toNextReportCursor } from '@/api/workflowApiTypes';
import { formatDateTime, formatQuantityWithUnit } from '@/lib/formatters';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminInventoryPanelProps = { model: AdminDataPageModel };

export function AdminInventoryPanel({ model }: AdminInventoryPanelProps) {
  const { adjustmentMovements, currentStockPage, currentStockPageSize, currentStockPageResponse, currentStockRows, effectiveActiveView, inventoryMovementSearch, queryViews, setCurrentStockPage, setCurrentStockPageSize, setInventoryMovementSearch, setStockMovementCursors, stockMovementCursors, stockMovementResult } = model;
  return (
    <KeepAliveTabPanel id="admin-inventory" active={effectiveActiveView === 'inventory'} className="flex flex-col gap-4">
      <SectionPanel
        title="Tồn kho hiện tại"
        description="Snapshot hiện tại theo kho và nguyên liệu; lịch sử bút toán được theo dõi riêng bên dưới."
        descriptionPlacement="inline"
      >
        <AdminQueryBoundary queries={[{ label: 'tồn kho hiện tại', view: queryViews.currentStock }]}>
          <PaginatedTableFrame
            ariaLabel="Tồn kho hiện tại theo kho và nguyên liệu"
            caption="Snapshot tồn kho hiện tại theo kho và nguyên liệu"
          >
            <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
              <thead>
                <tr>
                  <th scope="col" className="text-left">Kho</th>
                  <th scope="col" className="text-left">Nguyên liệu</th>
                  <th scope="col" className="text-right">Số lượng</th>
                  <th scope="col" className="text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {currentStockRows.length === 0 ? (
                  <EmptyRow
                    colSpan={4}
                    label="Chưa có snapshot tồn kho hiện tại. Dữ liệu sẽ xuất hiện sau khi Kho phát sinh nhập, xuất hoặc điều chỉnh."
                  />
                ) : currentStockRows.map((row) => (
                  <tr key={`${row.warehouseId}-${row.ingredientId}`}>
                    <td className="text-left ipc-muted-cell">{row.warehouse}</td>
                    <td className="text-left font-medium">{row.ingredient}</td>
                    <td data-cell-role="numeric" className="font-semibold">{formatQuantityWithUnit(row.currentQty, row.unit, { maximumFractionDigits: 3 })}</td>
                    <td className="text-left tabular-nums ipc-muted-cell">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={currentStockPageResponse?.pageNumber ?? currentStockPage}
            pageSize={currentStockPageResponse?.pageSize ?? currentStockPageSize}
            totalItems={currentStockPageResponse?.totalCount ?? 0}
            pageSizeOptions={[8, 20, 50]}
            onPageSizeChange={(nextSize) => { setCurrentStockPageSize(nextSize); setCurrentStockPage(1); }}
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
          />
        }
      >
        <AdminQueryBoundary queries={[{ label: 'lịch sử điều chỉnh tồn', view: queryViews.stockMovements }]}>
          <StockMovementTable
            movements={adjustmentMovements}
            emptyTitle={inventoryMovementSearch.trim() ? 'Không có bút toán điều chỉnh tồn khớp bộ lọc.' : 'Chưa phát sinh bút toán điều chỉnh tồn kho.'}
            ariaLabel="Lịch sử điều chỉnh tồn kho"
            caption="Các bút toán điều chỉnh tồn kho theo thời gian"
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
