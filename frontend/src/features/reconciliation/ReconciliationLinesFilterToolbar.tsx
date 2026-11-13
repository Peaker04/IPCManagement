import { useId, useRef, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Num } from '../../components/ui/num';
import { Input } from '../../components/ui/input';

export type LineStatusFilter = 'ALL' | 'NEEDS_REVIEW' | 'DISPOSED' | 'MATCHED';

interface ReconciliationLinesFilterToolbarProps {
  isSearchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  isPending?: boolean;
  dayNavigation: ReactNode;
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
  isSearchOpen,
  onSearchOpenChange,
  isPending = false,
  dayNavigation,
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
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const hasSearch = Boolean(searchTerm.trim());
  function closeSearch() {
    onSearchOpenChange(false);
    searchToggle.current?.focus();
  }
  return (
    <div className="reconciliation-lines-toolbar" aria-busy={isPending || undefined}>
      {isSearchOpen ? <div id={`${scopeId}-search`} className="reconciliation-search-controls" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); }
      }}>
        <Input ref={searchInput} id={scopeId} autoFocus aria-label="Tìm kiếm nguyên liệu đối soát" aria-describedby={`${scopeId}-help`}
          placeholder="Tên hoặc mã không dấu..." value={searchTerm}
          onChange={event => onSearchChange(event.target.value)} className="h-8 min-w-0 text-xs" />
        <Button variant="outline" className="h-8 text-xs shrink-0" aria-label="Xóa bộ lọc đối soát" disabled={!searchTerm && statusFilter === 'ALL'} onClick={() => { onClear(); searchInput.current?.focus(); }}>Xóa</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Đóng tìm kiếm nguyên liệu" onClick={closeSearch}><X size={16} /></Button>
      </div> : dayNavigation}
      <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5" role="toolbar" aria-label="Lọc trạng thái dòng">
        <Button
          type="button"
          variant="outline"
          className="reconciliation-status-filter"
          data-tone="neutral"
          aria-pressed={statusFilter === 'ALL'}
          size="xs"
          onClick={() => onStatusFilterChange('ALL')}
        >
          Tất cả ({totalCount})
        </Button>
        <Button
          type="button"
          variant="outline"
          data-tone="warning"
          aria-pressed={statusFilter === 'NEEDS_REVIEW'}
          size="xs"
          onClick={() => onStatusFilterChange('NEEDS_REVIEW')}
          className="reconciliation-status-filter"
        >
          Cần xử lý ({needsReviewCount})
        </Button>
        <Button
          type="button"
          variant="outline"
          data-tone="info"
          aria-pressed={statusFilter === 'DISPOSED'}
          size="xs"
          onClick={() => onStatusFilterChange('DISPOSED')}
          className="reconciliation-status-filter"
        >
          Đã giải trình ({disposedCount})
        </Button>
        <Button
          type="button"
          variant="outline"
          className="reconciliation-status-filter"
          data-tone="success"
          aria-pressed={statusFilter === 'MATCHED'}
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
      {isPending && <span role="status" className="sr-only">Đang tải phạm vi mới; số đếm thuộc dữ liệu trước.</span>}
      <Button ref={searchToggle} variant="outline" size="sm" className="shrink-0 w-24"
        aria-label={isSearchOpen ? 'Thu gọn tìm kiếm nguyên liệu' : hasSearch ? 'Tìm kiếm nguyên liệu đang lọc' : 'Mở tìm kiếm nguyên liệu'}
        aria-expanded={isSearchOpen} aria-controls={isSearchOpen ? `${scopeId}-search` : undefined}
        onClick={() => isSearchOpen ? closeSearch() : onSearchOpenChange(true)}>
        <Search size={16} /><span>{hasSearch ? 'Đang lọc' : 'Tìm kiếm'}</span>
      </Button>
      <p id={`${scopeId}-help`} className="sr-only">Chỉ lọc hiển thị; không đổi giải trình hàng loạt.</p>
      <p role="status" aria-label="Kết quả tìm nguyên liệu đối soát" className="sr-only">Hiển thị <Num value={visibleCount} />/<Num value={totalCount} /> dòng ngày</p>
    </div>
  );
}
