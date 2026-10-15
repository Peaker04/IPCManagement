import { apiClient } from './client';
import type { OperationalMode } from '../types';

export const systemApi = {
  async getOperationalMode(): Promise<{ mode: OperationalMode }> {
    try {
      return await apiClient<{ mode: OperationalMode }>('/systemoperationmode');
    } catch {
      const local = (localStorage.getItem('ipc_v3_mode') as OperationalMode) || 'DEFAULT';
      return { mode: local };
    }
  },

  async setOperationalMode(mode: OperationalMode): Promise<void> {
    localStorage.setItem('ipc_v3_mode', mode);
    try {
      await apiClient('/systemoperationmode', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
    } catch {
      // Offline fallback
    }
  },
};
