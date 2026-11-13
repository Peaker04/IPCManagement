import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Num } from '../ui/num';

interface PaginationBarProps {
  label: string;
  hideVisibleLabel?: boolean;
  page: number;
  pageSize: number;
  totalCount?: number;
  totalPages?: number;
  hasPrev: boolean;
  hasNext: boolean;
  pending?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  placement?: 'footer' | 'toolbar' | 'selector';
}

export function PaginationBar({ label, hideVisibleLabel, page, pageSize, totalCount, totalPages, hasPrev, hasNext, pending, onPageChange, onPageSizeChange, placement = 'footer' }: PaginationBarProps) {
  const isSelector = placement === 'selector';
  const showNavigation = isSelector
    ? (totalPages !== undefined && totalPages > 1) || page > 1 || hasPrev || hasNext
    : totalPages === undefined || totalPages > 1 || page > 1 || hasPrev || hasNext;
  const showControls = showNavigation || Boolean(onPageSizeChange);
  // shortcut: reserve the <md floating-menu footprint; update if AppShell changes its trigger.
  return (
    <nav aria-label={label} aria-busy={pending || undefined} className={isSelector
      ? showControls ? 'inline-flex items-center gap-1 shrink-0' : 'sr-only'
      : `min-h-12 md:h-12 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 pt-1.5 shrink-0 ${placement === 'footer' ? 'pb-16 md:py-0' : 'pb-1.5 md:py-0'}`}>
      {isSelector ? <span className={`inline-block min-w-[6ch] text-right text-xs text-slate-500 whitespace-nowrap tabular-nums ${showControls ? '' : 'invisible'}`}>
        <span className="sr-only"><Num value={totalCount} /> lô · </span>{showControls && <><span className="sr-only">Trang </span>{page}/{totalPages ?? '—'}</>}
      </span> : <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
        {!hideVisibleLabel && <span className="font-medium text-slate-700">{label}</span>}
        <span>{totalPages !== 0 && <>Trang {page}/{totalPages ?? '—'} · </>}<span className="inline-block min-w-[3ch] text-right font-mono tabular-nums"><Num value={totalCount} /></span> kết quả</span>
      </div>}
      {showControls && <div className="flex flex-wrap items-center gap-1">
        {onPageSizeChange && <div className="w-36 shrink-0"><Select
          aria-label="Số dòng mỗi trang"
          value={pageSize}
          disabled={pending}
          onChange={event => onPageSizeChange(Number(event.target.value))}
          className="h-9 text-xs"
        >
          {Array.from(new Set([25, 50, 100, pageSize])).sort((a, b) => a - b).map(size => <option key={size} value={size}>{size} dòng/trang</option>)}
        </Select></div>}
        {showNavigation && <><Button variant="outline" size={isSelector ? 'icon' : 'default'} className={isSelector ? 'h-8 w-8 text-xs' : 'h-9 text-xs'} aria-label="Trang trước" title="Trang trước" disabled={!hasPrev || pending} onClick={() => onPageChange(page - 1)}>
          {isSelector ? <ChevronLeft size={14} aria-hidden="true" /> : 'Trang trước'}
        </Button>
        <Button variant="outline" size={isSelector ? 'icon' : 'default'} className={isSelector ? 'h-8 w-8 text-xs' : 'h-9 text-xs'} aria-label="Trang sau" title="Trang sau" disabled={!hasNext || pending} onClick={() => onPageChange(page + 1)}>
          {isSelector ? <ChevronRight size={14} aria-hidden="true" /> : 'Trang sau'}
        </Button></>}
      </div>}
    </nav>
  );
}
