import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const rootEntries = readdirSync('frontend/tests', { withFileTypes: true })
const rootFiles = rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
const count = (suffix) => rootFiles.filter((name) => name.endsWith(suffix)).length
const browserSpecs = readdirSync('frontend/tests/browser').filter((name) => name.endsWith('.spec.ts'))

test('frontend tests use explicit taxonomy with no root Playwright debt', () => {
  assert.equal(count('.spec.ts'), 0, 'Playwright specs belong in tests/browser')
  assert.equal(browserSpecs.length, 32, 'browser discovery denominator changed')
  assert.ok(count('.test.ts') <= 57, 'root TypeScript contract-test debt grew')
  assert.ok(count('.test.tsx') <= 3, 'root TSX contract-test debt grew')

  for (const name of browserSpecs) {
    const source = readFileSync(join('frontend/tests/browser', name), 'utf8')
    assert.doesNotMatch(source, /from\s+['"][^'"]*\.spec(?:\.ts)?['"]/, `${name} imports another spec`)
  }

  for (const config of [
    'frontend/playwright.config.ts',
    'frontend/tests/config/headed-geometry.config.ts',
    'frontend/tests/config/recovery.config.ts',
  ]) assert.match(readFileSync(config, 'utf8'), /testMatch:\s*['"]\*\*\/\*\.spec\.ts['"]/)
  for (const config of [
    'frontend/tests/config/dialog-gap.config.ts',
    'frontend/tests/config/field-geometry.config.ts',
  ]) assert.match(readFileSync(config, 'utf8'), /headedGeometryConfig/)

  const evidence = readdirSync('frontend/tests/evidence').filter((name) => name.endsWith('.test.ts') || name.endsWith('.test.tsx'))
  assert.deepEqual(evidence.sort(), [
    'phase35GeometryDenominator.test.ts',
    'uiAuditBaselineDelta.test.ts',
    'uiAuditRemediationAttribution.test.ts',
  ])
})
