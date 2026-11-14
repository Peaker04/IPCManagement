import { render } from '@testing-library/react';
import { AuthProvider } from '../store/authContext';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible } from '../routes/navigationEligibility';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WarehousePage } from '../features/warehouse/WarehousePage';

export function renderWarehouse(initialEntry = '/warehouse') {
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/warehouse" element={<WarehousePage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}
