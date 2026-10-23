import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { mrxApi, type MrxDispositionCategory } from '../../api/mrxApi';
import type { ReconciliationLineItem } from '../../api/reconciliationApi';

interface ReconciliationDispositionModalProps {
  selectedLine: ReconciliationLineItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  isCompleted: boolean;
}

export function ReconciliationDispositionModal({
  selectedLine,
  isOpen,
  onClose,
  onSaved,
  isCompleted,
}: ReconciliationDispositionModalProps) {
  const [categories, setCategories] = useState<MrxDispositionCategory[]>([]);
  const [category, setCategory] = useState(selectedLine?.disposition?.category || 'ACCEPTED_VARIANCE');
  const [reason, setReason] = useState(selectedLine?.disposition?.reason || '');
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
    if (!selectedLine?.dailyLineId || !reason.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await mrxApi.setDailyDisposition(selectedLine.dailyLineId, {
        category,
        reason: reason.trim(),
        expectedVersion: selectedLine.disposition?.version,
      });
      onClose();
      await onSaved();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause : new Error('Không thể lưu hướng xử lý chênh lệch.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedLine) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCompleted ? 'Chi tiết hướng xử lý' : 'Xử lý chênh lệch theo ngày'}
      description={`${selectedLine.materialName} (${selectedLine.materialCode})`}
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
              {isSubmitting ? 'Đang lưu...' : 'Lưu hướng xử lý'}
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
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Nhu cầu đã khóa:</span>
            <strong className="font-mono text-slate-800">{selectedLine.requiredQuantity} {selectedLine.unit}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Đã xuất theo sổ:</span>
            <strong className="font-mono text-slate-800">{selectedLine.issuedQuantity ?? '—'} {selectedLine.unit}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Chênh lệch:</span>
            <strong className={`font-mono ${selectedLine.issuedRequiredDifference === 0 ? 'text-slate-700' : 'text-amber-700 font-semibold'}`}>
              {selectedLine.issuedRequiredDifference != null && selectedLine.issuedRequiredDifference > 0 ? '+' : ''}
              {selectedLine.issuedRequiredDifference ?? '—'} {selectedLine.unit}
            </strong>
          </div>
        </div>

        {selectedLine.notes.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Ghi chú từ Kho:</span>
            <ul className="text-xs space-y-1 pl-4 list-disc text-slate-600">
              {selectedLine.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block">Danh mục:</span>
              <span className="font-medium text-slate-900">{selectedLine.disposition?.category ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Lý do xử lý:</span>
              <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-800">
                {selectedLine.disposition?.reason ?? '—'}
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
                {[
                  'Chấp nhận hao hụt thực tế',
                  'Điều chỉnh định lượng BOM kỳ tới',
                  'Đã xuất bù thực tế trong ca',
                  'Sai số đo lường lúc xuất kho',
                ].map((preset) => (
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
