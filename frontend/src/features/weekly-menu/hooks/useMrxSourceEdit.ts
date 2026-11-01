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

  const load = useCallback(async () => {
    if (scope.enabled === false || !scope.customerId || !scope.weekStartDate) return;
    setIsLoading(true);
    try {
      const [nextScope, dishes] = await Promise.all([
        mrxApi.getEditScope(scope.customerId, scope.weekStartDate),
        adminApi.getDishes({ pageSize: 1000 }),
      ]);
      setEditScope(nextScope);
      setDraft(createDraft(nextScope));
      setDishOptions(dishes.items.filter((dish) => dish.isActive));
      setPreviewResult(null);
      setError(null);
      setLockedHighlight([]);
    } catch (cause) {
      const translated = toMrxErrorMessage(cause);
      setError(new Error(translated.message));
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

  const run = useCallback(async (operation: () => Promise<MrxMenuChangeResult>) => {
    setIsSubmitting(true);
    setError(null);
    setLockedHighlight([]);
    try {
      return await operation();
    } catch (cause) {
      const translated = toMrxErrorMessage(cause);
      setError(new Error(translated.message));
      setLockedHighlight(translated.lockedDates);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const preview = useCallback(async () => {
    if (changedLines.length === 0) return;
    const result = await run(() => mrxApi.previewSourceChange(request('Xem trước thay đổi nguồn')));
    if (result) setPreviewResult(result);
  }, [changedLines.length, request, run]);

  const apply = useCallback(async (reason: string): Promise<boolean> => {
    if (!reason.trim() || changedLines.length === 0) return false;
    const result = await run(() => mrxApi.applySourceChange(request(reason)));
    if (!result) return false;
    await load();
    return true;
  }, [changedLines.length, load, request, run]);

  const submit = useCallback(async (reason: string): Promise<boolean> => {
    if (!reason.trim() || changedLines.length === 0) return false;
    const result = await run(() => mrxApi.submitSourceChange(request(reason)));
    if (!result) return false;
    await load();
    return true;
  }, [changedLines.length, load, request, run]);

  const reset = useCallback(() => {
    if (editScope) setDraft(createDraft(editScope));
    setPreviewResult(null);
    setError(null);
    setLockedHighlight([]);
  }, [editScope]);

  return { editScope, draft, dishOptions, setServings, setDish, changedLines, preview, previewResult, apply, submit, error, isLoading, isSubmitting, reset, lockedHighlight, reload: load };
}
