#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const BASE_URL = process.env.DUAL_MODE_BASE_URL || 'http://127.0.0.1:3001'
const USERNAME = process.env.DUAL_MODE_USERNAME || ''
const PASSWORD = process.env.DUAL_MODE_PASSWORD || ''
const REPORT = process.env.DUAL_MODE_REPORT || '../.artifacts/perf/dual-mode-fluidity/report.json'
const PRIMARY = { width: 1440, height: 900 }
const VIEWPORTS = [{ width: 1366, height: 768 }, PRIMARY, { width: 1920, height: 1080 }]
const MODES = ['DEFAULT', 'MATERIAL_RECONCILIATION']
const routePaths = {
  dashboard: '/',
  'weekly-menu': '/weekly-menu',
  'meal-orders': '/meal-orders',
  approvals: '/approvals',
  purchasing: '/purchasing',
  warehouse: '/warehouse',
  'chef-dashboard': '/chef-dashboard',
  reports: '/reports',
  'admin-data': '/admin-data',
  'approval-rules': '/admin/rules',
  reconciliation: '/reconciliation',
}
const tabAliases = { 'material-demand': 'demand' }
const tabCapabilityKeys = { 'chef-dashboard': 'chef' }
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const percentile = (values, value) => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] : null
}
const initMetrics = () => {
  window.__dualModeMetrics = { frames: [], loafs: [], shifts: [], events: [], eventSupported: false }
  let last = performance.now()
  requestAnimationFrame(function frame(now) {
    window.__dualModeMetrics.frames.push(now - last)
    last = now
    requestAnimationFrame(frame)
  })
  try {
    window.__dualModeMetrics.eventSupported = PerformanceObserver.supportedEntryTypes?.includes('event') === true
    if (window.__dualModeMetrics.eventSupported) new PerformanceObserver((list) => window.__dualModeMetrics.events.push(...list.getEntries().filter((entry) => entry.interactionId).map((entry) => ({
      name: entry.name, duration: entry.duration, inputDelay: entry.processingStart - entry.startTime,
      processing: entry.processingEnd - entry.processingStart, presentation: entry.startTime + entry.duration - entry.processingEnd,
    })))).observe({ type: 'event', buffered: true, durationThreshold: 16 })
  } catch (error) { window.__dualModeMetrics.eventError = String(error) }
  try {
    new PerformanceObserver((list) => window.__dualModeMetrics.loafs.push(...list.getEntries().map((entry) => ({
      duration: entry.duration,
      blockingDuration: entry.blockingDuration ?? 0,
      renderStart: entry.renderStart ?? null,
      styleAndLayoutStart: entry.styleAndLayoutStart ?? null,
      scriptCount: entry.scripts?.length ?? 0,
    })))).observe({ type: 'long-animation-frame', buffered: true })
  } catch (error) { window.__dualModeMetrics.loafError = String(error) }
  try {
    new PerformanceObserver((list) => window.__dualModeMetrics.shifts.push(...list.getEntries().filter((entry) => !entry.hadRecentInput).map((entry) => entry.value))).observe({ type: 'layout-shift', buffered: true })
  } catch (error) { window.__dualModeMetrics.shiftError = String(error) }
}

if (!USERNAME || !PASSWORD) throw new Error('DUAL_MODE_USERNAME và DUAL_MODE_PASSWORD là bắt buộc.')
await mkdir(dirname(REPORT), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false })
let originalSnapshot
let authToken
let authUser
const results = { schemaVersion: 'dual-mode-fluidity/v1', startedAt: new Date().toISOString(), cells: [], routeViewports: [], excludedRoutes: [], continuous: [], modeSnapshots: {}, modeTransitions: [], failures: [], needsEvidence: [] }

