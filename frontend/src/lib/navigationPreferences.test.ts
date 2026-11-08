import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultNavigationPreferences,
  pageTabGroups,
  readNavigationPreferences,
  readPageTabPreferences,
  readReconciliationSelection,
  resetNavigationPreferences,
  resolveVisibleTabId,
  visibleTabIds,
  writeAdminTabPreferences,
  writeNavigationPreferences,
  writePageTabPreferences,
  writeReconciliationSelection,
  clearReconciliationSelection,
} from './navigationPreferences';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } as unknown as Storage;
};

describe('navigation display preferences', () => {
  afterEach(() => vi.restoreAllMocks());

  it('defaults to every operational area visible', () => {
    expect(readNavigationPreferences(storage())).toEqual(defaultNavigationPreferences);
  });

  it('round-trips only known boolean settings', () => {
    const target = storage();
    writeNavigationPreferences({ ...defaultNavigationPreferences, reports: false }, target);
    expect(readNavigationPreferences(target).reports).toBe(false);
    target.setItem('ipc.navigation-preferences.v1', '{"reports":"false","unknown":false}');
    expect(readNavigationPreferences(target).reports).toBe(true);
  });

  it('does not crash when browser storage rejects preference writes or removals', () => {
    const blockedStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('blocked', 'QuotaExceededError'); },
      removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    } as unknown as Storage;

    expect(() => writeNavigationPreferences(defaultNavigationPreferences, blockedStorage)).not.toThrow();
    expect(() => writeAdminTabPreferences({ 'bom-import': true, contracts: true, cleanup: true, inventory: true, statistics: true, audit: true, employees: true }, blockedStorage)).not.toThrow();
    expect(() => writePageTabPreferences(readPageTabPreferences(storage()), blockedStorage)).not.toThrow();
    expect(() => writeReconciliationSelection({ batchId: 'batch-1' }, blockedStorage)).not.toThrow();
    expect(() => writeReconciliationSelection({}, blockedStorage)).not.toThrow();
    expect(() => clearReconciliationSelection(blockedStorage)).not.toThrow();
  });

  it('dispatches preference events only after a successful browser-local write', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    writeNavigationPreferences(defaultNavigationPreferences);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ipc:navigation-preferences-changed' }));

    dispatch.mockClear();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'QuotaExceededError'); });
    expect(() => writeNavigationPreferences(defaultNavigationPreferences)).not.toThrow();
    expect(dispatch).not.toHaveBeenCalled();

    setItem.mockRestore();
    dispatch.mockClear();
    writeNavigationPreferences(defaultNavigationPreferences, storage());
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it('does not crash when the browser localStorage getter is blocked', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError'); } });
    try {
      expect(() => writeNavigationPreferences(defaultNavigationPreferences)).not.toThrow();
      expect(() => resetNavigationPreferences()).not.toThrow();
      expect(() => writeReconciliationSelection({ batchId: 'batch-1' })).not.toThrow();
      expect(() => clearReconciliationSelection()).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
      else delete (window as unknown as { localStorage?: Storage }).localStorage;
    }
  });

  it('resolves a requested visible tab and falls back when the URL value is unavailable', () => {
    expect(resolveVisibleTabId('demand', ['movement', 'demand'], 'movement')).toBe('demand');
    expect(resolveVisibleTabId('exceptions', ['movement', 'demand'], 'movement')).toBe('movement');
    expect(resolveVisibleTabId(null, ['movement', 'demand'], 'movement')).toBe('movement');
  });

  it('round-trips and clears reconciliation-only selection separately from DEFAULT preferences', () => {
    const target = storage();
    writeReconciliationSelection({ batchId: 'batch-1', warehouseView: 'movement' }, target);
    expect(readReconciliationSelection(target)).toEqual({ batchId: 'batch-1', warehouseView: 'movement' });

    clearReconciliationSelection(target);
    expect(readReconciliationSelection(target)).toEqual({});
  });

  it('covers every shared ViewSwitcher group without allowing an empty group', () => {
    const target = storage();
    const preferences = readPageTabPreferences(target);
    expect(pageTabGroups).toHaveLength(7);
    for (const group of pageTabGroups) expect(visibleTabIds(group.id, preferences).length).toBe(group.tabs.length);

    preferences.reports.audit = false;
    writePageTabPreferences(preferences, target);
    expect(visibleTabIds('reports', readPageTabPreferences(target))).not.toContain('audit');
  });
});
