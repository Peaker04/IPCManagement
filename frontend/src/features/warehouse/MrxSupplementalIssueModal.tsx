import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toVietnameseDate } from '../../utils/dates';

export interface DailyLineOption {
  dailyLineId: string;
  ingredientName?: string | null;
  issuedQuantity?: number | null;
  canonicalUnitName?: string | null;
}

interface MrxSupplementalIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBatchId: string;
  activeDate: string;
  lines: DailyLineOption[];
  suppMaterialId: string;
  onSuppMaterialIdChange: (val: string) => void;
  suppQuantity: string;
  onSuppQuantityChange: (val: string) => void;
  suppReason: string;
  onSuppReasonChange: (val: string) => void;
  suppError: string | null;
  isSubmittingSupp: boolean;
  onSubmit: () => void;
}

const PRESET_REASONS = [
  'Phát sinh suất ăn đột xuất',
  'Bếp nấu hỏng/bù định mức',
  'Hao hụt sơ chế thực tế cao',
  'Yêu cầu bổ sung từ khách hàng',
];

export function MrxSupplementalIssueModal({
  isOpen,
  onClose,
  activeBatchId,
  activeDate,
  lines,
  suppMaterialId,
  onSuppMaterialIdChange,
  suppQuantity,
  onSuppQuantityChange,
  suppReason,
  onSuppReasonChange,
  suppError,
  isSubmittingSupp,
  onSubmit,
}: MrxSupplementalIssueModalProps) {
  const currentLine = lines.find((l) => l.dailyLineId === suppMaterialId);
  const unit = currentLine?.canonicalUnitName || 'đơn vị';
  const canSubmit = !isSubmittingSupp && Boolean(suppMaterialId) && Number(suppQuantity) > 0 && Boolean(suppReason.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmittingSupp) onClose(); }}
      title="Xuất kho bổ sung trong ca"
      description={`Lô: ${activeBatchId.slice(0, 8)} · Ngày phục vụ: ${toVietnameseDate(activeDate)}`}
      footer={
        <>
          <Button variant="outline" size="sm" disabled={isSubmittingSupp} onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {isSubmittingSupp ? 'Đang xử lý...' : 'Xác nhận xuất bổ sung'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        {suppError && (
          <div role="alert" className="p-2.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-xs">
            {suppError}
          </div>
        )}
        <div>
          <label htmlFor="supp-ingredient" className="text-xs font-semibold text-slate-700 block mb-1">
            Chọn nguyên liệu bổ sung:
          </label>
          <select
            id="supp-ingredient"
            aria-label="Chọn nguyên liệu bổ sung"
            value={suppMaterialId}
            onChange={(e) => onSuppMaterialIdChange(e.target.value)}
            className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            {lines.map((l) => (
              <option key={l.dailyLineId} value={l.dailyLineId}>
                {l.ingredientName || 'Nguyên liệu'} (Đã xuất: {l.issuedQuantity ?? 0} {l.canonicalUnitName || 'đơn vị'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="supp-qty" className="text-xs font-semibold text-slate-700 block mb-1">
            Số lượng xuất thêm ({unit}):
          </label>
          <Input
            id="supp-qty"
            aria-label="Số lượng xuất thêm"
            type="number"
            step="any"
            min="0.001"
            value={suppQuantity}
            onChange={(e) => onSuppQuantityChange(e.target.value)}
            placeholder="Nhập số lượng xuất bổ sung dương..."
            className="h-9 text-sm font-mono"
          />
        </div>

        <div>
          <label htmlFor="supp-reason" className="text-xs font-semibold text-slate-700 block mb-1">
            Lý do xuất bổ sung (bắt buộc):
          </label>
          <Input
            id="supp-reason"
            aria-label="Lý do xuất bổ sung"
            value={suppReason}
            onChange={(e) => onSuppReasonChange(e.target.value)}
            placeholder="Nhập lý do xuất bổ sung..."
            className="h-9 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onSuppReasonChange(preset)}
                className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
