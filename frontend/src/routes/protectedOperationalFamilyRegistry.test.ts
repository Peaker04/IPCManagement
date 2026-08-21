import { describe, expect, it } from 'vitest'
import { UNKNOWN } from '../../tests/stateActionRegistryContract'
import appRouterSource from './AppRouter.tsx?raw'
import routeLoadersSource from './routeLoaders.ts?raw'

type SourceKind = 'importable' | 'literal-guarded' | 'unknown'
type FamilyClassification = 'object-family' | 'query-only' | 'page-shell' | 'unknown'
type SourceDimension = {
  kind: SourceKind
  source: string
  reason?: string
}

export type ProtectedRouteOwner = {
  routeKey: string
  page: string
  ownerSource: string
  permissions: readonly string[]
}

export type ProtectedOperationalFamily = {
  routeKey: string
  page: string
  ownerSource: string
  classification: FamilyClassification
  families: readonly string[]
  reason?: string
  stateSource: SourceDimension
  roleSource: SourceDimension
  operationSource: SourceDimension
  backendEnforcementSource: SourceDimension
}

const source = (kind: SourceKind, descriptor: string, reason?: string): SourceDimension => ({
  kind,
  source: descriptor,
  ...(reason ? { reason } : {}),
})

const normalizeImportPath = (specifier: string) => {
  const segments = ['frontend', 'src', 'routes', ...specifier.split('/')]
  const normalized: string[] = []
  for (const segment of segments) {
    if (segment === '..') normalized.pop()
    else if (segment !== '.') normalized.push(segment)
  }
  return `${normalized.join('/')}.tsx`
}

const uniqueMatchIndex = (lines: readonly string[], fragment: string) => {
  const matches = lines.flatMap((line, index) => line.includes(fragment) ? [index] : [])
  if (matches.length !== 1) {
    throw new Error(`Expected one ${fragment} route anchor, found ${matches.length}`)
  }
  return matches[0]
}

export function isolateProtectedMainLayoutBlock(sourceText: string) {
  const lines = sourceText.split(/\r?\n/)
  const protectedIndex = uniqueMatchIndex(lines, '<Route element={<ProtectedRoute />}>')
  const mainOffset = uniqueMatchIndex(lines.slice(protectedIndex + 1), '<Route element={<MainLayout />}>')
  const mainIndex = protectedIndex + 1 + mainOffset
  const indent = lines[mainIndex].match(/^\s*/)?.[0] ?? ''
  const endIndex = lines.findIndex((line, index) => index > mainIndex && line === `${indent}</Route>`)
  if (endIndex < 0) throw new Error('Protected MainLayout route block is not closed')
  return lines.slice(mainIndex + 1, endIndex).join('\n')
}

