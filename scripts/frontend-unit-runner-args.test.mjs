import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFrontendUnitNpmArgs,
  normalizeForwardedArgs,
} from './frontend-unit-runner-args.mjs'

test('canonical invocation does not inject an argument separator into Vitest argv', () => {
  assert.deepEqual(buildFrontendUnitNpmArgs([]), ['run', 'test:unit', '-w', 'frontend'])
})

test('forwarded options receive exactly one npm separator', () => {
  assert.deepEqual(
    buildFrontendUnitNpmArgs(['--', '--maxWorkers=1']),
    ['run', 'test:unit', '-w', 'frontend', '--', '--maxWorkers=1'],
  )
  assert.deepEqual(normalizeForwardedArgs(['--', '--', 'tests/example.test.ts']), ['tests/example.test.ts'])
})
