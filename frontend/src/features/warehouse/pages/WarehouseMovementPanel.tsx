import { ClipboardList, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  RefreshStatus,
  DocumentRail,
  EmptyState,
  InlineAlert,
  PaginationBar,
  SearchField,
  SectionPanel,
  TableSkeleton,
  TableViewport,
} from '@/components/common';
import { SplitWorkbench } from '@/components/common/SplitWorkbench';
import { StockMovementTable } from '@/components/common/StockMovementTable';
import { formatDateTime, formatQuantityWithUnit } from '@/lib/formatters';
import type { CurrentStockRow } from '@/api/workflowApiTypes';
import type { StockMovement, WorkflowDocument } from '@/types/workflow';

interface QueryPresentation {
  phase: 'uninitialized' | 'loading' | 'ready' | 'error' | 'forbidden';
  message?: string;
  instruction?: string;
  retry?: () => void;
  isRetrying?: boolean;
  isRefreshing?: boolean;
}

interface WarehouseMovementPanelProps {
  documents: WorkflowDocument[];
  currentStockSearch: string;
  onCurrentStockSearchChange: (value: string) => void;
  currentStockView: QueryPresentation;
  currentStockRows: CurrentStockRow[];
  currentStockPage: number;
  currentStockPageSize: number;
  currentStockTotalItems: number;
  onCurrentStockPageChange: (page: number) => void;
  stockMovementSearch: string;
  onStockMovementSearchChange: (value: string) => void;
  stockMovementView: QueryPresentation;
  stockMovements: StockMovement[];
  stockMovementPage: number;
  stockMovementHasNext: boolean;
  onStockMovementPrevious: () => void;
  onStockMovementNext: () => void;
}

export function WarehouseMovementPanel({
  documents,
  currentStockSearch,
  onCurrentStockSearchChange,
  currentStockView,
  currentStockRows,
  currentStockPage,
  currentStockPageSize,
  currentStockTotalItems,
  onCurrentStockPageChange,
  stockMovementSearch,
  onStockMovementSearchChange,
  stockMovementView,
  stockMovements,
  stockMovementPage,
  stockMovementHasNext,
  onStockMovementPrevious,
  onStockMovementNext,
}: WarehouseMovementPanelProps) {
  const isCurrentStockError = currentStockView.phase === 'error' || currentStockView.phase === 'forbidden';

  return (
    <SplitWorkbench
      wideDetailRail
      detailLabel="Phiếu kho"
      detail={(
        <DocumentRail
          documents={documents}
          title={null}
          actionForDocument={(document) => (
            <Link className="ipc-button ipc-button-ghost" to={document.route}>Mở phiếu</Link>
          )}
        />
      )}
    >
      <div className="flex flex-col gap-4">
        <SectionPanel
          title="Tồn kho hiện tại"
          icon={<Warehouse size={18} />}
          description="Tra cứu số lượng tồn thực tế của từng nguyên liệu theo các kho."
          actions={
            <SearchField
              id="warehouse-current-stock-search"
              label="Tìm trong snapshot tồn kho hiện tại"
              hideLabel
              width="standard"
              value={currentStockSearch}
              onChange={(event) => onCurrentStockSearchChange(event.target.value)}
              placeholder="Tìm kho, mã, nguyên liệu..."
            />
          }
        >
          {currentStockView.phase === 'forbidden' && <InlineAlert title="Không có quyền xem tồn kho hiện tại" variant="danger" className="mb-3">{currentStockView.message}</InlineAlert>}
          {currentStockView.phase === 'error' && <EmptyState variant="error" className="mb-3" title="Không tải được tồn kho hiện tại" description="Vui lòng thử tải lại hoặc kiểm tra kết nối mạng." onRetry={() => currentStockView.retry?.()} isRetrying={currentStockView.isRetrying} />}
          {currentStockView.phase === 'ready' && currentStockView.isRefreshing && <RefreshStatus>Đang cập nhật...</RefreshStatus>}
          <TableViewport className="ipc-warehouse-table-shell" ariaLabel="Bảng tồn kho hiện tại trong kho" caption="Danh sách tồn kho hiện tại trong kho">
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
                {currentStockView.phase === 'loading' ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={`stock-skel-${index}`}>
                      <td colSpan={4} className="p-2.5">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : currentStockRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">{currentStockView.phase === 'forbidden' ? 'Không có quyền xem tồn kho' : isCurrentStockError ? 'Không tải được tồn kho' : 'Chưa có dữ liệu tồn kho'}</td></tr>
                ) : currentStockRows.map((row) => (
                  <tr key={row.id}>
                    <td className="text-slate-700">{row.warehouse}</td>
                    <td className="font-medium text-slate-900">{row.ingredient}</td>
                    <td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                    <td className="text-center tabular-nums text-slate-600">{formatDateTime(row.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar page={currentStockPage} pageSize={currentStockPageSize} totalItems={currentStockTotalItems} onPageChange={onCurrentStockPageChange} />
        </SectionPanel>

        <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
          <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
          <SearchField
            id="warehouse-stock-movement-search"
            label="Tìm bút toán theo chứng từ nguồn"
            width="full"
            value={stockMovementSearch}
            onChange={(event) => onStockMovementSearchChange(event.target.value)}
            placeholder="Kho, nguyên liệu, loại, lý do hoặc ghi chú"
          />
          {stockMovementView.phase === 'forbidden' && <InlineAlert title="Không có quyền xem sổ luân chuyển kho" variant="danger" className="mb-3">{stockMovementView.message}</InlineAlert>}
          {stockMovementView.phase === 'error' && <EmptyState variant="error" className="mb-3" title="Không tải được sổ luân chuyển kho" description="Vui lòng thử tải lại để nạp lịch sử luân chuyển kho." onRetry={() => stockMovementView.retry?.()} isRetrying={stockMovementView.isRetrying} />}
          {stockMovementView.phase === 'ready' && stockMovementView.isRefreshing && <RefreshStatus>Đang cập nhật...</RefreshStatus>}
          {stockMovementView.phase === 'loading' ? (
            <TableSkeleton columns={6} rows={8} ariaLabel="Đang tải sổ luân chuyển kho..." />
          ) : stockMovementView.phase === 'uninitialized' ? <InlineAlert title="Chưa tải sổ luân chuyển" variant="info">{stockMovementView.instruction}</InlineAlert> : stockMovementView.phase === 'ready' ? (
            <StockMovementTable movements={stockMovements} cursorPagination={{ page: stockMovementPage, hasNext: stockMovementHasNext, onPrevious: onStockMovementPrevious, onNext: onStockMovementNext }} />
          ) : null}
          </div>
        </SectionPanel>
      </div>
    </SplitWorkbench>
  );
}
