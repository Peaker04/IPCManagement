import { MRX_SHIFT_OPTIONS } from '../../constants/mrxConstants';
import { useEffect, useId, useMemo, useState } from 'react';
import { Utensils } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { mrxApi, type MrxBatchDishSummary } from '../../api/mrxApi';
import { getCachedArray, serverStateCache } from '../../store/serverStateCache';
import { toVietnameseDate } from '../../utils/dates';
import { ApiError } from '../../api/client';
import { InlineBanner } from '../ui/inline-banner';
import { WorkbenchSkeleton } from './WorkbenchSkeleton';

export interface MrxBatchDishesModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  customerName?: string;
}

export function MrxBatchDishesModal(props: MrxBatchDishesModalProps) {
  return props.isOpen && props.batchId ? <MrxBatchDishesDialog key={props.batchId} {...props} /> : null;
}

function MrxBatchDishesDialog({
  isOpen,
  onClose,
  batchId,
  customerName,
}: MrxBatchDishesModalProps) {
  const materialHeadingId = useId();
  const cacheKey = `mrx_batch_dishes_${batchId}`;
  const [dishes, setDishes] = useState<MrxBatchDishSummary[]>(() => {
    const cached = serverStateCache.get<MrxBatchDishSummary[]>(cacheKey);
    const cachedItems = getCachedArray<MrxBatchDishSummary>(cacheKey);
    return cached && !cached.isStale && cachedItems ? cachedItems : [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = serverStateCache.get<MrxBatchDishSummary[]>(cacheKey);
    const cachedItems = getCachedArray<MrxBatchDishSummary>(cacheKey);
    return !(cached && !cached.isStale && cachedItems);
  });
  const [error, setError] = useState<Error | null>(null);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(() => {
    const cached = serverStateCache.get<MrxBatchDishSummary[]>(cacheKey);
    const cachedItems = getCachedArray<MrxBatchDishSummary>(cacheKey);
    return cached && !cached.isStale && cachedItems ? (cachedItems[0]?.dishId ?? null) : null;
  });
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen || !batchId) return;
    if (attempt === 0) {
      const warm = serverStateCache.get<MrxBatchDishSummary[]>(cacheKey);
      if (warm && !warm.isStale) return;
    }
    let ignore = false;
    mrxApi.getBatchDishes(batchId)
      .then((items) => {
        if (!ignore) {
          const normalized = items || [];
          serverStateCache.set(cacheKey, normalized);
          setDishes(normalized);
          if (normalized.length > 0) {
            setSelectedDishId((current) => current && normalized.some((d) => d.dishId === current) ? current : normalized[0].dishId);
          } else {
            setSelectedDishId(null);
          }
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          serverStateCache.delete(cacheKey);
          setDishes([]);
          setSelectedDishId(null);
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách món ăn trong lô đối soát.'));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => { ignore = true; };
  }, [isOpen, batchId, attempt, cacheKey]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      if (shiftFilter !== 'ALL') {
        const hasShift = (d.scopes ?? []).some((s) =>
          shiftFilter === 'MORNING'
            ? s.shiftName.toLowerCase().includes('sáng') || s.shiftName.toUpperCase().includes('MORNING') || s.shiftName.includes('1')
            : s.shiftName.toLowerCase().includes('chiều') || s.shiftName.toUpperCase().includes('AFTERNOON') || s.shiftName.includes('2')
        );
        if (!hasShift) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return d.dishName.toLowerCase().includes(q) || d.dishCode.toLowerCase().includes(q);
      }
      return true;
    });
  }, [dishes, shiftFilter, searchQuery]);

  const selectedDish = filteredDishes.find((d) => d.dishId === selectedDishId) || filteredDishes[0] || null;

  const materialDates = [...new Set(selectedDish?.materials.map(material => material.serviceDate ?? '') ?? [])].sort();
  const ingredientCount = (dish: MrxBatchDishSummary) => new Set(dish.materials.map(material => `${material.ingredientId}|${material.canonicalUnitId}`)).size;
  const denied = error instanceof ApiError && error.status === 403;
  const unavailable = !denied && Boolean(error && (error.message.includes('KITCHEN_FROZEN_LINEAGE_') || error.message.includes('LEGACY_')));
  const retry = () => {
    setDishes([]);
    setError(null);
    setIsLoading(true);
    setAttempt((current) => current + 1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Món & BOM đã đóng băng"
      description={`${customerName || 'Lô đã chọn'}${!isLoading && !error ? ` · ${dishes.length} món ăn` : ''}`}
      maxWidth="max-w-4xl"
      className="h-[min(40rem,85dvh)]"
      bodyClassName="min-h-0"
      footer={<Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-4">
        {isLoading ? (
          <WorkbenchSkeleton geometry={{ kind: 'split', columns: 3, rows: 6, splitRatio: '40/60' }} />
        ) : error ? (
          <InlineBanner
            variant={unavailable ? 'info' : 'error'}
            title={denied ? 'Không có quyền xem món & BOM của lô' : unavailable ? 'Chưa đủ dữ liệu món & BOM đã đóng băng' : 'Không thể tải món & BOM đã đóng băng'}
            actionLabel={!denied && !unavailable ? 'Thử lại' : undefined}
            onAction={!denied && !unavailable ? retry : undefined}
          >
            {unavailable ? 'Dữ liệu đóng băng thiếu hoặc chưa khớp.' : error.message}
          </InlineBanner>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400"
            >
              <Utensils size={20} strokeWidth={1.75} />
            </div>
            <p className="text-xs text-slate-500 italic">Lô chưa có món ăn đã đóng băng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 md:grid-cols-12">
            {/* Dish list and filters share the dialog's vertical scroll owner. */}
            <div className="md:col-span-5 min-w-0 flex flex-col bg-white">
              <div className="p-2 border-b border-slate-200 bg-slate-50 space-y-1.5 shrink-0">
                <Input
                  aria-label="Tìm món ăn"
                  placeholder="Tìm theo tên hoặc mã món..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs"
                />
                <div className="flex gap-1" role="toolbar" aria-label="Lọc theo ca">
                  <button
                    type="button"
                    onClick={() => setShiftFilter('ALL')}
                    aria-pressed={shiftFilter === 'ALL'}
                    className={`flex-1 py-0.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                      shiftFilter === 'ALL' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('MORNING')}
                    aria-pressed={shiftFilter === 'MORNING'}
                    className={`flex-1 py-0.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                      shiftFilter === 'MORNING' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Sáng
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('AFTERNOON')}
                    aria-pressed={shiftFilter === 'AFTERNOON'}
                    className={`flex-1 py-0.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                      shiftFilter === 'AFTERNOON' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Chiều
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredDishes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Không tìm thấy món phù hợp với bộ lọc.
                  </div>
                ) : (
                  filteredDishes.map((dish) => {
                    const isSelected = selectedDish?.dishId === dish.dishId;
                    const scopes = dish.scopes ?? [];
                    const totalServings = scopes.reduce((sum, s) => sum + (s.frozenServings ?? 0), 0);

                    return (
                      <div
                        key={dish.dishId}
                        className={`w-full p-3 flex items-start gap-2 transition-colors ${
                          isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button type="button" onClick={() => setSelectedDishId(dish.dishId)} aria-pressed={isSelected} className="flex-1 min-w-0 text-left cursor-pointer">
                          <span className="font-semibold text-sm text-slate-900 truncate block">
                            {dish.dishName}
                          </span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                          <span>{scopes.length} ca</span>
                          <span>·</span>
                          <span>{totalServings.toLocaleString('vi-VN')} suất</span>
                          <span>·</span>
                          <span>{ingredientCount(dish)} loại NL</span>
                        </div>
                        </button>
                        <IdentifierText value={dish.dishCode} className="shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Dish Detail (7 cols) */}
            <div className="md:col-span-7 min-w-0 border-t border-slate-200 md:border-l md:border-t-0 p-3 bg-white flex flex-col space-y-3">
              {selectedDish && (
                <>
                  <div className="pb-3 border-b border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-base text-slate-900">{selectedDish.dishName}</h3>
                      <Badge variant="neutral" size="sm">{selectedDish.dishCode}</Badge>
                    </div>

                    {/* Scopes: Service dates & shifts */}
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-semibold block mb-1">Lịch phục vụ trong tuần:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedDish.scopes ?? []).map((s, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 font-mono text-xs text-slate-700">
                            <strong>{toVietnameseDate(s.serviceDate)}</strong> ({MRX_SHIFT_OPTIONS.find(shift => shift.value === s.shiftName)?.label ?? 'Ca chưa nhận diện'}): {s.frozenServings} suất
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Materials breakdown */}
                  <section aria-labelledby={materialHeadingId}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2 pb-1">
                      <h4 id={materialHeadingId} className="text-sm font-semibold text-slate-900">Định mức theo ngày</h4>
                      <span className="text-xs text-slate-500"><Num value={ingredientCount(selectedDish)} /> loại nguyên liệu</span>
                    </div>
                    {materialDates.map(date => <table key={date} aria-label={`Định mức ngày ${date ? toVietnameseDate(date) : 'chưa xác định'}`} className="mt-3 w-full text-left text-xs border-separate border-spacing-0">
                      <caption className="bg-slate-100 px-2 py-2 text-left text-slate-900"><span className="mr-2 text-slate-600">Ngày phục vụ</span><strong>{date ? toVietnameseDate(date) : 'Chưa rõ ngày phục vụ'}</strong></caption>
                      <thead className="bg-white text-slate-500"><tr>
                        <th className="p-2 text-left">Nguyên liệu</th><th className="p-2 text-left">ĐVT</th><th className="p-2 text-right">Định mức/suất</th>
                      </tr></thead>
                      <tbody>{selectedDish.materials.filter(material => (material.serviceDate ?? '') === date).map((material, index) => <tr key={`${material.dailyLineId}-${material.batchLineId}-${index}`} className="h-10">
                        <td className="border-b border-slate-100 p-2 font-medium text-slate-900">{material.ingredientName}{material.ingredientCode && <span className="block text-slate-500"><IdentifierText value={material.ingredientCode} /></span>}</td>
                        <td className="border-b border-slate-100 p-2 text-slate-600">{material.canonicalUnitName || 'Chưa rõ đơn vị'}</td>
                        <td className="border-b border-slate-100 p-2 text-right" title={material.quantityUnavailableReasonCode ? 'Thiếu bằng chứng quy đổi đóng băng; không thể tính theo suất.' : undefined}><Num value={material.canonicalQtyPerServing} format="rate" /></td>
                      </tr>)}</tbody>
                    </table>)}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
