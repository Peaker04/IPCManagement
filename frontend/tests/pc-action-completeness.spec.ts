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
  getPcActionExpectation,
  PC_EXECUTABLE_FAMILIES,
  PC_FIXTURE_CONTRACT,
  PC_PROJECTED_REGISTRY_ROWS,
  type PcActorId,
  type PcProjectedRegistryRow,
} from './pcActionCompletenessFixture'
import { UNKNOWN } from './stateActionRegistryContract'
import {
  assertPcProjectionMatchesCanonical,
  PC_CANONICAL_ACTOR_ROW_COUNT,
  PC_CANONICAL_AGGREGATE_IDENTITY_COUNT,
  PC_CANONICAL_COVERAGE,
} from './pcActionCompletenessCanonicalCoverage'

test.use({ channel: 'chrome', headless: false })
test.describe.configure({ mode: 'serial', timeout: 900_000 })
test.beforeEach(({ browserName }, testInfo) => {
  void browserName
  testInfo.setTimeout(900_000)
})

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const EVIDENCE_ROOT = resolve(REPO_ROOT, '.artifacts', 'shipyard-live', process.env.PC_EVIDENCE_RUN ?? 'pc-action-completeness-20-02')
const EVIDENCE_JSON = resolve(EVIDENCE_ROOT, 'pc-action-completeness.json')
const TRACKED_AGGREGATE_JSON = resolve(REPO_ROOT, '.planning', 'phases', '20-pc-pd-action-completeness', '20-PC-AGGREGATE.json')

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
  scenarioId: string
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
  kind: 'family-final' | 'scenario-exclusion'
  scenarioId?: string
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
const collectorDiagnostics: string[] = []
const actualControlInventory: Array<{
  viewport: string
  family: string
  scenarioId: string
  actor: PcActorId
  role: string
  accessibleName: string
  operation: string | null
  route: string
}> = []

assertPcProjectionMatchesCanonical(PC_PROJECTED_REGISTRY_ROWS)

const normalizeLabel = (value: string) => value
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('vi-VN')

const expectedSurface = (row: PcProjectedRegistryRow) => {
  if (row.expectedControl?.tab === 'Nhu cầu') return 'demand-panel'
  if (row.family === 'CoordinationOrderScopeLifecycle' && row.expectedControl?.role === 'spinbutton') return 'Bảng điều phối đơn theo khách hàng'
  if (row.family === 'CoordinationOrderScopeLifecycle') return 'Thao tác điều phối'
  if (row.family === 'PurchasingWorkflow') return 'purchase-decision-panel'
  if (row.family === 'ApprovalDocument') return 'approval-queue-panel'
  if (row.family === 'WarehouseFulfilment') return 'warehouse-exceptions-panel'
  if (row.family === 'WeeklyMenuLifecycle' && row.expectedControl?.surface === 'admin-contracts') return 'admin-contracts'
  return 'command-bar'
}

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
  if (row.operation === 'update-forecast') return page.getByLabel(/^Suất dự kiến của /)
  if (row.operation === 'request-adjustment') return page.getByLabel(/^Suất thực tế của /)
  const surface = row.family === 'PurchasingWorkflow'
    ? page.locator('#purchase-decision-panel')
    : page
  return surface.getByRole(control.role, { name: control.name, exact: typeof control.name === 'string' })
}

