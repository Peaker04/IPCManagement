import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { apiSlice } from '../api/apiSlice';
import { coordinationReducer } from '../features/coordination';
import authReducer from '../features/auth/authSlice';
import type { User } from '../features/auth/authTypes';
import { ActionGuard } from './ActionGuard';
import { RoleGuard } from './RoleGuard';

type AuthTestState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const buildStore = (auth: Partial<AuthTestState> = {}) =>
  configureStore({
    reducer: {
      auth: authReducer,
      coordination: coordinationReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        ...auth,
      },
    },
  });

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'u1',
  username: 'user',
  fullName: 'Test User',
  role: 'staff',
  roleCode: 'STAFF',
  roleName: 'Nhân viên',
  isAdminFullAccess: false,
  permissions: [],
  ...overrides,
});

const renderWithStore = (
  ui: React.ReactElement,
  auth: Partial<AuthTestState> = {},
  initialPath = '/',
) => {
  const store = buildStore(auth);

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </Provider>,
  );
};

describe('RoleGuard permission decisions', () => {
  it('renders nothing while user is missing', () => {
    const { container } = renderWithStore(
      <RoleGuard requiredPermissions={['report.read']}>
        <span>Reports</span>
      </RoleGuard>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('allows exact permission and admin wildcard users', () => {
    renderWithStore(
      <RoleGuard requiredPermissions={['report.read']}>
        <span>Reports</span>
      </RoleGuard>,
      { user: buildUser({ permissions: ['report.read'] }), isAuthenticated: true },
    );
    expect(screen.getByText('Reports')).toBeInTheDocument();

    renderWithStore(
      <RoleGuard requiredPermissions={['admin.only']}>
        <span>Admin</span>
      </RoleGuard>,
      { user: buildUser({ role: 'admin', permissions: [] }), isAuthenticated: true },
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('redirects to forbidden page when permissions are missing', () => {
    renderWithStore(
      <Routes>
        <Route
          path="/"
          element={(
            <RoleGuard requiredPermissions={['purchase.read']}>
              <span>Purchasing</span>
            </RoleGuard>
          )}
        />
        <Route path="/403" element={<span>Forbidden</span>} />
      </Routes>,
      { user: buildUser({ permissions: ['report.read'] }), isAuthenticated: true },
    );

    expect(screen.getByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByText('Purchasing')).not.toBeInTheDocument();
  });
});

describe('ActionGuard role and permission decisions', () => {
  it('uses fallback for anonymous users and missing role or permission access', () => {
    const { rerender } = renderWithStore(
      <ActionGuard allowedRoles={['thukho']} fallback={<span>Hidden</span>}>
        <button type="button">Approve</button>
      </ActionGuard>,
    );
    expect(screen.getByText('Hidden')).toBeInTheDocument();

    rerender(
      <Provider store={buildStore({ user: buildUser({ role: 'thumua' }), isAuthenticated: true })}>
        <MemoryRouter>
          <ActionGuard allowedRoles={['thukho']} requiredPermissions={['warehouse.issue']} fallback={<span>Hidden</span>}>
            <button type="button">Approve</button>
          </ActionGuard>
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('renders children when role and permission both pass, or admin wildcard is present', () => {
    renderWithStore(
      <ActionGuard allowedRoles={['thukho']} requiredPermissions={['warehouse.issue']} fallback={<span>Hidden</span>}>
        <button type="button">Approve</button>
      </ActionGuard>,
      {
        user: buildUser({
          role: 'thukho',
          permissions: ['warehouse.issue'],
        }),
        isAuthenticated: true,
      },
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    renderWithStore(
      <ActionGuard allowedRoles={['staff']} requiredPermissions={['admin.only']} fallback={<span>Hidden</span>}>
        <button type="button">Admin action</button>
      </ActionGuard>,
      {
        user: buildUser({
          role: 'admin',
          isAdminFullAccess: true,
          permissions: [],
        }),
        isAuthenticated: true,
      },
    );
    expect(screen.getByRole('button', { name: 'Admin action' })).toBeInTheDocument();
  });
});
