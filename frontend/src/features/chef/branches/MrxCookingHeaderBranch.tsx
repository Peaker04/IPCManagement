import type { ReactNode } from 'react';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { MRX_SHIFT_OPTIONS } from '../../../constants/mrxConstants';
import { toVietnameseDate, weekStartFor } from '../../../utils/dates';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import type { MrxBatchSummary, MrxKitchenCooking } from '../../../api/mrxApi';

export interface MrxCookingHeaderBranchProps {
  batches: MrxBatchSummary[];
  batchId: string;
  onSelectBatch: (id: string) => void;
  selectedShift: 'ALL' | 'MORNING' | 'AFTERNOON';
  onSelectShift: (shift: 'ALL' | 'MORNING' | 'AFTERNOON') => void;
  isPending?: boolean;
  data: MrxKitchenCooking | null;
  catalogNavigation?: ReactNode;
  actions?: ReactNode;
}

export function MrxCookingHeaderBranch({
  batches,
  batchId,
  onSelectBatch,
  selectedShift,
  onSelectShift,
  isPending = false,
  data,
  catalogNavigation,
  actions,
}: MrxCookingHeaderBranchProps) {
  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.customerCode || b.customerName || 'Khách hàng'} · ${toVietnameseDate(b.weekStartDate)}`,
  }));

  const sessionScope = workspaceSessionStore.getScope();
  const fallbackWeek = data?.rows[0]?.serviceDate ? weekStartFor(data.rows[0].serviceDate) : (sessionScope.batchId === batchId ? sessionScope.weekStartDate : '');
  const fallbackCustomer = sessionScope.batchId === batchId ? (sessionScope.customerCode || sessionScope.customerName) : '';
  const fallbackBatchLabel = fallbackCustomer || fallbackWeek
    ? `${fallbackCustomer || 'Lô đã chọn'}${fallbackWeek ? ` · ${toVietnameseDate(fallbackWeek)}` : ''}`
    : 'Lô đã chọn';

  return (
    <WorkspaceHeader
      responsive
      className="mrx-scope-header"
      title="Phiếu nấu theo lô"
      breadcrumb="Đối soát MRX · Bếp trưởng"
      actions={actions ? <WorkspaceHeader.Actions>{actions}</WorkspaceHeader.Actions> : undefined}
      contextSelectors={
        <>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="w-52 xl:w-72 max-w-full">
            <Select
              aria-label="Chọn lô đối soát nấu"
              options={batchId && !batches.some(batch => batch.batchId === batchId)
                ? [{ value: batchId, label: fallbackBatchLabel }, ...batchOptions]
                : !batchId ? [{ value: '', label: '(Chưa chọn lô đối soát)' }, ...batchOptions] : batchOptions}
              value={batchId}
              disabled={batches.length === 0 && !batchId}
              onChange={(e) => onSelectBatch(e.target.value)}
              className="h-9 w-full font-medium text-sm"
            />
          </div>
          {catalogNavigation}
          </div>
          <div className="w-40 max-w-full">
            <Select
              aria-label="Lọc theo ca nấu"
              value={selectedShift}
              disabled={!data || batches.length === 0}
              onChange={(e) => onSelectShift(e.target.value as 'ALL' | 'MORNING' | 'AFTERNOON')}
              options={MRX_SHIFT_OPTIONS}
              className="h-9 w-full font-medium text-sm"
            />
          </div>
          <WorkspaceHeader.BadgeSlot variant="status">
            {isPending ? <span role="status" className="sr-only">Đang tải phạm vi mới</span> : data && (
              <Badge
                variant="neutral"
                size="default"
                className="h-8 px-2.5 text-xs font-mono flex items-center shrink-0 whitespace-nowrap"
              >
                Phiên bản: v{data.sourceVersion}
              </Badge>
            )}
          </WorkspaceHeader.BadgeSlot>
        </>
      }
    />
  );
}
