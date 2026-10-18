import { describe, it, expect, beforeEach } from 'vitest';
import { queryClient } from '../lib/scopedQuery';

describe('ScopedQuery Engine (Unit & Invariant Tests)', () => {
  beforeEach(() => {
    queryClient.clearAll();
  });

  it('normalizes query key with mode, role, and scope partitions (DOM-MODE-1)', () => {
    const key1 = queryClient.normalizeKey(['ingredients', 1], 'DEFAULT', 'Admin', 'KHO-1');
    const key2 = queryClient.normalizeKey(['ingredients', 1], 'MATERIAL_RECONCILIATION', 'Admin', 'KHO-1');

    expect(key1).toBe('DEFAULT#Admin#KHO-1#ingredients::1');
    expect(key2).toBe('MATERIAL_RECONCILIATION#Admin#KHO-1#ingredients::1');
    expect(key1).not.toBe(key2);
  });

  it('stores and retrieves cached entries with timestamp', () => {
    const key = queryClient.normalizeKey(['dashboard'], 'DEFAULT');
    queryClient.set(key, { kpi: 100 }, 'DEFAULT');

    const entry = queryClient.get<{ kpi: number }>(key);
    expect(entry).toBeDefined();
    expect(entry?.data.kpi).toBe(100);
    expect(entry?.mode).toBe('DEFAULT');
  });

  it('flushes only specified mode entries on mode transition (DOM-MODE-1)', () => {
    const keyDef = queryClient.normalizeKey(['orders'], 'DEFAULT');
    const keyMrx = queryClient.normalizeKey(['batches'], 'MATERIAL_RECONCILIATION');

    queryClient.set(keyDef, { count: 5 }, 'DEFAULT');
    queryClient.set(keyMrx, { count: 2 }, 'MATERIAL_RECONCILIATION');

    // Flush DEFAULT mode
    queryClient.flushMode('DEFAULT');

    expect(queryClient.get(keyDef)).toBeUndefined();
    expect(queryClient.get(keyMrx)).toBeDefined();
    expect(queryClient.get(keyMrx)?.data).toEqual({ count: 2 });
  });

  it('invalidates matching queries by pattern', () => {
    const key1 = queryClient.normalizeKey(['suppliers', 'active'], 'DEFAULT');
    const key2 = queryClient.normalizeKey(['suppliers', 'all'], 'DEFAULT');
    const key3 = queryClient.normalizeKey(['dishes'], 'DEFAULT');

    queryClient.set(key1, [1, 2], 'DEFAULT');
    queryClient.set(key2, [1, 2, 3], 'DEFAULT');
    queryClient.set(key3, ['dish-1'], 'DEFAULT');

    queryClient.invalidateQueries(['suppliers']);

    expect(queryClient.get(key1)).toBeUndefined();
    expect(queryClient.get(key2)).toBeUndefined();
    expect(queryClient.get(key3)).toBeDefined();
  });

  it('deduplicates concurrent in-flight requests', async () => {
    const key = queryClient.normalizeKey(['dedup-test'], 'DEFAULT');
    let callCount = 0;

    const mockFetch = () => {
      callCount++;
      return new Promise<string>((resolve) => setTimeout(() => resolve('done'), 50));
    };

    const p1 = queryClient.getInFlight(key) ?? mockFetch();
    queryClient.setInFlight(key, p1);

    const p2 = queryClient.getInFlight(key) ?? mockFetch();

    const [res1, res2] = await Promise.all([p1, p2]);
    queryClient.clearInFlight(key);

    expect(res1).toBe('done');
    expect(res2).toBe('done');
    expect(callCount).toBe(1); // Deduped! Only 1 actual invocation
  });
});
