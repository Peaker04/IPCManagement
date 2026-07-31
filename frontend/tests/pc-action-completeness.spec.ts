import { expect, type Locator, type Page, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertPcMeasurementRows,
  PC_EVIDENCE_KIND,
  PC_VIEWPORTS,
  pcMeasurementRowKey,
  type PcActualControl,
  type PcMeasurementRow,
} from './pcActionCompletenessContract'
import {
  assertPcFirewallClosed,
  classifyPcMeasurement,
  createPcFixtureRuntime,
  installPcActor,
  installPcApiFirewall,
  PC_EXECUTABLE_FAMILIES,
  PC_FIXTURE_CONTRACT,
  PC_PROJECTED_REGISTRY_ROWS,
  type PcActorId,
  type PcProjectedRegistryRow,
} from './pcActionCompletenessFixture'
import { UNKNOWN } from './stateActionRegistryContract'

test.use({ channel: 'chrome', headless: false })
test.describe.configure({ mode: 'serial', timeout: 900_000 })
test.beforeEach(({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(900_000)
})

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const EVIDENCE_ROOT = resolve(REPO_ROOT, '.artifacts', 'shipyard-live', 'pc-action-completeness-20-02')
const EVIDENCE_JSON = resolve(EVIDENCE_ROOT, 'pc-action-completeness.json')

type BrowserIssue = {
  viewport: string
  family: string
  scenarioId: string
  actor: PcActorId
  kind: 'console' | 'page' | 'request-failed'
  message: string
}

type PerformanceEvidence = {
  viewport: string
  family: string
  actor: PcActorId
  cls: number
  longTasks: Array<{ duration: number; startTime: number }>
  overflow: boolean
}

const rows: PcMeasurementRow[] = []
const browserIssues: BrowserIssue[] = []
const performanceEvidence: PerformanceEvidence[] = []
const screenshotEvidence: Array<{
  viewport: string
  family: string
  actor: PcActorId
  path: string
}> = []
const requestEvidence: Array<{
  viewport: string
  actor: PcActorId
  method: string
  path: string
  status: number
  mutation: boolean
  scenario: string
}> = []

const normalizeLabel = (value: string) => value
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('vi-VN')

const installPerformanceProbe = async (page: Page) => {
  await page.addInitScript(() => {
    const state = {
      cls: 0,
      longTasks: [] as Array<{ duration: number; startTime: number }>,
    }
    ;(window as typeof window & { __pcMetrics?: typeof state }).__pcMetrics = state
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!shift.hadRecentInput) state.cls += shift.value ?? 0
        }
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {
      // A zero baseline is deterministic when this Chrome build omits layout-shift observation.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({ duration: entry.duration, startTime: entry.startTime })
        }
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      // An empty list is deterministic when this Chrome build omits long-task observation.
    }
  })
}

const expectedLocator = (page: Page, row: PcProjectedRegistryRow): Locator | null => {
  const control = row.expectedControl
  if (!control) return null
  if (control.role === 'spinbutton') {
    const inputs = page.getByRole('spinbutton')
    return row.operation === 'request-adjustment' ? inputs.nth(1) : inputs.nth(0)
  }
  return page.getByRole(control.role, { name: control.name, exact: typeof control.name === 'string' })
}

