import { useEffect, useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { InlineBanner } from '../ui/inline-banner';
import { mrxApi, type MrxInventoryIssueDetail } from '../../api/mrxApi';
import { toVietnameseDate, formatVietnameseDateTime } from '../../utils/dates';

export interface ReconciliationIssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
}

export function ReconciliationIssueDetailModal({
  isOpen,
  onClose,
  issueId,
}: ReconciliationIssueDetailModalProps) {
  const [issue, setIssue] = useState<MrxInventoryIssueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !issueId) return;
    let ignore = false;
    mrxApi.getIssueById(issueId)
      .then((data) => {
        if (!ignore) setIssue(data);
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải chi tiết phiếu xuất kho.'));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
      setIssue(null);
      setError(null);
    };
  }, [isOpen, issueId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết phiếu xuất kho: ${issue?.issueCode || issueId || ''}`}
      description={
        issue
          ? `Ngày xuất: ${toVietnameseDate(issue.issueDate)} · Kho: ${issue.warehouseName || 'Kho chính'} · Người lập: ${issue.issuedByName || 'Thủ kho'}`
          : 'Đang tải thông tin phiếu xuất…'
      }
      footer={<Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-4 text-sm text-slate-700">
        {error && (
          <InlineBanner variant="error">
            {error.message}
          </InlineBanner>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Đang tải dữ liệu phiếu xuất kho…
          </div>
        ) : issue ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
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

            <div className="border border-slate-200 rounded overflow-hidden max-h-80 overflow-y-auto">
              <table aria-label="Danh sách nguyên liệu của phiếu xuất kho" className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 font-semibold">
                  <tr>
                    <th className="p-2.5">Mã NL</th>
                    <th className="p-2.5">Tên nguyên liệu</th>
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
                      const diff = line.issuedQty - line.requestedQty;
                      const isOver = diff > 0.0001;
                      const isUnder = diff < -0.0001;

                      return (
                        <tr key={line.issueLineId} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-600">
                            <IdentifierText value={line.ingredientId.slice(0, 8)} />
                          </td>
                          <td className="p-2.5 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{line.ingredientName || '—'}</span>
                              {isOver && (
                                <Badge variant="warning" size="sm">
                                  Xuất vượt (+{(diff).toFixed(3)})
                                </Badge>
                              )}
                              {isUnder && (
                                <Badge variant="neutral" size="sm">
                                  Tiết kiệm ({(diff).toFixed(3)})
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-600">{line.unitName || 'kg'}</td>
                          <td className="p-2.5 text-right font-mono text-slate-700">
                            <Num value={line.requestedQty} format="quantity" decimals={3} />
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${isOver ? 'text-amber-700' : isUnder ? 'text-rose-700' : 'text-slate-900'}`}>
                            <Num value={line.issuedQty} format="quantity" decimals={3} />
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
