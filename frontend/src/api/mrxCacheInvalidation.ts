import { serverStateCache } from '../store/serverStateCache';

export function invalidateMrxCaches(): void {
  serverStateCache.deletePrefix('mrx_');
  serverStateCache.deletePrefix('snapshot:mrx_');
}
