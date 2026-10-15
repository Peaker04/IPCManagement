import { apiClient } from './client';
import type { LoginResponse, UserInfo } from '../types';

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    return apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout(): Promise<void> {
    try {
      await apiClient('/auth/revoke', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('ipc_v3_token');
      localStorage.removeItem('ipc_v3_user');
    }
  },

  async getProfile(): Promise<UserInfo> {
    return apiClient<UserInfo>('/auth/profile');
  },
};
