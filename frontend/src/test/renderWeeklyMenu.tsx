import { render } from '@testing-library/react';
import { AuthProvider } from '../store/authContext';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible, resolveEligibleNavigation } from '../routes/navigationEligibility';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { ForbiddenPage } from '../features/auth/ForbiddenPage';
import { AppShell } from '../components/workbench/AppShell';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { RouteWorkbenchLoadingFallback } from '../routes/RouteWorkbenchLoadingFallback';

// This probe is mounted only by the test renderer.
// eslint-disable-next-line react-refresh/only-export-components
function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

export function renderWeeklyMenu(initialEntry = '/weekly-menu', withShell = false) {
  const content = <Routes>
    <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
    <Route path="/forbidden" element={<ForbiddenPage />} />
    <Route path="/warehouse" element={<LocationProbe />} />
  </Routes>;
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <DirtyNavigationProvider>{withShell
          ? <AppShell loadingFallback={<RouteWorkbenchLoadingFallback />} navigation={resolveEligibleNavigation(CANONICAL_ROUTES, JSON.parse(localStorage.getItem('ipc_v3_user')!), 'MATERIAL_RECONCILIATION')}>{content}</AppShell>
          : content}</DirtyNavigationProvider>
      </MemoryRouter>
    </AuthProvider>
  );
}
