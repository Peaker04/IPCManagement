import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const memory = fs.readFileSync(path.join(repositoryRoot, 'MEMORY.md'), 'utf8')
const baseline = memory.match(/frontend\s*`?(\d+)\s+files\s*\/\s*(\d+)\s+tests/i)
if (!baseline) throw new Error('MEMORY.md has no frontend N files / M tests baseline')

const minimumFiles = Number(baseline[1])
const minimumTests = Number(baseline[2])
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-frontend-count-'))
const outputFile = path.join(temporaryDirectory, 'vitest.json')

try {
  const vitest = path.join(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs')
  const result = spawnSync(process.execPath, [vitest, 'run', '--reporter=json', `--outputFile=${outputFile}`], {
    cwd: path.join(repositoryRoot, 'frontend'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) throw new Error(`Frontend Vitest JSON run failed (${result.status}):\n${result.stdout}\n${result.stderr}`)
  const report = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
  const suites = Number(report.numTotalTestSuites)
  const files = Number(report.testResults?.length)
  const tests = Number(report.numTotalTests)
  if (!Number.isFinite(suites) || !Number.isFinite(files) || !Number.isFinite(tests)) throw new Error('Vitest JSON report is missing numeric file/suite/test totals')
  if (files < minimumFiles || suites < minimumFiles || tests < minimumTests) {
    throw new Error(`Frontend test count decreased: ${files} files / ${suites} suites / ${tests} tests; minimum ${minimumFiles} files / ${minimumTests} tests`)
  }
  console.log(`Frontend nondecreasing gate passed: ${files} files / ${suites} suites / ${tests} tests >= ${minimumFiles} files / ${minimumTests} tests`)
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
