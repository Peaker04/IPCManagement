import { useState } from 'react';
import { toNextReportCursor, useGetStockMovementPageQuery, type ReportCursor } from '@/features/workflow';

export function usePurchaseHandoff(enabled = true) {
  const [cursors, setCursors] = useState<ReportCursor[]>([]);
  const cursor = cursors.at(-1);
  const {
    data: response,
    isError,
    isFetching,
    refetch,
  } = useGetStockMovementPageQuery(
    {
      movementType: 'receipt',
      cursorDate: cursor?.cursorDate,
      cursorId: cursor?.cursorId,
      cursorOffset: cursor?.cursorOffset,
      limit: 8,
      sortDirection: 'desc',
    },
    { skip: !enabled },
  );

  const previous = () => setCursors((current) => current.slice(0, -1));
  const next = () => {
    const nextCursor = toNextReportCursor(response);
    if (nextCursor) setCursors((current) => [...current, nextCursor]);
  };

  return {
    movements: response?.items ?? [],
    response,
    page: cursors.length + 1,
    previous,
    next,
    // Sổ bàn giao rỗng vì lỗi tải khác hẳn với "chưa có lần nhập kho nào".
    isError,
    isRetrying: isFetching,
    retry: () => refetch(),
  };
}
