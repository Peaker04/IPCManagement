export {
  default as authReducer,
  setAuthLoading,
  setCredentials,
  logOut,
  selectAuthToken,
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsAuthLoading,
} from '@/lib/auth/authSlice';
export { authApi, useLoginMutation, useGetCurrentUserQuery } from './authApi';
export { normalizeUserRole, ROLE_LABELS, canAccessRole } from '@/lib/auth/roleUtils';
export type { AppRole } from '@/lib/auth/roleUtils';
export type { AuthState, User } from '@/lib/auth/authTypes';
