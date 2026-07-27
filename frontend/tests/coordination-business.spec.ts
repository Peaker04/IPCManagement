import { expect, type Page, type Request, test } from '@playwright/test'
import { ROUTES } from '../src/lib/routeConfig'

type AppRole = 'quanly' | 'dieuphoi'

interface CoordinationScenario {
  statuses: string[]
  role?: AppRole
  lockRequests: Request[]
  signoffRequests: Request[]
  unlockRequests: Request[]
}

const fulfillJson = async (
  route: Parameters<Parameters<Page['route']>[1]>[0],
  data: unknown,
  status = 200,
) => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, message: status < 400 ? 'OK' : 'ERROR', data }),
  })
}

const installAuth = async (page: Page, role: AppRole) => {
  await page.addInitScript((selectedRole) => {
    const isManager = selectedRole === 'quanly'
    window.sessionStorage.setItem('token', `e2e-${selectedRole}-token`)
    window.localStorage.setItem('user', JSON.stringify({
      id: `e2e-${selectedRole}`,
      username: selectedRole,
      fullName: isManager ? 'Quản lý E2E' : 'Điều phối E2E',
      role: selectedRole,
      roleCode: isManager ? 'MANAGER' : 'COORDINATOR',
      roleName: isManager ? 'Quản lý' : 'Điều phối',
      isAdminFullAccess: false,
      permissions: [
        'coordination.read',
        'coordination.order.lock',
        'coordination.order.adjust',
        'coordination.order.signoff',
      ],
    }))
  }, role)
}

const buildOrder = (index: number, dayOfWeek: string, shiftName: string) => ({
  id: `${shiftName}-line-${index}`,
  quantityPlanLineId: `${shiftName}-line-${index}`,
  quantityPlanId: `${shiftName}-plan-${index}`,
  menuScheduleId: `${shiftName}-schedule-${index}`,
  customerId: `customer-${index}`,
  customerCode: `CUS-${index}`,
  customerName: `Khách hàng ${index}`,
  mealType: `Thực đơn ${index}`,
  forecastQuantity: 100 + index,
  actualQuantity: 105 + index,
  unitPrice: 25_000,
  appliedRate: 100,
  specialNotes: '',
  serviceDate: '2026-07-11',
  dayOfWeek,
  shiftName,
  shift: shiftName === 'AFTERNOON' ? 'Ca Chiều' : 'Ca Sáng',
  menuId: `menu-${index}`,
  menuCode: `MENU-${index}`,
  menuName: `Thực đơn ${index}`,
  dishId: 'dish-shared',
  dishes: [
    { dishId: 'dish-shared', dishCode: 'DISH-01', dishName: 'Cơm gà', dishSlot: 'savory-main', displayOrder: 1 },
    { dishId: 'dish-shared', dishCode: 'DISH-01', dishName: 'Cơm gà', dishSlot: 'savory-main', displayOrder: 1 },
    { dishId: 'dish-side', dishCode: 'DISH-02', dishName: 'Trứng chiên', dishSlot: 'savory-sub1', displayOrder: 2 },
    { dishId: 'dish-soup', dishCode: 'DISH-03', dishName: 'Canh rau', dishSlot: 'savory-canh', displayOrder: 3 },
    { dishId: 'dish-fruit', dishCode: 'DISH-04', dishName: 'Trái cây', dishSlot: 'savory-fruit', displayOrder: 4 },
    { dishId: 'dish-dessert', dishCode: 'DISH-05', dishName: 'Sữa chua', dishSlot: 'savory-dessert', displayOrder: 5 },
  ],
})

