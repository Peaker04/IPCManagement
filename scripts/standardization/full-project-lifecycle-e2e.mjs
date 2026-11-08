import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '../../node_modules/@playwright/test/index.mjs'

const password = process.env.K6_PASSWORD
if (!password) throw new Error('K6_PASSWORD is required; default credentials are prohibited.')

const baseUrl = 'http://127.0.0.1:3010'
const database = 'ipc_e2e_template'
const customerCode = 'ANV'
const weekStartDate = '2026-08-03'
const missingBomDish = 'Món E2E thiếu BOM tuần 20260803'
const shortageBomDish = 'Bún bò chả cua'
const phase = process.env.IPC_FULL_LIFECYCLE_PHASE ?? 'discover'
const root = path.resolve('.artifacts/shipyard-live', process.env.IPC_FULL_LIFECYCLE_RUN ?? 'full-project-lifecycle-20260804')
const profile = path.resolve('.artifacts/browser-use-full-project-lifecycle')
await fs.mkdir(root, { recursive: true })
const databaseProbe = () => {
  const output = execFileSync('dotnet', [
    'run', '--project', 'backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj', '--no-build', '--',
    'weekly-menu-evidence', '--settings', 'backend/src/IPCManagement.Api/appsettings.json',
    '--database', database, '--week', weekStartDate,
  ], { cwd: path.resolve('.'), encoding: 'utf8' })
  const jsonLine = output.split(/\r?\n/).findLast((line) => line.trim().startsWith('{'))
  if (!jsonLine) throw new Error(`Database probe returned no JSON: ${output}`)
  return JSON.parse(jsonLine)
}

const evidence = {
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: { baseUrl, apiUrl: 'http://127.0.0.1:8010', database, credentialSource: 'K6_PASSWORD' },
  headed: true,
  phase,
  routes: [],
  apiResponses: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false,
  viewport: { width: 1365, height: 900 },
  args: ['--window-size=1365,900'],
})
const page = context.pages()[0] ?? await context.newPage()
let probe = 'startup'
const demandResponses = []
page.on('console', (message) => {
  if (message.type() === 'error') evidence.consoleErrors.push({ probe, text: message.text() })
})
page.on('pageerror', (error) => evidence.pageErrors.push({ probe, message: error.message }))
page.on('requestfailed', (request) => evidence.requestFailures.push({
  probe, method: request.method(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText ?? 'unknown',
}))
page.on('response', async (response) => {
  const url = new URL(response.url())
  if (!url.pathname.startsWith('/api/')) return
  const record = { probe, method: response.request().method(), status: response.status(), path: url.pathname }
  if (record.method === 'POST' && record.path === '/api/material-demand/generate') {
    const body = await response.json().catch(() => null)
    demandResponses.push({ ...record, body })
  }
  evidence.apiResponses.push(record)
})

const settle = async () => {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(350)
}
const selectOption = async (trigger, optionName) => {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}
const openWeeklyScope = async () => {
  await page.goto(`${baseUrl}/weekly-menu`)
  await settle()
  await selectOption(page.getByRole('combobox').first(), new RegExp(`^${customerCode} -`))
  await page.locator('input[type="date"]').first().fill(weekStartDate)
  await page.getByText(missingBomDish, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 })
}
const openSaturdayDemand = async () => {
  return openDemandDay(5)
}
const openDemandDay = async (dayIndex) => {
  await openWeeklyScope()
  await page.getByRole('tab', { name: 'Nhu cầu', exact: true }).click()
  await page.getByText('KHSX, kiểm tồn kho và nhu cầu xuất', { exact: true }).waitFor({ state: 'visible' })
  const previousDay = page.getByRole('button', { name: 'Ngày trước', exact: true })
  while (!await previousDay.isDisabled()) {
    await previousDay.click()
    await page.waitForTimeout(150)
  }
  for (let index = 0; index < dayIndex; index += 1) {
    await page.getByRole('button', { name: 'Ngày sau', exact: true }).click()
    await page.waitForTimeout(150)
  }
}