async function authenticate() {
  const context = await browser.newContext({ viewport: PRIMARY })
  const page = await context.newPage()
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('#username').fill(USERNAME)
  await page.locator('#password').fill(PASSWORD)
  await Promise.all([page.waitForURL((url) => url.pathname !== '/login'), page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()])
  await page.waitForSelector('.ipc-content-shell')
  authToken = await page.evaluate(() => sessionStorage.getItem('token'))
  authUser = await page.evaluate(() => sessionStorage.getItem('user'))
  if (!authToken || !authUser) throw new Error('Đăng nhập không tạo đủ token/user session.')
  originalSnapshot = await operationSnapshot(page)
  await context.close()
}
async function operationSnapshot(page) {
  return page.evaluate(async () => {
    const token = sessionStorage.getItem('token')
    const response = await fetch('/api/system-operation-mode', { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json()
    if (!response.ok || !body?.data) throw new Error(`operation-mode GET ${response.status}`)
    return body.data
  })
}
async function changeMode(page, mode, reason) {
  const before = await operationSnapshot(page)
  if (before.mode === mode) return before
  const after = await page.evaluate(async ({ mode, expectedVersion, reason }) => {
    const token = sessionStorage.getItem('token')
    const response = await fetch('/api/system-operation-mode', {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, expectedVersion, confirmed: true, reason }),
    })
    const body = await response.json()
    if (!response.ok || !body?.data) throw new Error(`operation-mode PUT ${response.status}: ${body?.message || ''}`)
    return body.data
  }, { mode, expectedVersion: before.version, reason })
  results.modeTransitions.push({ at: new Date().toISOString(), from: before.mode, fromVersion: before.version, to: after.mode, toVersion: after.version, reason })
  return after
}
async function newPage(viewport = PRIMARY) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(({ token, user }) => { sessionStorage.setItem('token', token); sessionStorage.setItem('user', user) }, { token: authToken, user: authUser })
  await context.addInitScript(initMetrics)
  const page = await context.newPage()
  return { context, page }
}
function targetUrl(route, tab) {
  const url = new URL(routePaths[route], BASE_URL)
  if (tab) url.searchParams.set('view', tabAliases[tab] || tab)
  return url.toString()
}
async function captureCell(modeSnapshot, route, tab) {
  const { context, page } = await newPage()
  const errors = []
  const requests = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push({ type: 'console', text: message.text() }) })
  page.on('pageerror', (error) => errors.push({ type: 'page', text: error.message }))
  page.on('requestfailed', (request) => errors.push({ type: 'request', text: `${request.method()} ${request.url()} ${request.failure()?.errorText}` }))
  page.on('response', (response) => { if (response.url().includes('/api/')) requests.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() }) })
  const started = Date.now()
  try {
    await page.goto(targetUrl(route, tab), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.ipc-content-shell', { timeout: 60000 })
    await page.waitForTimeout(1200)
    const observed = await operationSnapshot(page)
    if (observed.mode !== modeSnapshot.mode || observed.version !== modeSnapshot.version) throw new Error(`Mode drift ${observed.mode}/${observed.version}`)
    const metrics = await page.evaluate(() => {
      const frames = window.__dualModeMetrics.frames
      return {
        frames, loafs: window.__dualModeMetrics.loafs, loafError: window.__dualModeMetrics.loafError ?? null,
        cls: window.__dualModeMetrics.shifts.reduce((sum, value) => sum + value, 0),
        nodes: document.querySelectorAll('*').length,
        overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        h1: [...document.querySelectorAll('h1')].filter((node) => node.getClientRects().length).map((node) => node.textContent?.trim()),
        selectedTabs: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((node) => ({ id: node.id, text: node.textContent?.trim() })),
        activePanelIds: [...document.querySelectorAll('[role="tabpanel"]')].filter((node) => getComputedStyle(node).display !== 'none' && !node.hidden).map((node) => node.id),
      }
    })
    await page.evaluate(() => {
      window.__dualModeMetrics.frames.length = 0
      window.__dualModeMetrics.loafs.length = 0
      window.__dualModeMetrics.shifts.length = 0
      window.__dualModeMetrics.events.length = 0
    })
    const natural = { tabSwitch: 'NOT_APPLICABLE', search: 'NOT_APPLICABLE', filter: 'NOT_APPLICABLE', pagination: 'NOT_APPLICABLE', overlay: 'NOT_APPLICABLE' }
    const search = page.locator('input[type="search"], input[role="searchbox"]').first()
    if (await search.count() && await search.isVisible() && await search.isEnabled()) {
      await search.fill('a'); await page.waitForTimeout(150); await search.fill(''); natural.search = 'PASS'
    }
    const filter = page.getByRole('combobox').first()
    if (await filter.count() && await filter.isVisible() && await filter.isEnabled()) {
      await filter.click(); await page.waitForTimeout(80); await page.keyboard.press('Escape'); natural.filter = 'PASS'
    }
    const pagination = page.locator('nav[aria-label*="Phân trang"] button:not(:disabled)').first()
    if (await pagination.count() && await pagination.isVisible()) {
      await pagination.click(); await page.waitForTimeout(150); natural.pagination = 'PASS'
    }
    const overlayTrigger = page.locator('[aria-haspopup="dialog"], [data-modal-trigger]').first()
    if (await overlayTrigger.count() && await overlayTrigger.isVisible() && await overlayTrigger.isEnabled()) {
      await overlayTrigger.click(); await page.waitForTimeout(100)
      const dialog = page.getByRole('dialog')
      natural.overlay = await dialog.count() ? 'PASS' : 'FAIL'
      if (await dialog.count()) await page.keyboard.press('Escape')
    }
    const inactiveTab = page.locator('[role="tab"][aria-selected="false"]').first()
    if (await inactiveTab.count() && await inactiveTab.isVisible() && await inactiveTab.isEnabled()) {
      const targetName = (await inactiveTab.textContent())?.trim() || ''
      await inactiveTab.click(); await page.waitForTimeout(150)
      const selectedTarget = page.getByRole('tab', { name: targetName, exact: true }).first()
      natural.tabSwitch = await selectedTarget.count() && await selectedTarget.getAttribute('aria-selected') === 'true' ? 'PASS' : 'FAIL'
    }
    await page.waitForTimeout(300)
    const naturalRaw = await page.evaluate(() => ({
      frames: window.__dualModeMetrics.frames,
      loafs: window.__dualModeMetrics.loafs,
      shifts: window.__dualModeMetrics.shifts,
      events: window.__dualModeMetrics.events,
      eventSupported: window.__dualModeMetrics.eventSupported,
      eventError: window.__dualModeMetrics.eventError ?? null,
    }))
    const naturalFrames = naturalRaw.frames.slice(2)
    const naturalMetrics = {
      cls: naturalRaw.shifts.reduce((sum, value) => sum + value, 0),
      medianFrameMs: median(naturalFrames), p95FrameMs: percentile(naturalFrames, .95),
      longestFrameMs: naturalFrames.length ? Math.max(...naturalFrames) : null,
      framesOver16_67Ms: naturalFrames.filter((value) => value > 16.67).length,
      framesOver33_3Ms: naturalFrames.filter((value) => value > 33.3).length,
      loafs: naturalRaw.loafs, events: naturalRaw.events, eventSupported: naturalRaw.eventSupported, eventError: naturalRaw.eventError,
    }
    const frames = metrics.frames.slice(5)
    const expectedTab = tab ? (tabAliases[tab] || tab) : null
    const targetSelected = !expectedTab || [...metrics.selectedTabs, ...metrics.activePanelIds.map((id) => ({ id }))].some((item) => item.id?.includes(expectedTab))
    const expectedPath = routePaths[route]
    const routeMatched = new URL(page.url()).pathname === expectedPath
    const naturalFailed = Object.values(natural).includes('FAIL')
    return {
      mode: observed.mode, modeVersion: observed.version, route, tab: tab ?? null, url: page.url(), elapsedMs: Date.now() - started,
      verdict: errors.length || metrics.overflowPx > 1 || metrics.cls > 0.1 || naturalMetrics.cls > 0.1 || naturalFailed || !targetSelected || !routeMatched ? 'FAIL' : 'PASS', errors, requests,
      metrics: { cls: metrics.cls, nodes: metrics.nodes, overflowPx: metrics.overflowPx, medianFrameMs: median(frames), p95FrameMs: percentile(frames, .95), longestFrameMs: frames.length ? Math.max(...frames) : null, framesOver16_67Ms: frames.filter((value) => value > 16.67).length, framesOver33_3Ms: frames.filter((value) => value > 33.3).length, loafs: metrics.loafs, loafError: metrics.loafError },
      dom: { h1: metrics.h1, selectedTabs: metrics.selectedTabs, activePanelIds: metrics.activePanelIds, targetSelected, routeMatched }, natural, naturalMetrics,
    }
  } catch (error) {
    return { mode: modeSnapshot.mode, modeVersion: modeSnapshot.version, route, tab: tab ?? null, url: page.url(), verdict: 'FAIL', errors: [...errors, { type: 'runner', text: String(error) }], requests }
  } finally { await context.close() }
}
async function captureRouteViewport(modeSnapshot, route, viewport) {
  const { context, page } = await newPage(viewport)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(targetUrl(route), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.ipc-content-shell', { timeout: 60000 }); await page.waitForTimeout(700)
    const observed = await operationSnapshot(page)
    const finalPath = new URL(page.url()).pathname
    const ready = await page.locator('main[data-ui-owner]').evaluate((node) => node.getClientRects().length > 0 && (node.textContent?.trim().length ?? 0) > 0)
    const geometry = await page.evaluate(() => ({ overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth), cls: window.__dualModeMetrics.shifts.reduce((sum, value) => sum + value, 0), nodes: document.querySelectorAll('*').length }))
    return { mode: modeSnapshot.mode, modeVersion: observed.version, route, viewport, finalPath, ready, ...geometry, errors, verdict: observed.mode === modeSnapshot.mode && finalPath === routePaths[route] && ready && geometry.overflowPx <= 1 && geometry.cls <= 0.1 && !errors.length ? 'PASS' : 'FAIL' }
  } catch (error) { return { mode: modeSnapshot.mode, route, viewport, errors: [...errors, String(error)], verdict: 'FAIL' } }
  finally { await context.close() }
}

