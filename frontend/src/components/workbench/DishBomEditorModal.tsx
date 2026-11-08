import { useEffect, useState, useId, useMemo, useRef } from 'react';
import { Trash2, Plus, AlertCircle, Utensils } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Badge } from '../ui/badge';
import { Num } from '../ui/num';
import { IdentifierText } from '../ui/identifier-text';
import { InlineBanner } from '../ui/inline-banner';
import { SearchableCombobox } from '../ui/searchable-combobox';
import { bomApi, type DishBomLine } from '../../api/bomApi';
import { adminApi, type IngredientItem } from '../../api/adminApi';
import { weeklyMenuApi } from '../../api/weeklyMenuApi';
import type { CustomerOption } from '../../types';

import { useSupportedPriceTiers } from '../../hooks/useSupportedPriceTiers';
import { VietnameseDateInput } from '../ui/vietnamese-date-input';
import { toVietnameseDate } from '../../utils/dates';
import { ApiError } from '../../api/client';

export interface DishBomEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: { dishId: string; dishCode: string; dishName: string } | null;
  onSaved?: () => void;
  readOnly?: boolean;
  initialPriceTier?: number;
}

export function DishBomEditorModal({
  isOpen,
  onClose,
  dish,
  onSaved,
  readOnly = false,
  initialPriceTier,
}: DishBomEditorModalProps) {
  const [bomLines, setBomLines] = useState<DishBomLine[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // BOM Tier & Scope state
  const { tiers, isLoading: isLoadingTiers, error: tierError, retry: retryTiers } = useSupportedPriceTiers(isOpen && Boolean(dish));
  const [chosenPriceTier, setSelectedPriceTier] = useState<number | null>(initialPriceTier ?? null);
  const selectedPriceTier = chosenPriceTier ?? tiers[0] ?? 0;
  const hasUsableTier = !isLoadingTiers && !tierError && tiers.includes(selectedPriceTier);
  const [scopeCustomer, setScopeCustomer] = useState<string>('GLOBAL');

  // New BOM line form state
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [grossQty, setGrossQty] = useState('');
  const [editingLine, setEditingLine] = useState<DishBomLine | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const pending = useRef(false);
  const editDirty = Boolean(editingLine && (grossQty !== String(editingLine.grossQtyPerServing) || effectiveFrom || reason));
  const formDirty = editingLine ? editDirty : grossQty !== '';
  const clearForm = () => {
    setEditingLine(null);
    setGrossQty('');
    setEffectiveFrom('');
    setDateError(null);
    setReason('');
  };
  const reloadLines = async () => {
    if (!dish) return false;
    try {
      const lines = await bomApi.getDishBomLines(dish.dishId);
      setBomLines(lines);
      setReloadNeeded(false);
      if (reloadNeeded) setFeedback({ type: 'success', message: 'Đã tải lại định mức BOM. Kiểm tra dữ liệu trước khi thực hiện thay đổi khác.' });
      return true;
    } catch {
      setReloadNeeded(true);
      setFeedback({ type: 'error', message: 'Chưa tải lại được định mức BOM. Hãy thử tải lại, không gửi lại thay đổi.' });
      return false;
    }
  };

  const ingSelectId = useId();
  const qtyInputId = useId();

  const loadData = async (dishId: string) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [lines, ingResult, custList] = await Promise.all([
        bomApi.getDishBomLines(dishId),
        readOnly ? Promise.resolve({ items: [] as IngredientItem[] }) : adminApi.getIngredients({ pageSize: 200 }).catch(() => ({ items: [] })),
        readOnly ? Promise.resolve([] as CustomerOption[]) : weeklyMenuApi.getCustomers().catch(() => []),
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
    if (!isOpen || !dish?.dishId) return;
    let ignore = false;
    Promise.all([
      bomApi.getDishBomLines(dish.dishId),
      readOnly ? Promise.resolve({ items: [] as IngredientItem[] }) : adminApi.getIngredients({ pageSize: 200 }).catch(() => ({ items: [] })),
      readOnly ? Promise.resolve([] as CustomerOption[]) : weeklyMenuApi.getCustomers().catch(() => []),
    ]).then(([lines, ingResult, custList]) => {
      if (ignore) return;
      setBomLines(lines || []);
      const ingItems = ingResult?.items || [];
      setIngredients(ingItems);
      setCustomers(custList || []);
      setSelectedIngredientId((current) => current || ingItems[0]?.ingredientId || '');
    }).catch((cause: unknown) => {
      if (!ignore) setFeedback({
        type: 'error',
        message: cause instanceof Error ? cause.message : 'Không thể tải định mức BOM của món ăn.',
      });
    }).finally(() => {
      if (!ignore) setIsLoading(false);
    });
    return () => { ignore = true; };
  }, [dish?.dishId, isOpen, readOnly]);

  const handleAddLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || pending.current || reloadNeeded || !hasUsableTier || !dish?.dishId || !selectedIngredientId || !grossQty) return;
    const qty = Number(grossQty);
    if (!Number.isFinite(qty) || qty < 0.000001) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập định mức / suất lớn hơn 0.' });
      return;
    }

    if (editingLine && (!effectiveFrom || dateError || !reason.trim() ||
      (editingLine.bomStatus === 'PUBLISHED' && effectiveFrom <= editingLine.effectiveFrom))) {
      setFeedback({ type: 'error', message: 'Nhập lý do và ngày hiệu lực mới sau ngày bắt đầu của dòng BOM đã phát hành.' });
      return;
    }
    pending.current = true;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      if (editingLine) {
        const saved = await bomApi.updateDishBomLine(dish.dishId, editingLine.bomId, {
          grossQtyPerServing: qty, effectiveFrom, reason: reason.trim(),
        });
        setBomLines(current => saved.bomId === editingLine.bomId
          ? current.map(line => line.bomId === saved.bomId ? saved : line)
          : [...current, saved]);
        clearForm();
        setFeedback({ type: 'success', message: 'Đã cập nhật định mức BOM; lịch sử phiên bản được giữ nguyên.' });
        onSaved?.();
        await reloadLines();
        return;
      }
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
      const unknownOutcome = !(err instanceof ApiError) || err.status >= 500 || err.code === 'SESSION_CHANGED';
      if (unknownOutcome) setReloadNeeded(true);
      setFeedback({
        type: 'error',
        message: unknownOutcome ? 'Chưa xác định kết quả lưu. Hãy tải lại định mức và kiểm tra, không gửi lại thay đổi.'
          : err.message,
      });
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteLine = async (bomId: string) => {
    if (readOnly || pending.current || reloadNeeded || editingLine || grossQty || !dish?.dishId) return;
    pending.current = true;
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
      pending.current = false;
      setIsSubmitting(false);
    }
  };

  // Filter BOM lines matching selected price tier
  const visibleBomLines = useMemo(() => {
    return bomLines.filter((l) => l.priceTierAmount === selectedPriceTier);
  }, [bomLines, selectedPriceTier]);

  if (!dish) return null;

  return (
    <Modal
      isOpen={isOpen}
      isDirty={!readOnly && formDirty}
      closeDisabled={isSubmitting}
      onClose={() => {
        if (isSubmitting) return;
        clearForm();
        onClose();
      }}
      title={`Định mức BOM: ${dish.dishName}`}
      description={readOnly ? 'Chi tiết nguyên liệu theo mốc giá · Chỉ xem.' : 'Quản lý định lượng BOM theo mốc giá và phạm vi khách hàng.'}
      maxWidth="max-w-4xl"
      footer={(requestClose) => (
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            Tổng cộng: <strong className="font-mono text-slate-900">{visibleBomLines.length}</strong> nguyên liệu ở tier {selectedPriceTier.toLocaleString('vi-VN')} ₫
          </div>
          <Button variant="outline" size="sm" onClick={requestClose} disabled={isSubmitting}>
            Đóng
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {isLoadingTiers && <p role="status">Đang tải mốc giá BOM…</p>}
        {tierError && <InlineBanner variant="error" actionLabel="Tải lại mốc giá" onAction={() => void retryTiers()}>{tierError.message}</InlineBanner>}
        {feedback && (
          <InlineBanner
            variant={feedback.type}
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </InlineBanner>
        )}

        {reloadNeeded && <Button variant="outline" size="sm" disabled={isSubmitting} onClick={() => void reloadLines().then(loaded => { if (loaded) clearForm(); })}>Tải lại dữ liệu BOM</Button>}
        {/* 3 Price Tiers & Scope Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Mốc giá suất ăn chuẩn:</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Mốc giá BOM">
              {tiers.map((tier) => {
                const isSelected = selectedPriceTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={isSubmitting || Boolean(editingLine) || grossQty !== ''}
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

          {!readOnly && <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Phạm vi áp dụng:</span>
            <Select
              aria-label="Phạm vi áp dụng BOM"
              value={scopeCustomer}
              disabled={isSubmitting || Boolean(editingLine)}
              onChange={(e) => setScopeCustomer(e.target.value)}
              options={[
                { value: 'GLOBAL', label: 'Dùng chung toàn hệ thống' },
                ...customers.map((c) => ({ value: c.customerId, label: `Khách: ${c.customerCode} - ${c.customerName}` })),
              ]}
              className="h-7 text-xs font-medium w-56"
            />
          </div>}
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
              {readOnly ? 'Chưa có nguyên liệu nào ở mốc giá này.' : 'Chưa có nguyên liệu nào ở mốc giá này. Sử dụng form bên dưới để thêm nguyên liệu vào định mức.'}
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
                    {!readOnly && <th className="py-2 px-2 text-center w-32" aria-label="Thao tác" />}
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
                        {line.unitName || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        <Num value={line.grossQtyPerServing} format="quantity" decimals={6} />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant={line.customerId ? 'info' : 'neutral'} size="sm">
                          {line.customerCode ? `Khách: ${line.customerCode}` : 'Dùng chung'}
                        </Badge>
                      </td>
                      {!readOnly && <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="sm" aria-label={`Chỉnh sửa ${line.ingredientName}`}
                          disabled={isSubmitting || reloadNeeded || Boolean(editingLine) || grossQty !== ''}
                          onClick={() => {
                            setEditingLine(line);
                            setSelectedIngredientId(line.ingredientId);
                            setGrossQty(String(line.grossQtyPerServing));
                            setScopeCustomer(line.customerId || 'GLOBAL');
                            setFeedback(null);
                          }}>Chỉnh sửa</Button>
                        <button
                          type="button"
                          aria-label={`Xóa ${line.ingredientName} khỏi BOM`}
                          onClick={() => void handleDeleteLine(line.bomId)}
                          disabled={isSubmitting || reloadNeeded || Boolean(editingLine) || grossQty !== ''}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form add new ingredient into BOM using SearchableCombobox */}
        {!readOnly && <form onSubmit={handleAddLine} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
          <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Plus size={14} className="text-slate-600" aria-hidden="true" />
              <span>{editingLine ? `Chỉnh sửa ${editingLine.ingredientName}` : `Thêm nguyên liệu vào mốc giá ${selectedPriceTier.toLocaleString('vi-VN')} ₫`}</span>
            </span>
            <span className="text-slate-500 font-normal">
              Áp dụng: <strong className="font-semibold">{scopeCustomer === 'GLOBAL' ? 'Dùng chung' : `Khách ${customers.find((c) => c.customerId === scopeCustomer)?.customerCode || ''}`}</strong>
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-7">
              {editingLine ? <p className="block text-xs font-medium text-slate-700 mb-1">Nguyên liệu (giữ nguyên)</p> : <label htmlFor={ingSelectId} className="block text-xs font-medium text-slate-700 mb-1">
                Tìm & chọn nguyên liệu (Gõ mã hoặc tên)
              </label>}
              {editingLine ? <p className="text-sm py-2">{editingLine.ingredientCode} · {editingLine.ingredientName} · {editingLine.unitName || '—'}</p> : <SearchableCombobox
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
              />}
            </div>

            <div className="col-span-3">
              <label htmlFor={qtyInputId} className="block text-xs font-medium text-slate-700 mb-1">
                Định mức / suất
              </label>
              <Input
                id={qtyInputId}
                aria-label="Định mức / suất"
                type="number"
                step="0.000001"
                min="0.000001"
                disabled={isSubmitting || reloadNeeded}
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
                disabled={!hasUsableTier || isSubmitting || reloadNeeded || !selectedIngredientId || !grossQty || (Boolean(editingLine) && (!effectiveFrom || Boolean(dateError) || !reason.trim()))}
                className="w-full h-8 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                {isSubmitting ? 'Đang lưu…' : editingLine ? 'Lưu thay đổi BOM' : 'Thêm vào BOM'}
              </Button>
            </div>
          </div>
          {editingLine && <div className="flex flex-wrap items-start gap-4">
            <div className="space-y-1">
              <label htmlFor={`${qtyInputId}-date`} className="block text-xs font-medium">Ngày hiệu lực mới</label>
              <VietnameseDateInput id={`${qtyInputId}-date`} aria-label="Ngày hiệu lực BOM" value={effectiveFrom}
                onChange={setEffectiveFrom} required disabled={isSubmitting}
                isDateAllowed={date => editingLine.bomStatus !== 'PUBLISHED' || date > editingLine.effectiveFrom}
                validationMessage="Ngày hiệu lực mới phải sau ngày bắt đầu của dòng BOM đã phát hành."
                onValidationChange={setDateError} />
              <p className="text-xs text-slate-500">Dòng hiện tại bắt đầu {toVietnameseDate(editingLine.effectiveFrom)}. Giữ nguyên lịch sử phiên bản.</p>
            </div>
            <div className="flex-1 min-w-48 space-y-1">
              <label htmlFor={`${qtyInputId}-reason`} className="block text-xs font-medium">Lý do chỉnh sửa</label>
              <Input id={`${qtyInputId}-reason`} aria-label="Lý do chỉnh sửa BOM" required maxLength={500}
                disabled={isSubmitting} value={reason} onChange={event => setReason(event.target.value)} />
            </div>
          </div>}
        </form>}
      </div>
    </Modal>
  );
}
