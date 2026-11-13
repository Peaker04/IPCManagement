import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'

const yaml = createRequire(import.meta.url)('js-yaml')

test('root contains no ordinary Windows reserved-device filename', () => {
  assert.deepEqual(readdirSync('.').filter(name => /^(?:nul|con|prn|aux|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)), [])
})

test('Verify workflow npm entry points resolve in the selected workspace', () => {
  const root = JSON.parse(readFileSync('package.json', 'utf8'))
  const frontend = JSON.parse(readFileSync('frontend/package.json', 'utf8'))
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8')
  assert.match(workflow, /run:\s*npm run test:phase05-fixture-determinism\b/, 'Keep the existing fixture-quality gate')
  assert.match(root.scripts?.['test:phase05-fixture-determinism'] ?? '', /scripts\/test_phase05_fixture_determinism\.py/, 'Use the real fixture determinism test')
  const commands = Object.values(yaml.load(workflow).jobs)
    .flatMap(job => job.steps ?? [])
    .flatMap(step => [...(step.run ?? '').matchAll(/\bnpm run ([\w:-]+)([^\r\n]*)/g)])
  const discovered = new Set()
  // Shared npm groups must be followed too: counting top-level YAML commands
  // would stop checking most gates after orchestration is consolidated.
  const check = (command, workspace) => {
    const key = `${workspace.name}:${command}`
    if (discovered.has(key)) return
    discovered.add(key)
    const script = workspace.scripts?.[command]
    assert.ok(script, `Missing npm entry point: ${key}`)
    for (const [, child, flags] of script.matchAll(/npm run ([\w:-]+)([^&]*)/g)) {
      check(child, /(?:-w|--workspace)\s+frontend\b/.test(flags) ? frontend : root)
    }
  }
  for (const [, command, flags] of commands) {
    const workspace = /(?:-w|--workspace)\s+frontend\b/.test(flags) ? frontend : root
    check(command, workspace)
  }
  for (const command of ['verify:quick', 'check:conformance-contracts', 'test:repository-entrypoints', 'test:ci-tooling', 'test:phase05-fixture-determinism', 'test:be:ci']) {
    assert.ok(discovered.has(`${root.name}:${command}`), `Required gate not reachable from workflow: ${command}`)
  }
})

test('ordinary Playwright entry points both exclude the separate MRX campaign', () => {
  for (const config of ['playwright.config.ts', 'frontend/playwright.config.ts']) {
    const source = readFileSync(config, 'utf8')
    assert.match(source, /testIgnore:\s*\[\s*['"]\*\*\/e2e-mrx\/\*\*['"]\s*\]/, config)
  }
})

for (const name of ['run-universal-worst-case-lifecycle-harness', 'run-mrx-e2e-mutation-test', 'run-mrx-exhaustive-scenarios-test', 'run-mrx-full-path-lifecycle-test']) {
  test(`${name} fails closed without acquiring any runtime or database capability`, () => {
    const path = `scripts/${name}.mjs`
    const source = readFileSync(path, 'utf8')
    // Never execute an old runner in the RED phase. These assertions reject it
    // before spawn, so the regression itself cannot run a historical campaign.
    assert.match(source, /Retired runner/)
    assert.doesNotMatch(source, /\bimport\b|\brequire\s*\(|DROP DATABASE|CREATE DATABASE|\bfetch\s*\(|\bspawn\s*\(/)
    const result = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Retired runner/)
    assert.equal(result.stdout, '')
  })
}

for (const name of ['capture-mrx-screenshots', 'capture-all-mrx-nooks', 'capture-all-canonical-routes', 'audit-mrx-responsive-deep', 'audit-mrx-matrix-responsive-deep', 'expert-fe-deep-audit', 'inspect-ui-reality-live', 'f12-dev-tools-audit', 'inspect-ui-reality', 'measure-route-5layers', 'audit-route-states']) {
  test(`${name} cannot silently start an obsolete visual audit`, () => {
    const path = `scripts/${name}.mjs`
    const source = readFileSync(path, 'utf8')
    assert.match(source, /Retired visual audit/)
    assert.doesNotMatch(source, /\bimport\b|\brequire\s*\(|\bfetch\s*\(|chromium\.launch|localStorage/)
    const result = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Retired visual audit/)
    assert.equal(result.stdout, '')
  })
}
