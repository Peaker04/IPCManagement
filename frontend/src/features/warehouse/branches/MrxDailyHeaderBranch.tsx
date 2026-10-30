import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import type { MrxBatchSummary } from '../../../api/mrxApi';

export interface MrxDailyHeaderBranchProps {
  batches: MrxBatchSummary[];
  activeBatchId: string;
  onSelectBatch: (id: string) => void;
  activeDate: string;
  onSelectDate: (date: string) => void;
  onNavigatePreparation: () => void;
  onNavigateTransactions?: () => void;
  isWeeklyAll: boolean;
  hasInitialIssue: boolean;
  onOpenSupplemental: () => void;
  onFillAll: () => void;
  onSubmit: () => void | Promise<void>;
  canSubmit: boolean;
  saving: boolean;
  linesCount: number;
}

export function MrxDailyHeaderBranch({
  batches,
  activeBatchId,
  onSelectBatch,
  activeDate,
  onSelectDate,
  onNavigatePreparation,
  onNavigateTransactions: _onNavigateTransactions,
  isWeeklyAll,
  hasInitialIssue,
  onOpenSupplemental,
  onFillAll,
  onSubmit,
  canSubmit,
  saving,
  linesCount,
}: MrxDailyHeaderBranchProps) {
  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.customerCode} - ${b.customerName} (${b.weekStartDate}) - ${b.status}`,
  }));

  const activeBatch = batches.find((b) => b.batchId === activeBatchId);

  return (
    <WorkspaceHeader
      title="Xuất kho nguyên liệu theo ngày"
      breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
      contextSelectors={
        <>
          <Select
            aria-label="Chọn lô đối soát xuất kho"
            options={batches.length === 0 ? [{ value: '', label: '(Chưa có lô đối soát)' }] : batchOptions}
            value={activeBatchId}
            disabled={batches.length === 0}
            onChange={(e) => onSelectBatch(e.target.value)}
            className="h-9 w-52 sm:w-60 font-medium text-xs sm:text-sm shrink-0"
          />
          <VietnameseDateInput
            aria-label="Ngày xuất kho"
            value={activeDate === 'ALL' ? (activeBatch?.weekStartDate || '') : activeDate}
            onChange={onSelectDate}
            className="h-9 w-38 sm:w-40 min-w-[155px] shrink-0 font-mono text-xs sm:text-sm tracking-tight"
          />
          <WorkspaceHeader.BadgeSlot variant="status">
            {activeBatch ? (
              <Badge
                variant={activeBatch.status === 'COMPLETED' ? 'neutral' : 'info'}
                size="default"
                className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
              >
                {activeBatch.status}
              </Badge>
            ) : null}
          </WorkspaceHeader.BadgeSlot>
        </>
      }
      actions={
        <WorkspaceHeader.Actions>
          <Button
            variant="outline"
            size="default"
            onClick={onNavigatePreparation}
          >
            Chuẩn bị phối hợp
          </Button>
          {isWeeklyAll ? (
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
              onClick={onOpenSupplemental}
            >
              Xuất bổ sung ca
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="default"
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
