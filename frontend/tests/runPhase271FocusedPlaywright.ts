import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ALLOWED_SPECS = new Set([
  'tests/visual-routes.spec.ts',
  'tests/ui-audit.spec.ts',
  'tests/ui-measurements.spec.ts',
])
const ALLOWED_ENV = new Set(['NODE_OPTIONS'])
const CONFIG = 'playwright.phase271-focused.config.ts'
const TRACE_ORDER = ['vite-spawn', 'vite-health', 'playwright-spawn', 'playwright-close', 'vite-teardown'] as const
const INPUT_KEYS = new Set(['spec', 'grep', 'project', 'workers', 'reporter', 'outputRoot', 'config', 'requireChildLaunchTrace', 'env'])
export const FOCUSED_PAYLOAD_MEMBERS = [
  '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/27.1-01F-SUMMARY.md',
  '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/attestations/27.1-01F-focused-launcher-manifest.json',
  '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/plan-results/27.1-01F-focused-launcher.json',
  'frontend/playwright.phase271-focused.config.ts',
  'frontend/tests/runPhase271FocusedPlaywright.test.ts',
  'frontend/tests/runPhase271FocusedPlaywright.ts',
].sort()

export type FocusedLauncherInput = {
  spec: string
  grep: string
  project: 'chromium'
  workers: 1
  reporter: 'line' | 'json'
  outputRoot: string
  config: typeof CONFIG
  requireChildLaunchTrace: true
  env?: Record<string, string>
}
export type LaunchTraceEvent = { event: typeof TRACE_ORDER[number]; detail?: string | number }
type CliPin = { path: string; sha256: string }
export type FocusedLauncherDependencies = {
  spawn: typeof nodeSpawn
  resolveCliPaths: (frontendCwd?: string) => { playwright: CliPin; vite: CliPin }
  waitForHealth: (url: string, child: ChildProcess) => Promise<void>
  teardown: (child: ChildProcess) => Promise<void>
  frontendCwd: string
  nodeExecutable: string
}

class FocusedLaunchError extends Error {
  trace: LaunchTraceEvent[]
  constructor(message: string, trace: LaunchTraceEvent[], cause?: unknown) {
    super(message, { cause })
    this.name = 'FocusedLaunchError'
    this.trace = [...trace]
  }
}

