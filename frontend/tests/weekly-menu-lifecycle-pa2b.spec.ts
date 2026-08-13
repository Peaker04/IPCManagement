import { expect, type Page, type Route, test } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES } from '../src/lib/routeConfig'
import {
  LAST_WEEKLY_MENU_CUSTOMER_KEY,
  LAST_WEEKLY_MENU_WEEK_KEY,
} from '../src/features/projects/weekly-menu/model/formatters'
import {
  PA2B_ACTORS,
  PA2B_CUSTOMER_CODE,
  PA2B_CUSTOMER_ID,
  PA2B_VIEWPORTS,
  PA2B_WEEK_END,
  PA2B_WEEK_START,
  terminalDemandAction,
  weeklyMenuLifecyclePa2bRegistry,
  type Pa2bActorId,
  type WeeklyMenuLifecyclePa2bScenario,
} from './weekly-menu-lifecycle-pa2b-fixture'

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(FRONTEND_ROOT, '..')
const EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  '.artifacts',
  'shipyard-live',
  'pa2b-pc-weekly-menu-20260730',
)
const EVIDENCE_JSON = resolve(EVIDENCE_ROOT, 'pa2b-pc-weekly-menu-fixture.json')

type ApiCall = {
  viewport: string
  scenarioId: string
  actor: Pa2bActorId
  method: string
  path: string
  status: number | 'pending'
}

type BrowserIssue = {
  viewport: string
  scenarioId: string
  actor: Pa2bActorId
  kind: 'console' | 'page' | 'request-failed'
  message: string
  expected: boolean
  expectedReason?: string
}

type PcClassification = 'KHỚP' | 'THIẾU' | 'MỒ CÔI' | 'KHÔNG-ÁP-DỤNG'

type BrowserResult = {
  viewport: string
  scenarioId: string
  actor: Pa2bActorId
  lifecycleState: WeeklyMenuLifecyclePa2bScenario['lifecycleState']
  downstreamState: WeeklyMenuLifecyclePa2bScenario['downstreamState']
  actionKind: WeeklyMenuLifecyclePa2bScenario['actionKind']
  expectedAction: string
  expectedControl: string | null
  backendAvailable: boolean | null
  frontendExpectedAvailable: boolean
  frontendObservedAvailable: boolean
  observedInteractions: Array<{
    tag: string
    role: string | null
    label: string
    enabled: boolean
    href: string | null
  }>
  observedBusinessActions: string[]
  classification: PcClassification
  screenshot: string
  apiCalls: ApiCall[]
  consoleErrors: string[]
  pageErrors: string[]
  requestFailures: string[]
  cls: number
  longTasks: Array<{ duration: number; startTime: number }>
  overflow: boolean
}

const results: BrowserResult[] = []
const apiCalls: ApiCall[] = []
const browserIssues: BrowserIssue[] = []
const businessMutationAttempts: ApiCall[] = []
const unhandledApi: ApiCall[] = []

const source = (relativePath: string) => readFileSync(resolve(REPO_ROOT, relativePath), 'utf8')
  .replace(/\r\n/g, '\n')

const productionSourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) return productionSourceFiles(absolutePath)
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.')) return []
    return [absolutePath]
  })

const wrap = (data: unknown, success = true, message = success ? 'OK' : 'Fixture error') => ({
  success,
  message,
  data,
})

const actorProfile = (actorId: Pa2bActorId) => {
  if (actorId === 'admin') {
    return {
      userId: 'pa2b-admin',
      username: 'admin',
      fullName: 'PA-2B Admin',
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    }
  }
  if (actorId === 'manager') {
    return {
      userId: 'pa2b-manager',
      username: 'quanly',
      fullName: 'PA-2B Manager',
      roleCode: 'MANAGER',
      roleName: 'Manager',
      isAdminFullAccess: false,
      permissions: [
        'coordination.read',
        'coordination.order.lock',
        'catalog.read',
        'purchase.read',
        'purchase.generate',
        'warehouse.read',
        'demand.generate',
      ],
    }
  }
  return {
    userId: 'pa2b-coordinator',
    username: 'dieuphoi',
    fullName: 'PA-2B Coordinator',
    roleCode: 'COORDINATOR',
    roleName: 'Coordinator',
    isAdminFullAccess: false,
    permissions: [
      'coordination.read',
      'coordination.order.lock',
      'coordination.order.adjust',
      'coordination.order.signoff',
      'demand.generate',
    ],
  }
}

