import type { SkeletonGeometry } from '../components/workbench/WorkbenchSkeleton';

export interface WorkbenchSurfaceDefinition {
  id: string;
  route: string;
  view?: string;
  geometry: SkeletonGeometry;
}

export const WORKBENCH_SURFACES: WorkbenchSurfaceDefinition[] = [
  { id: 'dashboard.root', route: '/', geometry: { kind: 'table', columns: 4, rows: 6, toolbar: true } },
  { id: 'weekly.schedule', route: '/weekly-menu', geometry: { kind: 'matrix', columns: 7, rows: 6, toolbar: true } },
  { id: 'weekly.demand', route: '/weekly-menu', view: 'demand', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'weekly.production', route: '/weekly-menu', view: 'production-plan', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'weekly.cost', route: '/weekly-menu', view: 'cost', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'mrx.batch', route: '/weekly-menu', view: 'mrx-batch', geometry: { kind: 'table', columns: 7, rows: 8, toolbar: true } },
  { id: 'meal.orders', route: '/meal-orders', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'approval.inbox', route: '/approvals', geometry: { kind: 'split', columns: 5, rows: 8, splitRatio: '60/40', toolbar: true } },
  { id: 'purchasing.orders', route: '/purchasing', geometry: { kind: 'split', columns: 6, rows: 8, splitRatio: '60/40', toolbar: true } },
  { id: 'warehouse.issues', route: '/warehouse', view: 'issues', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'warehouse.receipts', route: '/warehouse', view: 'receipts', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'warehouse.stock', route: '/warehouse', view: 'stock', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'mrx.daily', route: '/warehouse', view: 'mrx-daily', geometry: { kind: 'table', columns: 7, rows: 8, toolbar: true } },
  { id: 'mrx.issues', route: '/warehouse', view: 'mrx-issues', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'chef.plans', route: '/chef', view: 'plans', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'chef.issues', route: '/chef', view: 'issues', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'mrx.cooking', route: '/chef', view: 'mrx-cooking', geometry: { kind: 'table', columns: 7, rows: 8, toolbar: true } },
  { id: 'reconciliation.batch', route: '/reconciliation', geometry: { kind: 'table', columns: 7, rows: 8, toolbar: true } },
  { id: 'reports.demand', route: '/reports', view: 'demand', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'reports.prices', route: '/reports', view: 'prices', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'reports.stock', route: '/reports', view: 'stock', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'admin.ingredients', route: '/admin-data', view: 'ingredients', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'admin.dishes', route: '/admin-data', view: 'dishes', geometry: { kind: 'table', columns: 6, rows: 8, toolbar: true } },
  { id: 'admin.approval-rules', route: '/settings/approval-rules', geometry: { kind: 'table', columns: 5, rows: 6, toolbar: true } },
  { id: 'admin.mode', route: '/settings/advanced', view: 'mode', geometry: { kind: 'form', rows: 4, toolbar: true } },
];

export function resolveWorkbenchSurface(pathname: string, search: string): WorkbenchSurfaceDefinition {
  const view = new URLSearchParams(search).get('view') || undefined;
  return WORKBENCH_SURFACES.find((surface) => surface.route === pathname && surface.view === view)
    || WORKBENCH_SURFACES.find((surface) => surface.route === pathname && surface.view === undefined)
    || WORKBENCH_SURFACES.find((surface) => surface.route === pathname)
    || WORKBENCH_SURFACES[0];
}
