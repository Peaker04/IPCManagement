import type { AppDispatch, RootState } from '../../app/store';
import { authApi } from './authApi';
import { logOut } from './authSlice';

export const logoutSession = async (dispatch: AppDispatch, getState: () => RootState) => {
  const refreshToken = getState().auth.refreshToken;

  if (refreshToken) {
    try {
      await dispatch(authApi.endpoints.logout.initiate({ refreshToken })).unwrap();
    } catch {
      // Best-effort revoke. Local cleanup still runs below.
    }
  }

  dispatch(logOut());
};
