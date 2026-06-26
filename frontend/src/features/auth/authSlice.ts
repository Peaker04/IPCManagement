import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isAdminFullAccess: boolean;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const token = localStorage.getItem('token');
const refreshToken = localStorage.getItem('refreshToken');
const userJson = localStorage.getItem('user');

const parseStoredUser = (): User | null => {
  if (!userJson) {
    return null;
  }

  try {
    return JSON.parse(userJson) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const initialState: AuthState = {
  user: parseStoredUser(),
  token: token,
  refreshToken: refreshToken,
  isAuthenticated: false,
  isLoading: !!token,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string; refreshToken?: string }>
    ) => {
      const { user, token, refreshToken } = action.payload;
      state.user = user;
      state.token = token;
      if (refreshToken) state.refreshToken = refreshToken;
      state.isAuthenticated = true;
      state.isLoading = false;
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
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
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, setAuthLoading, logOut } = authSlice.actions;
export default authSlice.reducer;
export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