const sha256File = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
export function resolveFocusedCliPaths(frontendCwd = path.resolve('frontend')) {
  const require = createRequire(path.join(frontendCwd, 'package.json'))
  const playwrightPath = path.resolve(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js')
  const vitePath = path.resolve(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  return {
    playwright: { path: playwrightPath, sha256: sha256File(playwrightPath) },
    vite: { path: vitePath, sha256: sha256File(vitePath) },
  }
}

function normalizeRepoRelative(value: string, label: string) {
  if (!value || path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) throw new Error(`${label} must be repository-confined`)
  const normalized = value.replaceAll('\\', '/')
  if (normalized.split('/').includes('..') || normalized.startsWith('/')) throw new Error(`${label} escapes repository`)
  return normalized.replace(/^\.\//, '')
}

export function validateFocusedInput(raw: unknown): FocusedLauncherInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('focused input must be an object')
  for (const key of Object.keys(raw)) if (!INPUT_KEYS.has(key)) throw new Error(`forbidden or unknown focused key: ${key}`)
  const input = raw as Record<string, unknown>
  if (typeof input.spec !== 'string') throw new Error('exactly one spec is required; duplicates and multiple specs are forbidden')
  const spec = normalizeRepoRelative(input.spec, 'spec')
  if (!ALLOWED_SPECS.has(spec)) throw new Error('spec is not allowlisted')
  if (typeof input.grep !== 'string' || input.grep.trim() === '') throw new Error('non-empty grep is required')
  try { new RegExp(input.grep) } catch { throw new Error('grep must be a valid regular expression') }
  if (input.project !== 'chromium') throw new Error('project must be chromium')
  if (input.workers !== 1) throw new Error('workers must be 1')
  if (input.reporter !== 'line' && input.reporter !== 'json') throw new Error('reporter must be line or json')
  if (input.config !== CONFIG) throw new Error(`config must be ${CONFIG}`)
  if (input.requireChildLaunchTrace !== true) throw new Error('mandatory child-launch trace was not required')
  const outputRoot = normalizeRepoRelative(String(input.outputRoot ?? ''), 'output root')
  if (!outputRoot.startsWith('test-results/')) throw new Error('output root must remain under test-results')
  const env = input.env ?? {}
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new Error('environment must be an object')
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (!ALLOWED_ENV.has(key) || typeof value !== 'string' || value === '') throw new Error(`environment key is not allowlisted: ${key}`)
  }
  return { spec, grep: input.grep, project: 'chromium', workers: 1, reporter: input.reporter, outputRoot, config: CONFIG, requireChildLaunchTrace: true, env: env as Record<string, string> }
}

export function buildFocusedPlaywrightArgv(playwrightCli: string, raw: unknown) {
  const input = validateFocusedInput(raw)
  return [playwrightCli, 'test', input.spec, `--config=${input.config}`, '--project=chromium', '--workers=1', `--grep=${input.grep}`, `--reporter=${input.reporter}`, `--output=${input.outputRoot}`]
}

const CLI_FLAGS: Record<string, keyof FocusedLauncherInput> = {
  '--spec': 'spec', '--grep': 'grep', '--project': 'project', '--workers': 'workers', '--reporter': 'reporter', '--output-root': 'outputRoot', '--config': 'config',
}
export function parseFocusedCliArgs(argv: string[]): FocusedLauncherInput {
  const parsed: Record<string, unknown> = { env: {} }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--require-child-launch-trace') {
      if (parsed.requireChildLaunchTrace) throw new Error('duplicate --require-child-launch-trace')
      parsed.requireChildLaunchTrace = true
      continue
    }
    if (flag === '--env') {
      const pair = argv[++index]
      if (!pair || !pair.includes('=')) throw new Error('--env requires KEY=VALUE')
      const split = pair.indexOf('=')
      const key = pair.slice(0, split)
      if (Object.hasOwn(parsed.env as object, key)) throw new Error(`duplicate environment key: ${key}`)
      ;(parsed.env as Record<string, string>)[key] = pair.slice(split + 1)
      continue
    }
    const key = CLI_FLAGS[flag]
    if (!key) throw new Error(`forbidden or unknown CLI option: ${flag}`)
    const value = argv[++index]
    if (value === undefined) throw new Error(`${flag} requires a value`)
    if (Object.hasOwn(parsed, key)) throw new Error(`duplicate CLI option: ${flag}`)
    parsed[key] = key === 'workers' ? Number(value) : value
  }
  return validateFocusedInput(parsed)
}

async function defaultWaitForHealth(url: string, child: ChildProcess) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`premature Vite exit ${child.exitCode}`)
    try { if ((await fetch(url)).ok) return } catch { /* bounded retry */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Vite health timeout')
}
async function defaultTeardown(child: ChildProcess) {
  if (child.exitCode !== null) return
  if (!child.kill('SIGTERM')) throw new Error('owned Vite teardown signal failed')
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('owned Vite teardown timeout')), 5_000)
    child.once('close', () => { clearTimeout(timer); resolve() })
    child.once('error', error => { clearTimeout(timer); reject(error) })
  })
}
const defaultDependencies = (): FocusedLauncherDependencies => ({
  spawn: nodeSpawn,
  resolveCliPaths: resolveFocusedCliPaths,
  waitForHealth: defaultWaitForHealth,
  teardown: defaultTeardown,
  frontendCwd: path.resolve('frontend'),
  nodeExecutable: process.execPath,
})

function spawnChecked(deps: FocusedLauncherDependencies, executable: string, argv: string[], options: Parameters<typeof nodeSpawn>[2]) {
  return deps.spawn(executable, argv, options)
}
async function waitForClose(child: ChildProcess) {
  return await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', code => resolve(code ?? 1))
  })
}

