import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { InlineBanner } from '../../components/ui/inline-banner';
import { toVietnameseDate } from '../../utils/dates';
import { Num } from '../../components/ui/num';
import { mrxApi, type MrxBatchDishSummary } from '../../api/mrxApi';
import { normalizeQuantity } from './mrxQuantity';
import { invalidateMrxCaches } from '../../api/mrxCacheInvalidation';
import { getCachedArray, serverStateCache } from '../../store/serverStateCache';

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
  isOutcomeUnknown?: boolean;
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
  isOutcomeUnknown = false,
  onSubmit,
}: MrxSupplementalIssueModalProps) {
  const [mode, setMode] = useState<'direct' | 'by-dish'>('direct');
  const scope = `${activeBatchId}_${activeDate}`;
  const dishesCacheKey = activeBatchId ? `mrx_batch_dishes_${activeBatchId}` : '';
  const warmDishesEntry = dishesCacheKey ? serverStateCache.get<MrxBatchDishSummary[]>(dishesCacheKey) : null;
  const warmDishesArray = dishesCacheKey ? getCachedArray<MrxBatchDishSummary>(dishesCacheKey) : undefined;
  const [catalog, setCatalog] = useState<{ batchId: string; dishes: MrxBatchDishSummary[]; error: Error | null } | null>(() =>
    warmDishesEntry && warmDishesArray ? { batchId: activeBatchId, dishes: warmDishesArray, error: null } : null
  );
  if (isOpen && activeBatchId && warmDishesEntry && !warmDishesEntry.isStale && warmDishesArray && catalog?.batchId !== activeBatchId) {
    setCatalog({ batchId: activeBatchId, dishes: warmDishesArray, error: null });
  }
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [selection, setSelection] = useState<{ scope: string; dishId: string } | null>(null);
  const [servings, setServings] = useState<{ scope: string; value: string } | null>(null);
  const dishes = catalog?.batchId === activeBatchId ? catalog.dishes.filter(dish =>
    dish.materials.some(material => !material.serviceDate || material.serviceDate === activeDate)) : [];
  const catalogError = catalog?.batchId === activeBatchId ? catalog.error : null;
  const extraServings = servings?.scope === scope ? servings.value : '';
  const selectedDishId = selection?.scope === scope && dishes.some(dish => dish.dishId === selection.dishId) ? selection.dishId : dishes[0]?.dishId ?? '';

  useEffect(() => {
    if (!isOpen || !activeBatchId) return;
    if (catalogRetry === 0) {
      const cached = serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`);
      if (cached && !cached.isStale) return;
    }
    let ignore = false;
    mrxApi.getBatchDishes(activeBatchId)
      .then((items) => {
        if (!ignore) {
          serverStateCache.set(`mrx_batch_dishes_${activeBatchId}`, items);
          setCatalog({ batchId: activeBatchId, dishes: items, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (!ignore) setCatalog({ batchId: activeBatchId, dishes: [], error: cause instanceof Error ? cause : new Error('Không thể tải định mức món.') });
      });
    return () => { ignore = true; };
  }, [isOpen, activeBatchId, catalogRetry]);

  const currentLine = lines.find((l) => l.dailyLineId === suppMaterialId);
  const unit = currentLine?.canonicalUnitName || 'đơn vị';
  const directQuantity = normalizeQuantity(Number(suppQuantity));
  const canSubmit = !isSubmittingSupp && !isOutcomeUnknown && Boolean(currentLine) && Number.isFinite(directQuantity) && directQuantity > 0 && Boolean(suppReason.trim());

  const selectedDish = dishes.find((d) => d.dishId === selectedDishId) ?? null;
  const calculatedMaterials = (selectedDish?.materials ?? []).filter((material) => !material.serviceDate || material.serviceDate === activeDate).map((material) => ({
    material,
    matches: lines.filter((line) => line.dailyLineId === material.dailyLineId),
    quantity: material.canonicalQtyPerServing != null && material.canonicalQtyPerServing > 0
      ? normalizeQuantity(material.canonicalQtyPerServing, Number(extraServings)) : Number.NaN,
  }));
  const packageInvalid = calculatedMaterials.length === 0 || calculatedMaterials.some((item) => item.matches.length !== 1 || !Number.isFinite(item.quantity) || item.quantity <= 0)
    || new Set(calculatedMaterials.map((item) => item.material.dailyLineId)).size !== calculatedMaterials.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmittingSupp && !isOutcomeUnknown) onClose(); }}
      title="Xuất kho bổ sung trong ca"
      description={`Lô: ${activeBatchId.slice(0, 8)} · Ngày phục vụ: ${toVietnameseDate(activeDate)}`}
      footer={
        <>
          <Button variant="outline" size="sm" disabled={isSubmittingSupp || isOutcomeUnknown} onClick={onClose}>
            Hủy bỏ
          </Button>
          {mode === 'direct' && <Button
            variant="default"
            size="sm"
            disabled={!canSubmit}
            onClick={() => { if (canSubmit) onSubmit(); }}
          >
            {isSubmittingSupp ? 'Đang xử lý...' : 'Xác nhận xuất bổ sung'}
          </Button>}
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700">
        {suppError && (
          <InlineBanner
            variant="error"
            title={isOutcomeUnknown ? 'Chưa xác nhận được kết quả xuất kho' : undefined}
            actionLabel={isOutcomeUnknown ? 'Tải lại để kiểm tra kết quả' : undefined}
            onAction={isOutcomeUnknown ? () => { invalidateMrxCaches(); window.location.reload(); } : undefined}
          >
            {suppError}
          </InlineBanner>
        )}

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded text-xs">
          <button
            type="button"
            disabled={isSubmittingSupp || isOutcomeUnknown}
            onClick={() => setMode('direct')}
            className={`flex-1 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'direct' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhập nguyên liệu trực tiếp
          </button>
          <button
            type="button"
            disabled={isSubmittingSupp || isOutcomeUnknown}
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
            {catalogError && <InlineBanner variant="error" actionLabel="Tải lại định mức món" onAction={() => setCatalogRetry((value) => value + 1)}>{catalogError.message}</InlineBanner>}
            {!catalogError && catalog?.batchId !== activeBatchId && <p role="status">Đang tải định mức món…</p>}
            {!catalogError && catalog?.batchId === activeBatchId && dishes.length === 0 && <p>Chưa có định mức món cho ngày đang chọn để tính bổ sung. Có thể nhập nguyên liệu trực tiếp theo dòng đã khóa.</p>}
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
                  disabled={isSubmittingSupp || isOutcomeUnknown || dishes.length === 0}
                  onChange={(e) => setSelection({ scope, dishId: e.target.value })}
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
                  disabled={isSubmittingSupp || isOutcomeUnknown}
                  onChange={(e) => setServings({ scope, value: e.target.value })}
                  placeholder="Ví dụ: 20"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {selectedDish && Number(extraServings) > 0 && (
              <div className="mt-2 border-t border-blue-200 pt-2">
                {packageInvalid && <InlineBanner variant="error">Không thể xuất trọn gói: cần đủ định lượng canonical đóng băng và ánh xạ duy nhất tới dòng của ngày đang chọn. Hãy dùng nhập trực tiếp nếu thiếu bằng chứng quy đổi.</InlineBanner>}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-700 font-semibold text-xs">Các nguyên liệu cấu thành ({calculatedMaterials.length}):</span>
                  <Button
                    type="button"
                    variant="default"
                    size="xs"
                    disabled={isSubmittingSupp || isOutcomeUnknown || packageInvalid}
                    onClick={() => {
                      if (isSubmittingSupp || isOutcomeUnknown || packageInvalid) return;
                      onSubmit(calculatedMaterials.map((item) => ({
                        dailyLineId: item.matches[0].dailyLineId,
                        quantity: item.quantity,
                        reason: `Phát sinh ${extraServings} suất món ${selectedDish.dishName}`,
                      })));
                    }}
                    className="h-6 px-2 text-xs font-semibold"
                  >
                    Xuất trọn gói cả món ({calculatedMaterials.length} NL)
                  </Button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {calculatedMaterials.map(({ material: m, matches, quantity }, idx) => {
                    const lineMatch = matches.length === 1 ? matches[0] : null;
                    const calculatedQty = String(quantity);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200 hover:border-blue-400"
                      >
                        <span className="font-medium text-slate-800">
                          {m.ingredientName} (<Num value={m.canonicalQtyPerServing} format="rate" /> {m.canonicalUnitName || 'Chưa rõ đơn vị'}/suất)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-900">
                            <Num value={Number.isFinite(quantity) ? quantity : null} format="plain" decimals={6} /> {m.canonicalUnitName || 'Chưa rõ đơn vị'}
                          </span>
                          <button
                            type="button"
                            disabled={!lineMatch || isSubmittingSupp || isOutcomeUnknown || !Number.isFinite(quantity) || quantity <= 0}
                            onClick={() => {
                              if (!lineMatch || isSubmittingSupp || isOutcomeUnknown || !Number.isFinite(quantity) || quantity <= 0) return;
                              onSuppMaterialIdChange(lineMatch.dailyLineId);
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

        {mode === 'direct' && <>
        <div>
          <label htmlFor="supp-ingredient" className="text-xs font-semibold text-slate-700 block mb-1">
            Chọn nguyên liệu bổ sung:
          </label>
          <Select
            id="supp-ingredient"
            aria-label="Chọn nguyên liệu bổ sung"
            value={suppMaterialId}
            disabled={isSubmittingSupp || isOutcomeUnknown}
            onChange={(e) => { if (!isSubmittingSupp && !isOutcomeUnknown) onSuppMaterialIdChange(e.target.value); }}
            options={lines.map((l) => ({
              value: l.dailyLineId,
              label: `${l.ingredientName || 'Nguyên liệu'} (Đã xuất: ${l.issuedQuantity ?? 'Chưa rõ'} ${l.canonicalUnitName || 'Chưa rõ đơn vị'})`,
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
            min="0.000001"
            value={suppQuantity}
            disabled={isSubmittingSupp || isOutcomeUnknown}
            onChange={(e) => { if (!isSubmittingSupp && !isOutcomeUnknown) onSuppQuantityChange(e.target.value); }}
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
            disabled={isSubmittingSupp || isOutcomeUnknown}
            onChange={(e) => { if (!isSubmittingSupp && !isOutcomeUnknown) onSuppReasonChange(e.target.value); }}
            placeholder="Nhập lý do xuất bổ sung..."
            className="h-9 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={isSubmittingSupp || isOutcomeUnknown}
                onClick={() => { if (!isSubmittingSupp && !isOutcomeUnknown) onSuppReasonChange(preset); }}
                className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        </>}
      </div>
    </Modal>
  );
}
