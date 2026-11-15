import type { MrxSourceHistoryEvent } from '../../../api/mrxApi';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { toVietnameseDate } from '../../../utils/dates';
import { HISTORY_APPROVAL_LABELS, HISTORY_ROUTE_LABELS, HISTORY_STATUS_LABELS, historyApprovalVariant, historyStatusVariant } from '../sourceHistoryLabels';

export function MrxDeltaTableBranch({ items, onOpen }: {
  items: readonly MrxSourceHistoryEvent[]; onOpen: (item: MrxSourceHistoryEvent) => void;
}) {
  return <div className="mrx-history-list" role="list" aria-label="Các lần thay đổi nguồn">
    <div className="mrx-history-head" aria-hidden="true"><span>Thời điểm · Người thực hiện</span><span>Khách hàng · Tuần</span><span>Phạm vi</span><span>Trạng thái</span><span>Phê duyệt</span><span>Thao tác</span></div>
    {items.map(item => <div className="mrx-history-row" role="listitem" key={item.eventId}>
      <div className="mrx-history-cell"><strong>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.occurredAt))}</strong><span>{item.actorName}</span></div>
      <div className="mrx-history-cell"><strong>{item.customerCode} · {item.customerName}</strong><span>Tuần {toVietnameseDate(item.weekStartDate)}</span></div>
      <div className="mrx-history-cell"><strong>{item.affectedLineCount} dòng</strong><span>{HISTORY_ROUTE_LABELS[item.changeRoute] ?? 'Chỉnh sửa nguồn'}</span></div>
      <div className="mrx-history-cell mrx-history-status"><span className="mrx-history-mobile-label">Trạng thái</span><Badge variant={historyStatusVariant(item.status)} size="sm">{HISTORY_STATUS_LABELS[item.status] ?? item.status}</Badge></div>
      <div className="mrx-history-cell mrx-history-status"><span className="mrx-history-mobile-label">Phê duyệt</span><Badge variant={historyApprovalVariant(item.approvalStatus)} size="sm">{HISTORY_APPROVAL_LABELS[item.approvalStatus] ?? item.approvalStatus}</Badge></div>
      <div className="mrx-history-action"><Button variant="outline" size="sm" onClick={() => onOpen(item)} aria-label={`Xem chi tiết thay đổi nguồn ${item.customerCode} ${item.occurredAt}`}>Chi tiết</Button></div>
    </div>)}
  </div>;
}
