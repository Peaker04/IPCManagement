import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export type LineStatusFilter = 'ALL' | 'NEEDS_REVIEW' | 'DISPOSED' | 'MATCHED';

interface ReconciliationLinesFilterToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: LineStatusFilter;
  onStatusFilterChange: (filter: LineStatusFilter) => void;
  totalCount: number;
  needsReviewCount: number;
  disposedCount: number;
  matchedCount: number;
  onBulkDisposition?: () => void;
}

export function ReconciliationLinesFilterToolbar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  needsReviewCount,
  disposedCount,
  matchedCount,
  onBulkDisposition,
}: ReconciliationLinesFilterToolbarProps) {
  return (
    <div className="h-10 px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
      <Input
        aria-label="Tìm kiếm nguyên liệu đối soát"
        placeholder="Tìm theo tên hoặc mã nguyên liệu..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-7 w-64 text-xs"
      />
      <div className="flex items-center gap-1.5" role="toolbar" aria-label="Lọc trạng thái dòng">
        <Button
          type="button"
          variant={statusFilter === 'ALL' ? 'default' : 'outline'}
          size="xs"
          onClick={() => onStatusFilterChange('ALL')}
        >
          Tất cả ({totalCount})
        </Button>
        <Button
          type="button"
          variant={statusFilter === 'NEEDS_REVIEW' ? 'default' : 'outline'}
          size="xs"
          onClick={() => onStatusFilterChange('NEEDS_REVIEW')}
          className={statusFilter !== 'NEEDS_REVIEW' && needsReviewCount > 0 ? 'text-amber-700 border-amber-300' : ''}
        >
          Cần xử lý ({needsReviewCount})
        </Button>
        <Button
          type="button"
          variant={statusFilter === 'DISPOSED' ? 'default' : 'outline'}
          size="xs"
          onClick={() => onStatusFilterChange('DISPOSED')}
          className={statusFilter !== 'DISPOSED' && disposedCount > 0 ? 'text-emerald-700 border-emerald-300' : ''}
        >
          Đã giải trình ({disposedCount})
        </Button>
        <Button
          type="button"
          variant={statusFilter === 'MATCHED' ? 'default' : 'outline'}
          size="xs"
          onClick={() => onStatusFilterChange('MATCHED')}
        >
          Khớp định mức ({matchedCount})
        </Button>
        {onBulkDisposition && needsReviewCount > 1 && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onBulkDisposition}
            className="text-amber-800 border-amber-300 hover:bg-amber-100 font-semibold ml-1"
          >
            Giải trình hàng loạt ({needsReviewCount})
          </Button>
        )}
      </div>
    </div>
  );
}