const committedWeeklyMenu = (scenario: WeeklyMenuLifecyclePa2bScenario) => {
  if (scenario.scenarioId === 'empty') return null
  const dates = Array.from(new Set(scenario.schedules.map((schedule) => schedule.serviceDate)))
  const rows = (dates.length > 0 ? dates : [PA2B_WEEK_START]).map((serviceDate, index) => ({
    serviceDate,
    dayKey: index === 0 ? 't2' : 't3',
    sourceRowNumber: index + 1,
    sourceColumn: index === 0 ? 'B' : 'C',
    sourceSection: 'Mặn',
    sourceShift: 'Ca sáng',
    dbShiftName: 'MORNING',
    variant: 'savory',
    slot: 'main',
    slotLabel: 'Món chính',
    dishName: `Món kiểm thử PA-2B ${index + 1}`,
    rowSpan: 1,
    isMergedContinuation: false,
    existingDish: false,
  }))
  return {
    committed: true,
    fileName: 'pa2b-read-only-fixture.xlsx',
    customerId: PA2B_CUSTOMER_ID,
    customerCode: PA2B_CUSTOMER_CODE,
    customerName: 'Khách hàng PA-2B',
    weekStartDate: PA2B_WEEK_START,
    weekEndDate: PA2B_WEEK_END,
    detectedLayout: {
      sheetName: 'PA2B',
      labelColumn: 'A',
      dayColumns: [],
      sections: [],
      rowsScanned: rows.length,
      rowsImported: rows.length,
      rowsSkipped: 0,
    },
    warnings: [],
    validation: {
      isValid: true,
      hasCriticalErrors: false,
      errorCount: 0,
      warningCount: 0,
      issues: [],
    },
    rows,
    previewDiff: {
      addedSlots: 0,
      changedSlots: 0,
      removedSlots: 0,
      unchangedSlots: rows.length,
      rows: [],
    },
    importedWeeklyMenu: {},
  }
}

const ingredientDemandRows = (scenario: WeeklyMenuLifecyclePa2bScenario) => {
  if (!scenario.demandRequestStatus) return []
  return [{
    materialRequestId: `material-request-${scenario.scenarioId}`,
    requestLineId: `material-request-line-${scenario.scenarioId}`,
    ingredientId: 'ingredient-pa2b',
    unitId: 'unit-kg',
    bomId: null,
    priceTierAmount: 25000,
    bomScope: 'CUSTOMER',
    status: scenario.demandRequestStatus,
    materialRequestCode: `MR-${scenario.scenarioId.toUpperCase()}`,
    requestDate: PA2B_WEEK_START,
    ingredientName: 'Nguyên liệu PA-2B',
    totalRequiredQty: 100,
    currentStockQty: scenario.readiness.shortageCount > 0 ? 0 : 100,
    suggestedPurchaseQty: scenario.readiness.shortageCount > 0 ? 100 : 0,
    unitName: 'kg',
    dishName: 'Món kiểm thử PA-2B 1',
    customerId: PA2B_CUSTOMER_ID,
    customerCode: PA2B_CUSTOMER_CODE,
    customerName: 'Khách hàng PA-2B',
  }]
}

