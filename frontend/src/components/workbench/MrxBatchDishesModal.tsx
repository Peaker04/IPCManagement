import { useEffect, useMemo, useState } from 'react';
import { Utensils } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { mrxApi, type MrxBatchDishSummary } from '../../api/mrxApi';
import { toVietnameseDate } from '../../utils/dates';
import { DishBomEditorModal } from '../../features/admin/DishBomEditorModal';

export interface MrxBatchDishesModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId: string;
  customerName?: string;
}

export function MrxBatchDishesModal({
  isOpen,
  onClose,
  batchId,
  customerName,
}: MrxBatchDishesModalProps) {
  const [dishes, setDishes] = useState<MrxBatchDishSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBomDish, setEditingBomDish] = useState<{ dishId: string; dishCode: string; dishName: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !batchId) return;
    let ignore = false;
    mrxApi.getBatchDishes(batchId)
      .then((items) => {
        if (!ignore) {
          setDishes(items || []);
          if (items && items.length > 0) {
            setSelectedDishId(items[0].dishId);
          }
        }
      })
      .catch((cause: unknown) => {
        if (!ignore) {
          setError(cause instanceof Error ? cause : new Error('Không thể tải danh sách món ăn trong lô đối soát.'));
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => { ignore = true; };
  }, [isOpen, batchId]);

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

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Danh mục món ăn & định mức đông cứng trong lô"
      description={`Lô: ${(batchId || '').slice(0, 8)} ${customerName ? `· ${customerName}` : ''} · ${dishes.length} món ăn`}
      maxWidth="max-w-4xl"
      footer={<Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs">
            {error.message.includes('KITCHEN_FROZEN_LINEAGE_MISSING') || error.message.includes('LEGACY_')
              ? 'Lô đối soát này chưa có danh mục món ăn đóng băng theo ca từ hệ thống thực đơn.'
              : error.message}
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
            Đang tải dữ liệu món ăn đông cứng…
          </div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400"
            >
              <Utensils size={20} strokeWidth={1.75} />
            </div>
            <p className="text-xs text-slate-500 italic">Lô đối soát này chưa có danh mục món ăn đóng băng.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 h-96">
            {/* Left: Dish list (5 cols) with search & shift filter */}
            <div className="col-span-5 border border-slate-200 rounded overflow-hidden flex flex-col bg-white">
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
                    className={`flex-1 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      shiftFilter === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('MORNING')}
                    className={`flex-1 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      shiftFilter === 'MORNING' ? 'bg-slate-900 text-white font-bold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Ca 1 (Sáng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('AFTERNOON')}
                    className={`flex-1 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      shiftFilter === 'AFTERNOON' ? 'bg-slate-900 text-white font-bold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Ca 2 (Chiều)
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
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
                      <button
                        key={dish.dishId}
                        type="button"
                        onClick={() => setSelectedDishId(dish.dishId)}
                        className={`w-full text-left p-3 transition-colors cursor-pointer block ${
                          isSelected ? 'bg-blue-50/80 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-slate-900 truncate block">
                            {dish.dishName}
                          </span>
                          <IdentifierText value={dish.dishCode} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                          <span>{scopes.length} ca</span>
                          <span>·</span>
                          <span>{totalServings.toLocaleString('vi-VN')} suất</span>
                          <span>·</span>
                          <span>{dish.materials.length} loại NL</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Dish Detail (7 cols) */}
            <div className="col-span-7 border border-slate-200 rounded p-3 bg-slate-50/50 flex flex-col overflow-y-auto space-y-3">
              {selectedDish && (
                <>
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-slate-900">{selectedDish.dishName}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" size="sm">{selectedDish.dishCode}</Badge>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setEditingBomDish({
                            dishId: selectedDish.dishId,
                            dishCode: selectedDish.dishCode,
                            dishName: selectedDish.dishName,
                          })}
                          className="h-7 text-xs font-medium"
                        >
                          Chỉnh sửa BOM
                        </Button>
                      </div>
                    </div>

                    {/* Scopes: Service dates & shifts */}
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 font-semibold block mb-1">Lịch phục vụ trong tuần:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedDish.scopes ?? []).map((s, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 font-mono text-[11px] text-slate-700">
                            <strong>{toVietnameseDate(s.serviceDate)}</strong> ({s.shiftName}): {s.frozenServings} suất
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Materials breakdown */}
                  <div className="bg-white rounded border border-slate-200 flex-1 overflow-hidden flex flex-col">
                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
                      Định mức nguyên liệu cấu thành món ({selectedDish.materials.length} loại):
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
                          <tr>
                            <th className="p-2">Nguyên liệu</th>
                            <th className="p-2 text-center">ĐVT</th>
                            <th className="p-2 text-right">Định mức/suất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedDish.materials.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-medium text-slate-900">
                                {m.ingredientName}
                                <span className="ml-1 text-[10px] text-slate-400 font-mono">({m.ingredientCode})</span>
                              </td>
                              <td className="p-2 text-center font-mono text-slate-600">{m.canonicalUnitName || 'kg'}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-800">
                                <Num value={m.grossQtyPerServing} format="quantity" decimals={4} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>

    <DishBomEditorModal
      isOpen={Boolean(editingBomDish)}
      onClose={() => setEditingBomDish(null)}
      dish={editingBomDish}
    />
  </>
  );
}
