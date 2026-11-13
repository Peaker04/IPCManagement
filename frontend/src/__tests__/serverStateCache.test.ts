import { afterEach, expect, it, vi } from 'vitest';

// Reload the module to exercise the same hydration boundary as a browser reload.
afterEach(async () => {
  const { serverStateCache } = await import('../store/serverStateCache');
  serverStateCache.clearAll();
  vi.resetModules();
});

it('does not revive invalidated MRX data or snapshots as fresh after reload', async () => {
  const { serverStateCache } = await import('../store/serverStateCache');
  serverStateCache.clearAll();
  serverStateCache.set('mrx_scope_a', 'old');
  serverStateCache.set('mrx_scope_b', 'untouched');
  serverStateCache.set('snapshot:mrx_scope_a', { data: 'old' });
  serverStateCache.invalidate('mrx_scope_a');
  serverStateCache.invalidate('snapshot:mrx_scope_a');
  expect(serverStateCache.get('mrx_scope_a')?.isStale).toBe(true);

  vi.resetModules();
  const { serverStateCache: reloaded } = await import('../store/serverStateCache');
  for (const key of ['mrx_scope_a', 'snapshot:mrx_scope_a']) {
    const entry = reloaded.get(key);
    expect(entry === null || entry.isStale).toBe(true);
  }
  expect(reloaded.get('mrx_scope_b')).toMatchObject({ data: 'untouched', isStale: false });
});
