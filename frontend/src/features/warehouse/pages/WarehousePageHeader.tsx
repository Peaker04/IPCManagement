import { PackageOpen, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CommandBar, ContextStrip } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';

interface WarehousePageHeaderProps {
  warehouseName: string;
  issueDocumentTitle?: string;
  canCreateIssue: boolean;
  issueDisabledReason?: string;
  isFetchingIssueCandidates: boolean;
  onOpenIssueDialog: () => void;
  receiptCountLabel: string;
  issueCountLabel: string;
  stockCountLabel: string;
  shortageLabel: string;
  kitchenReceiptLabel: string;
  workflowDocumentError: boolean;
  currentStockError: boolean;
  hasCurrentStock: boolean;
  demandError: boolean;
  hasShortage: boolean;
  kitchenIssueError: boolean;
  hasPendingKitchenReceipt: boolean;
}

export function buildWarehousePageHeader(props: WarehousePageHeaderProps) {
  return {
    command: (
      <CommandBar actionsClassName="ipc-warehouse-actions" actions={<>
        <button className="ipc-button ipc-button-primary" type="button" onClick={props.onOpenIssueDialog} disabled={!props.canCreateIssue} aria-describedby={props.issueDisabledReason ? 'warehouse-issue-action-guidance' : undefined} title={props.issueDisabledReason}>
          {props.isFetchingIssueCandidates ? 'Đang kiểm tra nhu cầu' : 'Tạo phiếu xuất kho'}
        </button>
        <Link className="ipc-button ipc-button-success" to={ROUTES.REPORTS}>Xem tồn kho</Link>
        <Link className="ipc-button ipc-button-primary" to={ROUTES.CHEF_DASHBOARD}><PackageOpen size={16} />Bàn giao cho bếp</Link>
        <Link className="ipc-button ipc-button-ghost" to={ROUTES.PURCHASING}>Quay lại thu mua</Link>
      </>}>
        <span className="ipc-command-meta"><Warehouse size={16} />{props.warehouseName}</span>
        <span className="ipc-command-meta">Bàn giao bếp: {props.issueDocumentTitle ?? 'Chưa có phiếu xuất'}</span>
      </CommandBar>
    ),
    context: <ContextStrip items={[
      { label: 'Phiếu nhập', value: props.receiptCountLabel, tone: props.workflowDocumentError ? 'danger' : 'warning' },
      { label: 'Phiếu xuất', value: props.issueCountLabel, tone: props.workflowDocumentError ? 'danger' : 'warning' },
      { label: 'Dòng tồn kho', value: props.stockCountLabel, tone: props.currentStockError ? 'danger' : props.hasCurrentStock ? 'success' : 'warning' },
      { label: 'Thiếu hàng', value: props.shortageLabel, tone: props.demandError || props.hasShortage ? 'danger' : 'success' },
      { label: 'Bếp nhận', value: props.kitchenReceiptLabel, tone: props.kitchenIssueError ? 'danger' : props.hasPendingKitchenReceipt ? 'warning' : 'success' },
    ]} />,
  };
}