const aggregatePage = (scenario: WeeklyMenuLifecyclePa2bScenario) => ({
  items: scenario.readiness.totalCount > 0
    ? [{
        requestDate: PA2B_WEEK_START,
        customerId: PA2B_CUSTOMER_ID,
        customerCode: PA2B_CUSTOMER_CODE,
        customerName: 'Khách hàng PA-2B',
        priceTierAmount: 25000,
        ingredientId: 'ingredient-pa2b',
        ingredientName: 'Nguyên liệu PA-2B',
        unitId: 'unit-kg',
        unitName: 'kg',
        totalRequiredQty: 100,
        currentStockQty: scenario.readiness.shortageCount > 0 ? 0 : 100,
        suggestedPurchaseQty: scenario.readiness.shortageCount > 0 ? 100 : 0,
        lineCount: scenario.readiness.totalCount,
        hasCancelledLine: false,
      }]
    : [],
  totalCount: scenario.readiness.totalCount,
  pageNumber: 1,
  pageSize: 100,
  totalPages: scenario.readiness.totalCount > 0 ? 1 : 0,
  hasPrev: false,
  hasNext: false,
  shortageCount: scenario.readiness.shortageCount,
})

const staleness = (scenario: WeeklyMenuLifecyclePa2bScenario) => ({
  hasExistingPlan: Boolean(scenario.demandRequestStatus),
  isStale: false,
  lastGeneratedAt: scenario.demandRequestStatus ? '2026-07-29T00:00:00Z' : null,
  reasons: [],
  materialRequestId: scenario.demandRequestStatus
    ? `material-request-${scenario.scenarioId}`
    : null,
  status: scenario.demandRequestStatus ?? null,
  requestCode: scenario.demandRequestStatus
    ? `MR-${scenario.scenarioId.toUpperCase()}`
    : null,
  canRegenerate: scenario.downstreamState !== 'terminal',
  regenerationBlockReason: scenario.downstreamState === 'terminal'
    ? 'Fixture terminal chỉ đọc: không có action nghiệp vụ.'
    : null,
})

const installPerformanceProbe = async (page: Page) => {
  await page.addInitScript(() => {
    const state = {
      cls: 0,
      longTasks: [] as Array<{ duration: number; startTime: number }>,
    }
    ;(window as typeof window & { __pa2bMetrics?: typeof state }).__pa2bMetrics = state
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!shift.hadRecentInput) state.cls += shift.value ?? 0
        }
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {
      // Chromium without layout-shift support reports the zero baseline above.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({ duration: entry.duration, startTime: entry.startTime })
        }
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      // Chromium without longtask support reports the empty baseline above.
    }
  })
}

