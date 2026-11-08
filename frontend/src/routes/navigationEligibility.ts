import type { OperationalMode } from '../types';
import type { OperationalModeEligibility, RouteDef, RouteLeafDef } from './routeRegistry';

export interface NavigationActor {
  roleCode?: string;
  roleName?: string;
  isAdminFullAccess?: boolean;
  permissions?: string[];
}

export interface EligibleRoute extends RouteDef {
  leaves?: RouteLeafDef[];
}

function matchesMode(modes: OperationalModeEligibility[], mode: OperationalMode | null): boolean {
  if (modes.includes('SHARED')) return true;
  return mode !== null && modes.includes(mode);
}

function matchesActor(
  allowedRoles: string[] | undefined,
  permissions: string[] | undefined,
  actor: NavigationActor
): boolean {
  if (actor.isAdminFullAccess) return true;
  const actorRoles = [actor.roleCode, actor.roleName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toUpperCase());
  const roleAllowed = !allowedRoles?.length || allowedRoles.some((role) => actorRoles.includes(role.toUpperCase()));
  const actorPermissions = actor.permissions ?? [];
  const permissionAllowed = !permissions?.length || permissions.some((permission) => actorPermissions.includes(permission));
  return roleAllowed && permissionAllowed;
}

export function resolveEligibleNavigation(
  routes: RouteDef[],
  actor: NavigationActor,
  mode: OperationalMode | null
): EligibleRoute[] {
  return routes.flatMap((route) => {
    if (!matchesMode(route.modes, mode) || !matchesActor(route.allowedRoles, route.permissions, actor)) return [];
    const leaves = route.leaves?.filter((leaf) =>
      leaf.readiness !== 'BLOCKED' &&
      matchesMode(leaf.modes, mode) &&
      matchesActor(leaf.allowedRoles ?? route.allowedRoles, leaf.permissions, actor)
    );
    if (route.leaves && !leaves?.length) return [];
    return [{ ...route, leaves }];
  });
}

export function resolveLandingPath(
  routes: RouteDef[],
  actor: NavigationActor,
  mode: OperationalMode
): string {
  if (actor.isAdminFullAccess || actor.roleCode?.toUpperCase() === 'ADMIN' || actor.roleCode?.toUpperCase() === 'MANAGER') {
    return '/';
  }
  const destination = resolveEligibleNavigation(routes, actor, mode)
    .find((route) => route.path !== '/login' && route.path !== '/forbidden' && (mode !== 'MATERIAL_RECONCILIATION' || route.path !== '/'));
  return destination?.leaves?.[0]?.to ?? destination?.path ?? '/forbidden';
}

export function isRouteEligible(
  routes: RouteDef[],
  pathname: string,
  search: string,
  actor: NavigationActor,
  mode: OperationalMode | null
): boolean {
  const route = resolveEligibleNavigation(routes, actor, mode).find((entry) => entry.path === pathname);
  if (!route) return false;
  if (!route.leaves?.length) return true;

  const currentParams = new URLSearchParams(search);
  const currentView = currentParams.get('view');

  // Nếu không có search query hoặc không có tham số view (truy cập đường dẫn gốc)
  // Hợp lệ nếu route có ít nhất một leaf khả dụng trong ngữ cảnh hiện tại.
  if (!search || !currentView) {
    return route.leaves.length > 0;
  }

  // Có tham số view: kiểm tra xem có leaf khả dụng nào khớp view này không.
  // Các query params vận hành khác (batchId, date, page...) là state của view, không làm mất tính hợp lệ.
  return route.leaves.some((leaf) => {
    const leafParams = new URLSearchParams(leaf.to.split('?')[1] || '');
    const leafView = leafParams.get('view');
    if (leafView) return leafView === currentView;
    return leaf.to === pathname;
  });
}
