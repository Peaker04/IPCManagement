import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { mrxApi, type MrxDispositionCategory } from '../../api/mrxApi';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

interface ReconciliationDispositionModalProps {
  selectedLine: ReconciliationLineItem | null;
  selectedLines?: ReconciliationLineItem[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  isCompleted: boolean;
}

export function ReconciliationDispositionModal({
  selectedLine,
  selectedLines,
  isOpen,
  onClose,
  onSaved,
  isCompleted,
}: ReconciliationDispositionModalProps) {
  const isBulk = Boolean(selectedLines && selectedLines.length > 1);
  const targetLines = isBulk ? selectedLines! : selectedLine ? [selectedLine] : [];
  const primaryLine = targetLines[0] || null;

  const [categories, setCategories] = useState<MrxDispositionCategory[]>([]);
  const [category, setCategory] = useState(primaryLine?.disposition?.category || 'ACCEPTED_VARIANCE');
  const [reason, setReason] = useState(primaryLine?.disposition?.reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;
    mrxApi.getDispositionCategories()
      .then((data) => { if (!ignore) setCategories(data); })
      .catch(() => {
        if (!ignore) {
          setCategories([
            { value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' },
            { value: 'KITCHEN_FAULT', label: 'Lỗi bộ phận Bếp' },
            { value: 'INVENTORY_SHORTAGE', label: 'Hao hụt / Thiếu kho' },
          ]);
        }
      });
    return () => { ignore = true; };
  }, []);

  const handleSave = async () => {
    if (targetLines.length === 0 || !reason.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      for (const line of targetLines) {
        if (line.dailyLineId) {
          await mrxApi.setDailyDisposition(line.dailyLineId, {
            category,
            reason: reason.trim(),
            expectedVersion: line.disposition?.version,
          });
        }
      }
      onClose();
      await onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause : new Error('Không thể lưu hướng xử lý chênh lệch.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!primaryLine) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isBulk
          ? `Xử lý chênh lệch hàng loạt (${targetLines.length} dòng)`
          : isCompleted
          ? 'Chi tiết hướng xử lý'
          : 'Xử lý chênh lệch theo ngày'
      }
      description={
        isBulk
          ? `Áp dụng cùng kết luận và lý do giải trình cho ${targetLines.length} nguyên liệu có chênh lệch.`
          : `${primaryLine.materialName} (${primaryLine.materialCode})`
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {isCompleted ? 'Đóng' : 'Quay lại'}
          </Button>
          {!isCompleted && (
            <Button
              variant="default"
              size="sm"
              disabled={isSubmitting || !reason.trim()}
              onClick={() => void handleSave()}
            >
              {isSubmitting ? 'Đang lưu...' : isBulk ? `Xác nhận ${targetLines.length} dòng` : 'Lưu hướng xử lý'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-sm text-slate-700">
        {error && (
          <div role="alert" className="p-2.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-xs">
            {error.message}
          </div>
        )}

        {isBulk ? (
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
            <span className="font-semibold text-slate-800 block">
              Danh sách {targetLines.length} nguyên liệu được áp dụng cùng giải trình:
            </span>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {targetLines.map((l) => (
                <span key={l.dailyLineId} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {l.materialName}: <strong className="font-mono">{l.issuedRequiredDifference != null && l.issuedRequiredDifference > 0 ? '+' : ''}{l.issuedRequiredDifference} {l.unit}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Nhu cầu đã khóa:</span>
              <strong className="font-mono text-slate-800">{primaryLine.requiredQuantity} {primaryLine.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Đã xuất theo sổ:</span>
              <strong className="font-mono text-slate-800">{primaryLine.issuedQuantity ?? '—'} {primaryLine.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Chênh lệch:</span>
              <strong className={`font-mono ${primaryLine.issuedRequiredDifference === 0 ? 'text-slate-700' : 'text-amber-700 font-semibold'}`}>
                {primaryLine.issuedRequiredDifference != null && primaryLine.issuedRequiredDifference > 0 ? '+' : ''}
                {primaryLine.issuedRequiredDifference ?? '—'} {primaryLine.unit}
              </strong>
            </div>
          </div>
        )}

        {primaryLine.notes.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Ghi chú từ Kho:</span>
            <ul className="text-xs space-y-1 pl-4 list-disc text-slate-600">
              {primaryLine.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block">Danh mục:</span>
              <span className="font-medium text-slate-900">{primaryLine.disposition?.category ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Lý do xử lý:</span>
              <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-800">
                {primaryLine.disposition?.reason ?? '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label htmlFor="disposition-category" className="text-xs font-semibold text-slate-700 block mb-1">
                Danh mục xử lý chênh lệch:
              </label>
              <select
                id="disposition-category"
                aria-label="Danh mục xử lý chênh lệch"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="disposition-reason" className="text-xs font-semibold text-slate-700 block mb-1">
                Lý do xử lý chênh lệch:
              </label>
              <Input
                id="disposition-reason"
                aria-label="Lý do xử lý chênh lệch"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do kết luận hoặc hướng xử lý của Quản lý..."
                className="h-9 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Gợi ý lý do xử lý">
                {(primaryLine.issuedRequiredDifference != null && primaryLine.issuedRequiredDifference < 0 ? [
                  'Tiết kiệm định lượng tại bếp',
                  'Hao hụt thực tế thấp hơn định mức',
                  'Xác nhận theo thực tế sử dụng',
                  'Bếp trưởng xác nhận nấu đủ suất',
                ] : [
                  'Chấp nhận hao hụt thực tế',
                  'Điều chỉnh định lượng BOM kỳ tới',
                  'Đã xuất bù thực tế trong ca',
                  'Sai số đo lường lúc xuất kho',
                ]).map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setReason(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
