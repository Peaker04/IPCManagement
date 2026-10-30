import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { toVietnameseDate } from '../../../utils/dates';

export interface MrxDailyDateTabsBranchProps {
  dates?: readonly {
    serviceDate: string;
    lines: readonly { issuedQuantity?: number | null }[];
  }[];
  activeDate: string;
  onSelectDate: (date: string) => void;
  isWeeklyAll: boolean;
}

export function MrxDailyDateTabsBranch({
  dates = [],
  activeDate,
  onSelectDate,
  isWeeklyAll,
}: MrxDailyDateTabsBranchProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
      <span className="text-xs font-semibold text-slate-700 whitespace-nowrap mr-1">
        Lịch xuất ca:
      </span>
      <button
        type="button"
        onClick={() => onSelectDate('ALL')}
        className={clsx(
          'text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap',
          isWeeklyAll
            ? 'bg-slate-900 text-white font-bold shadow-2xs'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
        )}
      >
        Cả tuần (Tổng hợp)
      </button>

      {dates.map((d) => {
        const isSelected = d.serviceDate === activeDate;
        const dayLabel =
          ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][
            new Date(`${d.serviceDate}T00:00:00Z`).getUTCDay()
          ] ?? 'Ngày';
        const dateShort = toVietnameseDate(d.serviceDate).slice(0, 5);
        const hasIssued = d.lines.some((l) => (l.issuedQuantity ?? 0) > 0);

        return (
          <button
            key={d.serviceDate}
            type="button"
            title={`${dayLabel} · ${toVietnameseDate(d.serviceDate)}`}
            onClick={() => onSelectDate(d.serviceDate)}
            className={clsx(
              'text-xs px-2 sm:px-2.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap',
              isSelected
                ? 'bg-slate-900 text-white font-bold shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            )}
          >
            <span>{dayLabel}</span>
            <span className="hidden 2xl:inline"> ({dateShort})</span>
            {hasIssued && (
              <Check className="size-3 text-emerald-600 inline ml-1" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