const installReadOnlyApiFixture = async ({
  page,
  viewport,
  actor,
  getScenario,
}: {
  page: Page
  viewport: string
  actor: Pa2bActorId
  getScenario: () => WeeklyMenuLifecyclePa2bScenario
}) => {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const path = new URL(request.url()).pathname
    if (!path.startsWith('/api/')) {
      await route.fallback()
      return
    }
    const scenario = getScenario()
    const record = (status: ApiCall['status']) => {
      const call = { viewport, scenarioId: scenario.scenarioId, actor, method, path, status }
      apiCalls.push(call)
      return call
    }
    const fulfill = async (data: unknown, status = 200, message?: string) => {
      record(status)
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(wrap(data, status < 400, message)),
      })
    }

    if (path === '/api/auth/login') {
      await fulfill(null, 503, 'Playwright dev-login fallback')
      return
    }
    if (path === '/api/auth/profile') {
      await fulfill(actorProfile(actor))
      return
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const call = record(405)
      businessMutationAttempts.push(call)
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify(wrap(null, false, 'PA-2B blocks every business mutation')),
      })
      return
    }

    if (path === '/api/dishes/catalog') {
      await fulfill([])
      return
    }
    if (path === '/api/coordination/customers') {
      await fulfill([{
        customerId: PA2B_CUSTOMER_ID,
        customerCode: PA2B_CUSTOMER_CODE,
        customerName: 'Khách hàng PA-2B',
      }])
      return
    }
    if (path === '/api/coordination/customer-contracts') {
      await fulfill([{
        contractId: 'contract-pa2b',
        customerId: PA2B_CUSTOMER_ID,
        customerCode: PA2B_CUSTOMER_CODE,
        customerName: 'Khách hàng PA-2B',
        isActive: true,
        contractStatus: 'ACTIVE',
        menuScheduleCount: scenario.schedules.length,
        activeWeekDays: ['MONDAY', 'TUESDAY'],
        shiftNames: ['MORNING'],
        defaultMenuPrice: 25000,
        defaultBomRatePercent: 100,
      }])
      return
    }
    if (path === '/api/coordination/weekly-menu/import-history') {
      await fulfill([])
      return
    }
    if (path === '/api/coordination/weekly-menu') {
      await fulfill(committedWeeklyMenu(scenario))
      return
    }
    if (path === '/api/coordination/menu-schedules') {
      await fulfill(scenario.schedules)
      return
    }
    if (path === '/api/coordination/meal-quantity-plans') {
      await fulfill(scenario.quantityPlans)
      return
    }
    if (path === '/api/coordination/orders') {
      await fulfill([])
      return
    }
    if (path === '/api/workflow-reports/ingredient-demand') {
      await fulfill(ingredientDemandRows(scenario))
      return
    }
    if (path === '/api/workflow-reports/ingredient-demand/aggregate/page') {
      if (scenario.readiness.state === 'loading') {
        record('pending')
        setTimeout(() => {
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(wrap(aggregatePage(scenario))),
          }).catch(() => undefined)
        }, 5_000)
        return
      }
      if (scenario.readiness.state === 'error') {
        await fulfill(null, 503, 'PA-2B deterministic readiness error')
        return
      }
      await fulfill(aggregatePage(scenario))
      return
    }
    if (path === '/api/workflow-reports/workflow-documents') {
      await fulfill([])
      return
    }
    if (path === '/api/material-demand/staleness') {
      await fulfill(staleness(scenario))
      return
    }
    if (path.startsWith('/api/approval-history/material-demand/')) {
      await fulfill([])
      return
    }

    // Login redirects briefly through Dashboard. These GET-only bootstrap reads are
    // intercepted so the fixture never reaches a backend before /weekly-menu mounts.
    if (path === '/api/approvals/inbox') {
      await fulfill({ items: [], limit: 20, hasNext: false, nextCursor: null })
      return
    }
    if (path === '/api/workflow-reports/operational-kpis') {
      await fulfill({})
      return
    }
    if (path === '/api/purchase-requests') {
      await fulfill([])
      return
    }

    const call = record(501)
    unhandledApi.push(call)
    await route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify(wrap(null, false, 'Unhandled PA-2B read fixture endpoint')),
    })
  })
}

const login = async (page: Page, actor: Pa2bActorId) => {
  const username = PA2B_ACTORS[actor].username
  await page.goto(ROUTES.LOGIN)
  await page.getByLabel('Tài khoản').fill(username)
  await page.getByLabel('Mật khẩu').fill(username)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(ROUTES.DASHBOARD)
  await page.evaluate(({ customerKey, weekKey, customerId, weekStart }) => {
    window.localStorage.setItem(customerKey, customerId)
    window.localStorage.setItem(weekKey, weekStart)
  }, {
    customerKey: LAST_WEEKLY_MENU_CUSTOMER_KEY,
    weekKey: LAST_WEEKLY_MENU_WEEK_KEY,
    customerId: PA2B_CUSTOMER_ID,
    weekStart: PA2B_WEEK_START,
  })
}

const observedBusinessActions = async (page: Page) => {
  const labels = await page.locator([
    '#demand-panel .ipc-demand-primary-actions a',
    '#demand-panel .ipc-demand-primary-actions button:not([disabled])',
    '#demand-panel button:not([disabled])',
  ].join(', ')).allTextContents()
  return Array.from(new Set(labels
    .map((label) => label.replace(/\s+/g, ' ').trim())
    .filter((label) => /^(Mở thu mua|Mở hàng đợi duyệt|Tạo nhu cầu từ KHSX|Tính lại nhu cầu|Hoàn tất )/.test(label))))
}

