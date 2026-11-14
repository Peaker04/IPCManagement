import { render } from '@testing-library/react';
import { AuthProvider } from '../store/authContext';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible } from '../routes/navigationEligibility';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';

export function renderReconciliation(initialEntry = '/reconciliation') {
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reconciliation" element={<ReconciliationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}
