import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import {
  warehouseApi,
  type WarehouseItem,
  type InventoryReceiptItem,
  type InventoryIssueItem,
} from '../../api/warehouseApi';
import { formatVietnameseDate } from '../../utils/dates';

export function WarehousePage() {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView: 'issues' | 'receipts' | 'stock' =
    requestedView === 'receipts' || requestedView === 'stock' ? requestedView : 'issues';

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('ALL');
  const [issues, setIssues] = useState<InventoryIssueItem[]>([]);
  const [receipts, setReceipts] = useState<InventoryReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [whs, iss, rcp] = await Promise.all([
        warehouseApi.getWarehouses(),
        warehouseApi.getIssues(),
        warehouseApi.getReceipts(),
      ]);
      setWarehouses(whs);
      setIssues(iss);
      setReceipts(rcp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Không thể tải dữ liệu kho vận.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const [whs, iss, rcp] = await Promise.all([
          warehouseApi.getWarehouses(),
          warehouseApi.getIssues(),
          warehouseApi.getReceipts(),
        ]);
        if (!ignore) {
          setWarehouses(whs);
          setIssues(iss);
          setReceipts(rcp);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err : new Error('Không thể tải dữ liệu kho vận.'));
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      ignore = true;
    };
  }, []);

  const warehouseOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'Tất cả các kho' },
      ...warehouses.map((w) => ({ value: w.warehouseId, label: `${w.warehouseCode} - ${w.warehouseName}` })),
    ];
  }, [warehouses]);

  const activeViewLabel =
    activeView === 'receipts' ? 'Phiếu nhập kho' : activeView === 'stock' ? 'Tồn kho hiện tại' : 'Phiếu xuất kho';

  // Tab 1: Issues Columns
  const issueColumns: ColumnDef<InventoryIssueItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu xuất',
      width: '20%',
      cell: (row) => <IdentifierText value={row.issueCode} />,
    },
    {
      id: 'date',
      header: 'Ngày xuất',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.issueDate)}
        </span>
      ),
    },
    {
      id: 'shift',
      header: 'Ca áp dụng',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.shiftName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho xuất hàng',
      width: '26%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số mặt hàng',
      width: '12%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount} dòng</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'ISSUED' ? 'success' : row.status === 'CONFIRMED' ? 'info' : 'neutral'}
          size="sm"
        >
          {row.status === 'ISSUED' ? 'Đã xuất kho' : row.status === 'CONFIRMED' ? 'Đã nhận đủ' : 'Dự thảo'}
        </Badge>
      ),
    },
  ];

  // Tab 2: Receipts Columns
  const receiptColumns: ColumnDef<InventoryReceiptItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu nhập',
      width: '20%',
      cell: (row) => <IdentifierText value={row.receiptCode} />,
    },
    {
      id: 'date',
      header: 'Ngày nhập',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.receiptDate)}
        </span>
      ),
    },
    {
      id: 'supplier',
      header: 'Nhà cung cấp',
      width: '26%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm truncate block">{row.supplierName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho tiếp nhận',
      width: '20%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số dòng',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount} dòng</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'POSTED' ? 'success' : row.status === 'APPROVED' ? 'info' : 'neutral'}
          size="sm"
        >
          {row.status === 'POSTED' ? 'Đã nhập kho' : row.status === 'APPROVED' ? 'Đã duyệt' : 'Dự thảo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Kho nguyên liệu & Nhập xuất"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc kho vận hành"
              options={warehouseOptions}
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="h-9 w-72 font-medium text-sm"
            />
            <Badge variant="success" size="default" className="h-9 px-3 text-sm font-medium flex items-center">
              Kho đang hoạt động
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="default"
              onClick={loadData}
              className="h-9 text-sm font-medium"
            >
              Làm mới
            </Button>
            <span className="text-xs text-slate-500 max-w-80">
              Phiếu xuất phải bắt đầu từ yêu cầu vật tư đã duyệt.
            </span>
          </>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Đang xem: {activeViewLabel}</span>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng phiếu:</span>
              <strong className="text-slate-900 font-mono font-bold">{issues.length + receipts.length} chứng từ</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Kho vận hành:</span>
              <strong className="text-slate-900 font-semibold">{warehouses.length} kho</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">
              Tồn kho: Chưa có nguồn dữ liệu
            </Badge>
          </>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={isLoading}
        error={error}
        onRetry={loadData}
        isEmpty={
          !isLoading &&
          !error &&
          ((activeView === 'issues' && issues.length === 0) ||
            (activeView === 'receipts' && receipts.length === 0))
        }
        emptyTitle={activeView === 'issues' ? 'Chưa có phiếu xuất kho' : 'Chưa có phiếu nhập kho'}
        emptyDescription={
          activeView === 'issues'
            ? 'Không có phiếu xuất kho nào phù hợp với bộ lọc.'
            : 'Không có phiếu nhập kho nào phù hợp với bộ lọc.'
        }
      >
        {activeView === 'issues' && (
          <DataGrid<InventoryIssueItem>
            data={issues}
            columns={issueColumns}
            keyExtractor={(row) => row.issueId}
          />
        )}

        {activeView === 'receipts' && (
          <DataGrid<InventoryReceiptItem>
            data={receipts}
            columns={receiptColumns}
            keyExtractor={(row) => row.receiptId}
          />
        )}

        {activeView === 'stock' && (
          <StateBoundary
            isEmpty
            emptyScenario="prerequisite-blocked"
            emptyTitle="Chưa có nguồn tồn kho hiện tại"
            emptyDescription="Tồn kho hiện tại phải đến từ snapshot có thẩm quyền; không thể suy ra từ phiếu nhập và phiếu xuất với tồn đầu kỳ bằng 0."
          >
            <div />
          </StateBoundary>
        )}
      </StateBoundary>
    </div>
  );
}
