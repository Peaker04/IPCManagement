import { Button } from '../../components/ui/button';

interface ReconciliationBlockerStripProps {
  isPending?: boolean;
  hasResolvedStatus?: boolean;
  isPreviousScope?: boolean;
  pendingMessage?: string;
  needsReviewCount: number;
  onFilterNeedsReview: () => void;
  onNavigateWarehouse?: () => void;
  isBlocked?: boolean;
  isCompleted?: boolean;
}

export function ReconciliationBlockerStrip({
  isPending = false,
  hasResolvedStatus = true,
  isPreviousScope = false,
  pendingMessage = 'Đang xác minh trạng thái lô đã chọn…',
  needsReviewCount,
  onFilterNeedsReview,
  onNavigateWarehouse,
  isBlocked = true,
  isCompleted = false,
}: ReconciliationBlockerStripProps) {
  if (isPending && !hasResolvedStatus) return <div role="status" aria-busy="true" className="h-11 px-4 border-b border-slate-200 bg-slate-50 shrink-0"><span className="sr-only">{pendingMessage}</span></div>;
  if (!isBlocked) {
    return (
      <div
        role="status"
        aria-busy={isPending || undefined}
        className="h-11 px-4 text-xs font-medium border-b border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap"
      >
        {isPending && <span className="sr-only">{pendingMessage}</span>}
        <span className="truncate">
          {!(isPending && isPreviousScope) && <><strong>{isCompleted ? 'Trạng thái đối soát:' : 'Sẵn sàng chốt đối soát:'}</strong>{' '}
          {isCompleted
            ? 'Lô đối soát tuần đã hoàn tất và đóng băng số liệu.'
            : 'Các ngày trong tuần đã hoàn tất xuất kho và xử lý chênh lệch.'}</>}
        </span>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-busy={isPending || undefined}
      className="h-11 px-4 text-xs font-medium border-b border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap"
    >
      {isPending && <span className="sr-only">{pendingMessage}</span>}
      <span className="truncate">
        {!(isPending && isPreviousScope) && <><strong>Chưa thể chốt đối soát:</strong>{' '}
        {needsReviewCount > 0
          ? `Còn ${needsReviewCount} dòng chênh lệch cần giải trình trước khi chốt sổ tuần.`
          : 'Chờ Kho hoàn tất xuất nguyên liệu cho các ngày còn lại trong tuần. Bạn có thể chọn ngày để xem tiến độ.'}</>}
      </span>
      {needsReviewCount > 0 ? (
        <Button variant="outline" size="xs" className="shrink-0" disabled={isPending} onClick={onFilterNeedsReview}>
          Lọc dòng cần xử lý ({needsReviewCount})
        </Button>
      ) : onNavigateWarehouse ? (
        <Button variant="outline" size="xs" className="shrink-0" disabled={isPending} onClick={onNavigateWarehouse}>
          Mở trạm Kho xuất ngày →
        </Button>
      ) : null}
    </div>
  );
}