const stubCoordinationScenario = async (
  page: Page,
  initialStatuses: string[],
  role: AppRole = 'quanly',
): Promise<CoordinationScenario> => {
  await installAuth(page, role)
  const scenario: CoordinationScenario = {
    statuses: [...initialStatuses],
    role,
    lockRequests: [],
    signoffRequests: [],
    unlockRequests: [],
  }

  await page.route('**/api/auth/profile', async (route) => fulfillJson(route, {
    userId: `e2e-${role}`,
    username: role,
    fullName: role === 'quanly' ? 'Quản lý E2E' : 'Điều phối E2E',
    roleCode: role === 'quanly' ? 'MANAGER' : 'COORDINATOR',
    roleName: role === 'quanly' ? 'Quản lý' : 'Điều phối',
    isAdminFullAccess: false,
    permissions: [
      'coordination.read',
      'coordination.order.lock',
      'coordination.order.adjust',
      'coordination.order.signoff',
    ],
  }))
  await page.route('**/api/coordination/menu-schedules**', async (route) => fulfillJson(route, []))
  await page.route('**/api/coordination/meal-quantity-plans**', async (route) => {
    await fulfillJson(route, scenario.statuses.map((status, index) => ({
      quantityPlanId: `plan-${index + 1}`,
      planCode: `PLAN-${index + 1}`,
      serviceDate: '2026-07-11',
      dayOfWeek: 't7',
      status,
      lines: [],
    })))
  })
  await page.route('**/api/coordination/orders**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/orders/lock')) {
      scenario.lockRequests.push(request)
      scenario.statuses = scenario.statuses.map(() => 'CONFIRMED')
      await fulfillJson(route, {
        success: true,
        lockedAt: new Date().toISOString(),
        serviceDate: '2026-07-11',
        scope: 'FULLDAY',
        lockedShiftNames: ['MORNING', 'AFTERNOON'],
        lockedLineCount: scenario.statuses.length,
      })
      return
    }

    if (pathname.endsWith('/orders/signoff')) {
      scenario.signoffRequests.push(request)
      const oldStatuses = [...new Set(scenario.statuses)]
      scenario.statuses = scenario.statuses.map(() => 'COMPLETED')
      await fulfillJson(route, {
        success: true,
        serviceDate: '2026-07-11',
        shiftName: 'MORNING',
        affectedPlanCount: scenario.statuses.length,
        oldStatuses,
        newStatus: 'COMPLETED',
        changedAt: new Date().toISOString(),
      })
      return
    }

    if (pathname.endsWith('/orders/unlock')) {
      scenario.unlockRequests.push(request)
      const oldStatuses = [...new Set(scenario.statuses)]
      scenario.statuses = scenario.statuses.map(() => 'DRAFT')
      await fulfillJson(route, {
        success: true,
        serviceDate: '2026-07-11',
        shiftName: 'MORNING',
        affectedPlanCount: scenario.statuses.length,
        oldStatuses,
        newStatus: 'DRAFT',
        changedAt: new Date().toISOString(),
      })
      return
    }

    const url = new URL(request.url())
    const dayOfWeek = url.searchParams.get('dayOfWeek') ?? 't2'
    const shiftName = url.searchParams.get('shiftName') ?? 'MORNING'
    await fulfillJson(route, scenario.statuses.map((_, index) => buildOrder(index + 1, dayOfWeek, shiftName)))
  })

  return scenario
}

const openCoordination = async (page: Page) => {
  await page.setViewportSize({ width: 1365, height: 900 })
  await page.goto(ROUTES.MEAL_ORDERS)
  await expect(page.getByRole('heading', { name: 'Điều phối suất ăn' })).toBeVisible()
}

const actionButtons = (page: Page) => ({
  lock: page.getByRole('button', { name: 'Chốt đơn cả ngày' }),
  signoff: page.getByRole('button', { name: 'Hoàn tất ca' }),
  unlock: page.getByRole('button', { name: 'Mở khóa ca' }),
  export: page.getByRole('button', { name: 'Xuất báo cáo' }),
})

