import type { components } from '@/shared/api/contracts/schema';

/**
 * Chuẩn hóa response format cho tất cả API endpoints.
 * Khớp với ApiResponse<T> ở backend (IPCManagement.Api.Helpers.ApiResponse).
 */
export interface ApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

/**
 * Thông tin user trả về sau login / profile.
 * Khớp với UserInfoDto ở backend.
 */
export type UserInfo = components['schemas']['UserInfoDto'];

/**
 * Payload trả về khi login / refresh thành công.
 * Khớp với LoginResponseDto ở backend.
 */
export type LoginData = components['schemas']['LoginResponseDto'];

/**
 * Body gửi lên khi đăng nhập.
 * Khớp với LoginRequest ở backend.
 */
export type LoginRequest = components['schemas']['LoginRequest'];

/**
 * Body gửi lên khi refresh token.
 * Khớp với RefreshTokenRequest ở backend.
 */
export type RefreshTokenRequest = components['schemas']['RefreshTokenRequest'];

/**
 * Body gửi lên khi revoke (logout).
 * Khớp với RevokeTokenRequest ở backend.
 */
export type RevokeTokenRequest = components['schemas']['RevokeTokenRequest'];