const readControl = async (
  locator: Locator | null,
  row: PcProjectedRegistryRow,
  route: string,
  timeout: number,
): Promise<PcActualControl[]> => {
  if (!locator) return []
  await locator.first().waitFor({ state: 'attached', timeout }).catch(() => undefined)
  const visibleIndexes: number[] = []
  for (let index = 0; index < await locator.count(); index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) visibleIndexes.push(index)
  }
  if (visibleIndexes.length === 0) {
    collectorDiagnostics.push(`${row.family}/${row.scenarioId}: no visible ${String(row.expectedControl?.name)} candidate`)
    return []
  }
  return Promise.all(visibleIndexes.map(async (index) => {
    const control = locator.nth(index)
    const evidence = await control.evaluate((element) => {
    const input = element as HTMLInputElement
    const explicitLabel = input.id
      ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)?.textContent
      : null
    return {
      role: element.getAttribute('role')
        ?? (element instanceof HTMLAnchorElement
          ? 'link'
          : element instanceof HTMLButtonElement
            ? 'button'
            : element instanceof HTMLInputElement && element.type === 'number'
              ? 'spinbutton'
              : element.tagName.toLowerCase()),
      accessibleName: [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        explicitLabel,
        element.textContent,
        input.value,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
      selector: element.id ? `#${CSS.escape(element.id)}` : null,
      enabled: !input.disabled && element.getAttribute('aria-disabled') !== 'true',
      disabledReason: element.getAttribute('aria-description')
        ?? element.getAttribute('title')
        ?? element.closest('[data-disabled-reason]')?.getAttribute('data-disabled-reason')
        ?? null,
      surface: element.parentElement?.closest<HTMLElement>('#demand-panel, #purchase-decision-panel, #approval-queue-panel, #warehouse-exceptions-panel, [aria-label="Thao tác điều phối"], [aria-label="Bảng điều phối đơn theo khách hàng"]')?.getAttribute('aria-label')
        ?? element.parentElement?.closest<HTMLElement>('#demand-panel, #purchase-decision-panel, #approval-queue-panel, #warehouse-exceptions-panel')?.id
        ?? element.parentElement?.closest<HTMLElement>('[class*="command-bar"]')?.className
        ?? 'document-body',
    }
    })
    if (evidence.role !== row.expectedControl?.role) {
      collectorDiagnostics.push(`${row.family}/${row.scenarioId}: expected role ${row.expectedControl?.role}, observed ${evidence.role} for ${evidence.accessibleName}`)
    }
    if (row.operation !== UNKNOWN && typeof row.expectedControl?.name === 'string' && normalizeLabel(evidence.accessibleName) !== normalizeLabel(row.expectedControl.name)) {
      collectorDiagnostics.push(`${row.family}/${row.scenarioId}: normalized alias ${normalizeLabel(evidence.accessibleName)} does not map to ${row.operation}`)
    }
    return {
      ...evidence,
      selector: evidence.selector ?? (row.expectedControl?.role === 'spinbutton'
        ? `label=${String(row.expectedControl.name)}`
        : `role=${row.expectedControl?.role}[name=${String(row.expectedControl?.name)}]`),
      accessibleName: evidence.accessibleName || String(row.expectedControl?.name ?? row.operation),
      source: row.expectedControl?.source ?? row.source[0],
      route,
      surface: `${route}#${evidence.surface === 'document-body' ? expectedSurface(row) : evidence.surface}`,
      request: null,
      postAction: null,
    }
  }))
}

const unknownDimensions = (row: PcProjectedRegistryRow) => ([
  ['operation', row.operation],
  ['actor', row.registryActor],
  ['backendPermission', row.backendPermission],
  ['frontendPermission', row.frontendPermission],
] as const).filter(([, value]) => value === UNKNOWN).map(([field]) => field)

const requestPathMatches = (expected: string | undefined, actual: string) => {
  if (!expected) return false
  const pattern = expected.replace(/\{[^}]+\}/g, '[^/]+')
  return new RegExp(`^${pattern}$`).test(actual)
}

