import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ActionGuard } from '../../../components/ui/action-guard';
import { toVietnameseDate, weekStartFor } from '../../../utils/dates';
import type { CustomerOption } from '../../../types';
import type { MrxBatchSummary } from '../../../api/mrxApi';

export interface ReconciliationHeaderBranchProps {
  activeReportTab: 'lines' | 'variances' | 'transactions' | 'audit' | 'completed';
  customerCode: string;
  customers: CustomerOption[];
  onSelectCustomer: (code: string) => void;
  batchId: string;
  batches: MrxBatchSummary[];
  onSelectBatch: (id: string) => void;
  serviceDate: string;
  onSelectDate: (date: string) => void;
  batchStatus?: string;
  statusLabels: Record<string, string>;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  canComplete: boolean;
  onOpenComplete: () => void;
  needsReviewCount: number;
  catalogLoading?: boolean;
  catalogNavigation?: ReactNode;
}

export function ReconciliationHeaderBranch({
  activeReportTab,
  customerCode,
  customers,
  onSelectCustomer,
  batchId,
  batches,
  onSelectBatch,
  serviceDate,
  onSelectDate,
  batchStatus,
  statusLabels,
  isRefreshing,
  onRefresh,
  canComplete,
  onOpenComplete,
  needsReviewCount,
  catalogLoading,
  catalogNavigation,
}: ReconciliationHeaderBranchProps) {
  const customerOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const batchOptions = batches.length === 0
    ? [{ value: '', label: '(Chưa có lô đối soát)' }]
    : batches.map((b) => ({
        value: b.batchId,
        label: `${b.customerCode || b.customerName || 'Khách hàng'} · ${toVietnameseDate(b.weekStartDate)}`,
      }));

  if (batchId && !batches.some((batch) => batch.batchId === batchId)) {
    batchOptions.unshift({ value: batchId, label: `${customerCode || 'Lô đã chọn'} · ${toVietnameseDate(weekStartFor(serviceDate))}` });
  }

  return (
    <WorkspaceHeader
      responsive
      title="Đối soát nguyên liệu"
      breadcrumb="Đối soát MRX · Bàn điều khiển Giám sát"
      contextSelectors={
        activeReportTab === 'completed' ? (
          <div className="min-h-9 flex items-center">
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
            <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="w-full sm:w-36 xl:w-48 min-w-0 shrink-0"><Select
              aria-label="Chọn lô đối soát"
              options={batchOptions}
              value={batchId}
              onChange={(e) => onSelectBatch(e.target.value)}
              className="h-9 w-full min-w-0 font-medium text-xs sm:text-sm"
              disabled={catalogLoading || (!batchId && batches.length === 0)}
            /></div>
            {catalogNavigation}
            </div>
            {activeReportTab === 'lines' ? <VietnameseDateInput
              aria-label="Ngày đối soát"
              value={serviceDate}
              onChange={onSelectDate}
              className="h-9 w-38 sm:w-40 min-w-[155px] shrink-0 font-mono text-xs sm:text-sm tracking-tight"
            /> : <span className="text-xs text-slate-500">Phạm vi: cả lô</span>}
            <WorkspaceHeader.BadgeSlot variant="status">
              {batchStatus ? (
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
