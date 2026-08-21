import { useDeferredValue, useState } from 'react';
import { useGetCurrentStockPageQuery, useGetStockMovementPageQuery } from '@/features/reports/reportsApi';
import { toNextReportCursor, type ReportCursor, type WorkflowReportQuery } from '@/api/workflowApiTypes';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import { formatDateTime } from '@/lib/formatters';
import type { StockMovement } from '@/types/workflow';
import {
  movementTypeLabel,
  readPageSize,
  standardPageSizeOptions,
  toReportView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';

type ReportsStockMovementViewModelArgs = {
  activeView: ReportView;
  initialPage: number;
  reportPageSize: number;
  reportQuery: WorkflowReportQuery;
  searchParams: URLSearchParams;
  sortDirection: 'desc' | 'asc';
};

export function useReportsStockMovementViewModel({ activeView, initialPage, reportPageSize, reportQuery, searchParams, sortDirection }: ReportsStockMovementViewModelArgs) {
  const [movementCursors, setMovementCursors] = useState<ReportCursor[]>([]);
  const [stockPageSize, setStockPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [stockPage, setStockPage] = useState(initialPage);
  const [stockSearch, setStockSearchState] = useState('');
  const [movementSearch, setMovementSearchState] = useState('');
  const deferredStockSearch = useDeferredValue(stockSearch.trim());
  const deferredMovementSearch = useDeferredValue(movementSearch.trim());
  const currentStockResult = useGetCurrentStockPageQuery({
    ...reportQuery,
    searchKeyword: deferredStockSearch || undefined,
    pageNumber: stockPage,
    pageSize: stockPageSize,
  }, { skip: activeView !== 'stock' });
  const movementCursor = movementCursors.at(-1);
  const stockMovementResult = useGetStockMovementPageQuery({
    ...reportQuery,
    cursorDate: movementCursor?.cursorDate,
    cursorId: movementCursor?.cursorId,
    cursorOffset: movementCursor?.cursorOffset,
    searchKeyword: deferredMovementSearch || undefined,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'movement' });
  const currentStockView = toReportView(currentStockResult, 'tồn kho hiện tại');
  const stockMovementView = toReportView(stockMovementResult, 'nhập xuất kho');
  const currentStockRows = currentStockView.phase === 'ready' ? currentStockView.data.items : [];
  const stockMovementRows = stockMovementView.phase === 'ready' ? stockMovementView.data.items : [];
  const openNextMovementPage = () => {
    const nextCursor = stockMovementView.phase === 'ready' && stockMovementView.data.hasNext
      ? toNextReportCursor(stockMovementView.data)
      : null;
    if (nextCursor) setMovementCursors((current) => [...current, nextCursor]);
  };
  const setStockSearch = (value: string) => {
    setStockSearchState(value);
    setStockPage(1);
  };
  const setMovementSearch = (value: string) => {
    setMovementSearchState(value);
    setMovementCursors([]);
  };
  const exportConfigs: Record<'stock' | 'movement', ReportExportConfig> = {
    stock: {
      filename: 'ton-kho-hien-tai',
      rows: currentStockRows,
      columns: [
        ['Kho', (row) => row.warehouse],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Số lượng hiện tại', (row) => row.currentQty],
        ['Đơn vị', (row) => row.unit],
        ['Cập nhật', (row) => formatDateTime(row.lastUpdated)],
      ],
    },
    movement: {
      filename: 'nhap-xuat-kho',
      rows: stockMovementRows,
      columns: [
        ['Chứng từ', (row) => row.documentNo],
        ['Loại', (row: StockMovement) => movementTypeLabel[row.type]],
        ['Nguyên liệu', (row) => row.material],
        ['Số lượng', (row) => row.quantity],
        ['Đơn vị', (row) => row.unit],
        ['Phụ trách', (row) => row.owner],
        ['Trạng thái', (row) => formatWorkflowStatus(row.status)],
      ],
    },
  };

  return {
    currentStockResult,
    currentStockRows,
    exportConfigs,
    movementCursor,
    movementCursors,
    movementSearch,
    openNextMovementPage,
    setMovementSearch,
    setMovementCursors,
    setStockSearch,
    setStockPage,
    setStockPageSize,
    stockMovementResult,
    stockMovementRows,
    stockPage,
    stockPageSize,
    stockSearch,
    views: { movement: stockMovementView, stock: currentStockView },
  };
}
