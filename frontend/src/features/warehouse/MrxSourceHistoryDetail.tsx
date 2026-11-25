import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
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
  const [result, setResult] = useState<{ key: string; data: Detail | null; error: 'denied' | 'load' | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const eventId = event?.eventId;
  const key = `${eventId ?? ''}:${page}:${retry}`;
  const detail = result?.data?.event.eventId === eventId ? result?.data : null;
  const error = result?.key === key ? result.error : null;
  const loading = Boolean(event) && result?.key !== key;
  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    mrxApi.getSourceHistoryDetail(eventId, page, 25, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ key, data, error: null }); })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const canKeepPrevious = !(cause instanceof ApiError && cause.status < 500);
        setResult(previous => ({ key,
          data: canKeepPrevious && previous?.data?.event.eventId === eventId ? previous.data : null,
          error: cause instanceof ApiError && cause.status === 403 ? 'denied' : 'load',
        }));
      });
    return () => controller.abort();
  }, [eventId, page, key]);
  const close = () => { setPage(1); setResult(null); onClose(); };
  const changePage = (next: number) => {
    if (next === page) setRetry(value => value + 1);
    else setPage(next);
  };
  return <Modal isOpen={Boolean(event)} onClose={close} title="Chi tiết thay đổi nguồn" maxWidth="max-w-4xl"
    className={detail && detail.materials.totalPages > 1 ? 'h-[90dvh]' : undefined}
    footer={<><span role="status" className="mr-auto text-xs text-slate-600">{loading && detail ? `Đang tải trang ${page}…` : ''}</span><Button variant="outline" onClick={close}>Đóng</Button></>}>
    {loading && !detail && <p role="status" className="mrx-history-message">Đang tải chi tiết…</p>}
    {detail && <div className="mrx-history-detail" aria-busy={loading || undefined}>
      <dl className="mrx-history-meta">
        <div><dt>Khách hàng · Tuần</dt><dd>{detail.event.customerCode} · {detail.event.customerName} · {toVietnameseDate(detail.event.weekStartDate)}</dd></div>
        <div><dt>Trạng thái</dt><dd><Badge variant={historyStatusVariant(detail.event.status)} size="sm">{HISTORY_STATUS_LABELS[detail.event.status] ?? detail.event.status}</Badge></dd></div>
        <div><dt>Phê duyệt</dt><dd><Badge variant={historyApprovalVariant(detail.event.approvalStatus)} size="sm">{HISTORY_APPROVAL_LABELS[detail.event.approvalStatus] ?? detail.event.approvalStatus}</Badge></dd></div>
        {[
          { label: 'Người yêu cầu · Thời điểm', actor: detail.requesterName, occurredAt: detail.requestedAt },
          { label: 'Người duyệt · Thời điểm', actor: detail.reviewerName, occurredAt: detail.reviewedAt },
          { label: 'Người thực hiện yêu cầu · Thời điểm', actor: detail.executorName, occurredAt: detail.executedAt },
        ].filter(({ actor, occurredAt }) => actor || occurredAt).map(({ label, actor, occurredAt }) => <div key={label}>
          <dt>{label}</dt><dd>{actor}{occurredAt && <small>{time(occurredAt)}</small>}</dd>
        </div>)}
        <div className="mrx-history-meta-wide"><dt>Lý do</dt><dd>{detail.event.reason || 'Không có lý do'}</dd></div>
      </dl>
      {detail.revisions.length > 0 && <section><h3>Phiên bản nguồn</h3><div className="mrx-history-revisions">{detail.revisions.map(revision =>
        <div key={revision.revisionId}>Lần {revision.revisionNumber} · Lô <IdentifierText value={revision.batchId} displayValue={revision.batchId.slice(0, 8)} /> · Mã cập nhật <IdentifierText value={revision.revisionId} displayValue={revision.revisionId.slice(0, 8)} /></div>)}</div></section>}
      <section>{detail.materials.totalCount > 0 && <h3>{detail.revisions.length === 0 ? 'Ảnh hưởng dự kiến' : 'Thay đổi định lượng đã áp dụng'}</h3>}
        {detail.revisions.length === 0 && detail.event.status === 'EXECUTED' && <p>Chưa ghi nhận cập nhật nguồn.</p>}
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
          pending={loading} retainButtonFocus onPageChange={changePage} />}
      </section>
    </div>}
    {error === 'denied' && <div className="mrx-history-message" role="alert">Bạn không có quyền xem chi tiết thay đổi nguồn.</div>}
    {error === 'load' && <div className="mrx-history-message" role="alert">Không tải được chi tiết thay đổi nguồn. <Button variant="outline" size="sm" onClick={() => changePage(page)}>Thử lại</Button></div>}
  </Modal>;
}
