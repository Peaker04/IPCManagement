import type { ReactNode } from 'react';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { isServiceDate, weekStartFor } from '../../../utils/dates';
import { MrxDailyDateTabsBranch } from './MrxDailyDateTabsBranch';

export interface MrxPrepHeaderBranchProps {
  activeDate: string;
  scopeLocked: boolean;
  customerSelector: ReactNode;
  wholeWeek: boolean;
  onScopeChange: (date: string, wholeWeek: boolean) => void;
  canExport: boolean;
  downloading: boolean;
  onDownload: () => void;
}

export function MrxPrepHeaderBranch({ activeDate, scopeLocked, customerSelector, wholeWeek, onScopeChange, canExport, downloading, onDownload }: MrxPrepHeaderBranchProps) {
  const weekStart = weekStartFor(activeDate);
  const dates = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(`${weekStart}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return { serviceDate: date.toISOString().slice(0, 10), lines: [] };
  });
  return <>
    <WorkspaceHeader responsive title="Chuẩn bị nguyên liệu đa khách hàng" breadcrumb="Đối soát MRX · Kho nguyên liệu"
      contextSelectors={<>
        <VietnameseDateInput aria-label="Tuần chuẩn bị" value={weekStart} disabled={scopeLocked}
          onChange={date => onScopeChange(weekStartFor(date), wholeWeek)} className="h-9 w-40 font-mono text-sm" />
        {customerSelector}
      </>}
      actions={<WorkspaceHeader.Actions>
        <Button variant="default" size="sm" disabled={!canExport} onClick={onDownload}>{downloading ? 'Đang tải Excel…' : 'Xuất Excel chuẩn bị'}</Button>
      </WorkspaceHeader.Actions>} />
    <div role="group" aria-label="Phạm vi chuẩn bị" className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-5">
      <MrxDailyDateTabsBranch dates={dates} activeDate={isServiceDate(activeDate) ? activeDate : weekStart} isWeeklyAll={wholeWeek} disabled={scopeLocked}
        label="" showDates
        onSelectDate={date => onScopeChange(date === 'ALL' ? weekStart : date, date === 'ALL')} />
    </div>
  </>;
}
