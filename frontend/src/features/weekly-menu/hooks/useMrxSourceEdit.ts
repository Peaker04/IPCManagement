import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type DishItem } from '../../../api/adminApi';
import { mrxApi, type MrxEditScope, type MrxMenuChangeLine, type MrxMenuChangeRequest, type MrxMenuChangeResult } from '../../../api/mrxApi';
import { toMrxErrorMessage } from '../../../api/mrxErrors';

export interface MrxShiftDraft {
  savoryServings: number | null;
  vegetarianServings: number | null;
  dishes: Record<string, string>;
}
export type MrxSourceDraft = Record<string, Record<string, MrxShiftDraft>>;

type Variant = 'savory' | 'vegetarian';

function createDraft(scope: MrxEditScope): MrxSourceDraft {
  return Object.fromEntries(scope.days.map((day) => [day.serviceDate, Object.fromEntries(day.shifts.map((shift) => [shift.shiftName, {
    savoryServings: shift.savoryServings ?? null,
    vegetarianServings: shift.vegetarianServings ?? null,
    dishes: Object.fromEntries(shift.slots.map((slot) => [slot.dishSlot, slot.dishId ?? ''])),
  }]))]));
}

export function useMrxSourceEdit(scope: { customerId: string; weekStartDate: string; enabled?: boolean }) {
  const [editScope, setEditScope] = useState<MrxEditScope | null>(null);
  const [draft, setDraft] = useState<MrxSourceDraft>({});
  const [dishOptions, setDishOptions] = useState<DishItem[]>([]);
  const [previewResult, setPreviewResult] = useState<MrxMenuChangeResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lockedHighlight, setLockedHighlight] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);

  const load = useCallback(async (knownDishes: DishItem[] = []) => {
    if (scope.enabled === false || !scope.customerId || !scope.weekStartDate) return false;
    setIsLoading(true);
    try {
      const [nextScope, dishes] = await Promise.all([
        mrxApi.getEditScope(scope.customerId, scope.weekStartDate),
        adminApi.getDishes({ pageSize: 100 }),
      ]);
      const available = [...dishes.items];
      const remainingPages = await Promise.all(Array.from({ length: Math.max(0, dishes.totalPages - 1) }, (_, index) => adminApi.getDishes({ pageNumber: index + 2, pageSize: 100 })));
      available.push(...remainingPages.flatMap((page) => page.items));
      const referenced = new Set(nextScope.days.flatMap((day) => day.shifts.flatMap((shift) => shift.slots.map((slot) => slot.dishId))).filter((id): id is string => Boolean(id)));
      for (const dishId of referenced) {
        if (!available.some((dish) => dish.dishId === dishId)) {
          const known = knownDishes.find((dish) => dish.dishId === dishId);
          available.push(known ?? await adminApi.getDish(dishId));
        }
      }
      setEditScope(nextScope);
      setDraft(createDraft(nextScope));
      setDishOptions(available.filter((dish) => dish.isActive));
      setPreviewResult(null);
      setError(null);
      setLockedHighlight([]);
      setReloadRequired(false);
      return true;
    } catch (cause) {
      const translated = toMrxErrorMessage(cause);
      setError(new Error(translated.message));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [scope.customerId, scope.enabled, scope.weekStartDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const setServings = useCallback((date: string, shiftName: string, variant: Variant, value: number | null) => {
    if (editScope?.days.find((day) => day.serviceDate === date)?.isLocked) return;
    setDraft((current) => ({ ...current, [date]: { ...current[date], [shiftName]: {
      ...current[date]?.[shiftName],
      [`${variant}Servings`]: value,
    } } }));
    setPreviewResult(null);
  }, [editScope]);

  const setDish = useCallback((date: string, shiftName: string, dishSlot: string, dishId: string) => {
    if (editScope?.days.find((day) => day.serviceDate === date)?.isLocked) return;
    setDraft((current) => ({ ...current, [date]: { ...current[date], [shiftName]: {
      ...current[date]?.[shiftName],
      dishes: { ...current[date]?.[shiftName]?.dishes, [dishSlot]: dishId },
    } } }));
    setPreviewResult(null);
  }, [editScope]);

  const missingServings = useMemo(() => editScope?.days.flatMap(day => day.isLocked ? [] : day.shifts.flatMap(shift =>
    (['savory', 'vegetarian'] as const).filter(variant => draft[day.serviceDate]?.[shift.shiftName]?.[`${variant}Servings`] == null)
      .map(variant => ({ serviceDate: day.serviceDate, shiftName: shift.shiftName, variant })))) ?? [], [draft, editScope]);

  const changedLines = useMemo<MrxMenuChangeLine[]>(() => {
    if (!editScope) return [];
    const lines: MrxMenuChangeLine[] = [];
    for (const day of editScope.days) {
      if (day.isLocked) continue;
      for (const shift of day.shifts) {
        const next = draft[day.serviceDate]?.[shift.shiftName];
        if (!next) continue;
        const servingsChanged = next.savoryServings !== (shift.savoryServings ?? null)
          || next.vegetarianServings !== (shift.vegetarianServings ?? null);
        let servingsAttached = false;
        for (const slot of shift.slots) {
          const nextDishId = next.dishes[slot.dishSlot] || slot.dishId || '';
          const dishChanged = nextDishId !== (slot.dishId || '');
          if (!dishChanged && (!servingsChanged || servingsAttached)) continue;
          lines.push({
            serviceDate: day.serviceDate,
            shiftName: shift.shiftName,
            dishSlot: slot.dishSlot,
            newDishId: nextDishId,
            ...(servingsChanged && !servingsAttached ? {
              newSavoryServings: next.savoryServings,
              newVegetarianServings: next.vegetarianServings,
            } : {}),
          });
          if (servingsChanged) servingsAttached = true;
        }
      }
    }
    return lines;
  }, [draft, editScope]);

  const request = useCallback((reason: string): MrxMenuChangeRequest => ({
    customerId: scope.customerId,
    weekStartDate: scope.weekStartDate,
    expectedBaseMenuVersionId: editScope?.menuVersionId,
    expectedBatchVersion: editScope?.batchVersion,
    reason: reason.trim(),
    lines: changedLines,
  }), [changedLines, editScope, scope.customerId, scope.weekStartDate]);

  const run = useCallback(async (operation: () => Promise<MrxMenuChangeResult>, reloadAfterWrite = false) => {
    if (isSubmitting || reloadRequired) return null;
    setIsSubmitting(true);
    setError(null);
    setLockedHighlight([]);
    try {
      const result = await operation();
      if (reloadAfterWrite) {
        setReloadRequired(true);
        if (!await load(dishOptions)) throw new Error('Thay đổi đã được tiếp nhận; chưa tải lại được nguồn. Hãy tải lại, không gửi lại thay đổi.');
      }
      return result;
    } catch (cause) {
      const translated = toMrxErrorMessage(cause);
      setError(new Error(translated.message));
      setLockedHighlight(translated.lockedDates);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [dishOptions, isSubmitting, load, reloadRequired]);

  const preview = useCallback(async (): Promise<boolean> => {
    if (isSubmitting || changedLines.length === 0) return false;
    if (missingServings.length) { setError(new Error('Cần nhập đủ suất Mặn và Chay trước khi xem ảnh hưởng.')); return false; }
    const result = await run(() => mrxApi.previewSourceChange(request('Xem trước thay đổi nguồn')));
    if (result) setPreviewResult(result);
    return Boolean(result);
  }, [changedLines.length, isSubmitting, missingServings.length, request, run]);

  const apply = useCallback(async (reason: string): Promise<boolean> => {
    if (!reason.trim() || changedLines.length === 0) return false;
    const result = await run(() => mrxApi.applySourceChange(request(reason)), true);
    return Boolean(result);
  }, [changedLines.length, request, run]);

  const submit = useCallback(async (reason: string): Promise<boolean> => {
    if (!reason.trim() || changedLines.length === 0) return false;
    const result = await run(() => mrxApi.submitSourceChange(request(reason)), true);
    return Boolean(result);
  }, [changedLines.length, request, run]);

  const reset = useCallback(() => {
    if (editScope) setDraft(createDraft(editScope));
    setPreviewResult(null);
    setError(null);
    setLockedHighlight([]);
  }, [editScope]);

  return { missingServingsCount: missingServings.length, firstMissingServing: missingServings[0] ?? null, editScope, draft, dishOptions, setServings, setDish, changedLines, preview, previewResult, apply, submit, error, isLoading, isSubmitting, reloadRequired, reset, lockedHighlight, reload: load };
}