const waitForPostAction = async (page: Page, row: PcProjectedRegistryRow, postAction: string) => {
  if (postAction.startsWith('route=')) {
    const expectedPath = postAction.slice('route='.length)
    await expect.poll(() => {
      const observedPath = new URL(page.url()).pathname
      return observedPath === expectedPath
        || (row.family === 'PurchasingWorkflow' && observedPath === '/403')
    }, { timeout: 15_000 }).toBe(true)
    const observedPath = new URL(page.url()).pathname
    return observedPath === '/403'
      ? `route=/403 (target=${expectedPath} denied)`
      : `route=${expectedPath}`
  }
  if (postAction === 'input value changed') return 'input value changed'
  if (postAction.startsWith('text=')) {
    const expectedText = postAction.slice('text='.length)
    const candidates = page.getByText(expectedText, { exact: false })
    await expect.poll(async () => {
      for (let index = 0; index < await candidates.count(); index += 1) {
        if (await candidates.nth(index).isVisible().catch(() => false)) return true
      }
      return false
    }, { timeout: 10_000 }).toBe(true)
    return postAction
  }
  const separator = postAction.indexOf(':')
  const expectedText = separator >= 0 ? postAction.slice(separator + 1) : postAction
  const locator = separator >= 0 && postAction.startsWith('role=')
    ? page.locator(`[role="${postAction.slice('role='.length, separator)}"]`).filter({ hasText: expectedText })
    : page.getByText(expectedText, { exact: false })
  await locator.first().waitFor({ state: 'visible', timeout: 3_000 })
  return postAction
}

const exerciseProjectedAction = async (
  page: Page,
  row: PcProjectedRegistryRow,
  locator: Locator | null,
) => {
  const expectation = getPcActionExpectation(row)
  if (!expectation || !locator) return null

  if (expectation.kind === 'fill') {
    for (let index = 0; index < await locator.count(); index += 1) {
      const input = locator.nth(index)
      if (!await input.isVisible()) continue
      const before = await input.inputValue()
      await input.focus({ timeout: 3_000 })
      await input.fill(String(Number(before || '100') + 1), { timeout: 3_000 })
      await input.blur({ timeout: 3_000 })
    }
    await page.waitForTimeout(100)
    return expectation.postAction
  }

  if (!await locator.first().isEnabled()) return null
  await locator.first().click({ timeout: 3_000 })
  if (row.family === 'CoordinationOrderScopeLifecycle') {
    const confirmation = row.operation === 'lock-to-confirmed'
      ? 'Chốt cả ngày'
      : row.operation === 'signoff-to-completed'
        ? 'Hoàn tất ca'
        : row.operation === 'unlock-to-draft'
          ? 'Mở khóa ca'
          : 'Xuất báo cáo'
    await page.getByRole('dialog').getByRole('button', { name: confirmation, exact: true }).click({ timeout: 3_000 })
  } else if (row.family === 'PurchasingWorkflow' && ['demand', 'supplier-price', 'approved-order'].includes(row.scenarioId)) {
    await page.getByRole('dialog').getByRole('button').last().click({ timeout: 3_000 })
  }
  await page.waitForTimeout(100)
  return waitForPostAction(page, row, expectation.postAction)
}

const prepareProjectedAction = async (page: Page, row: PcProjectedRegistryRow) => {
  const purchasingPanel = page.locator('#purchase-decision-panel')
  if (row.family === 'PurchasingWorkflow' && row.scenarioId === 'demand') {
    await purchasingPanel.locator('#approved-demand-selection').selectOption({ index: 1 }, { timeout: 3_000 })
  }
  if (row.family === 'PurchasingWorkflow' && row.scenarioId === 'supplier-price') {
    await page.getByRole('button', { name: /^Xem (quyết định|bằng chứng)$/ }).first().click({ timeout: 3_000 })
    await purchasingPanel.locator('[aria-label^="Chọn "]').first().click({ timeout: 3_000 })
    await purchasingPanel.locator('input[type="date"]').first().fill('2026-07-27', { timeout: 3_000 })
  }
  if (row.family === 'WeeklyMenuLifecycle' && row.scenarioId === 'active-incomplete') {
    await page.locator('#demand-panel input[aria-label^="Số suất "]').first().fill('100', { timeout: 3_000 })
  }
}

