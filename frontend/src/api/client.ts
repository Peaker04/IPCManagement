import { clearSessionState } from '../store/clearSessionState';
import type { ApiResponse, LoginResponse } from '../types';

export class ApiError extends Error {
  status: number;
  errors?: string[];
  code?: string;
  lockedDates: string[];

  constructor(status: number, message: string, errors?: string[], code?: string, lockedDates: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.code = code;
    this.lockedDates = lockedDates;
  }
}

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5262/api';
}

const currentToken = () => typeof localStorage === 'undefined' ? null : localStorage.getItem('ipc_v3_token');
let renewal: { previous: string; current: string } | null = null;
let refreshFlight: { token: string; promise: Promise<string> } | null = null;

function sessionChanged(): ApiError {
  return new ApiError(401, 'Phiên đăng nhập đã thay đổi. Vui lòng tải lại dữ liệu.', undefined, 'SESSION_CHANGED');
}

function requireSameSession(token: string | null): void {
  const current = currentToken();
  if (current !== token && !(token && renewal?.previous === token && renewal.current === current)) throw sessionChanged();
}

function expireSession(token: string | null): void {
  if (currentToken() !== token) throw sessionChanged();
  if (typeof localStorage !== 'undefined') clearSessionState('expired');
  renewal = null;
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) window.location.href = '/login';
}

function refreshAccessToken(token: string): Promise<string> {
  if (refreshFlight?.token === token) return refreshFlight.promise;
  const promise = (async () => {
    const response = await fetch(`${resolveBaseUrl()}/auth/refresh`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token }),
    });
    if (currentToken() !== token) throw sessionChanged();
    if (!response.ok) throw new ApiError(response.status, 'Không thể gia hạn phiên đăng nhập. Vui lòng thử lại.');
    const envelope = await response.json() as ApiResponse<LoginResponse>;
    if (currentToken() !== token) throw sessionChanged();
    const result = envelope.data;
    if (!envelope.success || !result?.accessToken || !result.user?.userId) {
      throw new ApiError(502, 'Phản hồi gia hạn phiên không hợp lệ.');
    }
    const previousUser = JSON.parse(localStorage.getItem('ipc_v3_user') || '{}');
    if (previousUser.userId && previousUser.userId !== result.user.userId) throw sessionChanged();
    localStorage.setItem('ipc_v3_token', result.accessToken);
    localStorage.setItem('ipc_v3_user', JSON.stringify(result.user));
    renewal = { previous: token, current: result.accessToken };
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('ipc:session-refreshed'));
    return result.accessToken;
  })().finally(() => {
    if (refreshFlight?.promise === promise) refreshFlight = null;
  });
  refreshFlight = { token, promise };
  return promise;
}

/** Shared JSON/download transport; only an explicit auth rejection permits one replay. */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const target = new URL(url, resolveBaseUrl());
  if (target.origin !== new URL(resolveBaseUrl()).origin) throw new ApiError(400, 'Địa chỉ API không thuộc hệ thống.');
  let token = currentToken();
  const headers = Object.fromEntries([...new Headers(options.headers)].map(([name, value]) => [
    name === 'authorization' ? 'Authorization' : name === 'content-type' ? 'Content-Type' : name, value,
  ]));
  delete headers['x-operational-mode'];
  headers['X-Operational-Mode'] = (typeof localStorage === 'undefined' ? null : localStorage.getItem('ipc_v3_mode')) || 'DEFAULT';
  if (token) headers.Authorization = `Bearer ${token}`;
  const isAuthRequest = /\/api\/auth\/(login|refresh|logout|revoke)\/?$/i.test(target.pathname);
  const requestOptions: RequestInit = isAuthRequest
    ? { ...options, credentials: options.credentials ?? 'same-origin', headers }
    : { ...options, headers };
  const send = () => fetch(target.toString(), requestOptions);
  let response = await send();
  requireSameSession(token);
  if (response.status === 401 && token && !isAuthRequest) {
    // Another request may already have rotated this same session while this one was in flight.
    const latest = currentToken();
    if (latest !== token) {
      token = latest;
    } else {
      try {
        token = await refreshAccessToken(token);
      } catch (cause) {
        if (cause instanceof ApiError && cause.code !== 'SESSION_CHANGED' && (cause.status === 400 || cause.status === 401)) expireSession(token);
        throw cause;
      }
    }
    if (options.body instanceof ReadableStream) throw new ApiError(401, 'Phiên đã gia hạn. Vui lòng gửi lại yêu cầu tải dữ liệu.');
    headers.Authorization = `Bearer ${token}`;
    response = await send();
    requireSameSession(token);
  }
  if (response.status === 401 && !isAuthRequest) {
    expireSession(token);
    throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
  }
  return response;
}

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = currentToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const url = endpoint.startsWith('http') ? endpoint : `${resolveBaseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const response = await authenticatedFetch(url, { ...options, headers });
  let data: unknown;
  try { data = await response.json(); } catch { data = null; }
  requireSameSession(token);
  if (!response.ok) {
    const apiResp = data as ApiResponse | null;
    throw new ApiError(response.status, apiResp?.message || response.statusText || 'Yêu cầu không thành công', apiResp?.errors, apiResp?.code, apiResp?.lockedDates);
  }
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) return (data as ApiResponse<T>).data;
  return data as T;
}
