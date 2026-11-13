import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, type DishItem } from '../../../api/adminApi';
import { mrxApi, type MrxEditScope, type MrxMenuChangeLine, type MrxMenuChangeRequest, type MrxMenuChangeResult } from '../../../api/mrxApi';
import { toMrxErrorMessage } from '../../../api/mrxErrors';
import { getCachedArray, serverStateCache } from '../../../store/serverStateCache';

const DISH_CATALOG_CACHE_KEY = 'mrx_catalog_dishes';

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

export function useMrxSourceEdit(scope: { customerId: string; weekStartDate: string; enabled?: boolean; isParentTransitioning?: boolean; sourceVersionKey?: string }) {
  const scopeKey = `${scope.customerId}:${scope.weekStartDate}:${scope.sourceVersionKey ?? ''}`;
  const editScopeCacheKey = `mrx_edit_scope_${scope.customerId}_${scope.weekStartDate}_${scope.sourceVersionKey ?? ''}`;
  const cachedScopeEntry = scope.enabled !== false && scope.customerId && scope.weekStartDate
    ? serverStateCache.get<MrxEditScope>(editScopeCacheKey)
    : null;
  const initialCachedScope = cachedScopeEntry && !cachedScopeEntry.isStale ? cachedScopeEntry.data : null;
  const initialCachedDishes = getCachedArray<DishItem>(DISH_CATALOG_CACHE_KEY) ?? [];
  const [loadedScopeKey, setLoadedScopeKey] = useState(() => (initialCachedScope ? scopeKey : ''));
  const [rawEditScope, setEditScope] = useState<MrxEditScope | null>(() => initialCachedScope);
  const [draft, setDraft] = useState<MrxSourceDraft>(() => (initialCachedScope ? createDraft(initialCachedScope) : {}));
  const [dishOptions, setDishOptions] = useState<DishItem[]>(() => initialCachedDishes.filter((dish) => dish.isActive));
  const [previewResult, setPreviewResult] = useState<MrxMenuChangeResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lockedHighlight, setLockedHighlight] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  if (!scope.isParentTransitioning && initialCachedScope && loadedScopeKey !== scopeKey) {
    setEditScope(initialCachedScope);
    setLoadedScopeKey(scopeKey);
    setDraft(createDraft(initialCachedScope));
    if (initialCachedDishes.length > 0) {
      setDishOptions(initialCachedDishes.filter((dish) => dish.isActive));
    }
    setPreviewResult(null);
    setError(null);
    setLockedHighlight([]);
    setReloadRequired(false);
  }
  const isTransitioningScope = Boolean(
    scope.enabled !== false && scope.customerId && scope.weekStartDate && rawEditScope && (loadedScopeKey !== scopeKey || scope.isParentTransitioning) && !error
  );
  const editScope = scope.enabled !== false && (loadedScopeKey === scopeKey || isTransitioningScope) ? rawEditScope : null;

  const loadRequestId = useRef(0);
  const verifiedScopeKey = useRef('');
  const load = useCallback(async (knownDishes: DishItem[] = []) => {
    if (scope.enabled === false || scope.isParentTransitioning || !scope.customerId || !scope.weekStartDate) return false;
    const requestId = ++loadRequestId.current;
    verifiedScopeKey.current = '';
    setIsLoading(true);
    try {
      const editScopeCacheKey = `mrx_edit_scope_${scope.customerId}_${scope.weekStartDate}_${scope.sourceVersionKey ?? ''}`;
      // Cache serves the first paint; another actor may have added dishes since it was filled.
      const loadDishes = async (): Promise<DishItem[]> => {
        const dishes = await adminApi.getDishes({ pageSize: 100 });
        const allDishes = [...dishes.items];
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, dishes.totalPages - 1) }, (_, index) =>
            adminApi.getDishes({ pageNumber: index + 2, pageSize: 100 })
          )
        );
        allDishes.push(...remainingPages.flatMap((page) => page.items));
        serverStateCache.set(DISH_CATALOG_CACHE_KEY, allDishes);
        return allDishes;
      };
      // Cached source can predate a batch created by another actor; it is display data, not command authority.
      const loadEditScope = async (): Promise<MrxEditScope> => {
        const fetched = await mrxApi.getEditScope(scope.customerId, scope.weekStartDate);
        serverStateCache.set(editScopeCacheKey, fetched);
        return fetched;
      };
      const [nextScope, available] = await Promise.all([
        loadEditScope(),
        loadDishes(),
      ]);
      const referenced = new Set(nextScope.days.flatMap((day) => day.shifts.flatMap((shift) => shift.slots.map((slot) => slot.dishId))).filter((id): id is string => Boolean(id)));
      for (const dishId of referenced) {
        if (!available.some((dish) => dish.dishId === dishId)) {
          const known = knownDishes.find((dish) => dish.dishId === dishId);
          available.push(known ?? await adminApi.getDish(dishId));
        }
      }
      if (requestId !== loadRequestId.current) return false;
      verifiedScopeKey.current = scopeKey;
      setEditScope(nextScope);
      setLoadedScopeKey(scopeKey);
      setDraft(createDraft(nextScope));
      setDishOptions(available.filter((dish) => dish.isActive));
      setPreviewResult(null);
      setError(null);
      setLockedHighlight([]);
      setReloadRequired(false);
      return true;
    } catch (cause) {
      if (requestId !== loadRequestId.current) return false;
      const translated = toMrxErrorMessage(cause);
      setError(new Error(translated.message));
      return false;
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
  }, [scope.customerId, scope.enabled, scope.isParentTransitioning, scope.sourceVersionKey, scope.weekStartDate, scopeKey]);

  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) void load();
    });
    return () => {
      ignore = true;
      loadRequestId.current += 1;
    };
  }, [load, scope.sourceVersionKey]);

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
    if (isSubmitting || reloadRequired || isLoading || isTransitioningScope || verifiedScopeKey.current !== scopeKey) return null;
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
  }, [dishOptions, isSubmitting, isLoading, isTransitioningScope, load, reloadRequired, scopeKey]);

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

  const reload = useCallback(() => {
    serverStateCache.delete(DISH_CATALOG_CACHE_KEY);
    serverStateCache.deletePrefix('mrx_edit_scope_');
    return load();
  }, [load]);

  return { missingServingsCount: missingServings.length, firstMissingServing: missingServings[0] ?? null, editScope, isTransitioningScope, draft, dishOptions, setServings, setDish, changedLines, preview, previewResult, apply, submit, error, isLoading, isSubmitting, reloadRequired, reset, lockedHighlight, reload };
}