const enumerateScenarioControls = async (
  page: Page,
  group: PcProjectedRegistryRow[],
  viewport: string,
  actor: PcActorId,
  route: string,
) => {
  const family = group[0].family
  const locator = family === 'CoordinationOrderScopeLifecycle'
    ? page.locator('[aria-label="Thao tác điều phối"] button, input[aria-label^="Suất dự kiến của"], input[aria-label^="Suất thực tế của"]')
    : family === 'MaterialDemand'
      ? page.locator('.ipc-demand-primary-actions button, .ipc-demand-primary-actions a[href]')
      : family === 'PurchasingWorkflow'
        ? page.locator('#purchase-decision-panel button, #purchase-decision-panel a[href]')
        : family === 'ApprovalDocument'
          ? page.locator('#approval-queue-panel button')
          : family === 'WeeklyMenuLifecycle'
            ? page.locator('#demand-panel button, #demand-panel a[href], .ipc-command-bar button, button:has-text("Publish")')
            : page.getByRole('button', { name: 'Tạo phiếu xuất kho', exact: true })
  const controls = await locator.evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element)
      const bounds = element.getBoundingClientRect()
      return style.visibility !== 'hidden' && style.display !== 'none' && bounds.width > 0 && bounds.height > 0
    })
    .map((element) => {
      const input = element as HTMLInputElement
      const role = element.getAttribute('role')
        ?? (element instanceof HTMLAnchorElement ? 'link' : element instanceof HTMLButtonElement ? 'button' : input.type === 'number' ? 'spinbutton' : element.tagName.toLowerCase())
      const accessibleName = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
        .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      return { role, accessibleName }
    }))
  const supportControl = (name: string) => (
    name.startsWith('Chọn ')
    || ['Ngày trước', 'Ngày sau', 'Chỉnh sửa thực đơn', 'Xuất báo cáo gửi kho', 'Chi tiết'].some((label) => name.includes(label))
  )
  controls.forEach((control) => {
    const projected = group.find((row) => {
      if (row.expectedControl?.role !== control.role) return false
      const alias = row.expectedControl.name
      return typeof alias === 'string'
        ? normalizeLabel(control.accessibleName) === normalizeLabel(alias)
        : alias.test(control.accessibleName)
    })
    actualControlInventory.push({
      viewport,
      family,
      scenarioId: group[0].scenarioId,
      actor,
      role: control.role,
      accessibleName: control.accessibleName,
      operation: projected?.operation ?? null,
      route,
    })
    if (!projected && !supportControl(control.accessibleName)) {
      collectorDiagnostics.push(`${family}/${group[0].scenarioId}: unmapped ${control.role} ${control.accessibleName}`)
    }
  })
}

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
  const scenarioQueryKey = scenarioRows[0].family === 'PurchasingWorkflow' ? 'stage' : 'pc'
  await page.goto(`${route}${route.includes('?') ? '&' : '?'}${scenarioQueryKey}=${scenarioRows[0].scenarioId}`)
  await page.waitForLoadState('domcontentloaded')
  const mainReady = await page.locator('main').first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)
  const titleReady = await page.locator('.ipc-page-title').first().isVisible().catch(() => false)
  const forbiddenReady = new URL(page.url()).pathname === '/forbidden'
  const tab = scenarioRows.find((row) => row.expectedControl?.tab)?.expectedControl?.tab
  if (tab) {
    const tabLocator = page.getByRole('tab', { name: tab, exact: true })
    await tabLocator.first().waitFor({ state: 'visible', timeout: 10_000 })
    await tabLocator.first().click()
    if (tab === 'Nhu cầu') {
      await page.locator('#demand-panel').waitFor({ state: 'visible', timeout: 10_000 })
    }
  }
  if (scenarioRows[0].family === 'MaterialDemand') {
    const statusByScenario: Record<string, string> = {
      'not-created': 'Chưa tạo',
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
      cancelled: 'Đã hủy',
    }
    const expectedStatus = statusByScenario[scenarioRows[0].scenarioId]
    if (expectedStatus) {
      await page.getByText(expectedStatus, { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
    }
  }
  const loadingSurface = page.locator('[class*="skeleton"], [data-slot="skeleton"], [aria-busy="true"]')
  if (await loadingSurface.count() > 0) {
    await loadingSurface.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined)
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
  await page.waitForTimeout(100)
  return { route, fixtureReady: forbiddenReady || titleReady || mainReady }
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
      for (const [groupIndex, group] of groups.entries()) {
        const scenario = group[0]
        const runtime = createPcFixtureRuntime(scenario, actor)
        const page = await context.newPage()
        await installPerformanceProbe(page)
        await page.clock.install({ time: new Date('2026-07-27T07:00:00+07:00') })
        await installPcActor(page, actor)
        await installPcApiFirewall(page, runtime)

        page.on('console', (message) => {
          if (message.type() !== 'error') return
          browserIssues.push({ viewport: viewport.id, family: scenario.family, scenarioId: scenario.scenarioId, actor, kind: 'console', message: message.text() })
        })
        page.on('pageerror', (error) => {
          browserIssues.push({ viewport: viewport.id, family: scenario.family, scenarioId: scenario.scenarioId, actor, kind: 'page', message: error.message })
        })
        page.on('requestfailed', (request) => {
          const failure = request.failure()?.errorText ?? 'unknown'
          const url = new URL(request.url())
          const expectedNavigationAbort = failure.includes('ERR_ABORTED') && !url.pathname.startsWith('/api/')
          if (!expectedNavigationAbort) {
            browserIssues.push({ viewport: viewport.id, family: scenario.family, scenarioId: scenario.scenarioId, actor, kind: 'request-failed', message: `${request.method()} ${request.url()} — ${failure}` })
          }
        })

        const groupRequestStart = runtime.requests.length
        const opened = await openScenario(page, group)
        const route = opened.route
        const actualRoute = new URL(page.url()).pathname
        const routeDenied = actualRoute === '/forbidden'
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
        await enumerateScenarioControls(page, group, viewport.id, actor, actualRoute)
        const groupRowStart = rows.length

        for (const projected of group) {
          const requestStart = runtime.requests.length
          const unmatchedStart = runtime.unmatchedApi.length
          const expected = projected.expectedControl !== null
            && (projected.expectedActors?.includes(actor) ?? true)
          if (expected && getPcActionExpectation(projected)) {
            await prepareProjectedAction(page, projected).catch((error: unknown) => {
              collectorDiagnostics.push(`${projected.family}/${projected.scenarioId}: action prerequisite failed — ${error instanceof Error ? error.message : String(error)}`)
            })
          }
          const locator = expectedLocator(page, projected)
          const observedControls = await readControl(
            locator,
            projected,
            actualRoute,
            expected ? 10_000 : 2_500,
          )
          const actionExpectation = getPcActionExpectation(projected)
          let postAction: string | null = null
          if (expected && observedControls.length > 0 && actionExpectation) {
            postAction = await exerciseProjectedAction(page, projected, locator).catch((error: unknown) => {
              collectorDiagnostics.push(`${projected.family}/${projected.scenarioId}: action exercise failed — ${error instanceof Error ? error.message : String(error)}`)
              return null
            })
          }
          const expectedRequest = expected
            && (actionExpectation?.kind === 'mutation' || actionExpectation?.kind === 'fill')
          const relevantRequests = runtime.requests.slice(requestStart).filter((request) => (
            expectedRequest && requestPathMatches(actionExpectation?.path, request.path)
          ))
          const actualControls = observedControls.map((control, controlIndex) => ({
            ...control,
            request: relevantRequests[controlIndex]
              ? { method: relevantRequests[controlIndex].method, path: relevantRequests[controlIndex].path, outcome: `intercepted ${relevantRequests[controlIndex].status}` }
              : null,
            postAction,
          }))
          const fixtureConditionRuledOut = runtime.unmatchedApi.slice(unmatchedStart).length === 0 && opened.fixtureReady
          const routeMismatch = actualControls.length > 0 && (
            actualRoute !== new URL(route, 'http://pc.local').pathname
            || actualControls.some((control) => control.surface !== `${actualRoute}#${expectedSurface(projected)}`)
          )
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
              ruledOut: fixtureConditionRuledOut,
              evidence: runtime.unmatchedApi.slice(unmatchedStart).length > 0
                ? `${runtime.unmatchedApi.slice(unmatchedStart).length} unmatched API request(s) make fixture evidence incomplete`
                : fixtureConditionRuledOut
                  ? `independent route/title/fixture readiness markers passed for ${projected.scenarioId}`
                  : 'route/title/fixture readiness marker did not settle independently of the target control',
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
            routeMismatch,
            requestExpected: Boolean(expectedRequest),
            requestObserved: relevantRequests.length > 0,
          })
          rows.push({
            family: projected.family,
            scenarioId: projected.scenarioId,
            actor,
            registryActor: projected.registryActor,
            viewport,
            operation: projected.operation,
            backendPermission: projected.backendPermission,
            frontendPermission: projected.frontendPermission,
            expected,
            actualControls,
            exclusions,
            routeMismatch,
            requestExpected: Boolean(expectedRequest),
            requestObserved: relevantRequests.length > 0,
            mismatch,
            source: projected.source,
            disposition: projected.disposition,
            evidenceKind: PC_EVIDENCE_KIND,
          })

          if (projected.family === 'CoordinationOrderScopeLifecycle'
            && actionExpectation?.kind === 'mutation'
            && group.indexOf(projected) < group.length - 1) {
            Object.keys(runtime.mutationState).forEach((key) => delete runtime.mutationState[key])
            await openScenario(page, group)
          }
        }

        requestEvidence.push(...runtime.requests.slice(groupRequestStart).map((request) => ({
          viewport: viewport.id,
          actor,
          method: request.method,
          path: request.path,
          status: request.status,
          mutation: request.mutation,
          scenario: request.scenario,
        })))

        const groupMeasurements = rows.slice(groupRowStart)
        const needsScenarioEvidence = groupMeasurements.some((measurement) => (
          (measurement.expected && measurement.actualControls.length === 0)
          || measurement.mismatch === 'CHƯA-KẾT-LUẬN-ĐƯỢC'
        ))
        if (needsScenarioEvidence) {
          const screenshotRelative = `${viewport.id}/${scenario.family}/${scenario.scenarioId}-${actor}-exclusion.png`
          const screenshotAbsolute = resolve(EVIDENCE_ROOT, screenshotRelative)
          mkdirSync(dirname(screenshotAbsolute), { recursive: true })
          await page.screenshot({ path: screenshotAbsolute, fullPage: true })
          screenshotEvidence.push({
            viewport: viewport.id,
            family: scenario.family,
            scenarioId: scenario.scenarioId,
            actor,
            kind: 'scenario-exclusion',
            path: screenshotRelative.replace(/\\/g, '/'),
          })
        }

        const nextFamily = groups[groupIndex + 1]?.[0].family
        if (nextFamily !== scenario.family) {
          const screenshotRelative = `${viewport.id}/${scenario.family}-${actor}-final.png`
          const screenshotAbsolute = resolve(EVIDENCE_ROOT, screenshotRelative)
          mkdirSync(dirname(screenshotAbsolute), { recursive: true })
          await page.screenshot({ path: screenshotAbsolute, fullPage: true })
          screenshotEvidence.push({
            viewport: viewport.id,
            family: scenario.family,
            actor,
            kind: 'family-final',
            path: screenshotRelative.replace(/\\/g, '/'),
          })
        }

        await page.waitForTimeout(50)
        const metrics = await page.evaluate(() => {
          const state = (window as typeof window & { __pcMetrics?: { cls: number; longTasks: Array<{ duration: number; startTime: number }> } }).__pcMetrics
          return {
            cls: state?.cls ?? 0,
            longTasks: state?.longTasks ?? [],
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          }
        })
        performanceEvidence.push({ viewport: viewport.id, family: scenario.family, scenarioId: scenario.scenarioId, actor, ...metrics })
        assertPcFirewallClosed(runtime.requests, runtime.observedServiceRequests)
        expect(runtime.unmatchedApi, `${viewport.id}/${actor}/${scenario.family}/${scenario.scenarioId} unmatched API`).toEqual([])
        await page.close()
      }
      await context.close()
    }

    expect(rows.slice(viewportRowsStart)).toHaveLength(PC_CANONICAL_ACTOR_ROW_COUNT)
  })
}

