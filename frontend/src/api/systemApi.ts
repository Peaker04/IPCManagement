import { apiClient } from './client';
import type { OperationalMode } from '../types';

export interface SystemOperationCapabilitiesDto {
  navigation: string[];
  pageTabs: Record<string, string[]>;
}

export interface SystemOperationModeDto {
  mode: OperationalMode;
  label: string;
  version: number;
  updatedAt: string;
  reasonRequired: boolean;
  capabilities: SystemOperationCapabilitiesDto;
}

export const systemApi = {
  async getOperationalMode(): Promise<SystemOperationModeDto> {
    return apiClient<SystemOperationModeDto>('/system-operation-mode');
  },

  async setOperationalMode(
    mode: OperationalMode,
    expectedVersion: number,
    reason?: string
  ): Promise<SystemOperationModeDto> {
    return apiClient<SystemOperationModeDto>('/system-operation-mode', {
      method: 'PUT',
      body: JSON.stringify({
        mode,
        expectedVersion,
        confirmed: true,
        reason,
      }),
    });
  },
};
