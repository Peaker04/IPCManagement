import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const UI_AUDIT_VIEWPORTS = [
  { id: '1920x1080', width: 1920, height: 1080 }, { id: '1440x900', width: 1440, height: 900 },
  { id: '1366x768', width: 1366, height: 768 }, { id: '1365x900', width: 1365, height: 900 },
  { id: '1280x900', width: 1280, height: 900 }, { id: '320x900', width: 320, height: 900 },
  { id: '320x900@200%', width: 320, height: 900, textZoomPercent: 200 },
] as const;
export const UI_AUDIT_ROUTES = ['/', '/weekly-menu', '/reports', '/meal-orders', '/chef-dashboard', '/approvals', '/purchasing', '/warehouse', '/reconciliation', '/admin-data', '/admin/rules', '/admin/advanced-settings', '/login', '/403'] as const;
export const CANONICAL_QUERY_STATES = ['initial-loading', 'populated', 'refreshing', 'truly-empty', 'no-results', 'error-no-data', 'partial-error-stale', 'mutation-in-flight', 'mutation-failure'] as const;
export const REGION_INVENTORY = {
  '/': ['dashboard-shift-status','dashboard-workflow-exceptions'], '/weekly-menu': ['weekly-schedule','weekly-demand','weekly-purchase-summary','weekly-cost','weekly-dish-materials'],
  '/reports': ['report-demand','report-purchase-plan','report-current-stock','report-movements','report-price-variance'], '/meal-orders': ['coordination-orders'],
  '/chef-dashboard': ['chef-production','chef-material-checklist','chef-documents'], '/approvals': ['approval-queue','approval-history','approval-purchase-requests'],
  '/purchasing': ['purchase-workflow','purchase-supplemental','purchase-quotes'], '/warehouse': ['warehouse-current-stock','warehouse-purchase-receipts','warehouse-issues','warehouse-movements'], '/reconciliation': ['reconciliation-workspace'],
  '/admin-data': ['admin-entities','admin-imports','admin-data-quality','admin-cleanup'], '/admin/rules': ['approval-rules'], '/admin/advanced-settings': ['advanced-settings-form'],
  '/login': ['login-form'], '/403': ['forbidden-panel'],
} as const;
export type UiAuditRoute = keyof typeof REGION_INVENTORY;
export type UiAuditIdentity = { route: UiAuditRoute; regionId: string; state: string; actor: string; viewport: string; lowestOwner: string; disposition?: `N/A(${string})` };

const staticRoutes = new Set<UiAuditRoute>(['/403']);
const formRoutes = new Set<UiAuditRoute>(['/login','/admin/advanced-settings']);

/** Canonical identity authorities shared by the inventory and production-route evidence adapters. */
export const UI_AUDIT_ROUTE_AUTHORITIES: Record<UiAuditRoute, { actor: string; lowestOwner: string }> = {
  '/': { actor: 'authenticated', lowestOwner: 'DashboardPage' },
  '/weekly-menu': { actor: 'coordinator', lowestOwner: 'WeeklyMenuPage' },
  '/reports': { actor: 'reporter', lowestOwner: 'ReportsPage' },
  '/meal-orders': { actor: 'coordinator', lowestOwner: 'CoordinationPage' },
  '/chef-dashboard': { actor: 'chef', lowestOwner: 'ChefDashboardPage' },
  '/approvals': { actor: 'manager', lowestOwner: 'ApprovalPage' },
  '/purchasing': { actor: 'purchasing', lowestOwner: 'PurchasingPage' },
  '/warehouse': { actor: 'warehouse-keeper', lowestOwner: 'WarehousePage' },
  '/reconciliation': { actor: 'warehouse-keeper', lowestOwner: 'ReconciliationPage' },
  '/admin-data': { actor: 'administrator', lowestOwner: 'AdminDataPage' },
  '/admin/rules': { actor: 'administrator', lowestOwner: 'ApprovalRulesPage' },
  '/admin/advanced-settings': { actor: 'administrator', lowestOwner: 'AdvancedDisplaySettings' },
  '/login': { actor: 'anonymous', lowestOwner: 'login-form' },
  '/403': { actor: 'authenticated-but-forbidden', lowestOwner: 'ForbiddenPage' },
};

export function expandUiAuditInventory(): UiAuditIdentity[] {
  const rows: UiAuditIdentity[] = [];
  for (const [route, regions] of Object.entries(REGION_INVENTORY) as [UiAuditRoute, readonly string[]][]) for (const regionId of regions) for (const state of CANONICAL_QUERY_STATES) for (const viewport of UI_AUDIT_VIEWPORTS) {
    let disposition: UiAuditIdentity['disposition'];
    if (staticRoutes.has(route) && state !== 'populated') disposition = 'N/A(static denial region)';
    if (formRoutes.has(route) && !['populated','mutation-in-flight','mutation-failure'].includes(state)) disposition = 'N/A(local form has no collection query)';
    if (['/','/reports'].includes(route) && state.startsWith('mutation-')) disposition = 'N/A(read-only regions)';
    const authority = UI_AUDIT_ROUTE_AUTHORITIES[route];
    rows.push({ route, regionId, state, actor: authority.actor, viewport: viewport.id, lowestOwner: authority.lowestOwner, disposition });
  }
  return rows;
}
export function identityKey(row: UiAuditIdentity) { return [row.route,row.regionId,row.state,row.actor,row.viewport,row.lowestOwner].join('|'); }
export function parseProductionRouteSet(root = process.cwd()) {
  const repoRoot = root.endsWith('frontend') ? resolve(root, '..') : root;
  const config = readFileSync(resolve(repoRoot, 'frontend/src/lib/routeConfig.ts'), 'utf8');
  const router = readFileSync(resolve(repoRoot, 'frontend/src/routes/AppRouter.tsx'), 'utf8');
  const values = [...config.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);
  const referenced = new Set([...router.matchAll(/path=\{ROUTES\.([A-Z_]+)\}/g)].map((match) => match[1]));
  const names = [...config.matchAll(/^\s*([A-Z_]+):/gm)].map((match) => match[1]);
  return values.filter((_, index) => referenced.has(names[index])).sort();
}
