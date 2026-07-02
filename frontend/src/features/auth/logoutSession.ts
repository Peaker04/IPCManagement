import type { AppDispatch, RootState } from '../../app/store';
import { authApi } from './authApi';
import { logOut } from './authSlice';

const isDevFallbackRefreshToken = (refreshToken: string) =>
  refreshToken.startsWith('dev-fallback-refresh');

export const logoutSession = async (dispatch: AppDispatch, getState: () => RootState) => {
  const refreshToken = getState().auth.refreshToken;

  if (refreshToken && !isDevFallbackRefreshToken(refreshToken)) {
    try {
      await dispatch(authApi.endpoints.logout.initiate({ refreshToken })).unwrap();
    } catch {
      // Best-effort revoke. Local cleanup still needs to happen.
    }
  }

  dispatch(logOut());
};
