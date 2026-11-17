import { serverStateCache } from '../store/serverStateCache';

const refreshEvent = 'ipc:mrx-data-changed';
let cacheRevision = 0;

export function getMrxCacheRevision(): number {
  return cacheRevision;
}

export function subscribeMrxReads(refresh: () => void): () => void {
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
  window.addEventListener(refreshEvent, refresh);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener(refreshEvent, refresh);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function invalidateMrxCaches(): void {
  cacheRevision += 1;
  serverStateCache.deletePrefix('mrx_');
  serverStateCache.deletePrefix('snapshot:mrx_');
  serverStateCache.deletePrefix('snapshot:reconciliation');
  serverStateCache.deletePrefix('operational-approvals:MATERIAL_RECONCILIATION:');
  serverStateCache.deletePrefix('snapshot:operational-approvals:MATERIAL_RECONCILIATION:');
}

export function notifyMrxWriteAcknowledged(): void {
  invalidateMrxCaches();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(refreshEvent));
}
