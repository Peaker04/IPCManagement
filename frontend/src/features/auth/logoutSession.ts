import type { AppDispatch, RootState } from '../../app/store';
import { authApi } from './authApi';
import { logOut } from './authSlice';

const isDevFallbackToken = (token: string) =>
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