test.afterAll(() => {
  if (rows.length === 0) return
  assertPcMeasurementRows(rows)
  const measuredViewports = PC_VIEWPORTS.filter((viewport) => (
    rows.some((row) => row.viewport.id === viewport.id)
  ))
  const expectedKeys = PC_CANONICAL_COVERAGE.flatMap((row) => row.actors.flatMap((actor) => (
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
  if (measuredViewports.length === PC_VIEWPORTS.length) {
    expect(rows).toHaveLength(PC_CANONICAL_AGGREGATE_IDENTITY_COUNT)
  }
  const projectedRow = (row: PcMeasurementRow) => PC_PROJECTED_REGISTRY_ROWS.find((candidate) => (
    candidate.family === row.family
    && candidate.scenarioId === row.scenarioId
    && candidate.operation === row.operation
  ))
  expect(rows.filter((row) => row.operation === UNKNOWN).every((row) => row.mismatch !== 'KHỚP')).toBe(true)
  expect(browserIssues, 'console/page/request failures must block PC evidence').toEqual([])
  expect(collectorDiagnostics.filter((item) => item.includes('action exercise failed') || item.includes('action prerequisite failed') || item.includes('normalized alias'))).toEqual([])
  expect(performanceEvidence.filter((record) => record.overflow), 'every scenario must render without horizontal document overflow').toEqual([])
  expect(rows.filter((row) => !row.exclusions.viewport.ruledOut), 'row-level viewport exclusions must be resolved').toEqual([])
  expect(rows.filter((row) => {
    const projected = projectedRow(row)
    return row.expected
      && projected?.expectedControl?.role !== 'spinbutton'
      && unknownDimensions(projected!).length === 0
      && row.actualControls.length !== 1
  }).map((row) => `${row.family}/${row.scenarioId}/${row.actor}/${row.viewport.id}:${row.actualControls.length}`), 'known non-collection operations require exactly one rendered control').toEqual([])
  for (const family of PC_EXECUTABLE_FAMILIES) {
    const visibleControlCount = rows
      .filter((row) => row.family === family)
      .reduce((count, row) => count + row.actualControls.length, 0)
    expect(visibleControlCount, `${family} must capture at least one visible semantic control`).toBeGreaterThan(0)
  }
  const fullyResolvable = rows.filter((row) => (
    (row.family === 'MaterialDemand' && row.scenarioId !== 'terminal')
    || (row.family === 'PurchasingWorkflow' && ['submitted', 'receiving'].includes(row.scenarioId))
    || (row.family === 'WeeklyMenuLifecycle'
      && ['active-incomplete', 'active-shortage'].includes(row.scenarioId)
      && row.expected)
  ))
  expect(fullyResolvable.length).toBeGreaterThan(0)
  const missingResolvableControls = fullyResolvable
    .filter((row) => row.actualControls.length === 0)
    .map((row) => {
      const prefix = `${row.family}/${row.scenarioId}`
      const diagnostics = collectorDiagnostics.filter((item) => item.startsWith(prefix))
      return `${prefix}/${row.actor}/${row.viewport.id}${diagnostics.length > 0 ? ` — ${diagnostics.join(' | ')}` : ''}`
    })
  expect(
    missingResolvableControls,
    'resolvable MaterialDemand, Purchasing navigation, and WeeklyMenu controls must render for every frontend-expected actor/viewport',
  ).toEqual([])

  const canonicalDimensionsKnown = (row: PcMeasurementRow) => {
    const projected = projectedRow(row)
    return Boolean(projected && [
      projected.operation,
      projected.registryActor,
      projected.backendPermission,
      projected.frontendPermission,
    ].every((value) => value !== UNKNOWN))
  }
  expect(fullyResolvable
    .filter(canonicalDimensionsKnown)
    .filter((row) => row.mismatch !== 'KHỚP')
    .map((row) => `${row.family}/${row.scenarioId}/${row.actor}/${row.viewport.id}`)).toEqual([])

  const coordinationUnknownInputs = rows.filter((row) => (
    row.family === 'CoordinationOrderScopeLifecycle'
    && ['update-forecast', 'request-adjustment'].includes(row.operation)
  ))
  expect(coordinationUnknownInputs).toHaveLength(measuredViewports.length * 12)
  expect(coordinationUnknownInputs
    .filter((row) => (
      row.actualControls.length !== 1
      || row.mismatch !== 'CHƯA-KẾT-LUẬN-ĐƯỢC'
    ))
    .map((row) => `${row.scenarioId}/${row.operation}/${row.actor}/${row.viewport.id}`)).toEqual([])
  expect(fullyResolvable
    .filter((row) => !canonicalDimensionsKnown(row))
    .filter((row) => row.mismatch !== 'CHƯA-KẾT-LUẬN-ĐƯỢC')
    .map((row) => `${row.family}/${row.scenarioId}/${row.actor}/${row.viewport.id}`)).toEqual([])

  const intentionalWeeklyAbsence = rows.filter((row) => (
    row.family === 'WeeklyMenuLifecycle'
    && ((row.scenarioId === 'draft' && row.actor !== 'admin')
      || (row.scenarioId === 'active-shortage' && row.actor === 'coordinator'))
  ))
  expect(intentionalWeeklyAbsence.length).toBeGreaterThan(0)
  expect(intentionalWeeklyAbsence.every((row) => (
    !row.expected && row.actualControls.length === 0 && row.mismatch === 'KHỚP'
  ))).toBe(true)

  const observedControls = rows.flatMap((row) => row.actualControls)
  expect(observedControls.length).toBeGreaterThan(0)
  const exercisedRows = rows.filter((row) => {
    const projected = projectedRow(row)
    return row.expected && row.actualControls.length > 0 && projected && getPcActionExpectation(projected) !== null
  })
  expect(exercisedRows.length).toBeGreaterThan(0)
  expect(exercisedRows.filter((row) => row.actualControls.some((control) => control.postAction === null))).toEqual([])
  expect(exercisedRows.filter((row) => row.requestExpected && !row.requestObserved)).toEqual([])

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
  const generatedAt = new Date().toISOString()
  const payload = {
    generatedAt,
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
    actionRequestSemantics: 'Every known frontend-expected enabled action is exercised behind the pre-navigation in-memory firewall; intercepted request and observable post-action evidence are stored on each row.',
    unmatchedApi: requestEvidence.filter((request) => request.status === 501),
    browserIssues,
    performance: performanceEvidence,
    screenshots: screenshotEvidence,
    actualControls: actualControlInventory,
  }
  mkdirSync(EVIDENCE_ROOT, { recursive: true })
  const outputPath = measuredViewports.length === PC_VIEWPORTS.length
    ? EVIDENCE_JSON
    : resolve(EVIDENCE_ROOT, `pc-action-completeness-${measuredViewports.map(({ id }) => id).join('_')}.json`)
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  if (measuredViewports.length === PC_VIEWPORTS.length) {
    writeFileSync(TRACKED_AGGREGATE_JSON, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt,
      evidenceKind: PC_EVIDENCE_KIND,
      scope: 'aggregate-five-viewport',
      canonical: payload.canonical,
      rows,
      requests: requestEvidence,
      screenshots: screenshotEvidence,
      actualControls: actualControlInventory,
      performance: performanceEvidence,
      browserIssueCount: browserIssues.length,
      overflowCount: performanceEvidence.filter((record) => record.overflow).length,
      sourceArtifact: '.artifacts/shipyard-live/pc-action-completeness-20-02/pc-action-completeness.json',
    }, null, 2)}\n`, 'utf8')
  }
})

test('normalization preserves Vietnamese semantic labels without changing operation identity', () => {
  expect(normalizeLabel('  MỞ   THU MUA ')).toBe('mở thu mua')
  expect(normalizeLabel('Tạo đề xuất mua')).toBe('tạo đề xuất mua')
  expect(UNKNOWN).toBe('KHÔNG-XÁC-ĐỊNH-ĐƯỢC')
})
