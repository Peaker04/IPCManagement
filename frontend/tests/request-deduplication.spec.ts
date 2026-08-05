import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, type Page, test } from '@playwright/test'

import { ROUTES } from '../src/lib/routeConfig'

const viewports = [
  { id: '1920x1080', width: 1920, height: 1080 },
  { id: '1440x900', width: 1440, height: 900 },
  { id: '1366x768', width: 1366, height: 768 },
  { id: '1365x900', width: 1365, height: 900 },
  { id: '1280x900', width: 1280, height: 900 },
] as const

const artifactRoot = path.resolve('../.artifacts/shipyard-live/request-deduplication-20260803')

test.use({ channel: 'chrome' })

const fulfillJson = async (
  route: Parameters<Parameters<Page['route']>[1]>[0],
  data: unknown,
) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, message: 'OK', data }),
})

test('pointer, focus, touch, and navigation share one request owner at every canonical desktop viewport', async ({ page }) => {
  await fs.mkdir(artifactRoot, { recursive: true })
  const apiRequests: Array<{ viewport: string; method: string; requestKey: string }> = []
  const consoleErrors: Array<{ viewport: string; text: string }> = []
  const pageErrors: Array<{ viewport: string; text: string }> = []
  let activeViewport = 'startup'

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push({ viewport: activeViewport, text: message.text() })
  })
  page.on('pageerror', (error) => pageErrors.push({ viewport: activeViewport, text: error.message }))
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }
    const requestKey = request.method() + ' ' + url.pathname + url.search
    apiRequests.push({ viewport: activeViewport, method: request.method(), requestKey })

    if (url.pathname === '/api/auth/profile') {
      await fulfillJson(route, {
        userId: 'request-owner-admin',
        username: 'admin',
        fullName: 'Admin User',
        roleCode: 'ADMIN',
        roleName: 'Admin',
        isAdminFullAccess: true,
        permissions: ['*'],
      })
      return
    }
    if (url.pathname === '/api/coordination/customers') {
      await fulfillJson(route, [{ customerId: 'customer-anv', customerCode: 'ANV', customerName: 'ANV' }])
      return
    }
    if (url.pathname === '/api/coordination/customer-contracts') {
      await fulfillJson(route, [{
        contractId: 'contract-anv',
        customerId: 'customer-anv',
        customerCode: 'ANV',
        customerName: 'ANV',
        isActive: true,
        contractStatus: 'ACTIVE',
        menuScheduleCount: 0,
        activeWeekDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
        shiftNames: ['MORNING', 'AFTERNOON'],
        defaultMenuPrice: 25_000,
        defaultBomRatePercent: 100,
      }])
      return
    }
    if (url.pathname === '/api/workflow-reports/operational-kpis') {
      await fulfillJson(route, {
        shortageCount: 0,
        lowStockCount: 0,
        overduePurchaseRequestCount: 0,
        lateReceiptCount: 0,
        pendingKitchenConfirmationCount: 0,
        failedWorkflowCount: 0,
        criticalDataQualityCount: 0,
        overdueApprovalCount: 0,
        generatedAt: '2026-08-03T00:00:00Z',
      })
      return
    }
    await fulfillJson(route, [])
  })

  await page.addInitScript(() => {
    window.sessionStorage.setItem('token', 'dev-login-fallback-token-admin')
    window.localStorage.setItem('user', JSON.stringify({
      id: 'request-owner-admin',
      username: 'admin',
      fullName: 'Admin User',
      role: 'admin',
      roleCode: 'ADMIN',
      roleName: 'Admin',
      isAdminFullAccess: true,
      permissions: ['*'],
    }))
  })

  const results = []
  for (const viewport of viewports) {
    activeViewport = viewport.id
    const interactionStart = apiRequests.length
    await page.setViewportSize(viewport)
    await page.goto(ROUTES.DASHBOARD)
    await expect(page.locator('.ipc-dashboard-frame')).toBeVisible()
    const weeklyMenuLink = page.getByRole('link', { name: 'Thực đơn tuần' })

    await weeklyMenuLink.hover()
    await weeklyMenuLink.focus()
    await weeklyMenuLink.dispatchEvent('touchstart')
    await weeklyMenuLink.click()
    await expect(page).toHaveURL(ROUTES.WEEKLY_MENU)
    await expect(page.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' })).toBeVisible()
    await page.waitForTimeout(200)

    const requests = apiRequests.slice(interactionStart)
    expect(requests.filter((request) => request.requestKey.includes('/api/coordination/customers'))).toHaveLength(1)
    const counts = new Map<string, number>()
    requests.forEach(({ requestKey }) => counts.set(requestKey, (counts.get(requestKey) ?? 0) + 1))
    const duplicates = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([requestKey, count]) => ({ requestKey, count }))
    const screenshot = path.join(artifactRoot, viewport.id + '.png')
    await page.screenshot({ path: screenshot, fullPage: true })
    results.push({ viewport: viewport.id, requests, duplicates, screenshot })
    expect(duplicates).toEqual([])
  }

  const evidence = {
    generatedAt: new Date().toISOString(),
    browser: 'Google Chrome headed via Playwright',
    viewports,
    results,
    consoleErrors,
    pageErrors,
  }
  await fs.writeFile(path.join(artifactRoot, 'request-deduplication.json'), JSON.stringify(evidence, null, 2))
  await test.info().attach('request-deduplication', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
