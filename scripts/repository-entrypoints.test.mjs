import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'
import { join } from 'node:path'

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

test('npm test aliases reference existing test files, configs and commands', () => {
  const packages = ['', 'frontend'].map(dir => ({
    dir, scripts: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts,
  }))
  const missing = []
  for (const pkg of packages) {
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (!/^(?:test:|verify(?::|$))/.test(name)) continue
      for (const segment of command.split(/\s+&&\s+/)) {
        const owner = /(?:^|\s)(?:-w|--workspace)\s+frontend(?:\s|$)/.test(segment)
          ? packages[1] : pkg
        const alias = segment.match(/^npm run ([\w:-]+)/)?.[1]
        if (alias && !Object.hasOwn(owner.scripts, alias)) missing.push(alias)
        for (const [target] of segment.matchAll(/(?:--config=|(?<![\w/.-])(?:src\/|tests\/))[^\s"']+\.(?:tsx?|mjs|py)\b/g)) {
          const path = join(owner.dir, target.replace(/^--config=/, ''))
          if (!existsSync(path)) missing.push(`${name}: ${path}`)
        }
      }
    }
  }
  assert.deepEqual(missing, [])
})

test('ordinary Playwright shares frontend defaults and excludes the MRX campaign', () => {
  const root = readFileSync('playwright.config.ts', 'utf8')
  const frontend = readFileSync('frontend/playwright.config.ts', 'utf8')
  assert.match(root, /from ['"]\.\/frontend\/playwright\.config['"]/)
  assert.match(frontend, /testIgnore:\s*\[\s*['"]\*\*\/e2e-mrx\/\*\*['"]\s*\]/)
})

const retired = {
  'mrx-db': [
    'run-universal-worst-case-lifecycle-harness', 'run-mrx-e2e-mutation-test',
    'run-mrx-exhaustive-scenarios-test', 'run-mrx-full-path-lifecycle-test',
    'run-mrx-live-e2e-mutation-lifecycle',
  ],
  visual: [
    'capture-mrx-screenshots', 'capture-all-mrx-nooks', 'capture-all-canonical-routes',
    'audit-mrx-responsive-deep', 'audit-mrx-matrix-responsive-deep', 'expert-fe-deep-audit',
    'inspect-ui-reality-live', 'f12-dev-tools-audit', 'inspect-ui-reality',
    'measure-route-5layers', 'audit-route-states', 'verify-batch1-live-browser',
    'verify-mrx-matrix-and-modal-live', 'verify-mrx-operational-recovery-live',
  ],
}

test('retired entry points have no runtime capability and fail closed', () => {
  // Never spawn a historical runner. Check every source before running either family.
  for (const [kind, names] of Object.entries(retired)) {
    for (const name of names) {
      assert.equal(readFileSync(`scripts/${name}.mjs`, 'utf8').replace(/\r\n/g, '\n').trim(),
        `import { retiredRunner } from './retired-runner.mjs';
retiredRunner('${kind}');`, name)
    }
  }
  const owner = readFileSync('scripts/retired-runner.mjs', 'utf8').trim()
  assert.match(owner, /^export function retiredRunner\(kind\) \{\s+throw new Error\(kind === 'mrx-db'\s+\? '[^'\r\n]+'\s+: '[^'\r\n]+'\);\s+\}$/)
  for (const [kind, names] of Object.entries(retired)) {
    const result = spawnSync(process.execPath, [`scripts/${names[0]}.mjs`], { encoding: 'utf8', timeout: 5000 })
    assert.equal(result.status, 1)
    assert.match(result.stderr, kind === 'mrx-db' ? /Retired runner.*Invoke-MrxDisposableEvidence/ : /Retired visual audit.*frontend\/tests\/browser/)
    assert.equal(result.stdout, '')
  }
})