async function captureExcludedRoute(modeSnapshot, route) {
  const { context, page } = await newPage()
  const requests = []
  page.on('response', (response) => { if (response.url().includes('/api/')) requests.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() }) })
  try {
    const requestedPath = routePaths[route]
    await page.goto(new URL(requestedPath, BASE_URL).toString(), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(500)
    const observed = await operationSnapshot(page)
    const finalPath = new URL(page.url()).pathname
    const apiRequests = requests.filter((request) => request.path.startsWith('/api/'))
    const allowed = modeSnapshot.mode === 'DEFAULT'
      ? apiRequests.filter((request) => request.path !== '/api/system-operation-mode' && !request.path.startsWith('/api/workflow-reports/'))
      : apiRequests.filter((request) => request.path !== '/api/system-operation-mode' && request.path !== '/api/reconciliation/batches')
    const pass = observed.mode === modeSnapshot.mode && finalPath !== requestedPath && allowed.length === 0
    return { mode: modeSnapshot.mode, route, requestedPath, finalPath, requests, prohibited: allowed, verdict: pass ? 'PASS' : 'FAIL' }
  } catch (error) { return { mode: modeSnapshot.mode, route, verdict: 'FAIL', error: String(error), requests } }
  finally { await context.close() }
}

async function captureContinuousTabs(modeSnapshot, route, tabs) {
  const { context, page } = await newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(targetUrl(route, tabs[0]), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.ipc-content-shell', { timeout: 60000 }); await page.waitForTimeout(500)
    await page.evaluate(() => { window.__dualModeMetrics.frames.length = 0; window.__dualModeMetrics.loafs.length = 0; window.__dualModeMetrics.shifts.length = 0; window.__dualModeMetrics.events.length = 0 })
    const groupForTab = (tab) => {
      if (route === 'weekly-menu') {
        if (tab === 'schedule') return 'Soạn kế hoạch'
        if (['demand', 'production-plan', 'purchase-summary'].includes(tab)) return 'Thực thi tuần'
        if (['cost', 'dish-materials'].includes(tab)) return 'Phân tích'
      }
      if (route === 'reports') {
        if (tab === 'price') return 'Chi phí & giá'
        if (['demand', 'purchase'].includes(tab)) return 'Kế hoạch & nhu cầu'
        if (['stock', 'movement', 'kitchen', 'usage'].includes(tab)) return 'Kho & sử dụng'
        if (['audit', 'data-quality'].includes(tab)) return 'Kiểm soát'
      }
      return null
    }
    const samples = []
    for (let index = 0; index < 3; index += 1) for (const tab of [tabs[1], tabs[0]]) {
      if (route === 'weekly-menu') {
        const started = performance.now()
        await page.goto(targetUrl(route, tab), { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.ipc-content-shell'); await page.waitForTimeout(100)
        samples.push({ tab, elapsedMs: performance.now() - started, url: page.url() })
        continue
      }
      const alias = tabAliases[tab] || tab
      let target = page.locator(`[role="tab"][id*="${alias}"]:visible`).last()
      if (!await target.count()) {
        const groupName = groupForTab(alias)
        if (groupName) {
          const groupIds = {
            'Soạn kế hoạch': 'weekly-group-authoring-tab',
            'Thực thi tuần': 'weekly-group-execution-tab',
            'Phân tích': 'weekly-group-analysis-tab',
            'Chi phí & giá': 'report-group-cost-tab',
            'Kế hoạch & nhu cầu': 'report-group-planning-tab',
            'Kho & sử dụng': 'report-group-warehouse-tab',
            'Kiểm soát': 'report-group-control-tab',
          }
          await page.locator(`#${groupIds[groupName]}:visible`).click(); await page.waitForTimeout(60)
          target = page.locator(`[role="tab"][id*="${alias}"]:visible`).last()
        }
      }
      if (!await target.count()) throw new Error(`Không tìm thấy tab ${tab}`)
      await target.click(); await page.waitForTimeout(100)
      samples.push({ tab, url: page.url() })
    }
    const metrics = await page.evaluate(() => ({ frames: window.__dualModeMetrics.frames, loafs: window.__dualModeMetrics.loafs, shifts: window.__dualModeMetrics.shifts, events: window.__dualModeMetrics.events }))
    const documentResets = route === 'weekly-menu'
    const cls = documentResets ? null : metrics.shifts.reduce((sum, value) => sum + value, 0)
    return { mode: modeSnapshot.mode, kind: documentResets ? 'repeated-navigation' : 'repeated-tabs', route, tabs: tabs.slice(0, 2), actions: 6, samples, metricsScope: documentResets ? 'per-navigation elapsed/url; document metrics reset on navigation' : 'continuous-document', cls, longestFrameMs: documentResets ? null : Math.max(0, ...metrics.frames), loafs: documentResets ? [] : metrics.loafs, events: documentResets ? [] : metrics.events, errors, verdict: (cls == null || cls <= 0.1) && samples.length === 6 && !errors.length ? 'PASS' : 'FAIL' }
  } catch (error) { return { mode: modeSnapshot.mode, kind: route === 'weekly-menu' ? 'repeated-navigation' : 'repeated-tabs', route, tabs: tabs.slice(0, 2), errors: [...errors, String(error)], verdict: 'FAIL' } }
  finally { await context.close() }
}
async function captureHistory(modeSnapshot, routes) {
  const { context, page } = await newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(targetUrl(routes[0]), { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForTimeout(300)
    const samples = []
    for (const route of [routes[1], routes[2]]) { const started = performance.now(); await page.goto(targetUrl(route), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150); samples.push({ action: 'goto', route, elapsedMs: performance.now() - started, url: page.url() }) }
    let started = performance.now(); await page.goBack(); await page.waitForTimeout(150); samples.push({ action: 'back', elapsedMs: performance.now() - started, url: page.url() })
    started = performance.now(); await page.goForward(); await page.waitForTimeout(250); samples.push({ action: 'forward', elapsedMs: performance.now() - started, url: page.url() })
    return { mode: modeSnapshot.mode, kind: 'history-navigation', routes: routes.slice(0, 3), actions: 4, samples, metricsScope: 'per-navigation elapsed/url; document metrics reset on navigation', errors, verdict: samples.length === 4 && !errors.length ? 'PASS' : 'FAIL' }
  } catch (error) { return { mode: modeSnapshot.mode, kind: 'history-navigation', routes: routes.slice(0, 3), errors: [...errors, String(error)], verdict: 'FAIL' } }
  finally { await context.close() }
}

let controlPage
try {
  await authenticate()
  const control = await newPage()
  controlPage = control.page
  await controlPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  for (const mode of MODES) {
    const snapshot = await changeMode(controlPage, mode, `Đo interaction fluidity toàn bộ route/view ở ${mode}`)
    results.modeSnapshots[mode] = snapshot
    const routes = [...snapshot.capabilities.navigation]
    if (!routes.includes('admin-advanced-settings')) routes.push('admin-advanced-settings')
    routePaths['admin-advanced-settings'] = '/admin/advanced-settings'
    const cells = []
    for (const route of routes) {
      const tabKey = tabCapabilityKeys[route] || route
      const tabs = snapshot.capabilities.pageTabs?.[tabKey] || []
      if (tabs.length) tabs.forEach((tab) => cells.push({ route, tab }))
      else cells.push({ route, tab: null })
    }
    const uniqueCells = new Set(cells.map((cell) => `${cell.route}\0${cell.tab ?? ''}`))
    if (uniqueCells.size !== cells.length) throw new Error(`Duplicate denominator cells in ${mode}`)
    for (const cell of cells) results.cells.push(await captureCell(snapshot, cell.route, cell.tab))
    for (const route of routes) for (const viewport of VIEWPORTS) results.routeViewports.push(await captureRouteViewport(snapshot, route, viewport))
    for (const route of routes) {
      const tabKey = tabCapabilityKeys[route] || route
      const tabs = snapshot.capabilities.pageTabs?.[tabKey] || []
      if (tabs.length >= 2) results.continuous.push(await captureContinuousTabs(snapshot, route, tabs))
    }
    if (routes.length >= 3) results.continuous.push(await captureHistory(snapshot, routes))
    const excludedRoutes = mode === 'DEFAULT'
      ? ['reconciliation']
      : ['meal-orders', 'approvals', 'purchasing', 'chef-dashboard', 'reports', 'approval-rules']
    for (const route of excludedRoutes) results.excludedRoutes.push(await captureExcludedRoute(snapshot, route))
  }
} catch (error) {
  results.failures.push({ type: 'fatal', text: String(error) })
} finally {
  try {
    if (controlPage && originalSnapshot) {
      const current = await operationSnapshot(controlPage)
      if (current.mode !== originalSnapshot.mode) await changeMode(controlPage, originalSnapshot.mode, 'Khôi phục chế độ vận hành ban đầu sau audit hai mode')
      results.restoredSnapshot = await operationSnapshot(controlPage)
    }
  } catch (error) { results.failures.push({ type: 'restore', text: String(error) }) }
  results.originalSnapshot = originalSnapshot
  results.finishedAt = new Date().toISOString()
  results.sourceIdentity = {
    branch: git('branch', '--show-current'), headCommit: git('rev-parse', 'HEAD'), trackedDiffSha256: sha256(execFileSync('git', ['diff', '--binary'])),
    indexSha256: sha256(await readFile('dist/index.html')), browserVersion: browser.version(), baseUrl: BASE_URL,
  }
  const allResults = [...results.cells, ...results.routeViewports, ...results.excludedRoutes, ...results.continuous]
  const required = allResults.length
  const pass = allResults.filter((cell) => cell.verdict === 'PASS').length
  results.reconciliation = { required, pass, fail: required - pass, complete: required === pass + (required - pass) }
  results.verdict = results.failures.length || results.reconciliation.fail ? 'FAIL' : 'PASS'
  await writeFile(REPORT, `${JSON.stringify(results, null, 2)}\n`)
  await browser.close()
}
if (results.verdict !== 'PASS') process.exitCode = 1
