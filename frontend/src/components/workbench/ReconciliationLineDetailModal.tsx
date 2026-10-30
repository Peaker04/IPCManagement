import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { toVietnameseDate } from '../../utils/dates';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

export interface ReconciliationLineDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  line: ReconciliationLineItem | null;
  onOpenDisposition?: (line: ReconciliationLineItem) => void;
  isCompleted?: boolean;
}

export function ReconciliationLineDetailModal({
  isOpen,
  onClose,
  line,
  onOpenDisposition,
  isCompleted = false,
}: ReconciliationLineDetailModalProps) {
  if (!isOpen || !line) return null;

  const diff = line.issuedRequiredDifference ?? (line.issuedQuantity != null ? line.issuedQuantity - line.requiredQuantity : null);
  const isOver = diff != null && diff > 0.0001;
  const isUnder = diff != null && diff < -0.0001;

  const handleStartDisposition = () => {
    onClose();
    onOpenDisposition?.(line);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={line.materialName}
      description={`Mã: ${line.materialCode} · ĐVT: ${line.unit}${line.serviceDate ? ` · Ngày phục vụ: ${toVietnameseDate(line.serviceDate)}` : ''}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
          {!isCompleted && onOpenDisposition && (diff != null && diff !== 0) && (
            <Button
              variant="default"
              size="sm"
              onClick={handleStartDisposition}
            >
              {line.disposition ? 'Cập nhật giải trình' : 'Xử lý chênh lệch'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        <div aria-label="Thông số đối soát của dòng nguyên liệu" className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Nhu cầu BOM đã khóa:</span>
            <strong className="font-mono text-sm text-slate-900">
              <Num value={line.requiredQuantity} format="quantity" decimals={3} /> {line.unit}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Thực tế đã xuất:</span>
            <strong className="font-mono text-sm text-slate-900">
              {line.issuedQuantity != null ? (
                <>
                  <Num value={line.issuedQuantity} format="quantity" decimals={3} /> {line.unit}
                </>
              ) : (
                <span className="text-slate-400 font-normal">Chưa có phiếu xuất</span>
              )}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Chênh lệch xuất:</span>
            <strong className={`font-mono text-sm ${isOver ? 'text-amber-700 font-bold' : isUnder ? 'text-rose-700 font-bold' : 'text-slate-800'}`}>
              {diff != null ? (
                <>
                  {diff > 0 ? '+' : ''}
                  <Num value={diff} format="quantity" decimals={3} /> {line.unit}
                </>
              ) : (
                <span className="text-slate-400 font-normal">—</span>
              )}
            </strong>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Trạng thái dòng:</span>
            <Badge variant={line.disposition ? 'success' : line.triggers.length > 0 ? 'warning' : 'neutral'} size="sm">
              {line.disposition ? 'Đã giải trình' : line.status}
            </Badge>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">ID dòng theo ngày:</span>
            <IdentifierText value={line.dailyLineId || line.id} />
          </div>
        </div>

        {line.disposition && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded text-xs space-y-1">
            <div className="flex items-center justify-between">
              <strong className="text-emerald-900">Kết luận xử lý chênh lệch:</strong>
              <Badge variant="success" size="sm">{line.disposition.category}</Badge>
            </div>
            <p className="text-emerald-800 font-medium">{line.disposition.reason}</p>
          </div>
        )}

        {line.notes && line.notes.length > 0 && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs space-y-1">
            <strong className="text-amber-900 block">Lý do xuất thêm / xuất vượt từ Thủ kho:</strong>
            <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
              {line.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
