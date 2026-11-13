import { useEffect, useState } from 'react';
import { WorkbenchSkeleton } from './WorkbenchSkeleton';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { InlineBanner } from '../ui/inline-banner';
import { mrxApi, type MrxInventoryIssueDetail } from '../../api/mrxApi';
import { serverStateCache } from '../../store/serverStateCache';
import { toVietnameseDate, formatVietnameseDateTime } from '../../utils/dates';
import { formatNumber } from '../../utils/formatters';

export interface ReconciliationIssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
}

export function ReconciliationIssueDetailModal(props: ReconciliationIssueDetailModalProps) {
  return props.isOpen && props.issueId ? <ReconciliationIssueDetailDialog key={props.issueId} {...props} /> : null;
}

function ReconciliationIssueDetailDialog({
  isOpen,
  onClose,
  issueId,
}: ReconciliationIssueDetailModalProps) {
  const cacheKey = issueId ? `mrx_issue_detail_${issueId}` : '';
  const [issue, setIssue] = useState<MrxInventoryIssueDetail | null>(() => {
    const cached = cacheKey ? serverStateCache.get<MrxInventoryIssueDetail>(cacheKey) : null;
    return cached && !cached.isStale ? cached.data : null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = cacheKey ? serverStateCache.get<MrxInventoryIssueDetail>(cacheKey) : null;
    return !(cached && !cached.isStale);
  });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !issueId) return;
    if (attempt === 0) {
      const warm = serverStateCache.get<MrxInventoryIssueDetail>(cacheKey);
      if (warm && !warm.isStale) return;
    }
    let ignore = false;
    mrxApi.getIssueById(issueId)
      .then((data) => {
        if (!ignore) {
          if (cacheKey) serverStateCache.set(cacheKey, data);
          setIssue(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          if (cacheKey) serverStateCache.delete(cacheKey);
          setIssue(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải chi tiết phiếu xuất kho.'));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => { ignore = true; };
  }, [isOpen, issueId, attempt, cacheKey]);

  const retry = () => {
    setIssue(null);
    setError(null);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      className="mrx-issue-detail-frame"
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
      title="Chi tiết phiếu xuất kho"
      description="Thông tin chứng từ và nguyên liệu đã xuất của phiếu được chọn."
      footer={<Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>}
    >
      <div className="flex flex-1 min-h-0 flex-col gap-4 text-sm text-slate-700">
        {isLoading ? (
          <WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 8, columnWidths: ['14%', '36%', '10%', '20%', '20%'] }} />
        ) : error ? (
          <InlineBanner variant="error" title="Không thể tải chi tiết phiếu xuất kho" actionLabel="Thử lại" onAction={retry}>
            {error.message}
          </InlineBanner>
        ) : issue ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <div className="basis-full break-words text-slate-600">
                Ngày xuất: {toVietnameseDate(issue.issueDate)} · Kho: {issue.warehouseName || 'Kho chính'} · Người lập: {issue.issuedByName || 'Thủ kho'}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-slate-500">Mã phiếu:</span>
                <IdentifierText value={issue.issueCode} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Trạng thái Bếp nhận:</span>
                <Badge variant={issue.receivedAt ? 'success' : 'warning'} size="sm">
                  {issue.receivedAt ? `Đã nhận (${formatVietnameseDateTime(issue.receivedAt)})` : 'Chờ xác nhận'}
                </Badge>
              </div>
            </div>

            <div role="region" aria-label="Nguyên liệu phiếu xuất · cuộn để xem đầy đủ" tabIndex={0} className="flex-1 min-h-0 overflow-auto border border-slate-200 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400">
              <table aria-label="Danh sách nguyên liệu của phiếu xuất kho" className="w-full min-w-[680px] text-left text-xs border-separate border-spacing-0">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 z-20 font-semibold">
                  <tr>
                    <th className="p-2.5">Mã NL</th>
                    <th className="sticky left-0 z-30 min-w-48 bg-slate-100 p-2.5">Tên nguyên liệu</th>
                    <th className="p-2.5 text-center">ĐVT</th>
                    <th className="p-2.5 text-right">Nhu cầu khóa</th>
                    <th className="p-2.5 text-right">Thực xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issue.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        Phiếu xuất không có dòng chi tiết.
                      </td>
                    </tr>
                  ) : (
                    issue.lines.map((line) => {
                      const diff = Math.round((line.issuedQty - line.requestedQty) * 1_000_000) / 1_000_000;
                      const isOver = diff > 0;
                      const isUnder = diff < 0;
                      const provisions = issue.provisions.filter((provision) =>
                        provision.ingredientId === line.ingredientId && provision.unitId === line.unitId);

                      return (
                        <tr key={line.issueLineId} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-600">
                            <IdentifierText value={line.ingredientId.slice(0, 8)} />
                          </td>
                          <td className="sticky left-0 z-10 bg-white p-2.5 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{line.ingredientName || '—'}</span>
                              {isOver && (
                                <Badge variant="warning" size="sm">
                                  Xuất vượt (+<Num value={diff} format="plain" decimals={6} />)
                                </Badge>
                              )}
                              {isUnder && (
                                <Badge variant="neutral" size="sm">
                                  Tiết kiệm (<Num value={diff} format="plain" decimals={6} />)
                                </Badge>
                              )}
                              {provisions.map((provision) => (
                                <Badge
                                  key={provision.stockMovementId}
                                  variant="info"
                                  size="sm"
                                  aria-label={`Đã tự động bù tồn kho: +${formatNumber(provision.provisionedQuantity, 'plain', 6)} ${provision.unitName || line.unitName || provision.unitId}`}
                                >
                                  Đã tự động bù tồn kho: +<Num value={provision.provisionedQuantity} format="plain" decimals={6} /> {provision.unitName || line.unitName || provision.unitId}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-600">{line.unitName || 'Chưa rõ đơn vị'}</td>
                          <td className="p-2.5 text-right whitespace-nowrap font-mono text-slate-700">
                            <Num value={line.requestedQty} format="plain" decimals={6} />
                          </td>
                          <td className={`p-2.5 text-right whitespace-nowrap font-mono font-bold ${isOver ? 'text-amber-700' : isUnder ? 'text-rose-700' : 'text-slate-900'}`}>
                            <Num value={line.issuedQty} format="plain" decimals={6} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