export async function runFocusedPlaywright(raw: unknown, dependencies?: FocusedLauncherDependencies) {
  const input = validateFocusedInput(raw)
  const deps = dependencies ?? defaultDependencies()
  const trace: LaunchTraceEvent[] = []
  let vite: ChildProcess | undefined
  let primaryError: unknown
  try {
    const cli = deps.resolveCliPaths(deps.frontendCwd)
    const env = { ...process.env, ...input.env, VITE_ENABLE_MOCK_LOGIN: 'true' }
    const options = { cwd: deps.frontendCwd, env, shell: false as const, stdio: ['ignore', 'pipe', 'pipe'] as const }
    const viteArgv = [cli.vite.path, '--host', '127.0.0.1', '--port', '5173', '--strictPort']
    vite = spawnChecked(deps, deps.nodeExecutable, viteArgv, options)
    trace.push({ event: 'vite-spawn' })
    await deps.waitForHealth('http://127.0.0.1:5173/login', vite)
    trace.push({ event: 'vite-health' })
    const playwrightArgv = buildFocusedPlaywrightArgv(cli.playwright.path, input)
    const playwright = spawnChecked(deps, deps.nodeExecutable, playwrightArgv, options)
    trace.push({ event: 'playwright-spawn' })
    const exitCode = await waitForClose(playwright)
    trace.push({ event: 'playwright-close', detail: exitCode })
    if (exitCode !== 0) throw new Error(`Playwright exited ${exitCode}`)
    await deps.teardown(vite)
    trace.push({ event: 'vite-teardown' })
    vite = undefined
    if (trace.map(item => item.event).join(',') !== TRACE_ORDER.join(',')) throw new Error('mandatory child-launch trace is incomplete')
    return { schemaVersion: 1, status: 'COMPLETE' as const, exitCode: 0, trace, attestation: { nodeExecutable: deps.nodeExecutable, playwrightCli: cli.playwright, viteCli: cli.vite, playwrightArgv, viteArgv, cwd: deps.frontendCwd, shell: false } }
  } catch (error) {
    primaryError = error
    if (vite) {
      try { await deps.teardown(vite); trace.push({ event: 'vite-teardown' }) } catch (teardownError) { primaryError = teardownError }
    }
    throw new FocusedLaunchError(primaryError instanceof Error ? primaryError.message : String(primaryError), trace, primaryError)
  }
}

export function verifyFocusedSeal(manifest: unknown, expectedMembers = FOCUSED_PAYLOAD_MEMBERS) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('seal manifest must be an object')
  const value = manifest as Record<string, unknown>
  if (value.scope !== 'focused-only') throw new Error('seal must be focused-only')
  if (value.childLaunchTraceRequired !== true) throw new Error('seal must require child-launch trace')
  const members = Array.isArray(value.payloadMembers) ? [...value.payloadMembers].sort() : []
  if (JSON.stringify(members) !== JSON.stringify([...expectedMembers].sort())) throw new Error('exact payload membership mismatch')
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
async function main(argv: string[]) {
  if (argv.length === 1 && argv[0] === '--help-closed-schema') {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, mode: 'focused-only', required: ['spec', 'grep', 'project=chromium', 'workers=1', 'reporter=line|json', 'output-root under test-results', `config=${CONFIG}`, 'require-child-launch-trace'], allowedSpecs: [...ALLOWED_SPECS], allowedEnv: [...ALLOWED_ENV] })}\n`)
    return
  }
  if (argv[0] === '--verify-seal') {
    const file = argv[1]
    if (!file || !argv.includes('--require-focused-only') || !argv.includes('--require-child-launch-trace-contract') || !argv.includes('--require-exact-payload-members')) throw new Error('all seal requirements are mandatory')
    verifyFocusedSeal(readJson(file))
    process.stdout.write(`${JSON.stringify({ status: 'PASS', verification: 'focused-seal' })}\n`)
    return
  }
  if (argv[0] === '--verify-marker') {
    const file = argv[1]
    const marker = readJson(file)
    if (marker.status !== 'COMPLETE' || marker.scope !== 'focused-only' || !Array.isArray(marker.roots) || marker.roots.length !== 4) throw new Error('marker contract mismatch')
    process.stdout.write(`${JSON.stringify({ status: 'PASS', verification: 'focused-marker' })}\n`)
    return
  }
  const result = await runFocusedPlaywright(parseFocusedCliArgs(argv))
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) main(process.argv.slice(2)).catch(error => {
  const trace = error instanceof FocusedLaunchError ? error.trace : []
  process.stderr.write(`${JSON.stringify({ schemaVersion: 1, status: 'FAILED', exitCode: 1, error: error instanceof Error ? error.message : String(error), trace })}\n`)
  process.exitCode = 1
})
