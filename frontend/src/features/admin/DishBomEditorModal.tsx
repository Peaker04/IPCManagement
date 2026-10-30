import { useEffect, useState, useId, useMemo } from 'react';
import { Trash2, Plus, AlertCircle, Utensils } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { InlineBanner } from '../../components/ui/inline-banner';
import { SearchableCombobox } from '../../components/ui/searchable-combobox';
import { bomApi, type DishBomLine } from '../../api/bomApi';
import { adminApi, type IngredientItem } from '../../api/adminApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

const PRICE_TIERS = [25000, 30000, 34000];

export interface DishBomEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: { dishId: string; dishCode: string; dishName: string } | null;
  onSaved?: () => void;
}

export function DishBomEditorModal({
  isOpen,
  onClose,
  dish,
  onSaved,
}: DishBomEditorModalProps) {
  const [bomLines, setBomLines] = useState<DishBomLine[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // BOM Tier & Scope state
  const [selectedPriceTier, setSelectedPriceTier] = useState<number>(25000);
  const [scopeCustomer, setScopeCustomer] = useState<string>('GLOBAL');

  // New BOM line form state
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [grossQty, setGrossQty] = useState('');

  const ingSelectId = useId();
  const qtyInputId = useId();

  const loadData = async (dishId: string) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [lines, ingResult, custList] = await Promise.all([
        bomApi.getDishBomLines(dishId),
        adminApi.getIngredients({ pageSize: 200 }).catch(() => ({ items: [] })),
        weeklyMenuApi.getCustomers().catch(() => []),
      ]);
      setBomLines(lines || []);
      const ingItems = ingResult?.items || [];
      setIngredients(ingItems);
      setCustomers(custList || []);
      if (ingItems.length > 0 && !selectedIngredientId) {
        setSelectedIngredientId(ingItems[0].ingredientId);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể tải định mức BOM của món ăn.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !dish?.dishId) {
      setBomLines([]);
      setFeedback(null);
      return;
    }
    void loadData(dish.dishId);
  }, [isOpen, dish?.dishId]);

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dish?.dishId || !selectedIngredientId || !grossQty) return;
    const qty = Number(grossQty);
    if (isNaN(qty) || qty <= 0) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập định mức / suất lớn hơn 0.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const selectedIng = ingredients.find((i) => i.ingredientId === selectedIngredientId);
      const isCustomerSpecific = scopeCustomer !== 'GLOBAL';
      await bomApi.addDishBomLine(dish.dishId, {
        ingredientId: selectedIngredientId,
        grossQtyPerServing: qty,
        unitId: selectedIng?.unitId,
        priceTierAmount: selectedPriceTier,
        customerId: isCustomerSpecific ? scopeCustomer : undefined,
        bomScope: isCustomerSpecific ? 'customer' : 'global',
      });
      setGrossQty('');
      setFeedback({ type: 'success', message: 'Đã thêm nguyên liệu vào định mức BOM thành công.' });
      await loadData(dish.dishId);
      onSaved?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể thêm dòng BOM.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLine = async (bomId: string) => {
    if (!dish?.dishId) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await bomApi.closeDishBomLine(dish.dishId, bomId);
      setFeedback({ type: 'success', message: 'Đã xóa dòng định mức BOM.' });
      await loadData(dish.dishId);
      onSaved?.();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Không thể xóa dòng BOM.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter BOM lines matching selected price tier
  const visibleBomLines = useMemo(() => {
    return bomLines.filter((l) => (l.priceTierAmount || 25000) === selectedPriceTier);
  }, [bomLines, selectedPriceTier]);

  if (!dish) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Định mức BOM: ${dish.dishName}`}
      description={`Mã món: ${dish.dishCode} · Quản lý định lượng theo 3 mốc giá chuẩn (25k/30k/34k) và phạm vi khách hàng`}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="font-mono text-slate-900">{visibleBomLines.length}</strong> nguyên liệu ở tier {selectedPriceTier.toLocaleString('vi-VN')} ₫
          </div>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {feedback && (
          <InlineBanner
            variant={feedback.type}
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </InlineBanner>
        )}

        {/* 3 Price Tiers & Scope Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Mốc giá suất ăn chuẩn:</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Mốc giá BOM">
              {PRICE_TIERS.map((tier) => {
                const isSelected = selectedPriceTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedPriceTier(tier)}
                    className={clsx(
                      'px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    {tier.toLocaleString('vi-VN')} ₫
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Phạm vi áp dụng:</span>
            <Select
              aria-label="Phạm vi áp dụng BOM"
              value={scopeCustomer}
              onChange={(e) => setScopeCustomer(e.target.value)}
              options={[
                { value: 'GLOBAL', label: 'Dùng chung toàn hệ thống (Global)' },
                ...customers.map((c) => ({ value: c.customerId, label: `Khách: ${c.customerCode} - ${c.customerName}` })),
              ]}
              className="h-7 text-xs font-medium w-56"
            />
          </div>
        </div>

        {/* Existing BOM table for selected tier */}
        <div className="border border-slate-200 rounded overflow-hidden bg-white">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Utensils size={14} className="text-slate-500" aria-hidden="true" />
              <span>Nguyên liệu trong định mức tier {selectedPriceTier.toLocaleString('vi-VN')} ₫ ({visibleBomLines.length})</span>
            </span>
            {visibleBomLines.length === 0 && !isLoading && (
              <span className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle size={13} aria-hidden="true" />
                <span>Món ăn chưa có BOM ở mốc giá {selectedPriceTier.toLocaleString('vi-VN')} ₫</span>
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Đang tải danh sách định mức nguyên liệu…
            </div>
          ) : visibleBomLines.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-50/50">
              Chưa có nguyên liệu nào ở mốc giá này. Sử dụng form bên dưới để thêm nguyên liệu vào định mức.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold w-24">Mã NL</th>
                    <th className="py-2 px-3 font-semibold">Tên nguyên liệu</th>
                    <th className="py-2 px-2 font-semibold text-center w-16">ĐVT</th>
                    <th className="py-2 px-3 font-semibold text-right w-28">Định mức / suất</th>
                    <th className="py-2 px-3 font-semibold text-center w-28">Phạm vi</th>
                    <th className="py-2 px-2 text-center w-12" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleBomLines.map((line) => (
                    <tr key={line.bomId} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3">
                        <IdentifierText value={line.ingredientCode} />
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {line.ingredientName}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600">
                        {line.unitName || 'kg'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        <Num value={line.grossQtyPerServing} format="quantity" decimals={4} />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={line.customerId ? 'info' : 'neutral'} size="sm">
                          {line.customerCode ? `Khách: ${line.customerCode}` : 'Dùng chung'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          aria-label={`Xóa ${line.ingredientName} khỏi BOM`}
                          onClick={() => void handleDeleteLine(line.bomId)}
                          disabled={isSubmitting}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form add new ingredient into BOM using SearchableCombobox */}
        <form onSubmit={handleAddLine} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
          <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Plus size={14} className="text-slate-600" aria-hidden="true" />
              <span>Thêm nguyên liệu vào mốc giá {selectedPriceTier.toLocaleString('vi-VN')} ₫</span>
            </span>
            <span className="text-slate-500 font-normal">
              Áp dụng: <strong className="font-semibold">{scopeCustomer === 'GLOBAL' ? 'Dùng chung' : `Khách ${customers.find((c) => c.customerId === scopeCustomer)?.customerCode || ''}`}</strong>
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-7">
              <label htmlFor={ingSelectId} className="block text-xs font-medium text-slate-700 mb-1">
                Tìm & chọn nguyên liệu (Gõ mã hoặc tên)
              </label>
              <SearchableCombobox
                id={ingSelectId}
                aria-label="Chọn nguyên liệu"
                value={selectedIngredientId}
                onChange={setSelectedIngredientId}
                options={ingredients.map((ing) => ({
                  value: ing.ingredientId,
                  label: ing.ingredientName,
                  sublabel: ing.ingredientCode,
                  badge: ing.unitName || 'kg',
                }))}
                placeholder="Gõ tên hoặc mã nguyên liệu..."
                className="h-8"
              />
            </div>

            <div className="col-span-3">
              <label htmlFor={qtyInputId} className="block text-xs font-medium text-slate-700 mb-1">
                Định mức / suất
              </label>
              <Input
                id={qtyInputId}
                aria-label="Định mức / suất"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="0.100"
                value={grossQty}
                onChange={(e) => setGrossQty(e.target.value)}
                className="h-8 text-xs font-mono font-semibold"
                required
              />
            </div>

            <div className="col-span-2">
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isSubmitting || !selectedIngredientId || !grossQty}
                className="w-full h-8 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                {isSubmitting ? 'Đang lưu…' : 'Thêm vào BOM'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
