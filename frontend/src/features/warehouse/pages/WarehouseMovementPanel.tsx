import { useState } from 'react';
import { ClipboardList, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import {
  RefreshStatus,
  DocumentRail,
  EmptyState,
  InlineAlert,
  KeepAliveTabPanel,
  PaginationBar,
  QueryErrorAlert,
  SearchField,
  SectionPanel,
  TableSkeleton,
  TableViewport,
  ViewSwitcher,
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
  canViewChef?: boolean;
  documentState?: 'loading' | 'error' | 'ready';
  onRetryDocuments?: () => void;
  isRetryingDocuments?: boolean;
  currentStockSearch: string;
  onCurrentStockSearchChange: (value: string) => void;
  currentStockView: QueryPresentation;
  currentStockRows: CurrentStockRow[];
  currentStockPage: number;
  currentStockPageSize: number;
  currentStockTotalItems: number;
  onCurrentStockPageChange: (page: number) => void;
  onCurrentStockPageSizeChange: (pageSize: number) => void;
  stockMovementSearch: string;
  onStockMovementSearchChange: (value: string) => void;
  stockMovementView: QueryPresentation;
  stockMovements: StockMovement[];
  stockMovementPage: number;
  stockMovementHasNext: boolean;
  onStockMovementPrevious: () => void;
  onStockMovementNext: () => void;
  activeTask?: 'stock' | 'ledger';
  onTaskChange?: (task: 'stock' | 'ledger') => void;
}

export function WarehouseMovementPanel({
  documents,
  canViewChef = false,
  documentState = 'ready',
  onRetryDocuments,
  isRetryingDocuments,
  currentStockSearch,
  onCurrentStockSearchChange,
  currentStockView,
  currentStockRows,
  currentStockPage,
  currentStockPageSize,
  currentStockTotalItems,
  onCurrentStockPageChange,
  onCurrentStockPageSizeChange,
  stockMovementSearch,
  onStockMovementSearchChange,
  stockMovementView,
  stockMovements,
  stockMovementPage,
  stockMovementHasNext,
  onStockMovementPrevious,
  onStockMovementNext,
  activeTask: activeTaskProp,
  onTaskChange,
}: WarehouseMovementPanelProps) {
  const [localTask, setLocalTask] = useState<'stock' | 'ledger'>('stock');
  const activeTask = activeTaskProp ?? localTask;
  const selectTask = (task: 'stock' | 'ledger') => {
    if (onTaskChange) onTaskChange(task);
    else setLocalTask(task);
  };
  return (
    <SplitWorkbench
      wideDetailRail={activeTask === 'stock'}
      detailLabel="Phiếu kho gần đây"
      detail={documentState === 'loading' ? <InlineAlert title="Đang tải phiếu kho" variant="info">Đang đồng bộ danh sách chứng từ kho.</InlineAlert> : documentState === 'error' ? <QueryErrorAlert title="Không tải được phiếu kho" isRetrying={isRetryingDocuments} onRetry={() => onRetryDocuments?.()}>Danh sách phiếu chưa được xác nhận. Hãy thử tải lại.</QueryErrorAlert> : (
        <>
        <p className="text-xs text-slate-600">Trích từ tối đa 20 chứng từ vận hành gần nhất, gồm cả loại ngoài Kho; không phải toàn bộ lịch sử phiếu kho.</p>
        <DocumentRail
          documents={documents}
          title={null}
          actionForDocument={(document) => document.type === 'Phiếu nhập' && document.documentId
            ? <Link className="ipc-button ipc-button-ghost" to={`/warehouse?view=receiving&receiptId=${encodeURIComponent(document.documentId)}`}>Xem phiếu nhập</Link>
            : document.route === ROUTES.CHEF_DASHBOARD && !canViewChef
            ? <span className="text-xs text-slate-600">Bếp phụ trách chứng từ này</span>
            : <Link className="ipc-button ipc-button-ghost" to={document.route}>Đến phân hệ</Link>}
        />
        </>
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <ViewSwitcher
          compact
          ariaLabel="Chọn dữ liệu tra cứu kho"
          tabs={[
            { id: 'warehouse-lookup-stock', label: 'Tồn kho hiện tại' },
            { id: 'warehouse-lookup-ledger', label: 'Sổ luân chuyển' },
          ]}
          activeTab={`warehouse-lookup-${activeTask}`}
          onTabChange={(id) => selectTask(id.replace('warehouse-lookup-', '') as 'stock' | 'ledger')}
        />
        <KeepAliveTabPanel id="warehouse-lookup-stock" active={activeTask === 'stock'} className="min-w-0">
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
          {currentStockView.phase === 'uninitialized' && <InlineAlert title="Chưa tải tồn kho hiện tại" variant="info">{currentStockView.instruction}</InlineAlert>}
          {currentStockView.phase === 'ready' && currentStockView.isRefreshing && <RefreshStatus>Đang cập nhật...</RefreshStatus>}
          {(currentStockView.phase === 'loading' || currentStockView.phase === 'ready') && <>
            <TableViewport className="ipc-warehouse-table-shell" ariaLabel="Tồn kho hiện tại theo kho và nguyên liệu" caption="Snapshot tồn kho hiện tại theo kho và nguyên liệu">
              <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
                <thead>
                  <tr>
                    <th scope="col" className="text-left">Kho</th>
                    <th scope="col" className="text-left">Nguyên liệu</th>
                    <th scope="col" className="text-right">Số lượng</th>
                    <th scope="col" className="text-center">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStockView.phase === 'loading' ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <tr key={`stock-skel-${index}`}>
                        <td colSpan={4} className="p-2.5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                      </tr>
                    ))
                  ) : currentStockRows.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-slate-500">{currentStockSearch.trim() ? <>Không tìm thấy snapshot tồn kho khớp “{currentStockSearch.trim()}”. <button type="button" className="font-medium text-blue-700 underline" onClick={() => onCurrentStockSearchChange('')}>Xóa tìm kiếm</button></> : 'Chưa có snapshot tồn kho hiện tại.'}</td></tr>
                  ) : currentStockRows.map((row) => (
                    <tr key={row.id}>
                      <td className="text-slate-700">{row.warehouse}</td>
                      <td className="font-medium text-slate-900">{row.ingredient}</td>
                      <td data-cell-role="numeric" className="text-right tabular-nums font-semibold text-slate-900">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                      <td className="text-center tabular-nums text-slate-600">{formatDateTime(row.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableViewport>
            {currentStockView.phase === 'ready' && <PaginationBar page={currentStockPage} pageSize={currentStockPageSize} totalItems={currentStockTotalItems} pageSizeOptions={[8, 20, 50]} onPageSizeChange={onCurrentStockPageSizeChange} onPageChange={onCurrentStockPageChange} />}
          </>}
        </SectionPanel>
        </KeepAliveTabPanel>

        <KeepAliveTabPanel id="warehouse-lookup-ledger" active={activeTask === 'ledger'} className="min-w-0">
        <SectionPanel title="Sổ luân chuyển kho" icon={<ClipboardList size={18} />} description="Mặc định hiển thị bút toán từ 31 ngày trước đến hôm nay; tìm kiếm chỉ trong phạm vi này.">
          <div className="space-y-3 px-4 pb-4 pt-2">
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
            <StockMovementTable
              movements={stockMovements}
              ariaLabel="Sổ luân chuyển kho"
              caption="Các bút toán nhập, xuất, trả và điều chỉnh kho"
              emptyTitle={stockMovementSearch.trim() ? 'Không có bút toán khớp bộ lọc.' : 'Không có bút toán trong phạm vi mặc định.'}
              cursorPagination={{ page: stockMovementPage, hasNext: stockMovementHasNext, onPrevious: onStockMovementPrevious, onNext: onStockMovementNext }}
            />
          ) : null}
          </div>
        </SectionPanel>
        </KeepAliveTabPanel>
      </div>
    </SplitWorkbench>
  );
}
