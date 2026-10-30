import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { toVietnameseDate } from '../../utils/dates';
import { mrxApi, type MrxBatchDishSummary } from '../../api/mrxApi';

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
  onSubmit: (customLines?: Array<{ dailyLineId: string; quantity: number; reason: string }>) => void;
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
  const [mode, setMode] = useState<'direct' | 'by-dish'>('direct');
  const [dishes, setDishes] = useState<MrxBatchDishSummary[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [extraServings, setExtraServings] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !activeBatchId) return;
    let ignore = false;
    mrxApi.getBatchDishes(activeBatchId)
      .then((items) => {
        if (!ignore && items) {
          setDishes(items);
          if (items.length > 0 && !selectedDishId) {
            setSelectedDishId(items[0].dishId);
          }
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [isOpen, activeBatchId, selectedDishId]);

  const currentLine = lines.find((l) => l.dailyLineId === suppMaterialId);
  const unit = currentLine?.canonicalUnitName || 'đơn vị';
  const canSubmit = !isSubmittingSupp && Boolean(suppMaterialId) && Number(suppQuantity) > 0 && Boolean(suppReason.trim());

  const selectedDish = dishes.find((d) => d.dishId === selectedDishId) || dishes[0] || null;

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
            onClick={() => onSubmit()}
          >
            {isSubmittingSupp ? 'Đang xử lý...' : 'Xác nhận xuất bổ sung'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        {suppError && (
          <InlineBanner variant="error">
            {suppError}
          </InlineBanner>
        )}

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded text-xs">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`flex-1 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'direct' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhập nguyên liệu trực tiếp
          </button>
          <button
            type="button"
            onClick={() => setMode('by-dish')}
            className={`flex-1 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'by-dish' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tính theo món ăn & suất phát sinh
          </button>
        </div>

        {mode === 'by-dish' && (
          <div className="p-3 bg-blue-50/60 rounded border border-blue-200 space-y-2.5 text-xs">
            <span className="font-semibold text-blue-900 block">
              Tính nhanh lượng nguyên liệu cần bù theo định mức BOM đóng băng:
            </span>
            <div className="grid grid-cols-7 gap-2">
              <div className="col-span-4">
                <label htmlFor="dish-select" className="font-semibold text-slate-700 block mb-1">
                  Chọn món ăn:
                </label>
                <Select
                  id="dish-select"
                  aria-label="Chọn món ăn phát sinh"
                  value={selectedDishId}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  options={dishes.map((d) => ({
                    value: d.dishId,
                    label: `${d.dishName} (${d.dishCode})`,
                  }))}
                  className="w-full h-8 text-xs"
                />
              </div>
              <div className="col-span-3">
                <label htmlFor="servings-input" className="font-semibold text-slate-700 block mb-1">
                  Số suất phát sinh:
                </label>
                <Input
                  id="servings-input"
                  aria-label="Số suất phát sinh"
                  type="number"
                  min="1"
                  step="1"
                  value={extraServings}
                  onChange={(e) => setExtraServings(e.target.value)}
                  placeholder="Ví dụ: 20"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {selectedDish && Number(extraServings) > 0 && (
              <div className="mt-2 border-t border-blue-200 pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-700 font-semibold text-xs">Các nguyên liệu cấu thành ({selectedDish.materials.length}):</span>
                  <Button
                    type="button"
                    variant="default"
                    size="xs"
                    disabled={isSubmittingSupp}
                    onClick={() => {
                      const allLines = selectedDish.materials
                        .map((m) => {
                          const lineMatch = lines.find((l) => l.dailyLineId === m.dailyLineId);
                          if (!lineMatch) return null;
                          const calculatedQty = Number((Number(extraServings) * m.grossQtyPerServing).toFixed(3));
                          return {
                            dailyLineId: lineMatch.dailyLineId,
                            quantity: calculatedQty,
                            reason: `Phát sinh ${extraServings} suất món ${selectedDish.dishName}`,
                          };
                        })
                        .filter((item): item is { dailyLineId: string; quantity: number; reason: string } => item !== null && item.quantity > 0);
                      if (allLines.length > 0) {
                        onSubmit(allLines);
                      }
                    }}
                    className="h-6 px-2 text-xs font-semibold"
                  >
                    Xuất trọn gói cả món ({selectedDish.materials.length} NL)
                  </Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedDish.materials.map((m, idx) => {
                    const lineMatch = lines.find((l) => l.dailyLineId === m.dailyLineId);
                    const calculatedQty = (Number(extraServings) * m.grossQtyPerServing).toFixed(3);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200 hover:border-blue-400"
                      >
                        <span className="font-medium text-slate-800">
                          {m.ingredientName} ({m.grossQtyPerServing} {m.canonicalUnitName || 'kg'}/suất)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-900">
                            {calculatedQty} {m.canonicalUnitName || 'kg'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (lineMatch) onSuppMaterialIdChange(lineMatch.dailyLineId);
                              onSuppQuantityChange(calculatedQty);
                              onSuppReasonChange(`Phát sinh ${extraServings} suất món ${selectedDish.dishName}`);
                              setMode('direct');
                            }}
                            className="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 cursor-pointer"
                          >
                            Chọn
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="supp-ingredient" className="text-xs font-semibold text-slate-700 block mb-1">
            Chọn nguyên liệu bổ sung:
          </label>
          <Select
            id="supp-ingredient"
            aria-label="Chọn nguyên liệu bổ sung"
            value={suppMaterialId}
            onChange={(e) => onSuppMaterialIdChange(e.target.value)}
            options={lines.map((l) => ({
              value: l.dailyLineId,
              label: `${l.ingredientName || 'Nguyên liệu'} (Đã xuất: ${l.issuedQuantity ?? 0} ${l.canonicalUnitName || 'đơn vị'})`,
            }))}
            className="w-full h-9 text-sm"
          />
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