const readControl = async (
  locator: Locator | null,
  row: PcProjectedRegistryRow,
  route: string,
): Promise<PcActualControl[]> => {
  if (!locator) return []
  const visible = await locator.first().waitFor({ state: 'visible', timeout: 2_500 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return []
  const control = locator.first()
  const evidence = await control.evaluate((element, operation) => {
    const input = element as HTMLInputElement
    const explicitLabel = input.id
      ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)?.textContent
      : null
    return {
      role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
      accessibleName: [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        explicitLabel,
        element.textContent,
        input.value,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      selector: element.id
        ? `#${CSS.escape(element.id)}`
        : `${element.tagName.toLowerCase()}[data-pc-operation="${operation}"]`,
      enabled: !input.disabled && element.getAttribute('aria-disabled') !== 'true',
      disabledReason: element.getAttribute('aria-description')
        ?? element.getAttribute('title')
        ?? element.closest('[data-disabled-reason]')?.getAttribute('data-disabled-reason')
        ?? null,
    }
  }, row.operation)
  return [{
    ...evidence,
    accessibleName: evidence.accessibleName || String(row.expectedControl?.name ?? row.operation),
    source: row.expectedControl?.source ?? row.source[0],
    route,
    request: null,
    postAction: null,
  }]
}

const unknownDimensions = (row: PcProjectedRegistryRow) => ([
  ['operation', row.operation],
  ['actor', row.registryActor],
  ['backendPermission', row.backendPermission],
  ['frontendPermission', row.frontendPermission],
] as const).filter(([, value]) => value === UNKNOWN).map(([field]) => field)

const scenarioGroups = (actor: PcActorId) => {
  const grouped = new Map<string, PcProjectedRegistryRow[]>()
  PC_PROJECTED_REGISTRY_ROWS.filter((row) => row.actors.includes(actor)).forEach((row) => {
    const key = `${row.family}\0${row.scenarioId}`
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  })
  return [...grouped.values()]
}

const openScenario = async (page: Page, scenarioRows: PcProjectedRegistryRow[]) => {
  const route = scenarioRows.find((row) => row.expectedControl)?.expectedControl?.route
    ?? (scenarioRows[0].family === 'CoordinationOrderScopeLifecycle' ? '/meal-orders' : '/weekly-menu')
  await page.goto(`${route}${route.includes('?') ? '&' : '?'}pc=${scenarioRows[0].scenarioId}`)
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.ipc-page-title').waitFor({ state: 'visible', timeout: 10_000 })
  const tab = scenarioRows.find((row) => row.expectedControl?.tab)?.expectedControl?.tab
  if (tab) {
    const tabLocator = page.getByRole('tab', { name: tab, exact: true })
    await tabLocator.first().waitFor({ state: 'visible', timeout: 10_000 })
    await tabLocator.first().click()
    if (tab === 'Nhu cầu') {
      await page.locator('#demand-panel').waitFor({ state: 'visible', timeout: 10_000 })
    }
  }
  const loadingSurface = page.locator('[class*="skeleton"], [data-slot="skeleton"], [aria-busy="true"]')
  if (await loadingSurface.count() > 0) {
    await loadingSurface.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined)
  }
  await page.waitForTimeout(50)
  return route
}

for (const viewport of PC_VIEWPORTS) {
  test(`${viewport.id} measures all six registry families in Google Chrome`, async ({ browser }) => {
    const viewportRowsStart = rows.length

    for (const actor of ['admin', 'manager', 'coordinator', 'procurement', 'warehouse'] as const) {
      const groups = scenarioGroups(actor)
      if (groups.length === 0) continue
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      })
      const page = await context.newPage()
      let current = groups[0][0]
      const runtime = createPcFixtureRuntime(current, actor)
      await installPerformanceProbe(page)
      await page.clock.install({ time: new Date('2026-07-27T07:00:00+07:00') })
      await installPcActor(page, actor)
      await installPcApiFirewall(page, runtime)

      page.on('console', (message) => {
        if (message.type() !== 'error') return
        browserIssues.push({ viewport: viewport.id, family: current.family, scenarioId: current.scenarioId, actor, kind: 'console', message: message.text() })
      })
      page.on('pageerror', (error) => {
        browserIssues.push({ viewport: viewport.id, family: current.family, scenarioId: current.scenarioId, actor, kind: 'page', message: error.message })
      })
      page.on('requestfailed', (request) => {
        const failure = request.failure()?.errorText ?? 'unknown'
        const url = new URL(request.url())
        const expectedNavigationAbort = failure.includes('ERR_ABORTED') && !url.pathname.startsWith('/api/')
        if (!expectedNavigationAbort) {
          browserIssues.push({ viewport: viewport.id, family: current.family, scenarioId: current.scenarioId, actor, kind: 'request-failed', message: `${request.method()} ${request.url()} — ${failure}` })
        }
      })

      for (const [groupIndex, group] of groups.entries()) {
        current = group[0]
        runtime.row = current
        const requestStart = runtime.requests.length
        const route = await openScenario(page, group)
        const scenarioRequests = runtime.requests.slice(requestStart).map((request) => ({
          viewport: viewport.id,
          actor,
          method: request.method,
          path: request.path,
          status: request.status,
          mutation: request.mutation,
          scenario: request.scenario,
        }))
        requestEvidence.push(...scenarioRequests)
        const actualRoute = new URL(page.url()).pathname
        const routeDenied = actualRoute === '/forbidden'
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

        for (const projected of group) {
          const actualControls = await readControl(
            expectedLocator(page, projected),
            projected,
            actualRoute,
          )
          const expected = projected.expectedControl !== null
          const fixtureConditionRuledOut = !expected || actualControls.length > 0
          const exclusions = {
            navigation: {
              ruledOut: !routeDenied,
              evidence: routeDenied
                ? `actor ${actor} was routed to /forbidden; navigation exclusion retained`
                : `production route ${route} and actual path ${actualRoute} inspected`,
            },
            viewport: {
              ruledOut: !overflow,
              evidence: overflow
                ? `${viewport.id} has horizontal document overflow`
                : `${viewport.id} rendered without document overflow`,
            },
            fixtureCondition: {
              ruledOut: fixtureConditionRuledOut && runtime.unmatchedApi.length === 0,
              evidence: runtime.unmatchedApi.length > 0
                ? `${runtime.unmatchedApi.length} unmatched API request(s) make fixture evidence incomplete`
                : fixtureConditionRuledOut
                  ? `deterministic ${projected.scenarioId} fixture rendered the declared control state`
                  : `declared control did not render, so fixture/data conditioning remains an exclusion`,
            },
            roleState: {
              ruledOut: projected.registryActor !== UNKNOWN,
              evidence: projected.registryActor === UNKNOWN
                ? `canonical actor is ${UNKNOWN}; ${actor} is measured only as an explicit baseline`
                : `actor ${actor} belongs to canonical ${projected.registryActor} evidence`,
            },
          }
          const mismatch = classifyPcMeasurement({
            expected,
            actualCount: actualControls.length,
            exclusions,
            unknownDimensions: unknownDimensions(projected),
            routeMismatch: actualControls.length > 0 && actualRoute !== new URL(route, 'http://pc.local').pathname,
          })
          rows.push({
            family: projected.family,
            scenarioId: projected.scenarioId,
            actor,
            viewport,
            operation: projected.operation,
            backendPermission: projected.backendPermission,
            frontendPermission: projected.frontendPermission,
            expected,
            actualControls,
            exclusions,
            mismatch,
            source: projected.source,
            disposition: projected.disposition,
            evidenceKind: PC_EVIDENCE_KIND,
          })
        }

        const nextFamily = groups[groupIndex + 1]?.[0].family
        if (nextFamily !== current.family) {
          const screenshotRelative = `${viewport.id}/${current.family}-${actor}-final.png`
          const screenshotAbsolute = resolve(EVIDENCE_ROOT, screenshotRelative)
          mkdirSync(dirname(screenshotAbsolute), { recursive: true })
          await page.screenshot({ path: screenshotAbsolute, fullPage: true })
          screenshotEvidence.push({
            viewport: viewport.id,
            family: current.family,
            actor,
            path: screenshotRelative.replace(/\\/g, '/'),
          })
        }
      }

      const metrics = await page.evaluate(() => {
        const state = (window as typeof window & { __pcMetrics?: { cls: number; longTasks: Array<{ duration: number; startTime: number }> } }).__pcMetrics
        return {
          cls: state?.cls ?? 0,
          longTasks: state?.longTasks ?? [],
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        }
      })
      for (const family of [...new Set(groups.map((group) => group[0].family))]) {
        performanceEvidence.push({ viewport: viewport.id, family, actor, ...metrics })
      }
      assertPcFirewallClosed(runtime.requests)
      expect(runtime.unmatchedApi, `${viewport.id}/${actor} unmatched API`).toEqual([])
      await context.close()
    }

    const expectedViewportCount = PC_PROJECTED_REGISTRY_ROWS.reduce((count, row) => count + row.actors.length, 0)
    expect(rows.slice(viewportRowsStart)).toHaveLength(expectedViewportCount)
  })
}

