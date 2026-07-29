import { describe, expect, it } from 'vitest';

import currentLayoutSource from '@/components/layout/MainLayout.tsx?raw';
import appRouterSource from '@/routes/AppRouter.tsx?raw';

describe('MainLayout ownership and behavior contract', () => {
  it('characterizes the current route owner before the path-only move', () => {
    expect(appRouterSource).toContain("from '../components/layout/MainLayout'");
  });

  it('locks navigation, permissions, preload and DOM-visible behavior', () => {
    expect(currentLayoutSource).toContain('item.requiredPermissions.some');
    expect(currentLayoutSource).toContain('preloadRoute(path)');
    expect(currentLayoutSource).toContain('preloadRouteData(path)');
    expect(currentLayoutSource).toContain("effectiveType !== 'slow-2g'");
    expect(currentLayoutSource).toContain('onPointerEnter={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('onFocus={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('onTouchStart={() => preloadNavigationTarget(item.path)}');
    expect(currentLayoutSource).toContain('aria-current={isActive ? \'page\' : undefined}');
    expect(currentLayoutSource).toContain('id="ipc-main-content"');
    expect(currentLayoutSource).toContain('<Outlet />');
  });
});