const observedInteractions = async (page: Page) => page.evaluate(() => Array.from(
  document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"], [role="tab"]'),
).flatMap((element) => {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  const visible = rect.width > 0
    && rect.height > 0
    && style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.opacity !== '0'
  if (!visible) return []
  const input = element as HTMLInputElement
  const explicitLabel = input.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)?.textContent
    : null
  const label = [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    explicitLabel,
    element.textContent,
    input.value,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return [{
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute('role'),
    label,
    enabled: !input.disabled && element.getAttribute('aria-disabled') !== 'true',
    href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
  }]
}))

const observeExpectedControl = async (
  page: Page,
  scenario: WeeklyMenuLifecyclePa2bScenario,
) => {
  if (!scenario.expectedControl) return false
  const locator = page.getByRole(scenario.expectedControl.role, {
    name: scenario.expectedControl.name,
    exact: true,
  })
  if (await locator.count() === 0 || !await locator.first().isVisible()) return false
  return scenario.expectedControl.role === 'link' || await locator.first().isEnabled()
}

const classify = (backendAvailable: boolean | null, frontendAvailable: boolean): PcClassification => {
  if (backendAvailable === null) return 'KHÔNG-ÁP-DỤNG'
  if (backendAvailable && !frontendAvailable) return 'THIẾU'
  if (!backendAvailable && frontendAvailable) return 'MỒ CÔI'
  return 'KHỚP'
}