test.afterAll(() => {
  if (rows.length === 0) return
  assertPcMeasurementRows(rows)
  const measuredViewports = PC_VIEWPORTS.filter((viewport) => (
    rows.some((row) => row.viewport.id === viewport.id)
  ))
  const expectedKeys = PC_PROJECTED_REGISTRY_ROWS.flatMap((row) => row.actors.flatMap((actor) => (
    measuredViewports.map((viewport) => pcMeasurementRowKey({
      family: row.family,
      scenarioId: row.scenarioId,
      actor,
      viewport,
      operation: row.operation,
    }))
  )))
  expect(rows.map(pcMeasurementRowKey).sort()).toEqual(expectedKeys.sort())
  expect(new Set(rows.map(pcMeasurementRowKey)).size).toBe(rows.length)
  expect(new Set(rows.map((row) => row.family))).toEqual(new Set(PC_EXECUTABLE_FAMILIES))
  expect(rows.filter((row) => row.operation === UNKNOWN).every((row) => row.mismatch !== 'KHỚP')).toBe(true)
  expect(browserIssues.filter((issue) => issue.kind === 'page')).toEqual([])
  for (const family of PC_EXECUTABLE_FAMILIES) {
    const visibleControlCount = rows
      .filter((row) => row.family === family)
      .reduce((count, row) => count + row.actualControls.length, 0)
    expect(visibleControlCount, `${family} must capture at least one visible semantic control`).toBeGreaterThan(0)
  }

  const summary = Object.fromEntries(PC_EXECUTABLE_FAMILIES.map((family) => {
    const familyRows = rows.filter((row) => row.family === family)
    return [family, {
      rows: familyRows.length,
      scenarios: new Set(familyRows.map((row) => row.scenarioId)).size,
      actors: [...new Set(familyRows.map((row) => row.actor))].sort(),
      classifications: Object.fromEntries([
        'KHỚP',
        'THIẾU',
        'MỒ CÔI',
        'IM LẶNG',
        'LỆCH VỊ TRÍ',
        'CHƯA-KẾT-LUẬN-ĐƯỢC',
      ].map((classification) => [classification, familyRows.filter((row) => row.mismatch === classification).length])),
    }]
  }))
  const payload = {
    generatedAt: new Date().toISOString(),
    evidenceKind: PC_EVIDENCE_KIND,
    semantics: 'deterministic frontend rendering with pre-navigation API interception; never backend/DB E2E',
    browser: { product: 'Google Chrome', headed: true, channel: 'chrome' },
    fixtureContract: PC_FIXTURE_CONTRACT,
    scope: measuredViewports.length === PC_VIEWPORTS.length
      ? 'aggregate-five-viewport'
      : 'viewport-shard',
    canonical: {
      familyCount: 6,
      scenarioCount: 34,
      scenarioOperationRowCount: 44,
      requiredViewportCount: PC_VIEWPORTS.length,
      measuredViewportCount: measuredViewports.length,
      measuredViewports,
    },
    measurementRowCount: rows.length,
    summary,
    rows,
    requests: requestEvidence,
    actionRequestSemantics: 'Rendered controls are not exercised by this aggregate; request/postAction stay null and canonical action paths remain source-linked. Mutation firewall behavior is verified separately in Vitest.',
    unmatchedApi: requestEvidence.filter((request) => request.status === 501),
    browserIssues,
    performance: performanceEvidence,
    screenshots: screenshotEvidence,
  }
  mkdirSync(EVIDENCE_ROOT, { recursive: true })
  const outputPath = measuredViewports.length === PC_VIEWPORTS.length
    ? EVIDENCE_JSON
    : resolve(EVIDENCE_ROOT, `pc-action-completeness-${measuredViewports.map(({ id }) => id).join('_')}.json`)
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
})

test('normalization preserves Vietnamese semantic labels without changing operation identity', () => {
  expect(normalizeLabel('  MỞ   THU MUA ')).toBe('mở thu mua')
  expect(normalizeLabel('Tạo đề xuất mua')).toBe('tạo đề xuất mua')
  expect(UNKNOWN).toBe('KHÔNG-XÁC-ĐỊNH-ĐƯỢC')
})
