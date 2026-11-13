import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ActionGuard } from '../../../components/ui/action-guard';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxBatchSummary } from '../../../api/mrxApi';
import type { CustomerOption } from '../../../types';

export interface ReconciliationHeaderBranchProps {
  isPending?: boolean;
  activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed';
  customerCode: string;
  customers: CustomerOption[];
  onSelectCustomer: (code: string) => void;
  batchId: string;
  batches: MrxBatchSummary[];
  selectedBatch?: MrxBatchSummary;
  selectedWeek?: string;
  batchCount: number;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onSelectBatch: (batch: MrxBatchSummary) => void;
  onOpenBatchPicker: () => void;
  batchStatus?: string;
  statusLabels: Record<string, string>;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  canComplete: boolean;
  onOpenComplete: () => void;
  needsReviewCount: number;
  catalogLoading?: boolean;
  completedFilters?: ReactNode;
}

export function ReconciliationHeaderBranch({
  isPending = false,
  activeReportTab,
  customerCode,
  customers,
  onSelectCustomer,
  batchId,
  batches,
  selectedBatch,
  selectedWeek,
  batchCount,
  selectedMonth,
  onSelectMonth,
  onSelectBatch,
  onOpenBatchPicker,
  batchStatus,
  statusLabels,
  isRefreshing,
  onRefresh,
  canComplete,
  onOpenComplete,
  needsReviewCount,
  catalogLoading,
  completedFilters,
}: ReconciliationHeaderBranchProps) {
  const customerOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const recentBatches = batches.slice(0, 5);
  const batchLabel = (batch: MrxBatchSummary) => {
    const sameWeek = recentBatches.filter(item => item.weekStartDate === batch.weekStartDate);
    const suffix = sameWeek.length > 1 ? ` (${sameWeek.findIndex(item => item.batchId === batch.batchId) + 1})` : '';
    return `${batch.customerCode || customerCode} · ${toVietnameseDate(batch.weekStartDate)}${suffix}`;
  };
  const batchOptions = recentBatches.map(batch => ({ value: batch.batchId, label: batchLabel(batch) }));
  if (!batchId) batchOptions.unshift({ value: '', label: catalogLoading ? 'Đang tải lô…' : 'Chưa có lô trong tháng' });
  if (batchCount > 5) batchOptions.push({ value: '__all__', label: `Xem tất cả ${batchCount} lô…` });
  const outsideRecent = Boolean(batchId && !recentBatches.some(batch => batch.batchId === batchId));
  const year = Number(selectedMonth.slice(0, 4));
  const month = String(Number(selectedMonth.slice(5, 7)));
  const currentYear = new Date().getFullYear();
  // A rolling window keeps the control compact; boundary options extend it in either direction.
  const years = Array.from({ length: Math.max(currentYear + 5, year + 5) - Math.min(currentYear - 10, year - 5) + 1 }, (_, i) => String(Math.min(currentYear - 10, year - 5) + i));

  return (
    <WorkspaceHeader
      responsive
      className="mrx-scope-header"
      title="Đối soát nguyên liệu"
      breadcrumb="Đối soát MRX · Bàn điều khiển Giám sát"
      contextSelectors={
        activeReportTab === 'completed' ? (
          completedFilters || <div className="min-h-9 flex items-center">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Lô đối soát đã hoàn tất
            </span>
          </div>
        ) : (
          <>
            <div className="w-full sm:w-36 xl:w-44 min-w-0 shrink-0"><Select
              aria-label="Chọn khách hàng đối soát"
              options={customerOptions}
              value={customerCode}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="h-9 w-full min-w-0 font-medium text-xs sm:text-sm"
              disabled={customers.length === 0}
            /></div>
            <div className="w-full sm:w-64 min-w-0 shrink-0"><Select
              aria-label="Chọn lô đối soát" value={batchId} className="h-9 w-full min-w-0 text-xs sm:text-sm"
              disabled={catalogLoading || batches.length === 0}
              options={[
                ...(outsideRecent ? [{ value: batchId, label: selectedBatch ? batchLabel(selectedBatch) : selectedWeek ? `${customerCode} · ${toVietnameseDate(selectedWeek)}` : 'Đang tải lô…', disabled: true }] : []),
                ...batchOptions,
              ]}
              onChange={event => {
                if (event.target.value === '__all__') onOpenBatchPicker();
                else { const batch = recentBatches.find(item => item.batchId === event.target.value); if (batch) onSelectBatch(batch); }
              }}
            /></div>
            <div className="w-28 shrink-0"><Select aria-label="Tháng đối soát" value={month} className="h-9 w-full text-xs sm:text-sm"
              options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }))}
              onChange={event => onSelectMonth(`${year}-${event.target.value.padStart(2, '0')}`)} /></div>
            <div className="w-24 shrink-0"><Select aria-label="Năm đối soát" value={String(year)} className="h-9 w-full text-xs sm:text-sm"
              options={years.map(value => ({ value, label: value }))}
              onChange={event => onSelectMonth(`${event.target.value}-${month.padStart(2, '0')}`)} /></div>
            <WorkspaceHeader.BadgeSlot variant="status">
              {isPending ? <span role="status" className="sr-only">Đang tải phạm vi mới</span> : batchStatus ? (
                <Badge
                  variant={batchStatus === 'COMPLETED' ? 'neutral' : 'info'}
                  size="default"
                  className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap"
                >
                  {statusLabels[batchStatus] || batchStatus}
                </Badge>
              ) : null}
            </WorkspaceHeader.BadgeSlot>
          </>
        )
      }
      actions={
        activeReportTab !== 'lines' ? (
          <WorkspaceHeader.Actions>
            <Button
              variant="outline"
              size="default"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 text-sm font-medium flex items-center gap-1.5"
            >
              <RefreshCw
                size={14}
                className={clsx('transition-transform', isRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span>Làm mới</span>
            </Button>
          </WorkspaceHeader.Actions>
        ) : (
          <WorkspaceHeader.Actions>
            <Button
              variant="outline"
              size="default"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 text-sm font-medium flex items-center gap-1.5"
            >
              <RefreshCw
                size={14}
                className={clsx('transition-transform', isRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span>Làm mới</span>
            </Button>
            {canComplete ? (
              <ActionGuard
                capabilityId="RECON.BATCH.COMPLETE"
                roles={['ADMIN', 'MANAGER', 'Quản lý']}
                permissions={['ReconciliationWriteAccess', 'reconciliation.complete', 'reconciliation.read']}
                allowedModes={['MATERIAL_RECONCILIATION']}
                mode="disable"
                reason="Chỉ khả dụng trong chế độ đối soát nguyên liệu."
              >
                <Button
                  variant="default"
                  size="default"
                  onClick={onOpenComplete}
                  className="h-9 text-sm font-medium"
                >
                  Chốt đối soát tuần
                </Button>
              </ActionGuard>
            ) : batchStatus === 'IN_PROGRESS' && needsReviewCount > 0 ? (
              <span className="text-xs text-slate-500 font-medium">
                {`Còn ${needsReviewCount} dòng chênh lệch cần xử lý`}
              </span>
            ) : null}
          </WorkspaceHeader.Actions>
        )
      }
    />
  );
}
