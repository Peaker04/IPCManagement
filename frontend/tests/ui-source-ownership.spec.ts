import { expect, test, type Locator, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { buildManifestPathVariants, scanTextForSourcePathLeaks } from './uiSourceOwnershipLeakage.test'
import { login } from './support/route-smoke/auth'

type OwnershipTuple = { ownerId: string; floorplanId: string; regionId: string }
type UiFloorplanScopeEntry = {
  routeKey: string
  routePath: string
  surfaceKind: 'route' | 'tab' | 'nested-view'
  surfaceId: string
  parentSurfaceId: string | null
  roleStateId: string
  dataStateId: string
}
type SourceManifestEntry = { scopeKey: string; ownerId: string; regionId: string; sourceFile: string; sourceSymbol: string; sourceFragment: { kind: string; value?: string } }
type BrowserContracts = { registry: UiFloorplanScopeEntry[]; floorplanScopeKeys: string[]; manifest: SourceManifestEntry[]; targets: Array<{ scopeKey: string; ownerId: string; regionId: string }> }

const buildUiFloorplanScopeKey = (entry: UiFloorplanScopeEntry) => JSON.stringify([
  entry.routeKey, entry.routePath, entry.surfaceKind, entry.surfaceId, entry.parentSurfaceId, entry.roleStateId, entry.dataStateId,
])

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1365x900', width: 1365, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
] as const

