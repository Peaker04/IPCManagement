import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from './authTypes';
import { clearStoredAuth, persistAuthSnapshot, readStoredAuthSnapshot } from './authStorage';
import { resetSessionExpiredNotice } from './sessionEvents';
const storedAuth = readStoredAuthSnapshot();

const initialState: AuthState = {
  user: storedAuth.user,
  token: storedAuth.token,

  isAuthenticated: false,
  isLoading: !!storedAuth.token,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      state.isLoading = false;
      persistAuthSnapshot({
        user,
        token,
      });
      resetSessionExpiredNotice();
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logOut: (state) => {
      state.user = null;
      state.token = null;
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
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export type { AuthState, User };