const captureScenario = async ({
  page,
  viewport,
  actor,
  scenario,
}: {
  page: Page
  viewport: string
  actor: Pa2bActorId
  scenario: WeeklyMenuLifecyclePa2bScenario
}) => {
  const apiStart = apiCalls.length
  const issueStart = browserIssues.length
  const isAdminOnlyPublish = scenario.scenarioId === 'draft'
  const targetRoute = `${ROUTES.WEEKLY_MENU}?pa2b=${scenario.scenarioId}-${actor}`
  await page.goto(targetRoute)
  await expect(page.getByRole('tab', { name: 'Kế hoạch tuần', exact: true })).toBeVisible()
  if (isAdminOnlyPublish) {
    const publish = page.getByRole('button', { name: 'Xuất bản tuần', exact: true })
    if (actor === 'admin') await expect(publish).toBeEnabled()
    else await expect(publish).toHaveCount(0)
  }

  const needsDemand = scenario.expectedControl?.surface === 'demand-panel'
    || scenario.actionKind === 'none'
  if (needsDemand) {
    await page.getByRole('tab', { name: 'Nhu cầu', exact: true }).click()
    await expect(page.locator('#demand-panel')).toBeVisible()
    await expect(page.getByText('KHSX, kiểm tồn kho và nhu cầu xuất', { exact: true })).toBeVisible()
    if (scenario.downstreamState === 'approved') {
      await expect(page.getByText('Đã duyệt', { exact: true }).first()).toBeVisible()
    }
    if (scenario.downstreamState === 'terminal') {
      await expect(page.getByText(/Đã gửi kho|Đã xuất kho/).first()).toBeVisible()
    }
  }

  const frontendObservedAvailable = await observeExpectedControl(page, scenario)
  const interactions = await observedInteractions(page)
  const actions = needsDemand ? await observedBusinessActions(page) : []
  const actorOracle = scenario.actorOracle[actor]
  if (!scenario.expectedControl && scenario.actionKind === 'none') {
    expect(actions, `${scenario.scenarioId}/${actor} must have no business action`).toEqual([])
  }
  expect(
    frontendObservedAvailable,
    `${scenario.scenarioId}/${actor} frontend availability drifted`,
  ).toBe(actorOracle.frontendAvailable)

  const screenshotRelative = `${viewport}/${scenario.scenarioId}-${actor}.png`
  const screenshotAbsolute = resolve(EVIDENCE_ROOT, screenshotRelative)
  mkdirSync(dirname(screenshotAbsolute), { recursive: true })
  await page.screenshot({ path: screenshotAbsolute, fullPage: true })

  const metrics = await page.evaluate(() => {
    const state = (window as typeof window & {
      __pa2bMetrics?: {
        cls: number
        longTasks: Array<{ duration: number; startTime: number }>
      }
    }).__pa2bMetrics
    return {
      cls: state?.cls ?? 0,
      longTasks: state?.longTasks ?? [],
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
  const issues = browserIssues.slice(issueStart)
  const unexpectedIssues = issues.filter((issue) => !issue.expected)
  const scenarioCalls = apiCalls.slice(apiStart)
  const result: BrowserResult = {
    viewport,
    scenarioId: scenario.scenarioId,
    actor,
    lifecycleState: scenario.lifecycleState,
    downstreamState: scenario.downstreamState,
    actionKind: scenario.actionKind,
    expectedAction: scenario.expectedAction,
    expectedControl: scenario.expectedControl?.name ?? null,
    backendAvailable: actorOracle.backendAvailable,
    frontendExpectedAvailable: actorOracle.frontendAvailable,
    frontendObservedAvailable,
    observedInteractions: interactions,
    observedBusinessActions: actions,
    classification: classify(actorOracle.backendAvailable, frontendObservedAvailable),
    screenshot: screenshotRelative.replace(/\\/g, '/'),
    apiCalls: scenarioCalls,
    consoleErrors: issues.filter((issue) => issue.kind === 'console').map((issue) => issue.message),
    pageErrors: issues.filter((issue) => issue.kind === 'page').map((issue) => issue.message),
    requestFailures: issues.filter((issue) => issue.kind === 'request-failed').map((issue) => issue.message),
    cls: metrics.cls,
    longTasks: metrics.longTasks,
    overflow: metrics.overflow,
  }
  results.push(result)
  expect(result.pageErrors).toEqual([])
  expect(result.overflow).toBe(false)
  expect(unexpectedIssues, `${scenario.scenarioId}/${actor} unexpected browser issue`).toEqual([])
}

test.describe.configure({ mode: 'serial' })

test.describe('PA-2B WeeklyMenuLifecycle read-only registry and PC fixture', () => {
  test('source contracts fail when non-importable policy, guard, actor or boundary sources drift', () => {
    expect(terminalDemandAction).toBe('none')
    expect(weeklyMenuLifecyclePa2bRegistry.map((item) => item.scenarioId)).toEqual([
      'empty',
      'draft',
      'active-incomplete',
      'active-not-generated',
      'active-loading',
      'active-error',
      'active-shortage-approved',
      'active-shortage-terminal',
      'active-no-shortage',
      'inconsistent',
      'superseded',
    ])
    expect(new Set(weeklyMenuLifecyclePa2bRegistry.map((item) => item.scenarioId)).size).toBe(11)
    expect(weeklyMenuLifecyclePa2bRegistry.every((item) => item.object === 'WeeklyMenuLifecycle')).toBe(true)
    expect(weeklyMenuLifecyclePa2bRegistry.every((item) => item.source.length > 0)).toBe(true)

    const loginSource = source('frontend/src/features/auth/pages/LoginPage.tsx')
    expect(loginSource).toContain("admin: { fullName: 'Trần Văn Giám Đốc', role: 'admin', permissions: ['*'] }")
    expect(loginSource).toContain("quanly: { fullName: 'Lê Văn Quản Lý', role: 'quanly', permissions: ['coordination.read', 'coordination.order.lock', 'catalog.read', 'purchase.read', 'purchase.generate', 'warehouse.read', 'demand.generate'] }")
    expect(loginSource).toContain("dieuphoi: { fullName: 'Trần Thị Điều Phối', role: 'dieuphoi', permissions: ['coordination.read', 'coordination.order.lock', 'coordination.order.adjust', 'coordination.order.signoff', 'demand.generate'] }")

    const demandSource = source('frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx')
    expect(demandSource).toContain("requiredPermissions={['coordination.order.lock']}")
    expect(demandSource).toContain("requiredPermissions={['purchase.read']}")
    expect(demandSource).toContain("requiredPermissions={['demand.generate']}")
    expect(demandSource).toContain("<ActionGuard requiredPermissions={['purchase.read']}>")

    expect(existsSync(resolve(FRONTEND_ROOT, 'src/features/projects/weekly-menu/lifecycle/WeeklyMenuLifecyclePanel.tsx'))).toBe(false)
    const weeklyMenuPageSource = source('frontend/src/features/projects/pages/WeeklyMenuPage.tsx')
    expect(weeklyMenuPageSource).not.toContain('WeeklyMenuLifecyclePanel')

    const demandModelSource = source('frontend/src/features/projects/weekly-menu/demand/demandModel.ts')
    expect(demandModelSource).toContain("approvalStatus === 'terminal'\n    ? 'none' as const")

    const policySource = source('backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs')
    expect(policySource).toContain('"Manager", "MANAGER", "Quản lý",\n        "Coordinator", "COORDINATOR", "Điều phối"')
    expect(policySource).toContain('private static readonly string[] ManagerPermissions')
    expect(policySource).toContain('private static readonly string[] CoordinatorPermissions')
    expect(policySource).toContain('        PurchaseRead,\n        PurchaseGenerate,')
    expect(policySource).toContain('        DemandGenerate,\n        ReportRead\n    ];')

    const programSource = source('backend/src/IPCManagement.Api/Program.cs')
    expect(programSource).toContain('options.AddPolicy(AuthorizationPolicies.CoordinationAccess, policy =>\n        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CoordinationRoles));')
    expect(programSource).toContain('options.AddPolicy(AuthorizationPolicies.DemandGenerateAccess, policy =>\n        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CoordinationRoles));')

    const routerSource = source('frontend/src/routes/AppRouter.tsx')
    expect(routerSource).toContain("path={ROUTES.PURCHASING} element={<RoleGuard requiredPermissions={['purchase.read']}")

    const productionImports = productionSourceFiles(resolve(FRONTEND_ROOT, 'src'))
      .filter((file) => readFileSync(file, 'utf8').includes('weekly-menu-lifecycle-pa2b-fixture'))
      .map((file) => file.replace(`${FRONTEND_ROOT}\\`, '').replace(/\\/g, '/'))
    expect(productionImports).toEqual([])
  })

  for (const viewport of PA2B_VIEWPORTS) {
    test(`${viewport.id} renders every PA-2B actor/scenario without business mutation`, async ({ browser }) => {
      test.setTimeout(300_000)
      for (const actor of Object.keys(PA2B_ACTORS) as Pa2bActorId[]) {
        const actorScenarios = weeklyMenuLifecyclePa2bRegistry.filter((scenario) => scenario.actors.includes(actor))
        if (actorScenarios.length === 0) continue
        let currentScenario = actorScenarios[0]
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        })
        const page = await context.newPage()
        await installPerformanceProbe(page)
        page.on('console', (message) => {
          if (message.type() !== 'error') return
          const expected = message.text().includes('503')
            && (currentScenario.scenarioId === 'empty' || currentScenario.scenarioId === 'active-error')
          browserIssues.push({
            viewport: viewport.id,
            scenarioId: currentScenario.scenarioId,
            actor,
            kind: 'console',
            message: message.text(),
            expected,
            expectedReason: expected ? 'intercepted dev-login fallback or deterministic readiness error' : undefined,
          })
        })
        page.on('pageerror', (error) => {
          browserIssues.push({
            viewport: viewport.id,
            scenarioId: currentScenario.scenarioId,
            actor,
            kind: 'page',
            message: error.message,
            expected: false,
          })
        })
        page.on('requestfailed', (request) => {
          const requestUrl = new URL(request.url())
          const requestPath = requestUrl.pathname
          const failure = request.failure()?.errorText ?? 'unknown'
          const isNavigationAbort = failure.includes('ERR_ABORTED')
            && requestUrl.origin === 'http://127.0.0.1:5173'
            && !requestPath.startsWith('/api/')
          const isControlledLoadingAbort = failure.includes('ERR_ABORTED')
            && requestPath === '/api/workflow-reports/ingredient-demand/aggregate/page'
          const isExternalFontNavigationAbort = failure.includes('ERR_ABORTED')
            && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(requestUrl.hostname)
          const expected = isNavigationAbort || isControlledLoadingAbort || isExternalFontNavigationAbort
          browserIssues.push({
            viewport: viewport.id,
            scenarioId: currentScenario.scenarioId,
            actor,
            kind: 'request-failed',
            message: `${request.method()} ${request.url()} — ${failure}`,
            expected,
            expectedReason: isNavigationAbort
              ? 'same-origin Vite asset load cancelled by fixture navigation'
              : isControlledLoadingAbort
                ? 'deterministic loading request cancelled by next scenario navigation'
                : isExternalFontNavigationAbort
                  ? 'external font load cancelled by immediate navigation'
                : undefined,
          })
        })
        await installReadOnlyApiFixture({
          page,
          viewport: viewport.id,
          actor,
          getScenario: () => currentScenario,
        })
        await login(page, actor)
        for (const scenario of actorScenarios) {
          currentScenario = scenario
          await captureScenario({ page, viewport: viewport.id, actor, scenario })
        }
        await context.close()
      }

      const viewportMutations = businessMutationAttempts.filter((call) => call.viewport === viewport.id)
      const viewportUnhandled = unhandledApi.filter((call) => call.viewport === viewport.id)
      expect(viewportMutations).toEqual([])
      expect(viewportUnhandled).toEqual([])
    })
  }

  test.afterAll(() => {
    mkdirSync(EVIDENCE_ROOT, { recursive: true })
    const interactionResults = results.filter((result) => result.classification !== 'KHÔNG-ÁP-DỤNG')
    const payload = {
      generatedAt: new Date().toISOString(),
      scope: 'WeeklyMenuLifecycle only',
      behaviorChange: 'remove unintended lifecycle panel and align verified frontend permission gates',
      fixtureSemantics: 'frontend rendering with intercepted read-only API; not backend/DB E2E',
      requiredLaunchMode: 'Chrome/Chromium headed',
      viewports: PA2B_VIEWPORTS,
      scenarioCount: weeklyMenuLifecyclePa2bRegistry.length,
      caseCount: results.length,
      registry: weeklyMenuLifecyclePa2bRegistry.map((scenario) => ({
        object: scenario.object,
        scenarioId: scenario.scenarioId,
        lifecycleState: scenario.lifecycleState,
        downstreamState: scenario.downstreamState,
        downstreamPrimaryAction: scenario.downstreamPrimaryAction,
        actionKind: scenario.actionKind,
        expectedAction: scenario.expectedAction,
        expectedControl: scenario.expectedControl,
        actors: scenario.actors,
        actorOracle: scenario.actorOracle,
        source: scenario.source,
      })),
      pcSummary: {
        matching: interactionResults.filter((result) => result.classification === 'KHỚP').length,
        missing: interactionResults.filter((result) => result.classification === 'THIẾU').length,
        orphan: interactionResults.filter((result) => result.classification === 'MỒ CÔI').length,
        notApplicable: results.filter((result) => result.classification === 'KHÔNG-ÁP-DỤNG').length,
      },
      results,
      apiCalls,
      businessMutationAttempts,
      unhandledApi,
      browserIssues,
      browserIssueSummary: {
        total: browserIssues.length,
        expected: browserIssues.filter((issue) => issue.expected).length,
        unexpected: browserIssues.filter((issue) => !issue.expected).length,
      },
    }
    writeFileSync(EVIDENCE_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  })
})
