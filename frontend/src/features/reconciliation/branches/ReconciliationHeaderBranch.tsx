import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ActionGuard } from '../../../components/ui/action-guard';
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
  onNavigateCooking?: () => void;
  onOpenDishes: () => void;
  canComplete: boolean;
  onOpenComplete: () => void;
  needsReviewCount: number;
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
  onNavigateCooking: _onNavigateCooking,
  onOpenDishes: _onOpenDishes,
  canComplete,
  onOpenComplete,
  needsReviewCount,
}: ReconciliationHeaderBranchProps) {
  const customerOptions = customers.map((c) => ({
    value: c.customerCode,
    label: `${c.customerCode} - ${c.customerName}`,
  }));

  const batchOptions = batches.length === 0
    ? [{ value: '', label: '(Chưa có lô đối soát)' }]
    : batches.map((b) => ({
        value: b.batchId,
        label: `${b.customerCode || b.customerName || 'Khách hàng'} · ${b.status} · ${b.batchId.slice(0, 8)}`,
      }));

  return (
    <WorkspaceHeader
      title="Đối soát nguyên liệu"
      breadcrumb="Đối soát MRX · Bàn điều khiển Giám sát"
      contextSelectors={
        activeReportTab === 'completed' ? (
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Lưu trữ hồ sơ các lô đối soát đã quyết toán vĩnh viễn
          </span>
        ) : (
          <>
            <Select
              aria-label="Chọn khách hàng đối soát"
              options={customerOptions}
              value={customerCode}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="h-9 w-40 sm:w-44 shrink-0 font-medium text-xs sm:text-sm"
              disabled={customers.length === 0}
            />
            <Select
              aria-label="Chọn lô đối soát"
              options={batchOptions}
              value={batchId}
              onChange={(e) => onSelectBatch(e.target.value)}
              className="h-9 w-44 sm:w-48 shrink-0 font-medium text-xs sm:text-sm"
              disabled={batches.length === 0}
            />
            <VietnameseDateInput
              aria-label="Ngày đối soát"
              value={serviceDate}
              onChange={onSelectDate}
              className="h-9 w-38 sm:w-40 min-w-[155px] shrink-0 font-mono text-xs sm:text-sm tracking-tight"
            />
            <WorkspaceHeader.BadgeSlot variant="status">
              {batchStatus ? (
                <Badge
                  variant={batchStatus === 'COMPLETED' ? 'neutral' : 'info'}
                  size="default"
                  className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
                >
                  {statusLabels[batchStatus] || batchStatus}
                </Badge>
              ) : null}
            </WorkspaceHeader.BadgeSlot>
          </>
        )
      }
      actions={
        activeReportTab === 'completed' ? (
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
            ) : batchStatus === 'IN_PROGRESS' ? (
              <span className="text-xs text-slate-500 font-medium">
                {needsReviewCount > 0
                  ? `Còn ${needsReviewCount} dòng chênh lệch cần xử lý`
                  : 'Chờ hoàn tất xuất kho các ngày'}
              </span>
            ) : null}
          </WorkspaceHeader.Actions>
        )
      }
    />
  );
}
