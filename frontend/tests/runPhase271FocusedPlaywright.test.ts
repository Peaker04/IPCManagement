import { EventEmitter } from 'node:events'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildFocusedPlaywrightArgv,
  parseFocusedCliArgs,
  resolveFocusedCliPaths,
  runFocusedPlaywright,
  verifyFocusedSeal,
  type FocusedLauncherDependencies,
} from './runPhase271FocusedPlaywright'

const valid = {
  spec: 'tests/visual-routes.spec.ts',
  grep: 'chef-dashboard visual baseline',
  project: 'chromium',
  workers: 1,
  reporter: 'line' as const,
  outputRoot: 'test-results/phase271/plan-02-chef',
  config: 'playwright.phase271-focused.config.ts',
  requireChildLaunchTrace: true,
  env: {},
}

class FakeChild extends EventEmitter {
  exitCode: number | null = null
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn(() => true)
}

const dependencies = (options: { viteExit?: number; playwrightExit?: number; healthError?: Error; teardownError?: Error } = {}) => {
  const children: FakeChild[] = []
  const deps: FocusedLauncherDependencies = {
    spawn: vi.fn((_executable, argv) => {
      const child = new FakeChild()
      children.push(child)
      queueMicrotask(() => {
        if (argv[0] === 'PW') {
          child.exitCode = options.playwrightExit ?? 0
          child.emit('close', child.exitCode)
        } else if (options.viteExit !== undefined) {
          child.exitCode = options.viteExit
          child.emit('close', child.exitCode)
        }
      })
      return child as never
    }),
    resolveCliPaths: () => ({ playwright: { path: 'PW', sha256: 'a'.repeat(64) }, vite: { path: 'VITE', sha256: 'b'.repeat(64) } }),
    waitForHealth: async () => { if (options.healthError) throw options.healthError },
    teardown: async () => { if (options.teardownError) throw options.teardownError },
    frontendCwd: path.resolve('frontend'),
    nodeExecutable: process.execPath,
  }
  return { deps, children }
}

describe('focused Phase 27.1 browser adapter', () => {
  it('parses the exact closed CLI and preserves Unicode output as one argv value', () => {
    const input = parseFocusedCliArgs(['--spec', valid.spec, '--project', 'chromium', '--workers', '1', '--grep', valid.grep, '--reporter', 'json', '--output-root', 'test-results/Kì 7/out & x', '--config', valid.config, '--require-child-launch-trace'])
    expect(input.outputRoot).toBe('test-results/Kì 7/out & x')
    expect(buildFocusedPlaywrightArgv('PW', input)).toContain('--output=test-results/Kì 7/out & x')
  })

  it.each(['--command', '--npm', '--npx', '--shell', '--executable', '--argv', '--webServer', '--unknown'])('rejects forbidden or unknown %s before spawn', async key => {
    const { deps } = dependencies()
    expect(() => parseFocusedCliArgs([...toArgs(valid), key, 'bad'])).toThrow(/unknown|forbidden/)
    expect(deps.spawn).not.toHaveBeenCalled()
  })

  it('rejects absent, duplicate, multiple, and non-allowlisted specs before spawn', async () => {
    const { deps } = dependencies()
    const invalid = [
      { ...valid, spec: '' },
      { ...valid, spec: ['tests/visual-routes.spec.ts', 'tests/visual-routes.spec.ts'] },
      { ...valid, spec: ['tests/visual-routes.spec.ts', 'tests/ui-audit.spec.ts'] },
      { ...valid, spec: 'tests/not-allowed.spec.ts' },
    ]
    for (const input of invalid) await expect(runFocusedPlaywright(input, deps)).rejects.toThrow()
    expect(deps.spawn).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...valid, grep: '' }, /grep/],
    [{ ...valid, grep: '[' }, /grep/],
    [{ ...valid, reporter: 'html' }, /reporter/],
    [{ ...valid, project: 'webkit' }, /project/],
    [{ ...valid, workers: 2 }, /workers/],
    [{ ...valid, config: 'playwright.config.ts' }, /config/],
    [{ ...valid, outputRoot: '../escape' }, /output/],
    [{ ...valid, outputRoot: 'C:/escape' }, /output/],
    [{ ...valid, requireChildLaunchTrace: false }, /trace/],
    [{ ...valid, env: { PATH: 'bad' } }, /environment/],
  ])('rejects closed-contract drift without a child', async (input, message) => {
    const { deps } = dependencies()
    await expect(runFocusedPlaywright(input, deps)).rejects.toThrow(message as RegExp)
    expect(deps.spawn).not.toHaveBeenCalled()
  })

  it('records the mandatory ordered child-launch trace and direct process boundary', async () => {
    const { deps } = dependencies()
    const result = await runFocusedPlaywright(valid, deps)
    expect(result.exitCode).toBe(0)
    expect(result.trace.map(event => event.event)).toEqual(['vite-spawn', 'vite-health', 'playwright-spawn', 'playwright-close', 'vite-teardown'])
    expect(deps.spawn).toHaveBeenNthCalledWith(1, process.execPath, expect.arrayContaining(['VITE']), expect.objectContaining({ shell: false, cwd: path.resolve('frontend') }))
    expect(deps.spawn).toHaveBeenNthCalledWith(2, process.execPath, expect.arrayContaining(['PW']), expect.objectContaining({ shell: false, cwd: path.resolve('frontend') }))
  })

  it.each([
    [{ healthError: new Error('health failed') }, /health failed/],
    [{ viteExit: 1, healthError: new Error('premature Vite exit') }, /premature/],
    [{ playwrightExit: 2 }, /Playwright exited 2/],
    [{ teardownError: new Error('teardown failed') }, /teardown failed/],
  ])('fails closed on lifecycle failure while retaining trace evidence', async (options, message) => {
    const { deps } = dependencies(options)
    await expect(runFocusedPlaywright(valid, deps)).rejects.toMatchObject({ message: expect.stringMatching(message as RegExp), trace: expect.any(Array) })
  })

  it('rejects a spawn failure and cannot accept an exit zero without both children', async () => {
    const { deps } = dependencies()
    deps.spawn = vi.fn(() => { throw new Error('spawn failed') })
    await expect(runFocusedPlaywright(valid, deps)).rejects.toMatchObject({ message: 'spawn failed', trace: [] })
  })

  it('resolves installed Playwright and Vite JavaScript CLIs with hashes', () => {
    const paths = resolveFocusedCliPaths()
    expect(paths.playwright.path).toMatch(/cli\.js$/)
    expect(paths.vite.path).toMatch(/vite\.js$/)
    expect(paths.playwright.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(paths.vite.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifies exact seal membership and rejects scope widening', () => {
    expect(() => verifyFocusedSeal({ scope: 'focused-only', payloadMembers: ['a'], childLaunchTraceRequired: true }, ['a'])).not.toThrow()
    expect(() => verifyFocusedSeal({ scope: 'canonical', payloadMembers: ['a'], childLaunchTraceRequired: true }, ['a'])).toThrow(/focused-only/)
    expect(() => verifyFocusedSeal({ scope: 'focused-only', payloadMembers: ['a', 'b'], childLaunchTraceRequired: true }, ['a'])).toThrow(/payload/)
  })
})

function toArgs(input: typeof valid) {
  return ['--spec', input.spec, '--project', input.project, '--workers', String(input.workers), '--grep', input.grep, '--reporter', input.reporter, '--output-root', input.outputRoot, '--config', input.config, '--require-child-launch-trace']
}
