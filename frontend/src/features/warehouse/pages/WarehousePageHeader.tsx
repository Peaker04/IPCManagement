import { PackageOpen, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CommandBar } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';

interface WarehousePageHeaderProps {
  warehouseName: string;
  showStockShortcut: boolean;
  canViewChef: boolean;
  issueDocumentTitle?: string;
  canCreateIssue: boolean;
  issueDisabledReason?: string;
  isFetchingIssueCandidates: boolean;
  onOpenIssueDialog: () => void;
}

export function buildWarehousePageHeader(props: WarehousePageHeaderProps) {
  return {
    command: (
      <CommandBar actionsClassName="ipc-warehouse-actions" actions={<>
        <button className="ipc-button ipc-button-primary h-8 min-h-8 px-3 text-xs font-semibold rounded-[var(--ipc-radius-sm,2px)] inline-flex items-center gap-1.5" type="button" onClick={props.onOpenIssueDialog} disabled={!props.canCreateIssue} aria-busy={props.isFetchingIssueCandidates} aria-describedby={props.issueDisabledReason ? 'warehouse-issue-action-guidance' : undefined} title={props.issueDisabledReason}>
          Tạo phiếu xuất kho
        </button>
        {props.showStockShortcut && <Link className="ipc-button ipc-button-secondary h-8 min-h-8 px-2.5 text-xs font-semibold rounded-[var(--ipc-radius-sm,2px)] inline-flex items-center gap-1.5" to={`${ROUTES.WAREHOUSE}?view=movement&movementTask=stock`}>Xem tồn kho</Link>}
        {props.canViewChef && <Link className="ipc-button ipc-button-secondary h-8 min-h-8 px-2.5 text-xs font-semibold rounded-[var(--ipc-radius-sm,2px)] inline-flex items-center gap-1.5" to={`${ROUTES.CHEF_DASHBOARD}?view=production&task=materials`}><PackageOpen size={14} />Xem bàn giao tại Bếp</Link>}
        <Link className="ipc-button ipc-button-ghost h-8 min-h-8 px-2.5 text-xs font-semibold rounded-[var(--ipc-radius-sm,2px)] inline-flex items-center gap-1.5" to={ROUTES.PURCHASING}>Quay lại thu mua</Link>
      </>}>
        <span className="ipc-command-meta w-44 min-w-44 truncate text-xs" title={props.warehouseName}><Warehouse size={15} />{props.warehouseName}</span>
        <span className="ipc-command-meta text-xs">Bàn giao bếp: {props.issueDocumentTitle ?? 'Chưa có phiếu xuất'}</span>
      </CommandBar>
    ),
    context: null,
  };
}
