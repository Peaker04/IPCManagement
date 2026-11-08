import type { AppDispatch, RootState } from '@/app/store';
import { authApi } from '@/features/auth/authApi';
import { logOut } from '@/lib/auth/authSlice';

const isDevFallbackToken = (token: string) =>
  !import.meta.env.PROD &&
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true' &&
  token.startsWith('dev-login-fallback-token-');

let logoutPromise: Promise<void> | null = null;

export const logoutSession = (dispatch: AppDispatch, getState: () => RootState) => {
  if (logoutPromise) return logoutPromise;

  logoutPromise = (async () => {
    const token = getState().auth.token;

    if (token && !isDevFallbackToken(token)) {
      try {
        await dispatch(authApi.endpoints.logout.initiate()).unwrap();
      } catch {
        // Best-effort revoke. Local cleanup still needs to happen.
      }
    }

    dispatch(logOut());
  })().finally(() => {
    logoutPromise = null;
  });

  return logoutPromise;
};