test.describe('coordination business state coverage', () => {
  for (const state of [
    { status: 'DRAFT', lock: true, signoff: false, unlock: false, export: false },
    { status: 'FORECASTED', lock: true, signoff: false, unlock: false, export: false },
    { status: 'CONFIRMED', lock: false, signoff: true, unlock: true, export: true },
    { status: 'ADJUSTED', lock: false, signoff: true, unlock: true, export: true },
    { status: 'COMPLETED', lock: false, signoff: false, unlock: false, export: false },
    { status: 'ARCHIVED', lock: false, signoff: false, unlock: false, export: false },
    { status: 'CANCELLED', lock: false, signoff: false, unlock: false, export: false },
  ]) {
    test(`${state.status} exposes only legal actions and edit controls`, async ({ page }) => {
      await stubCoordinationScenario(page, [state.status])
      await openCoordination(page)
      const buttons = actionButtons(page)

      for (const [button, visible] of [
        [buttons.lock, state.lock],
        [buttons.signoff, state.signoff],
        [buttons.unlock, state.unlock],
        [buttons.export, state.export],
      ] as const) {
        await expect(button).toHaveCount(visible ? 1 : 0)
        if (visible) await expect(button).toBeEnabled()
      }

      const servingInputs = page.getByRole('spinbutton')
      await expect(servingInputs.nth(0)).toBeEnabled({ enabled: state.status === 'DRAFT' || state.status === 'FORECASTED' })
      await expect(servingInputs.nth(1)).toBeEnabled({ enabled: state.status === 'CONFIRMED' || state.status === 'ADJUSTED' })
    })
  }

  test('empty and mixed plans fail closed', async ({ page }) => {
    await stubCoordinationScenario(page, [])
    await openCoordination(page)
    for (const button of Object.values(actionButtons(page))) {
      if (await button.count()) await expect(button).toBeDisabled()
    }

    const mixedPage = await page.context().newPage()
    await stubCoordinationScenario(mixedPage, ['DRAFT', 'CONFIRMED'])
    await openCoordination(mixedPage)
    await expect(mixedPage.getByText('Trạng thái kế hoạch chưa đồng nhất')).toBeVisible()
    for (const button of Object.values(actionButtons(mixedPage))) {
      if (await button.count()) await expect(button).toBeDisabled()
    }
    await expect(mixedPage.getByRole('spinbutton').nth(0)).toBeDisabled()
    await expect(mixedPage.getByRole('spinbutton').nth(1)).toBeDisabled()
  })

  test('switching shifts derives fresh permissions without leaking the previous lock state', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await stubCoordinationScenario(page, ['CONFIRMED'])
    await page.route('**/api/coordination/meal-quantity-plans**', async (route) => {
      const shiftName = new URL(route.request().url()).searchParams.get('shiftName') ?? 'MORNING'
      await fulfillJson(route, [{
        quantityPlanId: `plan-${shiftName}`,
        planCode: `PLAN-${shiftName}`,
        serviceDate: '2026-07-11',
        dayOfWeek: 't7',
        status: shiftName === 'MORNING' ? 'CONFIRMED' : 'DRAFT',
        lines: [],
      }])
    })
    await openCoordination(page)

    await expect(actionButtons(page).lock).toHaveCount(0)
    await expect(page.getByRole('spinbutton').nth(0)).toBeDisabled()
    await expect(page.getByRole('spinbutton').nth(1)).toBeEnabled()

    await page.getByRole('button', { name: 'Ca Sáng' }).click()
    await page.getByRole('button', { name: 'Ca Chiều' }).click()
    await expect(actionButtons(page).lock).toBeEnabled()
    await expect(page.getByRole('spinbutton').nth(0)).toBeEnabled()
    await expect(page.getByRole('spinbutton').nth(1)).toBeDisabled()

    await page.getByRole('button', { name: 'Ca Chiều' }).click()
    await page.getByRole('button', { name: 'Ca Sáng' }).click()
    await expect(actionButtons(page).lock).toHaveCount(0)
    await expect(page.getByRole('spinbutton').nth(1)).toBeEnabled()
    expect(consoleErrors.filter((message) => message.includes('same key'))).toEqual([])
  })

  test('lock cancellation sends nothing; confirmation sends exactly one FULLDAY request', async ({ page }) => {
    const scenario = await stubCoordinationScenario(page, ['DRAFT', 'FORECASTED'])
    await openCoordination(page)

    await actionButtons(page).lock.click()
    const dialog = page.getByRole('dialog', { name: 'Chốt đơn cả ngày?' })
    await dialog.getByRole('button', { name: 'Hủy' }).click()
    expect(scenario.lockRequests).toHaveLength(0)

    await actionButtons(page).lock.click()
    await dialog.getByRole('button', { name: 'Chốt cả ngày' }).click()
    await expect.poll(() => scenario.lockRequests.length).toBe(1)
    expect(scenario.lockRequests[0].postDataJSON()).toMatchObject({ scope: 'FULLDAY', shiftName: 'MORNING' })
    await expect(page.getByText('Ca này đã khóa', { exact: true })).toBeVisible()
  })

  test('signoff sends one batch request for the selected shift', async ({ page }) => {
    const scenario = await stubCoordinationScenario(page, ['CONFIRMED', 'ADJUSTED'])
    await openCoordination(page)

    await actionButtons(page).signoff.click()
    await page.getByRole('dialog', { name: 'Hoàn tất ca này?' })
      .getByRole('button', { name: 'Hoàn tất ca' }).click()

    await expect.poll(() => scenario.signoffRequests.length).toBe(1)
    expect(scenario.signoffRequests[0].postDataJSON()).toMatchObject({ shiftName: 'MORNING' })
    await expect(page.getByText('Ca này đã hoàn tất', { exact: true })).toBeVisible()
  })

  test('manager can batch unlock while coordinator cannot see the command', async ({ page }) => {
    const scenario = await stubCoordinationScenario(page, ['CONFIRMED'], 'quanly')
    await openCoordination(page)
    await actionButtons(page).unlock.click()
    await page.getByRole('dialog', { name: 'Mở khóa ca này?' })
      .getByRole('button', { name: 'Mở khóa ca' }).click()
    await expect.poll(() => scenario.unlockRequests.length).toBe(1)
    expect(scenario.unlockRequests[0].postDataJSON()).toMatchObject({ shiftName: 'MORNING' })

    const coordinatorPage = await page.context().newPage()
    await stubCoordinationScenario(coordinatorPage, ['CONFIRMED'], 'dieuphoi')
    await openCoordination(coordinatorPage)
    await expect(actionButtons(coordinatorPage).unlock).toHaveCount(0)
  })

  test('duplicate dishes render once without React duplicate-key errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await stubCoordinationScenario(page, ['DRAFT'])
    await openCoordination(page)

    await expect(page.getByText('Cơm gà', { exact: true })).toHaveCount(1)
    expect(consoleErrors.filter((message) => message.includes('same key'))).toEqual([])
  })

  test('compact worklist keeps shift context truthful and opens dish details without another request', async ({ page }) => {
    const menuScheduleRequests: Request[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/coordination/menu-schedules')) menuScheduleRequests.push(request)
    })
    await stubCoordinationScenario(page, ['DRAFT'])
    await openCoordination(page)

    await expect(page.locator('.ipc-order-table thead th')).toHaveCount(6)
    await expect(page.locator('.ipc-header-context')).toContainText('Ca Sáng · Điều phối ca')
    await expect(page.getByText('Chờ dữ liệu backend', { exact: true })).toHaveCount(0)
    await expect(page.getByText('DISH-01', { exact: true })).toHaveCount(0)
    expect(menuScheduleRequests).toHaveLength(0)

    await page.getByRole('button', { name: 'Xem chi tiết thực đơn của Khách hàng 1' }).click()
    const dialog = page.getByRole('dialog', { name: 'Chi tiết thực đơn' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Cơm gà', { exact: true })).toHaveCount(1)
    for (const role of ['Món chính', 'Món phụ', 'Canh', 'Trái cây', 'Tráng miệng']) {
      await expect(dialog.getByRole('heading', { name: role })).toBeVisible()
    }
    await expect(dialog.getByText('Phụ 1', { exact: true })).toBeVisible()
    expect(menuScheduleRequests).toHaveLength(0)
  })

  test('detail action gives immediate feedback while its lazy chunk is still loading', async ({ page }) => {
    await stubCoordinationScenario(page, ['DRAFT'])
    let releaseDialogChunk = () => undefined
    const dialogChunkGate = new Promise<void>((resolve) => {
      releaseDialogChunk = resolve
    })

    await page.route('**/src/features/coordination/components/dish-detail-dialog.tsx*', async (route) => {
      await dialogChunkGate
      await route.continue()
    })
    await openCoordination(page)

    await page.getByRole('button', { name: 'Xem chi tiết thực đơn của Khách hàng 1' }).click()
    const dialog = page.getByRole('dialog', { name: 'Chi tiết thực đơn' })
    await expect(dialog.getByRole('status')).toContainText('Đang mở chi tiết thực đơn')

    releaseDialogChunk()
    await expect(dialog.getByRole('heading', { name: 'Món chính' })).toBeVisible()
  })

  test('legacy order payload resolves dish roles from menu schedule only after opening details', async ({ page }) => {
    await stubCoordinationScenario(page, ['COMPLETED'])
    const sourceOrder = buildOrder(1, 't6', 'MORNING')
    const legacyOrder = {
      ...sourceOrder,
      dishes: sourceOrder.dishes.map((dish) => ({
        dishId: dish.dishId,
        dishCode: dish.dishCode,
        dishName: dish.dishName,
      })),
    }
    let menuScheduleRequests = 0

    await page.route('**/api/coordination/orders**', async (route) => {
      const url = new URL(route.request().url())
      if (route.request().method() === 'GET' && url.pathname.endsWith('/coordination/orders')) {
        await fulfillJson(route, [legacyOrder])
        return
      }
      await route.fallback()
    })
    await page.route('**/api/coordination/menu-schedules**', async (route) => {
      menuScheduleRequests += 1
      const dishTypes: Record<string, string> = {
        'dish-shared': 'Món chính',
        'dish-side': 'Món phụ',
        'dish-soup': 'Món Canh',
        'dish-fruit': 'Trái cây',
        'dish-dessert': 'Tráng miệng',
      }
      await fulfillJson(route, [{
        menuScheduleId: sourceOrder.menuScheduleId,
        menuId: sourceOrder.menuId,
        customerId: sourceOrder.customerId,
        serviceDate: sourceOrder.serviceDate,
        shiftName: sourceOrder.shiftName,
        dishes: sourceOrder.dishes.map((dish) => ({
          dishId: dish.dishId,
          dishCode: dish.dishCode,
          dishName: dish.dishName,
          dishType: dishTypes[dish.dishId],
          displayOrder: dish.displayOrder,
        })),
      }])
    })

    await openCoordination(page)
    expect(menuScheduleRequests).toBe(0)
    await page.getByRole('button', { name: 'Xem chi tiết thực đơn của Khách hàng 1' }).click()
    await expect.poll(() => menuScheduleRequests).toBe(1)

    const dialog = page.getByRole('dialog', { name: 'Chi tiết thực đơn' })
    for (const role of ['Món chính', 'Món phụ', 'Canh', 'Trái cây', 'Tráng miệng']) {
      await expect(dialog.getByRole('heading', { name: role })).toBeVisible()
    }
    await expect(dialog.getByRole('heading', { name: 'Chưa phân loại' })).toHaveCount(0)
  })
})
