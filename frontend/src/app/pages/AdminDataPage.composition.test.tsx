import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainLayout } from '@/app/layout/MainLayout';
import { ROUTES } from '@/lib/routeConfig';
import AdminDataPage from './AdminDataPage';

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => ({
    fullName: 'Quản trị hệ thống',
    role: 'admin',
    permissions: ['*'],
    isAdminFullAccess: true,
  }),
}));
vi.mock('@/app/providers/SystemOperationProvider', () => ({
  SystemOperationProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/systemOperationContext', () => ({
  useSystemOperation: () => ({ mode: 'DEFAULT', label: 'Mặc định' }),
}));
vi.mock('@/features/auth/components/IdleSessionGuard', () => ({ IdleSessionGuard: () => null }));
vi.mock('@/routes/routeLoaders', () => ({ preloadRoute: vi.fn(), preloadRouteData: vi.fn() }));

vi.mock('./admin-data/useAdminDataPageModel', () => ({
  useAdminDataPageModel: () => {
    const [searchParams] = useSearchParams();
    const effectiveActiveView = searchParams.get('view') === 'contracts' ? 'contracts' : 'bom-import';
    return {
      adminTabs: [
        { id: 'admin-bom-import', label: 'BOM theo đơn giá' },
        { id: 'admin-contracts', label: 'Hợp đồng' },
      ],
      effectiveActiveView,
      isViewPending: false,
      setActiveView: vi.fn(),
      startViewTransition: (callback: () => void) => callback(),
    };
  },
}));

vi.mock('./admin-data/AdminBomPanel', () => ({
  AdminBomPanel: () => <section><h2>Import BOM theo đơn giá</h2></section>,
}));
vi.mock('./admin-data/AdminContractsPanel', () => ({
  AdminContractsPanel: () => (
    <section>
      <h2>Hợp đồng khách hàng và quy tắc suất ăn</h2>
      <label htmlFor="admin-contract-customer">Khách hàng</label>
      <select id="admin-contract-customer" defaultValue="customer-1">
        <option value="customer-1">Công ty ANV</option>
      </select>
    </section>
  ),
}));
vi.mock('./admin-data/AdminCleanupPanel', () => ({ AdminCleanupPanel: () => null }));
vi.mock('./admin-data/AdminInventoryPanel', () => ({ AdminInventoryPanel: () => null }));
vi.mock('./admin-data/AdminStatisticsPanel', () => ({ AdminStatisticsPanel: () => null }));
vi.mock('./admin-data/AdminEmployeesPanel', () => ({ AdminEmployeesPanel: () => null }));
vi.mock('./admin-data/AdminAuditPanel', () => ({ AdminAuditPanel: () => null }));

function WeeklyMenuDestination() {
  const navigate = useNavigate();
  return (
    <section>
      <h2>Điểm đến thực đơn tuần</h2>
      <button type="button" onClick={() => navigate(-1)}>Quay lại</button>
    </section>
  );
}

describe('DEFAULT Admin page composition', () => {
  beforeEach(() => window.localStorage.clear());

  it('uses permission-visible shell navigation without generic page shortcuts and restores the exact Admin view on Back', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={[`${ROUTES.ADMIN_DATA}?view=contracts`]}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.ADMIN_DATA} element={<AdminDataPage />} />
            <Route path={ROUTES.WEEKLY_MENU} element={<WeeklyMenuDestination />} />
            <Route path={ROUTES.DASHBOARD} element={<h2>Điểm đến bàn điều hành</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const weeklyMenuLink = within(navigation).getByRole('link', { name: 'Thực đơn tuần' });
    expect(weeklyMenuLink).toHaveAttribute('href', ROUTES.WEEKLY_MENU);
    expect(within(navigation).getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('href', ROUTES.DASHBOARD);

    expect(screen.getByRole('tab', { name: 'Hợp đồng' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { level: 2, name: 'Hợp đồng khách hàng và quy tắc suất ăn' })).toBeInTheDocument();
    expect(screen.getByLabelText('Khách hàng')).toHaveValue('customer-1');
    expect(screen.queryByRole('link', { name: /Xem KHSX\/BOM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Về bàn điều hành' })).not.toBeInTheDocument();
    expect(container.querySelector('.ipc-command-bar')).toBeNull();

    weeklyMenuLink.focus();
    expect(weeklyMenuLink).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Điểm đến thực đơn tuần' })).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: 'Quay lại' });
    backButton.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Hợp đồng' })).toHaveAttribute('aria-selected', 'true'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Hợp đồng khách hàng và quy tắc suất ăn' })).toBeInTheDocument();
    expect(screen.getByLabelText('Khách hàng')).toHaveValue('customer-1');
    expect(container.querySelector('.ipc-command-bar')).toBeNull();
  });

  it('keeps the canonical BOM work surface without restoring the retired page summary', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={[ROUTES.ADMIN_DATA]}>
        <AdminDataPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'BOM theo đơn giá' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Import BOM theo đơn giá' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Import BOM theo đơn giá' })).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('dl.ipc-context-strip')).toHaveLength(0));
  });
});
