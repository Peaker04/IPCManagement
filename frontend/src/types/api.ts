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
export interface UserInfo {
  userId: string;
  fullName: string;
  username: string;
  roleCode?: string;
  roleName: string;
  isActive: boolean;
  isAdminFullAccess?: boolean;
  permissions?: string[];
}

/**
 * Payload trả về khi login / refresh thành công.
 * Khớp với LoginResponseDto ở backend.
 */
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

/**
 * Body gửi lên khi đăng nhập.
 * Khớp với LoginRequestDto ở backend.
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Body gửi lên khi refresh token.
 * Khớp với RefreshTokenRequestDto ở backend.
 */
export interface RefreshTokenRequest {
  accessToken: string;
  refreshToken?: string;
}

/**
 * Body gửi lên khi revoke (logout).
 * Khớp với RevokeTokenRequestDto ở backend.
 */
export interface RevokeTokenRequest {
  refreshToken?: string;
}
