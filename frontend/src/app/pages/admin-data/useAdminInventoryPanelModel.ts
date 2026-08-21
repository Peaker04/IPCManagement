import { useState } from 'react';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import {
  useGetCurrentStockPageQuery,
  useGetStockMovementPageQuery,
  type ReportCursor,
} from '@/api/workflowApi';
import type { AdminView } from './adminDataPageTypes';
import { toAdminView } from './adminDataPageModelShared';

export function useAdminInventoryPanelModel(activeView: AdminView) {
  const [stockMovementCursors, setStockMovementCursors] = useState<ReportCursor[]>([]);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [inventoryMovementSearch, setInventoryMovementSearchState] = useState('');
  const deferredInventoryMovementSearch = useDebouncedValue(inventoryMovementSearch.trim(), 250);
  const stockMovementCursor = stockMovementCursors.at(-1);
  const stockMovementResult = useGetStockMovementPageQuery({
    movementType: 'adjustment',
    searchKeyword: deferredInventoryMovementSearch || undefined,
    cursorDate: stockMovementCursor?.cursorDate,
    cursorId: stockMovementCursor?.cursorId,
    cursorOffset: stockMovementCursor?.cursorOffset,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'inventory' });
  const stockMovementView = toAdminView(stockMovementResult, 'bút toán điều chỉnh kho');
  const currentStockQuery = useGetCurrentStockPageQuery(
    { pageNumber: currentStockPage, pageSize: 8 },
    { skip: activeView !== 'inventory' && activeView !== 'statistics' },
  );
  const currentStockView = toAdminView(currentStockQuery, 'tồn kho hiện tại');
  const currentStockPageResponse = currentStockView.phase === 'ready' ? currentStockView.data : undefined;
  const adjustmentMovements = stockMovementView.phase === 'ready' ? stockMovementView.data.items : [];
  const currentStockRows = currentStockPageResponse?.items ?? [];
  const setInventoryMovementSearch = (value: string) => {
    setInventoryMovementSearchState(value);
    setStockMovementCursors([]);
  };

  return {
    queryViews: {
      currentStock: currentStockView,
      stockMovements: stockMovementView,
    },
    adjustmentMovements,
    currentStockPage,
    currentStockPageResponse,
    currentStockRows,
    inventoryMovementSearch,
    setInventoryMovementSearch,
    setCurrentStockPage,
    setStockMovementCursors,
    stockMovementCursors,
    stockMovementResult,
  };
}
