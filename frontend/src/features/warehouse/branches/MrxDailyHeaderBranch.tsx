import type { ReactNode } from 'react';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { MRX_STATUS_LABELS } from '../../../constants/mrxConstants';
import { isServiceDate, toVietnameseDate } from '../../../utils/dates';
import type { MrxBatchSummary } from '../../../api/mrxApi';

export interface MrxDailyHeaderBranchProps {
  batches: MrxBatchSummary[];
  activeBatchId: string;
  activeBatchLabel?: string;
  batchStatus?: string;
  onSelectBatch: (id: string) => void;
  activeDate: string;
  onSelectDate: (date: string) => void;
  onDateValidationChange?: (message: string | null) => void;
  availableDates?: string[];
  isWeeklyAll: boolean;
  hasInitialIssue: boolean;
  onOpenSupplemental: () => void;
  onFillAll: () => void;
  onSubmit: () => void | Promise<void>;
  canSubmit: boolean;
  saving: boolean;
  scopeLocked?: boolean;
  linesCount: number;
  catalogNavigation?: ReactNode;
}

export function MrxDailyHeaderBranch({
  batches,
  activeBatchId,
  activeBatchLabel,
  batchStatus,
  onSelectBatch,
  activeDate,
  onSelectDate,
  onDateValidationChange,
  availableDates,
  isWeeklyAll,
  hasInitialIssue,
  onOpenSupplemental,
  onFillAll,
  onSubmit,
  canSubmit,
  saving,
  scopeLocked = false,
  linesCount,
  catalogNavigation,
}: MrxDailyHeaderBranchProps) {
  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.customerCode} - ${b.customerName} (${toVietnameseDate(b.weekStartDate)})`,
  }));

  const activeBatch = batches.find((b) => b.batchId === activeBatchId);
  const currentStatus = batchStatus ?? activeBatch?.status;

  return (
    <WorkspaceHeader
      responsive
      title="Xuất kho nguyên liệu theo ngày"
      breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
      contextSelectors={
        <>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="w-52 shrink-0 xl:w-60">
          <Select
            aria-label="Chọn lô đối soát xuất kho"
            options={activeBatchId && !batches.some((batch) => batch.batchId === activeBatchId)
              ? [{ value: activeBatchId, label: activeBatchLabel || 'Lô đang chọn (ngoài trang danh sách)' }, ...batchOptions]
              : batches.length === 0 ? [{ value: '', label: '(Chưa có lô đối soát)' }] : batchOptions}
            value={activeBatchId}
            disabled={scopeLocked || (batches.length === 0 && !activeBatchId)}
            onChange={(e) => onSelectBatch(e.target.value)}
            className="h-9 font-medium text-xs sm:text-sm"
          />
          </div>
          {catalogNavigation}
          </div>
          <VietnameseDateInput
            key={activeBatchId}
            required
            isDateAllowed={(date) => !availableDates || availableDates.includes(date)}
            validationMessage="Ngày phải thuộc lô đối soát đang chọn."
            onValidationChange={onDateValidationChange}
            aria-label="Ngày xuất kho"
            value={activeDate === 'ALL' ? (activeBatch?.weekStartDate || '') : activeDate}
            disabled={scopeLocked}
            onChange={onSelectDate}
            className="h-9 w-38 sm:w-40 min-w-[155px] shrink-0 font-mono text-xs sm:text-sm tracking-tight"
          />
          <WorkspaceHeader.BadgeSlot variant="status">
            {currentStatus ? (
              <Badge
                variant={currentStatus === 'COMPLETED' ? 'neutral' : 'info'}
                size="default"
                className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
              >
                {MRX_STATUS_LABELS[currentStatus] ?? 'Chưa xác định'}
              </Badge>
            ) : null}
          </WorkspaceHeader.BadgeSlot>
        </>
      }
      actions={
        <WorkspaceHeader.Actions>
          {!isWeeklyAll && !isServiceDate(activeDate) ? (
            <Badge variant="neutral" size="default">Ngày lịch sử · Chỉ xem</Badge>
          ) : isWeeklyAll ? (
            <Badge variant="neutral" size="default" className="h-9 px-3 text-xs flex items-center">
              Chế độ xem tổng hợp tuần (Chỉ đọc)
            </Badge>
          ) : linesCount === 0 ? (
            <Badge variant="neutral" size="default" className="h-9 px-3 text-xs flex items-center text-slate-500">
              Không có định lượng ca
            </Badge>
          ) : hasInitialIssue ? (
            <Button
              variant="default"
              size="default"
              disabled={scopeLocked}
              onClick={onOpenSupplemental}
            >
              Xuất bổ sung ca
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="default"
                disabled={scopeLocked}
                onClick={onFillAll}
              >
                Điền đủ toàn bộ
              </Button>
              <Button
                variant="default"
                size="default"
                onClick={() => void onSubmit()}
                disabled={!canSubmit}
              >
                {saving ? 'Đang ghi…' : 'Xác nhận xuất kho'}
              </Button>
            </>
          )}
        </WorkspaceHeader.Actions>
      }
    />
  );
}
