import { ClipboardList, Search, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DocumentRail,
  EmptyState,
  InlineAlert,
  PaginationBar,
  SectionPanel,
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
        <SectionPanel title="Tồn kho hiện tại" icon={<Warehouse size={18} />}>
          <label htmlFor="warehouse-current-stock-search" className="mb-3 grid gap-1 text-xs font-semibold text-slate-700">
            Tìm trong snapshot tồn kho hiện tại
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input id="warehouse-current-stock-search" type="search" value={currentStockSearch} onChange={(event) => onCurrentStockSearchChange(event.target.value)} placeholder="Kho, mã hoặc tên nguyên liệu, đơn vị" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200" />
            </span>
          </label>
          {currentStockView.phase === 'forbidden' && <InlineAlert title="Không có quyền xem tồn kho hiện tại" variant="danger" className="mb-3">{currentStockView.message}</InlineAlert>}
          {currentStockView.phase === 'error' && <EmptyState variant="error" className="mb-3" title="Không tải được tồn kho hiện tại" description="Vui lòng thử tải lại hoặc kiểm tra kết nối mạng." onRetry={() => currentStockView.retry?.()} isRetrying={currentStockView.isRetrying} />}
          {currentStockView.phase === 'ready' && currentStockView.isRefreshing && <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm border border-slate-200 bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm" role="status">Đang cập nhật...</span>}
          <TableViewport className="ipc-warehouse-table-shell min-h-[27rem]" ariaLabel="Bảng tồn kho hiện tại trong kho" caption="Danh sách tồn kho hiện tại trong kho">
            <table className="ipc-data-table">
              <thead><tr><th>Kho</th><th>Nguyên liệu</th><th className="text-right">Số lượng</th><th>Cập nhật</th></tr></thead>
              <tbody>
                {currentStockView.phase === 'loading' ? Array.from({ length: 8 }).map((_, index) => <tr key={`stock-skel-${index}`}><td colSpan={4} className="p-2"><div className="ipc-table-skeleton-cell h-8 w-full" /></td></tr>) : currentStockRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">{currentStockView.phase === 'forbidden' ? 'Không có quyền xem tồn kho' : isCurrentStockError ? 'Không tải được tồn kho' : 'Chưa có dữ liệu tồn kho'}</td></tr>
                ) : currentStockRows.map((row) => <tr key={row.id}><td>{row.warehouse}</td><td>{row.ingredient}</td><td className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit)}</td><td>{formatDateTime(row.lastUpdated)}</td></tr>)}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar page={currentStockPage} pageSize={currentStockPageSize} totalItems={currentStockTotalItems} onPageChange={onCurrentStockPageChange} />
        </SectionPanel>

        <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
          <label htmlFor="warehouse-stock-movement-search" className="mb-3 grid gap-1 text-xs font-semibold text-slate-700">
            Tìm bút toán theo chứng từ nguồn
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input id="warehouse-stock-movement-search" type="search" value={stockMovementSearch} onChange={(event) => onStockMovementSearchChange(event.target.value)} placeholder="Kho, nguyên liệu, loại, lý do hoặc ghi chú" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-200" />
            </span>
          </label>
          {stockMovementView.phase === 'forbidden' && <InlineAlert title="Không có quyền xem sổ luân chuyển kho" variant="danger" className="mb-3">{stockMovementView.message}</InlineAlert>}
          {stockMovementView.phase === 'error' && <EmptyState variant="error" className="mb-3" title="Không tải được sổ luân chuyển kho" description="Vui lòng thử tải lại để nạp lịch sử luân chuyển kho." onRetry={() => stockMovementView.retry?.()} isRetrying={stockMovementView.isRetrying} />}
          {stockMovementView.phase === 'ready' && stockMovementView.isRefreshing && <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm border border-slate-200 bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm" role="status">Đang cập nhật...</span>}
          {stockMovementView.phase === 'loading' ? (
            <div className="min-h-[380px] space-y-3 p-4" role="status" aria-label="Đang tải sổ luân chuyển kho"><div className="ipc-table-skeleton-cell h-8 w-full !bg-slate-100" />{Array.from({ length: 8 }).map((_, index) => <div key={index} className="ipc-table-skeleton-cell h-9 w-full" />)}</div>
          ) : stockMovementView.phase === 'uninitialized' ? <InlineAlert title="Chưa tải sổ luân chuyển" variant="info">{stockMovementView.instruction}</InlineAlert> : stockMovementView.phase === 'ready' ? (
            <StockMovementTable className="min-h-[27rem]" movements={stockMovements} cursorPagination={{ page: stockMovementPage, hasNext: stockMovementHasNext, onPrevious: onStockMovementPrevious, onNext: onStockMovementNext }} />
          ) : null}
        </SectionPanel>
      </div>
    </SplitWorkbench>
  );
}
