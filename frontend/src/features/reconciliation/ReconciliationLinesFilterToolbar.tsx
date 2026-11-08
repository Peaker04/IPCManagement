import { useId } from 'react';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { Input } from '../../components/ui/input';

export type LineStatusFilter = 'ALL' | 'NEEDS_REVIEW' | 'DISPOSED' | 'MATCHED';

interface ReconciliationLinesFilterToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: LineStatusFilter;
  onStatusFilterChange: (filter: LineStatusFilter) => void;
  totalCount: number;
  visibleCount: number;
  onClear: () => void;
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
  visibleCount,
  onClear,
  needsReviewCount,
  disposedCount,
  matchedCount,
  onBulkDisposition,
}: ReconciliationLinesFilterToolbarProps) {
  const scopeId = useId();
  return (
    <div className="px-4 py-1 border-b border-slate-100 bg-white flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
      <label htmlFor={scopeId} className="text-xs font-medium text-slate-700">Tìm trong dòng ngày</label>
      <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
        <Input id={scopeId} aria-label="Tìm kiếm nguyên liệu đối soát" aria-describedby={`${scopeId}-help`}
          placeholder="Tên hoặc mã không dấu..." value={searchTerm}
          onChange={event => onSearchChange(event.target.value)} className="h-9 min-w-0 sm:w-48 text-xs" />
        <Button variant="outline" className="h-9 text-xs shrink-0" aria-label="Xóa bộ lọc đối soát" disabled={!searchTerm && statusFilter === 'ALL'} onClick={onClear}>Xóa</Button>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5" role="toolbar" aria-label="Lọc trạng thái dòng">
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
      <p id={`${scopeId}-help`} className="sr-only">Chỉ lọc hiển thị; không đổi giải trình hàng loạt.</p>
      <p role="status" aria-label="Kết quả tìm nguyên liệu đối soát" className="sr-only">Hiển thị <Num value={visibleCount} />/<Num value={totalCount} /> dòng ngày</p>
    </div>
  );
}
