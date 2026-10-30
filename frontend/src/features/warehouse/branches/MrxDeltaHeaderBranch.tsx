import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { WorkspaceHeader } from '../../../components/workbench/WorkspaceHeader';
import { Button } from '../../../components/ui/button';

export interface MrxDeltaHeaderBranchProps {
  onNavigateDaily: () => void;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
}

export function MrxDeltaHeaderBranch({
  onNavigateDaily,
  isRefreshing,
  onRefresh,
}: MrxDeltaHeaderBranchProps) {
  return (
    <WorkspaceHeader
      title="Thay đổi nguồn chờ Kho xử lý"
      breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="default"
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
            Xem trạm xuất kho ngày →
          </Button>
        </div>
      }
    />
  );
}
