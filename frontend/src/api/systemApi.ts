import { apiClient } from './client';
import type { OperationalMode } from '../types';

export interface SystemOperationModeDto {
  mode: OperationalMode;
  version: number;
  reason?: string;
  updatedAt?: string;
}

export const systemApi = {
  async getOperationalMode(): Promise<SystemOperationModeDto> {
    return apiClient<SystemOperationModeDto>('/system-operation-mode');
  },

  async setOperationalMode(
    mode: OperationalMode,
    expectedVersion = 1,
    reason?: string
  ): Promise<SystemOperationModeDto> {
    localStorage.setItem('ipc_v3_mode', mode);
    return apiClient<SystemOperationModeDto>('/system-operation-mode', {
      method: 'PUT',
      body: JSON.stringify({
        mode,
        expectedVersion,
        confirmed: true,
        reason: reason || 'Chuyển đổi chế độ vận hành từ giao diện người dùng',
      }),
    });
  },
};
