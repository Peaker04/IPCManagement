import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Button } from '../../../components/ui/button';

export interface MrxDeltaHeaderBranchProps {
  onNavigateDaily: () => void;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  filters?: ReactNode;
}

export function MrxDeltaHeaderBranch({
  onNavigateDaily,
  isRefreshing,
  onRefresh,
  filters,
}: MrxDeltaHeaderBranchProps) {
  return (
    <WorkspaceHeader
      responsive
      title="Lịch sử thay đổi nguồn"
      breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
      contextSelectors={filters}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Chỉ đọc</span>
          <Button
            variant="outline"
            size="default"
            disabled={isRefreshing}
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
          <Button
            variant="outline"
            size="default"
            onClick={onNavigateDaily}
          >
            Xuất kho ngày
          </Button>
        </div>
      }
    />
  );
}
