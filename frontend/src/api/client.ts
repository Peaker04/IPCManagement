import type { ApiResponse } from '../types';

export class ApiError extends Error {
  status: number;
  errors?: string[];

  constructor(status: number, message: string, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5262/api';
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ipc_v3_token') : null;
  const mode = (typeof localStorage !== 'undefined' ? localStorage.getItem('ipc_v3_mode') : null) || 'DEFAULT';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Operational-Mode': mode,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = resolveBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ipc_v3_token');
      localStorage.removeItem('ipc_v3_user');
    }
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const apiResp = data as ApiResponse | null;
    const message = apiResp?.message || response.statusText || 'Yêu cầu không thành công';
    throw new ApiError(response.status, message, apiResp?.errors);
  }

  // Handle ApiResponse<T> wrapper from ASP.NET Core
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    const apiResp = data as ApiResponse<T>;
    return apiResp.data;
  }

  return data as T;
}
