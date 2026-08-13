import { describe, expect, it } from 'vitest';

import currentLayoutSource from '@/app/layout/MainLayout.tsx?raw';
import appRouterSource from '@/routes/AppRouter.tsx?raw';

describe('MainLayout ownership and behavior contract', () => {
  it('keeps the route owner in the app composition layer', () => {
    expect(appRouterSource).toContain("from '@/app/layout/MainLayout'");
  });

  it('locks navigation, permissions, preload and DOM-visible behavior', () => {
    expect(currentLayoutSource).toContain('item.requiredPermissions.some');
    expect(currentLayoutSource).toContain('preloadRoute(path)');
    expect(currentLayoutSource).toContain('preloadRouteData(path)');
    expect(currentLayoutSource).toContain('onPointerEnter={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('onFocus={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('onTouchStart={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('aria-current={isActive ? \'page\' : undefined}');
    expect(currentLayoutSource).toContain('id="ipc-main-content"');
    expect(currentLayoutSource).toContain('<Outlet />');
  });

  it('preloads only a route for which the user has shown navigation intent', () => {
    expect(currentLayoutSource).not.toContain('requestIdleCallback');
    expect(currentLayoutSource).not.toContain('scheduleNextRoute');
    expect(currentLayoutSource).not.toContain('visibleMenuItems[nextRouteIndex]');
  });
});
