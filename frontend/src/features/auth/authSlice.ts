import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { clearStoredAuth, persistAuthSnapshot, readStoredAuthSnapshot } from './authStorage';
import { resetSessionExpiredNotice } from './sessionEvents';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const storedAuth = readStoredAuthSnapshot();

const initialState: AuthState = {
  user: storedAuth.user,
  token: storedAuth.token,
  refreshToken: storedAuth.refreshToken,
  isAuthenticated: false,
  isLoading: !!storedAuth.token,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string; refreshToken?: string | null }>
    ) => {
      const { user, token, refreshToken } = action.payload;
      state.user = user;
      state.token = token;
      state.refreshToken = refreshToken ?? state.refreshToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      persistAuthSnapshot({
        user,
        token,
        refreshToken: refreshToken ?? state.refreshToken,
      });
      resetSessionExpiredNotice();
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logOut: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      clearStoredAuth();
    },
  },
});

export const { setCredentials, setAuthLoading, logOut } = authSlice.actions;
export default authSlice.reducer;
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectRefreshToken = (state: { auth: AuthState }) => state.auth.refreshToken;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
