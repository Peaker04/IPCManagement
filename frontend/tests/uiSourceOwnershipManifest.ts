import {
  buildUiFloorplanScopeKey,
  uiFloorplanScopeRegistry,
  type UiFloorplanScopeKey,
} from './uiFloorplanScopeRegistry'

export type UiOpaqueOwnerId = string & { readonly __uiOpaqueOwnerId: unique symbol }
export type UiOpaqueRegionId = string & { readonly __uiOpaqueRegionId: unique symbol }

export type UiSourceFragmentLocator =
  | { kind: 'jsx-tag'; tagName: string }
  | { kind: 'jsx-string-attribute'; tagName: string; attributeName: string; value: string }
  | { kind: 'call'; owner: string; member: string }
  | { kind: 'identifier'; value: string }

export type UiSourceOwnershipTarget = {
  scopeKey: UiFloorplanScopeKey
  ownerId: UiOpaqueOwnerId
  regionId: UiOpaqueRegionId
  parentRegionId: UiOpaqueRegionId | null
}

export type UiSourceFragmentLocatorEntry = UiSourceFragmentLocator

export type UiSourceOwnershipManifestEntry = UiSourceOwnershipTarget & {
  sourceFile: string
  sourceSymbol: string
  sourceFragment: UiSourceFragmentLocatorEntry
}

export type UiSourceOwnershipKey = string & { readonly __uiSourceOwnershipKey: unique symbol }

export const buildUiSourceOwnershipKey = (
  entry: Pick<UiSourceOwnershipTarget, 'scopeKey' | 'ownerId' | 'regionId'>,
): UiSourceOwnershipKey => JSON.stringify([entry.scopeKey, entry.ownerId, entry.regionId]) as UiSourceOwnershipKey

const pageOwnerByRoute: Partial<Record<keyof typeof import('../src/lib/routeConfig').ROUTES, { file: string; symbol: string }>> = {
  LOGIN: { file: 'src/features/auth/pages/LoginPage.tsx', symbol: 'LoginPage' },
  FORBIDDEN: { file: 'src/features/auth/pages/ForbiddenPage.tsx', symbol: 'ForbiddenPage' },
  DASHBOARD: { file: 'src/features/dashboard/pages/DashboardPage.tsx', symbol: 'DashboardPage' },
  WEEKLY_MENU: { file: 'src/features/projects/pages/WeeklyMenuPage.tsx', symbol: 'WeeklyMenuPage' },
  REPORTS: { file: 'src/features/reports/pages/ReportsPage.tsx', symbol: 'ReportsPage' },
  MEAL_ORDERS: { file: 'src/features/coordination/pages/CoordinationPage.tsx', symbol: 'CoordinationPage' },
  CHEF_DASHBOARD: { file: 'src/features/chef/pages/ChefDashboardPage.tsx', symbol: 'ChefDashboardPage' },
  APPROVALS: { file: 'src/features/approvals/pages/ApprovalPage.tsx', symbol: 'ApprovalPage' },
  PURCHASING: { file: 'src/features/purchasing/pages/PurchasingPage.tsx', symbol: 'PurchasingPage' },
  WAREHOUSE: { file: 'src/features/warehouse/pages/WarehousePage.tsx', symbol: 'WarehousePage' },
  ADMIN_DATA: { file: 'src/app/pages/AdminDataPage.tsx', symbol: 'AdminDataPage' },
  APPROVAL_RULES: { file: 'src/features/admin/pages/ApprovalRulesPage.tsx', symbol: 'ApprovalRulesPage' },
  ADVANCED_SETTINGS: { file: 'src/features/admin/pages/AdvancedDisplaySettingsPage.tsx', symbol: 'AdvancedDisplaySettingsPage' },
}

const ownerId = (index: number) => `uio-${index.toString(36)}` as UiOpaqueOwnerId
const regionId = (index: number) => `uir-${index.toString(36)}` as UiOpaqueRegionId

export const uiSourceOwnershipTargets: readonly UiSourceOwnershipTarget[] = uiFloorplanScopeRegistry.map((entry, index) => ({
  scopeKey: buildUiFloorplanScopeKey(entry),
  ownerId: ownerId(index),
  regionId: regionId(index),
  parentRegionId: null,
}))

export const uiSourceOwnershipManifest: readonly UiSourceOwnershipManifestEntry[] = uiFloorplanScopeRegistry.map((entry, index) => {
  const owner = pageOwnerByRoute[entry.routeKey]
  if (!owner) throw new Error(`Missing source owner for ${entry.routeKey}`)
  return {
    ...uiSourceOwnershipTargets[index],
    sourceFile: owner.file,
    sourceSymbol: owner.symbol,
    sourceFragment: { kind: 'identifier', value: owner.symbol },
  }
})

export type UiSourceOwnershipDiagnostics = {
  missing: UiSourceOwnershipKey[]
  duplicates: UiSourceOwnershipKey[]
  orphans: UiSourceOwnershipKey[]
  stale: UiSourceOwnershipKey[]
}

const sortedUnique = (items: readonly UiSourceOwnershipKey[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b))

export const compareUiSourceOwnershipSets = (
  targets: readonly UiSourceOwnershipTarget[],
  manifest: readonly UiSourceOwnershipManifestEntry[],
  scopeKeys: readonly UiFloorplanScopeKey[] = uiFloorplanScopeRegistry.map(buildUiFloorplanScopeKey),
  resolutions: ReadonlyMap<UiSourceOwnershipKey, boolean> = new Map(manifest.map((entry) => [buildUiSourceOwnershipKey(entry), true])),
): UiSourceOwnershipDiagnostics => {
  const targetKeys = targets.map(buildUiSourceOwnershipKey)
  const manifestKeys = manifest.map(buildUiSourceOwnershipKey)
  const targetSet = new Set(targetKeys)
  const manifestSet = new Set(manifestKeys)
  const scopes = new Set(scopeKeys)
  const duplicates = manifestKeys.filter((key, index) => manifestKeys.indexOf(key) !== index)
  const orphans = manifest.filter((entry) => !scopes.has(entry.scopeKey) || entry.parentRegionId !== null && !targets.some((target) => target.scopeKey === entry.scopeKey && target.ownerId === entry.ownerId && target.regionId === entry.parentRegionId)).map(buildUiSourceOwnershipKey)
  const stale = manifest.filter((entry) => !/^src\/[A-Za-z0-9_./-]+\.(?:ts|tsx)$/.test(entry.sourceFile) || !resolutions.get(buildUiSourceOwnershipKey(entry))).map(buildUiSourceOwnershipKey)
  return {
    missing: sortedUnique(targetKeys.filter((key) => !manifestSet.has(key))),
    duplicates: sortedUnique(duplicates),
    orphans: sortedUnique(orphans),
    stale: sortedUnique([...manifestKeys.filter((key) => !targetSet.has(key)), ...stale]),
  }
}
