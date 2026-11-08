import { clearAllWorkspaceState } from './workspaceUiState';
import { workspaceSessionStore } from './workspaceSessionStore';
import { clearAllClientDrafts } from '../hooks/useClientDraftPersistence';
import { clearAllServerCache } from './serverStateCache';
import { clearAllOfflineQueue } from './offlineMutationQueue';
import { idempotencyManager } from '../utils/idempotencyKey';
import { queryClient } from '../lib/scopedQuery';

export function clearSessionState(reason: 'expired' | 'logout' = 'logout'): void {
  const hadSession = Boolean(localStorage.getItem('ipc_v3_token') || localStorage.getItem('ipc_v3_user'));
  let preserveMrxUserId: string | undefined;
  if (reason === 'expired' && localStorage.getItem('ipc_v3_mode') === 'MATERIAL_RECONCILIATION') {
    try {
      const user = JSON.parse(localStorage.getItem('ipc_v3_user') ?? 'null');
      if (typeof user?.userId === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(user.userId)) {
        preserveMrxUserId = user.userId;
      }
    } catch { /* Unknown identity cannot retain scoped work. */ }
  }
  localStorage.removeItem('ipc_v3_token');
  localStorage.removeItem('ipc_v3_user');
  localStorage.removeItem('ipc_v3_mode_version');
  clearAllWorkspaceState();
  workspaceSessionStore.clearScope();
  // Anonymous follow-up 401s must not erase work retained by the first expiry.
  if (reason === 'logout' || hadSession) clearAllClientDrafts(preserveMrxUserId);
  clearAllServerCache();
  clearAllOfflineQueue();
  idempotencyManager.clearAll();
  queryClient.clearAll();
}
