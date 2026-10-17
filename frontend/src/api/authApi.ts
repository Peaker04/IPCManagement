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
    await apiClient('/auth/revoke', { method: 'POST' });
  },

  async getProfile(): Promise<UserInfo> {
    return apiClient<UserInfo>('/auth/profile');
  },
};