try {
  probe = 'login'
  await page.goto(`${baseUrl}/login`)
  await settle()
  if (await page.locator('#username').isVisible().catch(() => false)) {
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill(password)
    await Promise.all([
      page.waitForURL((url) => url.pathname !== '/login', { timeout: 20_000 }),
      page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(),
    ])
  }

  if (phase === 'publish') {
    evidence.databaseSnapshots = { before: databaseProbe() }
    probe = 'publish:weekly-menu'
    await openWeeklyScope()
    await page.screenshot({ path: path.join(root, 'publish-before.png'), fullPage: true })
    const publishResponse = page.waitForResponse((response) => response.request().method() === 'PATCH'
      && /\/api\/coordination\/menu-schedules\/[^/]+\/version$/.test(new URL(response.url()).pathname))
    await page.getByRole('button', { name: 'Xuất bản tuần', exact: true }).click()
    const response = await publishResponse
    const body = await response.json().catch(() => null)
    evidence.publish = { status: response.status(), body }
    if (response.status() !== 200 || body?.data?.menuVersionStatus !== 'ACTIVE') {
      throw new Error(`Weekly menu publish failed: ${JSON.stringify(body)}`)
    }
    await page.reload()
    await settle()
    await page.getByText(missingBomDish, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 })
    if (await page.getByRole('button', { name: 'Xuất bản tuần', exact: true }).count()) {
      throw new Error('Publish action remained available after the active version reloaded.')
    }
    evidence.databaseSnapshots.after = databaseProbe()
    await page.screenshot({ path: path.join(root, 'publish-after-reload.png'), fullPage: true })
  } else if (phase === 'shortage-menu') {
    probe = 'shortage-menu:replace-saturday-afternoon-savory'
    await openWeeklyScope()
    evidence.databaseSnapshots = { before: databaseProbe() }
    await page.getByRole('button', { name: 'Chỉnh sửa thực đơn', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa thực đơn tuần' })
    await dialog.waitFor({ state: 'visible' })
    const afternoonSavory = dialog.getByRole('heading', { name: 'MENU MẶN - CA CHIỀU', exact: true }).locator('..').locator('..')
    const saturdayDish = afternoonSavory.getByRole('combobox').last()
    await saturdayDish.click()
    await page.getByRole('option', { name: shortageBomDish, exact: true }).click()
    await page.screenshot({ path: path.join(root, 'shortage-menu-before-save.png'), fullPage: true })
    const saveResponse = page.waitForResponse((response) => response.request().method() === 'PUT'
      && new URL(response.url()).pathname === '/api/coordination/weekly-menu/bulk-update')
    await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    const response = await saveResponse
    const body = await response.json().catch(() => null)
    evidence.shortageMenu = { status: response.status(), body }
    if (response.status() !== 200 || body?.success !== true) throw new Error(`Saturday shortage dish update failed: ${JSON.stringify(body)}`)
    await page.reload()
    await settle()
    await selectOption(page.getByRole('combobox').first(), new RegExp(`^${customerCode} -`))
    await page.locator('input[type="date"]').first().fill(weekStartDate)
    await page.getByText(shortageBomDish, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 })
    evidence.databaseSnapshots.after = databaseProbe()
    await page.screenshot({ path: path.join(root, 'shortage-menu-after-reload.png'), fullPage: true })
  } else if (phase === 'servings') {
    probe = 'servings:weekly-menu'
    await openSaturdayDemand()
    const completionButtonNames = ['Hoàn tất Ca Sáng', 'Hoàn tất Ca Chiều']
    const completionButtonCount = await page.getByRole('button', { name: /Hoàn tất Ca (Sáng|Chiều)/ }).count()
    const alreadyCompleted = await page.getByText('2/2 ca hoàn tất', { exact: true }).count() > 0
    if (completionButtonCount !== 2 && !alreadyCompleted) {
      throw new Error(`Expected two Saturday serving completion controls, found ${completionButtonCount}.`)
    }
    evidence.databaseSnapshots = { before: databaseProbe() }
    await page.screenshot({ path: path.join(root, 'servings-before.png'), fullPage: true })
    if (!alreadyCompleted) {
      const servingInputs = page.locator('#demand-panel input[type="number"]')
      if (await servingInputs.count() < 2) throw new Error('Saturday serving inputs are not available.')
      for (const [input, servings] of [[servingInputs.first(), '840'], [servingInputs.last(), '870']]) {
        if (await input.inputValue() === servings) continue
        const saveResponse = page.waitForResponse((response) => response.request().method() === 'POST'
          && new URL(response.url()).pathname === '/api/coordination/meal-quantity-plans/quick-servings')
        await input.fill(servings)
        await input.press('Tab')
        const response = await saveResponse
        const body = await response.json().catch(() => null)
        if (response.status() !== 200 || body?.data?.status !== 'FORECASTED') {
          throw new Error(`Serving draft save failed: ${JSON.stringify(body)}`)
        }
      }
      await openSaturdayDemand()
      for (const buttonName of completionButtonNames) {
        if (await page.getByRole('button', { name: buttonName, exact: true }).isDisabled()) {
          throw new Error(`${buttonName} remained disabled after a positive serving value was saved.`)
        }
      }
      for (const buttonName of completionButtonNames) {
        const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
          && new URL(response.url()).pathname === '/api/coordination/meal-quantity-plans/quick-servings')
        await page.getByRole('button', { name: buttonName, exact: true }).click()
        const response = await responsePromise
        const body = await response.json().catch(() => null)
        evidence.apiResponses.push({ probe, method: 'POST', status: response.status(), path: '/api/coordination/meal-quantity-plans/quick-servings', body })
        if (response.status() !== 200 || body?.data?.status !== 'COMPLETED') {
          throw new Error(`Serving completion failed: ${JSON.stringify(body)}`)
        }
      }
    }
    await page.reload()
    await settle()
    await selectOption(page.getByRole('combobox').first(), new RegExp(`^${customerCode} -`))
    await page.locator('input[type="date"]').first().fill(weekStartDate)
    await page.getByRole('tab', { name: 'Nhu cầu', exact: true }).click()
    await page.getByText('KHSX, kiểm tồn kho và nhu cầu xuất', { exact: true }).waitFor({ state: 'visible' })
    for (let index = 0; index < 4; index += 1) await page.getByRole('button', { name: 'Ngày sau', exact: true }).click()
    if (await page.getByText('2/2 ca hoàn tất', { exact: true }).count() !== 1) {
      throw new Error('Saturday serving completion did not persist after reload.')
    }
    evidence.databaseSnapshots.after = databaseProbe()
    await page.screenshot({ path: path.join(root, 'servings-after-reload.png'), fullPage: true })
  } else if (phase === 'week-servings') {
    probe = 'servings:full-week'
    evidence.databaseSnapshots = { before: databaseProbe() }
    evidence.weekServings = []
    for (let dayIndex = 0; dayIndex < 6; dayIndex += 1) {
      await openDemandDay(dayIndex)
      const completed = await page.getByText('2/2 ca hoàn tất', { exact: true }).count() === 1
      if (!completed) {
        const inputs = page.locator('#demand-panel input[type="number"]')
        if (await inputs.count() < 2) throw new Error(`Day ${dayIndex + 1} has no serving inputs.`)
        for (const [input, servings] of [[inputs.first(), '840'], [inputs.last(), '870']]) {
          if (await input.inputValue() === servings) continue
          const saveResponse = page.waitForResponse((response) => response.request().method() === 'POST'
            && new URL(response.url()).pathname === '/api/coordination/meal-quantity-plans/quick-servings')
          await input.fill(servings)
          await input.press('Tab')
          const response = await saveResponse
          if (response.status() !== 200) throw new Error(`Day ${dayIndex + 1} serving save failed.`)
        }
        await openDemandDay(dayIndex)
        for (const buttonName of ['Hoàn tất Ca Sáng', 'Hoàn tất Ca Chiều']) {
          const button = page.getByRole('button', { name: buttonName, exact: true })
          if (await button.isDisabled()) throw new Error(`${buttonName} is disabled for day ${dayIndex + 1}.`)
          const completionResponse = page.waitForResponse((response) => response.request().method() === 'POST'
            && new URL(response.url()).pathname === '/api/coordination/meal-quantity-plans/quick-servings')
          await button.click()
          const response = await completionResponse
          const body = await response.json().catch(() => null)
          if (response.status() !== 200 || body?.data?.status !== 'COMPLETED') throw new Error(`Day ${dayIndex + 1} completion failed.`)
        }
        await openDemandDay(dayIndex)
      }
      if (await page.getByText('2/2 ca hoàn tất', { exact: true }).count() !== 1) {
        throw new Error(`Day ${dayIndex + 1} did not persist serving completion.`)
      }
      evidence.weekServings.push({ dayIndex: dayIndex + 1, completed: true })
    }
    await openSaturdayDemand()
    evidence.databaseSnapshots.after = databaseProbe()
    await page.screenshot({ path: path.join(root, 'week-servings-after-reload.png'), fullPage: true })
  } else if (phase === 'demand') {
    probe = 'demand:saturday'
    await openSaturdayDemand()
    if (await page.getByText('2/2 ca hoàn tất', { exact: true }).count() !== 1) {
      throw new Error('Saturday servings must be completed before material demand generation.')
    }
    evidence.databaseSnapshots = { before: databaseProbe() }
    await page.screenshot({ path: path.join(root, 'demand-before.png'), fullPage: true })
    const demandResponseCountBefore = demandResponses.length
    await page.getByRole('button', { name: 'Tạo nhu cầu từ KHSX', exact: true }).click()
    const deadline = Date.now() + 90_000
    while (demandResponses.length - demandResponseCountBefore < 6 && Date.now() < deadline) await page.waitForTimeout(250)
    const generated = demandResponses.slice(demandResponseCountBefore)
    const saturday = generated.find((item) => item.body?.data?.serviceDate === '2026-08-08')
    evidence.demand = { generated }
    const shortageLineCount = saturday?.body?.data?.lines?.filter((line) => Number(line.suggestedPurchaseQty) > 0).length ?? 0
    evidence.demand.shortageLineCount = shortageLineCount
    if (generated.length !== 6 || saturday?.status !== 200 || !(saturday.body?.data?.lines?.length > 0) || !(saturday.body?.data?.missingBomDishes?.length > 0) || (phase === 'demand' && shortageLineCount <= 0)) {
      throw new Error(`Demand did not retain complete-BOM, missing-BOM, and shortage branches: ${JSON.stringify(generated)}`)
    }
    await openSaturdayDemand()
    await page.getByText('Một số món từ tệp chưa có định lượng BOM', { exact: true }).waitFor({ state: 'visible' })
    if (await page.getByText(/Nguyên liệu trong ngày/).count() < 1) {
      throw new Error('Generated demand did not render after reload.')
    }
    evidence.databaseSnapshots.after = databaseProbe()
    await page.screenshot({ path: path.join(root, 'demand-after-reload.png'), fullPage: true })
  } else if (phase === 'approve-demand') {
    const requestCode = 'MR-ANV-20260808-FULLDAY'
    probe = 'approval:saturday-demand'
    await page.goto(`${baseUrl}/approvals`)
    await settle()
    await page.getByLabel('Tìm chứng từ hoặc nguyên liệu').fill(requestCode)
    const record = page.locator('[id^="approval-record-"]').filter({ hasText: requestCode })
    if (await record.count()) {
      await page.screenshot({ path: path.join(root, 'approval-before.png'), fullPage: true })
      await record.getByRole('button', { name: 'Duyệt nhu cầu', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Duyệt nhu cầu nguyên liệu?' })
      await dialog.getByLabel('Ghi chú duyệt (tùy chọn)').fill('E2E: duyệt nhu cầu Saturday sau khi kiểm BOM.')
      const approvalResponse = page.waitForResponse((response) => response.request().method() === 'POST'
        && /^\/api\/approvals\/material-demand\/[^/]+$/.test(new URL(response.url()).pathname))
      await dialog.getByRole('button', { name: 'Duyệt nhu cầu', exact: true }).click()
      const response = await approvalResponse
      const body = await response.json().catch(() => null)
      evidence.approval = { status: response.status(), body }
      if (response.status() !== 200 || !['MANAGERAPPROVED', 'APPROVED'].includes(body?.data?.newStatus)) throw new Error(`Demand approval failed: ${JSON.stringify(body)}`)
    } else {
      evidence.approval = { alreadyProcessed: true }
    }
    await page.reload()
    await settle()
    await page.getByLabel('Tìm chứng từ hoặc nguyên liệu').fill(requestCode)
    if (await page.locator('[id^="approval-record-"]').filter({ hasText: requestCode }).count()) {
      throw new Error('Approved Saturday demand remained in the pending approval inbox after reload.')
    }
    await page.screenshot({ path: path.join(root, 'approval-after-reload.png'), fullPage: true })
  } else if (phase === 'purchase-request') {
    const requestCode = 'MR-ANV-20260808-FULLDAY'
    probe = 'purchase:create-request'
    await page.goto(`${baseUrl}/purchasing?week=${weekStartDate}&date=2026-08-08&stage=demand`)
    await settle()
    await page.getByRole('heading', { name: 'Thu mua theo nhu cầu đã duyệt' }).waitFor({ state: 'visible' })
    const demandSelect = page.getByLabel('Nhu cầu nguyên liệu đã duyệt')
    await demandSelect.waitFor({ state: 'visible', timeout: 20_000 })
    await demandSelect.click()
    const demandOption = page.getByRole('option', { name: new RegExp(`^${requestCode} -`) })
    if (!await demandOption.count()) throw new Error(`Approved demand ${requestCode} is absent from the purchasing selector.`)
    await demandOption.click()
    await page.screenshot({ path: path.join(root, 'purchase-request-before.png'), fullPage: true })
    await page.locator('#purchase-decision-panel').getByRole('button', { name: 'Tạo đề xuất mua', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo đề xuất mua' })
    const createResponse = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/purchase-workflow/from-demand')
    await dialog.getByRole('button', { name: 'Tạo đề xuất mua', exact: true }).click()
    const response = await createResponse
    const body = await response.json().catch(() => null)
    evidence.purchaseRequest = { status: response.status(), body }
    if (response.status() !== 200 || body?.data?.status !== 'DRAFT' || !(body?.data?.lines?.length > 0)) {
      throw new Error(`Purchase request creation failed: ${JSON.stringify(body)}`)
    }
    await page.goto(`${baseUrl}/purchasing?week=${weekStartDate}&date=2026-08-08&stage=supplier-price`)
    await settle()
    await page.getByRole('heading', { name: 'Thu mua theo nhu cầu đã duyệt' }).waitFor({ state: 'visible', timeout: 20_000 })
    await page.getByText('Quyết định thu mua', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 })
    if (await page.getByText('Chọn nhà cung cấp và giá', { exact: true }).count() < 1) {
      throw new Error('Purchase request did not advance the reloaded workbench to supplier-price.')
    }
    await page.screenshot({ path: path.join(root, 'purchase-request-after-reload.png'), fullPage: true })
  } else {
    for (const route of [
      '/weekly-menu',
      '/meal-orders',
      '/approvals',
      '/purchasing?week=2026-08-03&date=2026-08-08&stage=demand',
      '/warehouse?week=2026-08-03',
      '/chef-dashboard?date=2026-08-08',
      '/reports',
    ]) {
      probe = `discover:${route}`
      await page.goto(`${baseUrl}${route}`)
      await settle()
      const controls = await page.getByRole('button').allTextContents()
      const headings = await page.getByRole('heading').allTextContents()
      evidence.routes.push({ route, headings, controls })
      await page.screenshot({ path: path.join(root, `${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.png`), fullPage: true })
    }
  }
} catch (error) {
  evidence.failure = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
  throw error
} finally {
  evidence.finishedAt = new Date().toISOString()
  await fs.writeFile(path.join(root, 'browser-control-discovery.json'), `${JSON.stringify(evidence, null, 2)}\n`)
  await context.close()
}
