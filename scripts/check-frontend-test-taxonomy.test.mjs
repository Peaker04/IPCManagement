import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('Playwright specs are isolated from Vitest and never import another spec', () => {
  assert.equal(readdirSync('frontend/tests').some((name) => name.endsWith('.spec.ts')), false)
  for (const name of readdirSync('frontend/tests/browser').filter((name) => name.endsWith('.spec.ts'))) {
    assert.doesNotMatch(readFileSync(join('frontend/tests/browser', name), 'utf8'), /from\s+['"][^'"]*\.spec(?:\.ts)?['"]/, `${name} imports another spec`)
  }
  for (const config of ['frontend/playwright.config.ts', 'frontend/tests/config/headed-geometry.config.ts']) {
    assert.match(readFileSync(config, 'utf8'), /testMatch:\s*['"]\*\*\/\*\.spec\.ts['"]/, config)
  }
})
