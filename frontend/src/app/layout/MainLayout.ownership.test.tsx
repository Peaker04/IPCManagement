import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/routeConfig';
import { routeRegistry } from '@/routes/routeRegistry';

import currentLayoutSource from '@/app/layout/MainLayout.tsx?raw';
import appRouterSource from '@/routes/AppRouter.tsx?raw';

describe('MainLayout ownership and behavior contract', () => {
  it('keeps the route owner in the app composition layer', () => {
    expect(appRouterSource).toContain("from '@/app/layout/MainLayout'");
  });

  it('keeps page-owned shift scope out of the shared header', () => {
    expect(currentLayoutSource).not.toContain('HeaderShiftContext');
    expect(currentLayoutSource).not.toContain("'Ca trưa'");
    expect(routeRegistry[ROUTES.WEEKLY_MENU].shellTitle).toBe('Thực đơn tuần');
  });

  it('locks navigation, permissions, preload and DOM-visible behavior', () => {
    expect(currentLayoutSource).toContain('isRouteVisibleToPermissions(');
    expect(currentLayoutSource).toContain('preloadRoute(path, mode)');
    expect(currentLayoutSource).toContain('preloadRouteData(path, mode)');
    expect(currentLayoutSource).toContain("onPointerEnter={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain("onFocus={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain("onTouchStart={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain('aria-current={isActive ? \'page\' : undefined}');
    expect(currentLayoutSource).toContain("!navigationPreferences[item.preferenceKey]");
    expect(currentLayoutSource).toContain('id="ipc-main-content"');
    expect(currentLayoutSource).toContain('<Outlet />');
  });

  it('preloads only a route for which the user has shown navigation intent', () => {
    expect(currentLayoutSource).not.toContain('requestIdleCallback');
    expect(currentLayoutSource).not.toContain('scheduleNextRoute');
    expect(currentLayoutSource).not.toContain('visibleMenuItems[nextRouteIndex]');
  });

  it('gives the forbidden route its own page identity and denied state', () => {
    expect(routeRegistry[ROUTES.FORBIDDEN]).toMatchObject({
      shellTitle: 'Không đủ quyền truy cập',
      workflow: 'Phân quyền',
      headerState: 'Bị từ chối',
    });
  });

  it('preloads only a route for which the user has shown navigation intent', () => {
    expect(currentLayoutSource).not.toContain('requestIdleCallback');
    expect(currentLayoutSource).not.toContain('scheduleNextRoute');
    expect(currentLayoutSource).not.toContain('visibleMenuItems[nextRouteIndex]');
  });

  // G4 batch D: nested sidebar minimal (NESTED-4)
  it('renders nested leaf nav when route has children', () => {
    // Top-level nav link carries data-active-ancestor marker
    expect(currentLayoutSource).toContain('data-active-ancestor=');
    // Leaf list uses ?view= query param
    expect(currentLayoutSource).toContain('?view=');
    // Leaf nav uses ipc-nav-leaf-list class
    expect(currentLayoutSource).toContain('ipc-nav-leaf-list');
    expect(currentLayoutSource).toContain('ipc-nav-leaf-link');
    // Wraps each nav item in ipc-nav-group div
    expect(currentLayoutSource).toContain('ipc-nav-group');
  });

  it('does not rerender the app shell for every feature query transition', () => {
    expect(currentLayoutSource).not.toContain('Object.values(state.api.queries)');
    expect(currentLayoutSource).not.toContain('activeRequestCount');
  });
});
