import type { AppDispatch, RootState } from '../../app/store';
import { authApi } from './authApi';
import { logOut } from './authSlice';

const isDevFallbackToken = (token: string) =>
  !import.meta.env.PROD &&
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_MOCK_LOGIN === 'true' &&
  token.startsWith('dev-login-fallback-token-');

export const logoutSession = async (dispatch: AppDispatch, getState: () => RootState) => {
  const token = getState().auth.token;

  if (token && !isDevFallbackToken(token)) {
    try {
      await dispatch(authApi.endpoints.logout.initiate()).unwrap();
    } catch {
      // Best-effort revoke. Local cleanup still needs to happen.
    }
  }

  dispatch(logOut());
};
