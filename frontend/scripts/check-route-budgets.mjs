import { gzipSync } from 'node:zlib'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const KIB = 1024

function fail(message) {
  throw new Error(message)
}

function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`Invalid ${label} at ${file}: ${error.message}`)
  }
}

function requireObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(`${label} must be a JSON object`)
  }

  return value
}

function validateRoutes(config) {
  const routes = config.routes
  if (!Array.isArray(routes) || routes.length === 0) {
    fail('Route budget config must contain a non-empty routes array')
  }

  const ids = new Set()
  return routes.map((route, index) => {
    if (!route || typeof route !== 'object' || Array.isArray(route)) {
      fail(`Route budget at index ${index} must be an object`)
    }
    if (typeof route.id !== 'string' || !route.id.trim()) {
      fail(`Route budget at index ${index} has an invalid id`)
    }
    if (ids.has(route.id)) {
      fail(`Duplicate route budget id: ${route.id}`)
    }
    ids.add(route.id)
    if (typeof route.entry !== 'string' || !route.entry.trim()) {
      fail(`Route ${route.id} has an invalid manifest entry`)
    }
    if (!Number.isInteger(route.gzipBytes) || route.gzipBytes <= 0) {
      fail(`Route ${route.id} has an invalid non-positive gzip budget`)
    }

    return route
  })
}

function findManifestEntry(manifest, route) {
  const match = Object.entries(manifest).find(([key, value]) => key === route.entry || value?.src === route.entry)
  if (!match) {
    fail(`Route ${route.id} is missing manifest entry ${route.entry}`)
  }
  return match[0]
}

function assetPath(distRoot, asset) {
  if (typeof asset !== 'string' || !asset) {
    fail('Manifest contains an invalid emitted asset path')
  }
  const file = resolve(distRoot, asset)
  if (relative(distRoot, file).startsWith('..')) {
    fail(`Manifest asset escapes the build output: ${asset}`)
  }
  return file
}

function collectAssets(manifest, entryKey, collected = new Set(), visited = new Set()) {
  if (visited.has(entryKey)) return collected
  visited.add(entryKey)

  const entry = manifest[entryKey]
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(`Manifest entry ${entryKey} is missing or invalid`)
  }
  if (typeof entry.file !== 'string') {
    fail(`Manifest entry ${entryKey} is missing its emitted file`)
  }
  collected.add(entry.file)

  for (const cssFile of entry.css ?? []) {
    collected.add(cssFile)
  }
  for (const importedKey of entry.imports ?? []) {
    if (typeof importedKey !== 'string' || !manifest[importedKey]) {
      fail(`Manifest entry ${entryKey} has an unresolved import`)
    }
    collectAssets(manifest, importedKey, collected, visited)
  }

  return collected
}

function gzipBytes(distRoot, assets) {
  let total = 0
  for (const asset of assets) {
    try {
      total += gzipSync(readFileSync(assetPath(distRoot, asset))).byteLength
    } catch (error) {
      fail(`Unable to read emitted asset ${asset}: ${error.message}`)
    }
  }
  return total
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(2)} KiB (${bytes} B)`
}

export function checkRouteBudgets({ configPath = resolve(frontendRoot, 'route-budgets.json'), manifestPath = resolve(frontendRoot, 'dist/.vite/manifest.json'), distRoot = resolve(frontendRoot, 'dist') } = {}) {
  const config = requireObject(readJson(configPath, 'route budget config'), 'Route budget config')
  const manifest = requireObject(readJson(manifestPath, 'Vite manifest'), 'Vite manifest')
  const routes = validateRoutes(config)
  const results = routes.map((route) => {
    const entryKey = findManifestEntry(manifest, route)
    const currentBytes = gzipBytes(distRoot, collectAssets(manifest, entryKey))
    return { ...route, currentBytes }
  })

  const failures = results.filter((route) => route.currentBytes > route.gzipBytes)
  for (const route of results) {
    console.log(`Route ${route.id}: current ${formatKiB(route.currentBytes)} / budget ${formatKiB(route.gzipBytes)}`)
  }
  if (failures.length > 0) {
    const details = failures.map((route) => `Route ${route.id} exceeds gzip budget: current ${formatKiB(route.currentBytes)}, budget ${formatKiB(route.gzipBytes)}, overage ${formatKiB(route.currentBytes - route.gzipBytes)}`).join('\n')
    fail(details)
  }

  return results
}

function expectFailure(run, expectedMessage) {
  try {
    run()
  } catch (error) {
    if (error.message.includes(expectedMessage)) return
    fail(`Self-test expected "${expectedMessage}" but received "${error.message}"`)
  }
  fail(`Self-test expected failure: ${expectedMessage}`)
}

function writeFixture(root, config, manifest, assets) {
  for (const [file, content] of Object.entries(assets)) {
    const path = resolve(root, 'dist', file)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, content)
  }
  writeFileSync(resolve(root, 'route-budgets.json'), JSON.stringify(config))
  writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest))
}

function runSelfTest() {
  const root = mkdtempSync(resolve(tmpdir(), 'ipc-route-budgets-'))
  try {
    const manifest = {
      'src/routes/Dashboard.tsx': { file: 'assets/dashboard.js', imports: ['_shared.js'], css: ['assets/dashboard.css'] },
      '_shared.js': { file: 'assets/shared.js' },
    }
    const assets = {
      'assets/dashboard.js': 'dashboard route payload',
      'assets/shared.js': 'shared route payload',
      'assets/dashboard.css': '.dashboard { display: grid; }',
    }
    const config = { routes: [{ id: 'dashboard', entry: 'src/routes/Dashboard.tsx', gzipBytes: 4096 }] }
    writeFixture(root, config, manifest, assets)
    checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') })

    writeFixture(root, { routes: [{ ...config.routes[0], gzipBytes: 1 }] }, manifest, assets)
    expectFailure(() => checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') }), 'Route dashboard exceeds gzip budget: current')
    writeFixture(root, { routes: [{ ...config.routes[0], id: 'duplicate' }, { ...config.routes[0], id: 'duplicate' }] }, manifest, assets)
    expectFailure(() => checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') }), 'Duplicate route budget id')
    writeFixture(root, { routes: [{ ...config.routes[0], entry: 'src/routes/Missing.tsx' }] }, manifest, assets)
    expectFailure(() => checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') }), 'missing manifest entry')
    writeFixture(root, { routes: [{ ...config.routes[0], gzipBytes: 0 }] }, manifest, assets)
    expectFailure(() => checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') }), 'invalid non-positive gzip budget')
    writeFileSync(resolve(root, 'manifest.json'), '[]')
    expectFailure(() => checkRouteBudgets({ configPath: resolve(root, 'route-budgets.json'), manifestPath: resolve(root, 'manifest.json'), distRoot: resolve(root, 'dist') }), 'Vite manifest must be a JSON object')
    console.log('Route budget checker self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv.includes('--self-test')) {
  runSelfTest()
} else {
  checkRouteBudgets()
}
