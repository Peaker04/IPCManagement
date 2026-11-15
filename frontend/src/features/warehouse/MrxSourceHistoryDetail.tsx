import { useEffect, useState } from 'react';
import { mrxApi, type MrxSourceHistoryDetail as Detail, type MrxSourceHistoryEvent } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { toVietnameseDate } from '../../utils/dates';
import { HISTORY_APPROVAL_LABELS, HISTORY_STATUS_LABELS, historyApprovalVariant, historyStatusVariant } from './sourceHistoryLabels';

function time(value?: string | null) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : null;
}

export function MrxSourceHistoryDetail({ event, onClose }: { event: MrxSourceHistoryEvent | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: Detail | null; error: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${event?.eventId ?? ''}:${page}:${retry}`;
  const detail = result?.key === key ? result.data : null;
  const error = result?.key === key ? result.error : '';
  const loading = Boolean(event) && result?.key !== key;
  useEffect(() => {
    if (!event) return;
    let active = true;
    mrxApi.getSourceHistoryDetail(event.eventId, page).then(data => { if (active) setResult({ key, data, error: '' }); })
      .catch(() => { if (active) setResult({ key, data: null, error: 'Không tải được chi tiết thay đổi nguồn.' }); });
    return () => { active = false; };
  }, [event, page, key]);
  const close = () => { setPage(1); onClose(); };
  return <Modal isOpen={Boolean(event)} onClose={close} title="Chi tiết thay đổi nguồn" description="Lịch sử theo yêu cầu và lần cập nhật thực tế" maxWidth="max-w-4xl"
    footer={<Button variant="outline" onClick={close}>Đóng</Button>}>
    {loading && <p role="status" className="mrx-history-message">Đang tải chi tiết...</p>}
    {error && <div className="mrx-history-message" role="alert">{error} <Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Thử lại</Button></div>}
    {detail && <div className="mrx-history-detail">
      <dl className="mrx-history-meta">
        <div><dt>Khách hàng · Tuần</dt><dd>{detail.event.customerCode} · {detail.event.customerName} · {toVietnameseDate(detail.event.weekStartDate)}</dd></div>
        <div><dt>Trạng thái</dt><dd><Badge variant={historyStatusVariant(detail.event.status)} size="sm">{HISTORY_STATUS_LABELS[detail.event.status] ?? detail.event.status}</Badge></dd></div>
        <div><dt>Phê duyệt</dt><dd><Badge variant={historyApprovalVariant(detail.event.approvalStatus)} size="sm">{HISTORY_APPROVAL_LABELS[detail.event.approvalStatus] ?? detail.event.approvalStatus}</Badge></dd></div>
        <div><dt>Người yêu cầu · Thời điểm</dt><dd>{detail.requesterName ?? 'Không có yêu cầu'}{time(detail.requestedAt) && <small>{time(detail.requestedAt)}</small>}</dd></div>
        <div><dt>Người duyệt · Thời điểm</dt><dd>{detail.reviewerName ?? (detail.event.approvalStatus === 'PENDING' ? 'Chưa duyệt' : 'Không cần duyệt')}{time(detail.reviewedAt) && <small>{time(detail.reviewedAt)}</small>}</dd></div>
        <div><dt>Người thực hiện yêu cầu · Thời điểm</dt><dd>{detail.executorName ?? 'Chưa thực hiện'}{time(detail.executedAt) && <small>{time(detail.executedAt)}</small>}</dd></div>
        <div className="mrx-history-meta-wide"><dt>Lý do</dt><dd>{detail.event.reason || 'Không có lý do'}</dd></div>
      </dl>
      {detail.revisions.length > 0 && <section><h3>Phiên bản nguồn</h3><div className="mrx-history-revisions">{detail.revisions.map(revision =>
        <div key={revision.revisionId}>Lần {revision.revisionNumber} · Lô <IdentifierText value={revision.batchId} displayValue={revision.batchId.slice(0, 8)} /> · Mã cập nhật <IdentifierText value={revision.revisionId} displayValue={revision.revisionId.slice(0, 8)} /></div>)}</div></section>}
      <section><h3>{detail.revisions.length === 0 ? 'Ảnh hưởng dự kiến · Chưa ghi nhận cập nhật nguồn' : detail.materials.totalCount === 0 ? 'Phiên bản nguồn đã ghi nhận' : 'Thay đổi định lượng đã áp dụng'}</h3>
        {detail.materials.totalCount === 0 ? <p>Chưa có dòng nguyên liệu định lượng trong bản ghi này.</p> :
          <table className="mrx-history-materials" aria-label="Định lượng nguyên liệu trước và sau">
            <thead><tr><th>Nguyên liệu · Ngày</th><th>Trước</th><th>Sau</th><th>Chênh lệch</th><th>Đơn vị</th></tr></thead>
            <tbody>{detail.materials.items.map((material, index) => <tr key={`${material.serviceDate}-${material.ingredientCode}-${index}`}>
              <th scope="row"><strong>{material.ingredientName}</strong><span>{toVietnameseDate(material.serviceDate)} · {material.ingredientCode}</span></th>
              <td data-label="Trước"><Num value={material.previousQuantity} format="plain" decimals={6} /></td>
              <td data-label="Sau"><Num value={material.newQuantity} format="plain" decimals={6} /></td>
              <td data-label="Chênh lệch"><Num value={material.deltaQuantity} format="plain" decimals={6} prefix={material.deltaQuantity > 0 ? '+' : ''} /></td>
              <td data-label="Đơn vị">{material.unitName}</td>
            </tr>)}</tbody>
          </table>}
        {detail.materials.totalPages > 1 && <PaginationBar label="Phân trang nguyên liệu thay đổi" page={detail.materials.pageNumber} pageSize={detail.materials.pageSize}
          totalCount={detail.materials.totalCount} totalPages={detail.materials.totalPages} hasPrev={detail.materials.hasPrev} hasNext={detail.materials.hasNext}
          pending={loading} onPageChange={setPage} />}
      </section>
    </div>}
  </Modal>;
}