const resolvePageOwners = (routerText: string, loadersText: string) => {
  const loaderImports = new Map(
    [...loadersText.matchAll(/const\s+(\w+Route)\s*=\s*createPreloadableRoute\(\(\)\s*=>\s*import\('([^']+)'\)\);/g)]
      .map((match) => [match[1], normalizeImportPath(match[2])]),
  )
  const owners = new Map<string, string>()

  for (const match of loadersText.matchAll(/export const\s+(\w+Page)\s*=\s*(\w+Route)\.Component;/g)) {
    const ownerSource = loaderImports.get(match[2])
    if (!ownerSource) throw new Error(`Unresolved lazy owner for ${match[1]}`)
    owners.set(match[1], ownerSource)
  }
  for (const match of routerText.matchAll(/import\s+(\w+Page)\s+from\s+'([^']+)'/g)) {
    owners.set(match[1], normalizeImportPath(match[2]))
  }
  for (const match of routerText.matchAll(/const\s+(\w+Page)\s*=\s*lazy\(\(\)\s*=>\s*import\('([^']+)'\)/g)) {
    owners.set(match[1], normalizeImportPath(match[2]))
  }
  return owners
}

export function discoverProtectedRouteOwners(routerText: string, loadersText: string): ProtectedRouteOwner[] {
  const block = isolateProtectedMainLayoutBlock(routerText)
  const owners = resolvePageOwners(routerText, loadersText)
  const discovered = block.split(/\r?\n/).filter((line) => line.includes('path={ROUTES.')).map((line) => {
    const routeKey = line.match(/path=\{ROUTES\.([A-Z0-9_]+)\}/)?.[1]
    const pages = [...line.matchAll(/<([A-Z][A-Za-z0-9]+Page)\s*\/>/g)].map((match) => match[1])
    if (!routeKey || pages.length !== 1) throw new Error(`Unresolved protected route owner: ${line.trim()}`)
    const ownerSource = owners.get(pages[0])
    if (!ownerSource) throw new Error(`Unresolved protected route owner: ${routeKey} → ${pages[0]}`)
    const permissionBody = line.match(/requiredPermissions=\{\[([^\]]*)\]\}/)?.[1] ?? ''
    const permissions = [...permissionBody.matchAll(/'([^']+)'/g)].map((match) => match[1])
    return { routeKey, page: pages[0], ownerSource, permissions }
  })

  const routeKeys = discovered.map((item) => item.routeKey)
  if (new Set(routeKeys).size !== routeKeys.length) throw new Error('Duplicate protected route discovered')
  return discovered.sort((left, right) => left.routeKey.localeCompare(right.routeKey))
}

const SOURCE_DIMENSIONS = [
  'stateSource',
  'roleSource',
  'operationSource',
  'backendEnforcementSource',
] as const

const assertSourceDimension = (routeKey: string, name: typeof SOURCE_DIMENSIONS[number], value: SourceDimension) => {
  if (!['importable', 'literal-guarded', 'unknown'].includes(value.kind)) {
    throw new Error(`${routeKey} has invalid ${name} kind`)
  }
  if (!/^(frontend|backend)\/[A-Za-z0-9_./-]+:\d+(?:-\d+)?$/.test(value.source)) {
    throw new Error(`${routeKey} has invalid ${name} source`)
  }
  if (value.kind === 'unknown' && !value.reason) throw new Error(`${routeKey} has unexplained ${name}`)
}

export function assertInventoryMatchesRoutes(
  discovered: readonly ProtectedRouteOwner[],
  inventory: readonly ProtectedOperationalFamily[],
) {
  const discoveredKeys = discovered.map((item) => item.routeKey)
  const inventoryKeys = inventory.map((item) => item.routeKey)
  if (new Set(discoveredKeys).size !== discoveredKeys.length) throw new Error('Duplicate discovered route')
  if (new Set(inventoryKeys).size !== inventoryKeys.length) throw new Error('Duplicate inventory route')

  const discoveredByKey = new Map(discovered.map((item) => [item.routeKey, item]))
  const inventoryByKey = new Map(inventory.map((item) => [item.routeKey, item]))
  const missing = discoveredKeys.filter((key) => !inventoryByKey.has(key))
  const stale = inventoryKeys.filter((key) => !discoveredByKey.has(key))
  if (missing.length > 0) throw new Error(`Missing route classification: ${missing.join(', ')}`)
  if (stale.length > 0) throw new Error(`Stale route classification: ${stale.join(', ')}`)

  for (const item of inventory) {
    const route = discoveredByKey.get(item.routeKey)!
    if (item.page !== route.page || item.ownerSource !== route.ownerSource) {
      throw new Error(`Route owner drift: ${item.routeKey}`)
    }
    if (item.classification === 'object-family' && item.families.length === 0) {
      throw new Error(`${item.routeKey} has no object family`)
    }
    if (item.classification !== 'object-family' && !item.reason) {
      throw new Error(`${item.routeKey} has no classification reason`)
    }
    SOURCE_DIMENSIONS.forEach((name) => assertSourceDimension(item.routeKey, name, item[name]))
  }
}

const unknown = (descriptor: string, reason: string) => source('unknown', descriptor, reason)

export const protectedOperationalFamilies: readonly ProtectedOperationalFamily[] = ([
  {
    routeKey: 'ADMIN_DATA', page: 'AdminDataPage', ownerSource: 'frontend/src/app/pages/AdminDataPage.tsx',
    classification: 'page-shell', families: ['AdminData'], reason: 'Multi-panel administration shell; no single business lifecycle is importable.',
    stateSource: unknown('frontend/src/app/pages/AdminDataPage.tsx:1', UNKNOWN),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:62'),
    operationSource: unknown('frontend/src/app/pages/AdminDataPage.tsx:1', 'Panel-owned operations do not form one page lifecycle.'),
    backendEnforcementSource: unknown('frontend/src/app/pages/AdminDataPage.tsx:1', 'Backend policies differ by panel.'),
  },
  {
    routeKey: 'APPROVALS', page: 'ApprovalPage', ownerSource: 'frontend/src/features/approvals/pages/ApprovalPage.tsx',
    classification: 'object-family', families: ['ApprovalDocument'],
    stateSource: source('importable', 'frontend/src/lib/actionEligibility.ts:21-48'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:58'),
    operationSource: source('literal-guarded', 'frontend/src/features/approvals/pages/ApprovalPage.tsx:217-239'),
    backendEnforcementSource: unknown('frontend/src/features/approvals/pages/ApprovalPage.tsx:190', 'Generic decision mutation does not expose target-specific backend policy.'),
  },
  {
    routeKey: 'APPROVAL_RULES', page: 'ApprovalRulesPage', ownerSource: 'frontend/src/features/admin/pages/ApprovalRulesPage.tsx',
    classification: 'query-only', families: ['ApprovalRules'], reason: 'Configuration CRUD surface, not an importable business lifecycle.',
    stateSource: unknown('frontend/src/features/admin/pages/ApprovalRulesPage.tsx:1', 'Only query and dialog state is page-owned.'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:63'),
    operationSource: unknown('frontend/src/features/admin/pages/ApprovalRulesPage.tsx:1', 'No lifecycle operation model is exported.'),
    backendEnforcementSource: unknown('frontend/src/features/admin/pages/ApprovalRulesPage.tsx:1', 'Backend policy is not importable from the page shell.'),
  },
  {
    routeKey: 'CHEF_DASHBOARD', page: 'ChefDashboardPage', ownerSource: 'frontend/src/features/chef/pages/ChefDashboardPage.tsx',
    classification: 'object-family', families: ['ProductionPlan'],
    stateSource: source('importable', 'frontend/src/features/chef/production/chefProductionModel.ts:113-319'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:57'),
    operationSource: source('literal-guarded', 'frontend/src/features/chef/production/ChefProductionSection.tsx:27-50'),
    backendEnforcementSource: source('literal-guarded', 'frontend/src/features/chef/production/useChefProductionPlan.ts:59-80'),
  },
  {
    routeKey: 'DASHBOARD', page: 'DashboardPage', ownerSource: 'frontend/src/features/dashboard/pages/DashboardPage.tsx',
    classification: 'page-shell', families: ['Dashboard'], reason: 'Read-only overview aggregates several object families.',
    stateSource: unknown('frontend/src/features/dashboard/pages/DashboardPage.tsx:1', 'Dashboard query phases are not entity lifecycle states.'),
    roleSource: unknown('frontend/src/routes/AppRouter.tsx:52', 'Protected route has no additional RoleGuard permission.'),
    operationSource: unknown('frontend/src/features/dashboard/pages/DashboardPage.tsx:1', 'No business mutation lifecycle is owned by the page.'),
    backendEnforcementSource: unknown('frontend/src/features/dashboard/pages/DashboardPage.tsx:1', 'Overview queries have endpoint-specific policies.'),
  },
  {
    routeKey: 'FORBIDDEN', page: 'ForbiddenPage', ownerSource: 'frontend/src/features/auth/pages/ForbiddenPage.tsx',
    classification: 'unknown', families: ['Forbidden'], reason: 'Access-denied page has no business object lifecycle.',
    stateSource: unknown('frontend/src/features/auth/pages/ForbiddenPage.tsx:1', 'Static access-denied presentation.'),
    roleSource: unknown('frontend/src/routes/AppRouter.tsx:51', 'Reached after authorization denial, without its own role gate.'),
    operationSource: unknown('frontend/src/features/auth/pages/ForbiddenPage.tsx:1', 'No operational mutation.'),
    backendEnforcementSource: unknown('frontend/src/features/auth/pages/ForbiddenPage.tsx:1', 'No backend endpoint is owned by this page.'),
  },
  {
    routeKey: 'MEAL_ORDERS', page: 'CoordinationPage', ownerSource: 'frontend/src/features/coordination/pages/CoordinationPage.tsx',
    classification: 'object-family', families: ['CoordinationOrderScopeLifecycle'],
    stateSource: source('importable', 'frontend/src/features/coordination/coordinationStatus.ts:14-103'),
    roleSource: source('literal-guarded', 'frontend/src/features/coordination/components/action-toolbar.tsx:389-439'),
    operationSource: source('literal-guarded', 'frontend/src/features/coordination/components/action-toolbar.tsx:136-147'),
    backendEnforcementSource: source('literal-guarded', 'backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationOrdersController.cs:13-229'),
  },
  {
    routeKey: 'PURCHASING', page: 'PurchasingPage', ownerSource: 'frontend/src/features/purchasing/pages/PurchasingPage.tsx',
    classification: 'object-family', families: ['PurchasingWorkflow'],
    stateSource: source('importable', 'frontend/src/features/purchasing/purchasingModel.ts:18-245'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:59'),
    operationSource: source('literal-guarded', 'frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:130-500'),
    backendEnforcementSource: unknown('frontend/src/features/purchasing/PurchaseDecisionPanel.tsx:149', 'Frontend mutations do not expose endpoint policy metadata.'),
  },
  {
    routeKey: 'REPORTS', page: 'ReportsPage', ownerSource: 'frontend/src/features/reports/pages/ReportsPage.tsx',
    classification: 'query-only', families: ['Reports'], reason: 'Report filters and exports are query projections, not an entity lifecycle.',
    stateSource: unknown('frontend/src/features/reports/pages/ReportsPage.tsx:1', 'Query/view state only.'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:55'),
    operationSource: unknown('frontend/src/features/reports/pages/ReportsPage.tsx:1', 'No importable business lifecycle operation model.'),
    backendEnforcementSource: unknown('frontend/src/features/reports/pages/ReportsPage.tsx:1', 'Report endpoints use endpoint-specific policies.'),
  },
  {
    routeKey: 'WAREHOUSE', page: 'WarehousePage', ownerSource: 'frontend/src/features/warehouse/pages/WarehousePage.tsx',
    classification: 'object-family', families: ['WarehouseFulfilment', 'WarehousePurchaseReceipt'],
    stateSource: source('literal-guarded', 'frontend/src/features/warehouse/pages/WarehousePage.tsx:42-350'),
    roleSource: source('literal-guarded', 'frontend/src/features/warehouse/pages/WarehousePage.tsx:61-63'),
    operationSource: source('literal-guarded', 'frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx:62-173'),
    backendEnforcementSource: unknown('frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx:44', 'Workbench mutations do not expose backend policy metadata.'),
  },
  {
    routeKey: 'WEEKLY_MENU', page: 'WeeklyMenuPage', ownerSource: 'frontend/src/features/projects/pages/WeeklyMenuPage.tsx',
    classification: 'object-family', families: ['WeeklyMenuLifecycle', 'MaterialDemand'],
    stateSource: source('importable', 'frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecycleModel.ts:34-128'),
    roleSource: source('literal-guarded', 'frontend/src/routes/AppRouter.tsx:54'),
    operationSource: source('importable', 'frontend/src/features/projects/weekly-menu/demand/demandModel.ts:17-31'),
    backendEnforcementSource: source('literal-guarded', 'backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:15-60'),
  },
] satisfies ProtectedOperationalFamily[]).sort((left, right) => left.routeKey.localeCompare(right.routeKey))

const discoveredRoutes = discoverProtectedRouteOwners(appRouterSource, routeLoadersSource)

describe('protected operational family registry', () => {
  it('discovers every protected route owner from AppRouter and routeLoaders', () => {
    expect(() => assertInventoryMatchesRoutes(discoveredRoutes, protectedOperationalFamilies)).not.toThrow()
    expect(protectedOperationalFamilies.flatMap((item) => item.families)).toEqual(expect.arrayContaining([
      'WeeklyMenuLifecycle',
      'MaterialDemand',
      'CoordinationOrderScopeLifecycle',
      'PurchasingWorkflow',
      'ApprovalDocument',
      'WarehouseFulfilment',
      'WarehousePurchaseReceipt',
      'ProductionPlan',
      'Reports',
      'AdminData',
    ]))
  })

  it('rejects a duplicate discovered route without editing source', () => {
    expect(() => assertInventoryMatchesRoutes([...discoveredRoutes, discoveredRoutes[0]], protectedOperationalFamilies))
      .toThrow('Duplicate discovered route')
  })

  it('rejects a removed classification without editing source', () => {
    expect(() => assertInventoryMatchesRoutes(discoveredRoutes, protectedOperationalFamilies.slice(1)))
      .toThrow('Missing route classification')
  })

  it.each(['stateSource', 'roleSource', 'operationSource'] as const)('rejects an independently missing %s', (dimension) => {
    const [first, ...rest] = protectedOperationalFamilies
    const invalid = [{ ...first, [dimension]: { ...first[dimension], source: '' } }, ...rest]
    expect(() => assertInventoryMatchesRoutes(discoveredRoutes, invalid)).toThrow(`invalid ${dimension} source`)
  })

  it('proves production source does not import Phase 19 registry modules', () => {
    const productionSources = import.meta.glob(['../**/*.ts', '../**/*.tsx'], {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>
    const testOwnedNames = [
      'stateActionRegistryContract',
      'protectedOperationalFamilyRegistry',
      'coordinationOrderScopeLifecycleRegistry',
    ]
    const imports = Object.entries(productionSources)
      .filter(([file]) => !file.includes('.test.') && !file.includes('.spec.'))
      .filter(([, sourceText]) => testOwnedNames.some((name) => sourceText.includes(name)))
    expect(imports).toEqual([])
  })
})
