import { describe, expect, it } from 'vitest';

import currentLayoutSource from '@/app/layout/MainLayout.tsx?raw';
import appRouterSource from '@/routes/AppRouter.tsx?raw';

describe('MainLayout ownership and behavior contract', () => {
  it('keeps the route owner in the app composition layer', () => {
    expect(appRouterSource).toContain("from '@/app/layout/MainLayout'");
  });

  it('locks navigation, permissions, preload and DOM-visible behavior', () => {
    expect(currentLayoutSource).toContain('item.requiredPermissions.some');
    expect(currentLayoutSource).toContain('preloadRoute(path, mode)');
    expect(currentLayoutSource).toContain('preloadRouteData(path, mode)');
    expect(currentLayoutSource).toContain("onPointerEnter={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain("onFocus={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain("onTouchStart={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}");
    expect(currentLayoutSource).toContain('aria-current={isActive ? \'page\' : undefined}');
    expect(currentLayoutSource).toContain('id="ipc-main-content"');
    expect(currentLayoutSource).toContain('<Outlet />');
  });

  it('preloads only a route for which the user has shown navigation intent', () => {
    expect(currentLayoutSource).not.toContain('requestIdleCallback');
    expect(currentLayoutSource).not.toContain('scheduleNextRoute');
    expect(currentLayoutSource).not.toContain('visibleMenuItems[nextRouteIndex]');
  });

  it('does not rerender the app shell for every feature query transition', () => {
    expect(currentLayoutSource).not.toContain('Object.values(state.api.queries)');
    expect(currentLayoutSource).not.toContain('activeRequestCount');
  });
});
