import { useState } from 'react';
import { useGetStockMovementPageQuery } from '@/features/workflow';

export function usePurchaseHandoff(enabled = true) {
  const [cursors, setCursors] = useState<Array<{ cursorDate: string; cursorId?: string }>>([]);
  const cursor = cursors.at(-1);
  const { data: response } = useGetStockMovementPageQuery(
    {
      movementType: 'receipt',
      cursorDate: cursor?.cursorDate,
      cursorId: cursor?.cursorId,
      limit: 8,
      sortDirection: 'desc',
    },
    { skip: !enabled },
  );

  const previous = () => setCursors((current) => current.slice(0, -1));
  const next = () => {
    if (!response?.nextCursorDate) return;
    setCursors((current) => [...current, { cursorDate: response.nextCursorDate!, cursorId: response.nextCursorId }]);
  };

  return { movements: response?.items ?? [], response, page: cursors.length + 1, previous, next };
}
