import { Button } from '../../components/ui/button';

interface ReconciliationBlockerStripProps {
  needsReviewCount: number;
  onFilterNeedsReview: () => void;
  onNavigateWarehouse?: () => void;
}

export function ReconciliationBlockerStrip({
  needsReviewCount,
  onFilterNeedsReview,
  onNavigateWarehouse,
}: ReconciliationBlockerStripProps) {
  return (
    <div
      role="status"
      className="px-4 py-2 text-xs font-medium border-b border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between shrink-0"
    >
      <span>
        <strong>Chưa thể chốt đối soát:</strong>{' '}
        {needsReviewCount > 0
          ? `Còn ${needsReviewCount} dòng chênh lệch cần giải trình trước khi chốt sổ tuần.`
          : 'Còn ngày trong tuần chưa xuất kho hoàn tất. Hãy kiểm tra lại tiến độ các ngày.'}
      </span>
      {needsReviewCount > 0 ? (
        <Button variant="outline" size="xs" onClick={onFilterNeedsReview}>
          Lọc dòng cần xử lý ({needsReviewCount})
        </Button>
      ) : onNavigateWarehouse ? (
        <Button variant="outline" size="xs" onClick={onNavigateWarehouse}>
          Mở trạm Kho xuất ngày →
        </Button>
      ) : null}
    </div>
  );
}
