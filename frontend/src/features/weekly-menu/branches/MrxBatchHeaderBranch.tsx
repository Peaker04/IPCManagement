import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { VietnameseDateInput } from '../../../components/ui/vietnamese-date-input';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ActionGuard } from '../../../components/ui/action-guard';
import type { CustomerOption } from '../../../types';
import type { MrxBatch, MrxWeeklySource } from '../../../api/mrxApi';

export interface MrxBatchHeaderBranchProps {
  customers: CustomerOption[];
  customerId: string;
  onSelectCustomer: (id: string) => void;
  weekStartDate: string;
  onSelectWeekStartDate: (date: string) => void;
  batch: MrxBatch | null;
  source?: MrxWeeklySource | null;
  statusLabels: Record<string, string>;
  isSubmitting: boolean;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onOpenImport?: () => void;
  onOpenEditor?: () => void;
  onOpenDishes?: () => void;
  isAdmin?: boolean;
  changeInboxCount?: number;
  onOpenReviewRequest?: () => void;
  hasSourceLines?: boolean;
  onOpenSourceChange?: () => void;
  primaryAction: {
    label: string;
    action: () => void;
    capability: string;
  } | null;
}

export function MrxBatchHeaderBranch({
  customers,
  customerId,
  onSelectCustomer,
  weekStartDate,
  onSelectWeekStartDate,
  batch,
  source: _source,
  statusLabels,
  isSubmitting,
  isRefreshing,
  onRefresh,
  primaryAction,
}: MrxBatchHeaderBranchProps) {
  return (
    <WorkspaceHeader
      title="Chuẩn bị lô đối soát"
      breadcrumb="Đối soát MRX · Trạm Điều phối"
      contextSelectors={
        <>
          <Select
            aria-label="Chọn khách hàng MRX"
            options={customers.map((item) => ({
              value: item.customerId,
              label: `${item.customerCode} - ${item.customerName}`,
            }))}
            value={customerId}
            disabled={customers.length === 0}
            onChange={(e) => onSelectCustomer(e.target.value)}
            className="h-9 w-44 sm:w-52 font-medium text-sm"
          />
          <VietnameseDateInput
            aria-label="Tuần MRX bắt đầu"
            value={weekStartDate}
            onChange={onSelectWeekStartDate}
            className="h-9 w-36 font-mono text-sm"
          />
          <WorkspaceHeader.BadgeSlot variant="status">
            {batch ? (
              <Badge
                variant={batch.status === 'COMPLETED' ? 'neutral' : 'info'}
                size="default"
                className="h-8 px-2.5 text-xs font-semibold flex items-center shrink-0 whitespace-nowrap animate-in fade-in duration-150"
              >
                {statusLabels[batch.status] ?? batch.status}
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
            disabled={isSubmitting}
            onClick={onRefresh}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              size={14}
              className={clsx('transition-transform', isRefreshing && 'animate-spin')}
              aria-hidden="true"
            />
            <span>Làm mới</span>
          </Button>
          {primaryAction && (
            <ActionGuard
              capabilityId={primaryAction.capability}
              roles={['ADMIN', 'MANAGER', 'COORDINATOR', 'Điều phối']}
              permissions="reconciliation.source.read"
              allowedModes={['MATERIAL_RECONCILIATION']}
              mode="disable"
              reason="Chỉ Điều phối được thực hiện bước này trong chế độ MRX."
            >
              <Button
                variant="default"
                size="default"
                disabled={isSubmitting}
                onClick={primaryAction.action}
              >
                {isSubmitting ? 'Đang xử lý...' : primaryAction.label}
              </Button>
            </ActionGuard>
          )}
        </WorkspaceHeader.Actions>
      }
    />
  );
}