const viewSwitcherSource = fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/common/ViewSwitcher.tsx'), 'utf8')
const bindingPattern = /'([^']+)\\0([^']+)': \{ ownerId: '([^']+)', floorplanId: '([^']+)', regionId: '([^']+)' \}/g
const bindingBySurface = new Map([...viewSwitcherSource.matchAll(bindingPattern)].map((match) => [match[2], {
  ariaLabel: match[1],
  surfaceId: match[2],
  tuple: { ownerId: match[3], floorplanId: match[4], regionId: match[5] },
}]))

export const buildCanonicalRenderedStates = (contracts: BrowserContracts) => contracts.registry.map((entry, index) => ({
  entry,
  scopeKey: buildUiFloorplanScopeKey(entry),
  tuple: { ownerId: contracts.targets[index].ownerId, floorplanId: `uif-${index.toString(36)}`, regionId: contracts.targets[index].regionId },
  binding: entry.surfaceKind === 'route' ? null : bindingBySurface.get(entry.surfaceId),
}))

const loadBrowserContracts = async (server: ViteDevServer): Promise<BrowserContracts> => {
  const registryModule = await server.ssrLoadModule('/tests/uiFloorplanScopeRegistry.ts')
  const floorplanModule = await server.ssrLoadModule('/tests/uiFloorplanContracts.ts')
  const manifestModule = await server.ssrLoadModule('/tests/uiSourceOwnershipManifest.ts')
  return {
    registry: registryModule.uiFloorplanScopeRegistry,
    floorplanScopeKeys: floorplanModule.uiFloorplanContracts.map((contract: { scopeKey: string }) => contract.scopeKey),
    manifest: manifestModule.uiSourceOwnershipManifest,
    targets: manifestModule.uiSourceOwnershipTargets,
  }
}

const resolveNearestOwnershipTuple = async (locator: Locator): Promise<OwnershipTuple> => locator.evaluate((node) => {
  const names = ['owner', 'floorplan', 'region'] as const
  const result: Record<string, string> = {}
  for (const name of names) {
    let current: Element | null = node
    while (current && !current.hasAttribute(`data-ui-${name}`)) current = current.parentElement
    const value = current?.getAttribute(`data-ui-${name}`)
    if (!value) throw new Error(`Missing nearest data-ui-${name}`)
    result[`${name}Id`] = value
  }
  return result as OwnershipTuple
})

const expectTuple = async (locator: Locator, tuple: OwnershipTuple) => {
  await expect(locator).toHaveAttribute('data-ui-owner', tuple.ownerId)
  await expect(locator).toHaveAttribute('data-ui-floorplan', tuple.floorplanId)
  await expect(locator).toHaveAttribute('data-ui-region', tuple.regionId)
  expect(await resolveNearestOwnershipTuple(locator)).toEqual(tuple)
}

const assertSourceBlindDocument = async (page: Page, stateKey: string, manifest: readonly SourceManifestEntry[], scopeKeys: readonly string[]) => {
  const forbiddenMetadata = [
  ...manifest.flatMap((entry) => [
    entry.sourceFile,
    entry.sourceFile.replaceAll('/', '\\'),
    entry.sourceSymbol,
    entry.sourceFragment.kind === 'identifier' ? entry.sourceFragment.value : '',
  ]),
  ...scopeKeys,
  'uiSourceOwnershipManifest',
  'uiFloorplanScopeRegistry',
  'uiOwnershipInstrumentationContract',
  ]
  const html = await page.content()
  expect(scanTextForSourcePathLeaks(html, stateKey, buildManifestPathVariants(manifest))).toEqual([])
  for (const forbidden of forbiddenMetadata.filter(Boolean)) expect(html, `${stateKey} leaked ${forbidden}`).not.toContain(forbidden)
  const invalid = await page.locator('[data-ui-owner], [data-ui-floorplan], [data-ui-region]').evaluateAll((nodes) => nodes.flatMap((node) => {
    const values = [
      ['data-ui-owner', /^uio-[a-z0-9]+$/],
      ['data-ui-floorplan', /^uif-[a-z0-9]+$/],
      ['data-ui-region', /^uir-[a-z0-9]+$/],
    ] as const
    return values.flatMap(([name, pattern]) => {
      const value = node.getAttribute(name)
      return value !== null && !pattern.test(value) ? [`${name}=${value}`] : []
    })
  }))
  expect(invalid).toEqual([])
}

const activateSurface = async (page: Page, entry: UiFloorplanScopeEntry, registry: readonly UiFloorplanScopeEntry[]) => {
  const routeEntry = registry.find((candidate) => candidate.routeKey === entry.routeKey && candidate.surfaceKind === 'route')!
  if (entry.parentSurfaceId && entry.parentSurfaceId !== routeEntry.surfaceId) {
    const parent = registry.find((candidate) => candidate.routeKey === entry.routeKey && candidate.surfaceId === entry.parentSurfaceId)
    if (!parent) throw new Error(`Missing parent ${entry.parentSurfaceId} for ${entry.surfaceId}`)
    const parentTab = page.locator(`#${parent.surfaceId}-tab`)
    await expect(parentTab).toBeVisible()
    await parentTab.click()
  }
  const binding = bindingBySurface.get(entry.surfaceId)
  if (!binding) throw new Error(`Missing production binding for ${entry.surfaceId}`)
  const tab = page.locator(`#${entry.surfaceId}-tab`)
  await expect(tab).toBeVisible()
  await expect(tab).toHaveRole('tab')
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(tab.locator('xpath=..')).toHaveAttribute('aria-label', binding.ariaLabel)
  return tab
}

const stubOwnershipReads = async (page: Page) => {
  const success = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data }) })
  const emptyPage = { items: [], totalCount: 0, pageNumber: 1, pageSize: 8, totalPages: 0, hasPrev: false, hasNext: false }
  await page.route('**/api/dishes/catalog**', (route) => route.fulfill(success([])))
  await page.route('**/api/ingredients**', (route) => route.fulfill(success({ items: [] })))
  await page.route('**/api/coordination/customer-contracts**', (route) => route.fulfill(success([])))
  await page.route('**/api/workflow-reports/**', (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.includes('/data-quality')) return route.fulfill(success({
      generatedAt: '2026-08-02T00:00:00Z', totalIssues: 0, errorCount: 0, warningCount: 0,
      resolvedIssueCount: 0, reopenedIssueCount: 0, urgentIssueCount: 0, missingBomCount: 0,
      invalidUnitCount: 0, missingConversionCount: 0, negativeStockCount: 0, orphanDocumentCount: 0,
      issues: [], page: emptyPage,
    }))
    return route.fulfill(success(pathname.endsWith('/page') ? emptyPage : []))
  })
}

