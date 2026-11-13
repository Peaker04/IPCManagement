import { RouteWorkbenchLoadingFallback } from '../routes/RouteWorkbenchLoadingFallback';
import { lazy } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthProvider } from '../store/authContext';
import { systemApi } from '../api/systemApi';
import { AppShell } from '../components/workbench/AppShell';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';

it('uses the route composition owner fallback instead of importing a route into AppShell', async () => {
  vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1,
    updatedAt: '2026-11-13T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
  const PendingPage = lazy(() => new Promise<{ default: () => React.JSX.Element }>(() => {}));
  render(<AuthProvider><MemoryRouter initialEntries={['/reconciliation?view=audit']}><DirtyNavigationProvider>
    <AppShell navigation={[]} loadingFallback={<h1>Fallback từ composition owner</h1>}><PendingPage /></AppShell>
  </DirtyNavigationProvider></MemoryRouter></AuthProvider>);
  expect(await screen.findByRole('heading', { name: 'Fallback từ composition owner' })).toBeVisible();
});

it('keeps a canonical workspace title while a protected page module is pending', async () => {
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1,
    updatedAt: '2026-11-13T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
  let release!: (module: { default: () => React.JSX.Element }) => void;
  const PendingPage = lazy(() => new Promise<{ default: () => React.JSX.Element }>(resolve => { release = resolve; }));
  render(<AuthProvider><MemoryRouter initialEntries={['/reconciliation?view=audit']}><DirtyNavigationProvider>
    <AppShell loadingFallback={<RouteWorkbenchLoadingFallback />} navigation={[]}><PendingPage /></AppShell>
  </DirtyNavigationProvider></MemoryRouter></AuthProvider>);
  expect(await screen.findByRole('heading', { name: 'Nhật ký kiểm toán' })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Xác nhận|Xuất kho/ })).not.toBeInTheDocument();
  await act(async () => release({ default: () => <h1>Nhật ký đã tải</h1> }));
  expect(await screen.findByRole('heading', { name: 'Nhật ký đã tải' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Nhật ký kiểm toán' })).not.toBeInTheDocument();
});