test.describe('Phase 26 canonical source ownership', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })
  let contractServer: ViteDevServer
  let contracts: BrowserContracts

  test.beforeAll(async () => {
    contractServer = await createServer({
      root: path.resolve(import.meta.dirname, '..'),
      configFile: path.resolve(import.meta.dirname, '../vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
      plugins: [{
        name: 'phase-26-contract-loader',
        enforce: 'pre',
        resolveId(id) { return id === 'vitest' ? '\0phase-26-vitest-noop' : null },
        load(id) { return id === '\0phase-26-vitest-noop' ? 'export const describe=()=>{}; export const it=()=>{}; export const expect=()=>{}' : null },
        transform(code, id) {
          return id.replaceAll('\\', '/').endsWith('/src/routes/protectedOperationalFamilyRegistry.test.ts')
            ? code.replace("import { describe, expect, it } from 'vitest'", 'const describe=()=>{}; const it=()=>{}; const expect=()=>{}')
            : null
        },
      }],
    })
    contracts = await loadBrowserContracts(contractServer)
  })

  test.afterAll(async () => contractServer?.close())

  for (const viewport of viewports) {
    test(`joins every canonical rendered state at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.route(/^https?:\/\/[^/]+\/api\//, (route) => route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Read-only source ownership fixture' }),
      }))
      await stubOwnershipReads(page)

      const states = buildCanonicalRenderedStates(contracts)
      expect(states).toHaveLength(contracts.registry.length)
      expect(contracts.floorplanScopeKeys).toEqual(states.map((state) => state.scopeKey))
      expect(states.filter((state) => state.entry.surfaceKind !== 'route' && !state.binding)).toEqual([])

      const loginState = states.find((state) => state.entry.routeKey === 'LOGIN' && state.entry.surfaceKind === 'route')!
      await page.goto(loginState.entry.routePath)
      await expectTuple(page.locator('.ipc-auth-shell'), loginState.tuple)
      await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible()
      await assertSourceBlindDocument(page, loginState.scopeKey, contracts.manifest, states.map((state) => state.scopeKey))

      await login(page)
      const visited = new Set<string>([loginState.scopeKey])
      for (const routeState of states.filter((state) => state.entry.surfaceKind === 'route' && state.entry.routeKey !== 'LOGIN')) {
        await page.goto(routeState.entry.routePath)
        await expect(page).toHaveURL(new RegExp(`${routeState.entry.routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?.*)?$`))
        const routeRoot = routeState.entry.routeKey === 'FORBIDDEN'
          ? page.locator(`[data-ui-owner="${routeState.tuple.ownerId}"][data-ui-floorplan="${routeState.tuple.floorplanId}"][data-ui-region="${routeState.tuple.regionId}"]`).last()
          : page.locator('#ipc-main-content')
        await expectTuple(routeRoot, routeState.tuple)
        await assertSourceBlindDocument(page, routeState.scopeKey, contracts.manifest, states.map((state) => state.scopeKey))
        visited.add(routeState.scopeKey)

        const surfaces = states.filter((state) => state.entry.routeKey === routeState.entry.routeKey && state.entry.surfaceKind !== 'route')
        for (const state of surfaces) {
          const tab = await activateSurface(page, state.entry, contracts.registry)
          await expectTuple(tab, state.tuple)
          await expectTuple(tab.locator('xpath=..'), state.tuple)
          expect(new URL(page.url()).pathname).toBe(routeState.entry.routePath)
          await assertSourceBlindDocument(page, state.scopeKey, contracts.manifest, states.map((candidate) => candidate.scopeKey))
          visited.add(state.scopeKey)
        }
      }
      expect([...visited].sort()).toEqual(states.map((state) => state.scopeKey).sort())
    })
  }

  test('rejects missing and conflicting nearest ownership components with exact diagnostics', async ({ page }) => {
    await page.setContent('<main data-ui-owner="uio-a"><section data-ui-floorplan="uif-a"><button id="target" data-ui-region="uir-a">Target</button></section></main>')
    await expect(resolveNearestOwnershipTuple(page.locator('#target'))).resolves.toEqual({ ownerId: 'uio-a', floorplanId: 'uif-a', regionId: 'uir-a' })
    await page.locator('main').evaluate((node) => node.removeAttribute('data-ui-owner'))
    await expect(resolveNearestOwnershipTuple(page.locator('#target'))).rejects.toThrow('Missing nearest data-ui-owner')
  })
})
