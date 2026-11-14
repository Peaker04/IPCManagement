import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const require = createRequire(import.meta.url)
const yaml = require('js-yaml')
const verify = yaml.load(readFileSync('.github/workflows/verify.yml', 'utf8'))
const codeql = yaml.load(readFileSync('.github/workflows/codeql.yml', 'utf8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const runs = job => (job.steps ?? []).map(step => step.run ?? '').join('\n')

test('FE and BE run independently, with MySQL only in BE', () => {
  assert.ok(verify.jobs.frontend && verify.jobs.backend)
  assert.equal(verify.jobs.frontend['runs-on'], 'windows-latest')
  assert.equal(verify.jobs.frontend.needs, undefined)
  assert.equal(verify.jobs.backend.needs, undefined)
  assert.equal(verify.jobs.frontend.services, undefined)
  assert.ok(verify.jobs.backend.services.mysql)
  assert.match(runs(verify.jobs.frontend), /npm run verify:quick/)
  assert.match(runs(verify.jobs.frontend), /npm run test:fe:unit/)
})

test('stable required verify check always evaluates both jobs', () => {
  const gate = verify.jobs.verify
  assert.deepEqual([...gate.needs].sort(), ['backend', 'frontend', 'windows-contracts'])
  assert.match(gate.if, /always\(\)/)
  assert.match(runs(gate), /check-ci-job-results/)
  assert.match(gate.steps.find(step => step.run?.includes('check-ci-job-results')).env.FRONTEND_RESULT, /needs.frontend.result/)
  assert.match(gate.steps.find(step => step.run?.includes('check-ci-job-results')).env.BACKEND_RESULT, /needs.backend.result/)
  assert.match(gate.steps.find(step => step.run?.includes('check-ci-job-results')).env.WINDOWS_RESULT, /needs\['windows-contracts'\].result/)
})

test('aggregate rejects failure, cancellation, skip, missing or unknown result', () => {
  for (const [frontend, backend, windows, expected] of [
    ['success', 'success', 'success', 0], ['failure', 'success', 'success', 1], ['success', 'failure', 'success', 1],
    ['cancelled', 'success', 'success', 1], ['success', 'skipped', 'success', 1], ['', 'success', 'success', 1],
    ['success', 'unknown', 'success', 1], ['success', 'success', 'failure', 1], ['success', 'success', 'skipped', 1],
  ]) {
    const result = spawnSync(process.execPath, ['scripts/check-ci-job-results.mjs'], {
      encoding: 'utf8', env: { ...process.env, FRONTEND_RESULT: frontend, BACKEND_RESULT: backend, WINDOWS_RESULT: windows },
    })
    assert.equal(result.status, expected, `${frontend}/${backend}: ${result.stderr}`)
    if (expected === 0) assert.match(result.stdout, /passed/)
  }
})

test('only main is eligible for Git deployment while Verify and CodeQL cover main and dev', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const branches = ['main', 'dev']
  assert.deepEqual(vercel.git.deploymentEnabled, { '**': false, main: true },
    'Disable every branch, including names with slashes; the explicit main rule enables Production')
  for (const workflow of [verify, codeql]) {
    for (const branch of branches) {
      assert.ok(workflow.on.push.branches.includes(branch), `push ${branch}`)
      assert.ok(workflow.on.pull_request.branches.includes(branch), `PR ${branch}`)
    }
    assert.equal(workflow.on.push.paths, undefined, 'Do not path-skip required workflows')
  }
})

test('common fast gates include conformance in local and CI entrypoints', () => {
  assert.match(pkg.scripts['verify:quick'] ?? '', /check:conformance-contracts/)
  assert.match(pkg.scripts.verify, /npm run verify:quick/)
})

test('backend preserves real contract, fixtures, migration and per-case evidence gates', () => {
  assert.ok(verify.jobs.backend)
  const source = runs(verify.jobs.backend)
  for (const command of ['check:api-contract', 'test:phase05-fixture-determinism', 'migrations has-pending-model-changes',
    'Migration_fresh_install_applies_decision_exception_and_legacy_marker_schema',
    'Migration_upgrade_populated_clone_preserves_receipt_history',
    'Migration_upgrade_preserves_supplier_snapshots_and_rejects_duplicate_purchase_order_keys',
    'ci_schema_parity.py', 'ci_test_results.py']) assert.ok(source.includes(command), command)
  const reports = verify.jobs.backend.steps.filter(step => step.run?.includes('ci_test_results.py'))
  assert.equal(reports.length, 3)
  assert.ok(reports.every(step => step.if?.includes('always()')))
  const fresh = reports.find(step => step.run.includes('/migration-replay.trx'))
  const upgrade = reports.find(step => step.run.includes('/migration-upgrade-replay.trx'))
  assert.deepEqual([...fresh.run.matchAll(/--expected\s+(\w+)/g)].map(match => match[1]),
    ['Migration_fresh_install_applies_decision_exception_and_legacy_marker_schema'])
  assert.deepEqual([...upgrade.run.matchAll(/--expected\s+(\w+)/g)].map(match => match[1]).sort(), [
    'Migration_upgrade_populated_clone_preserves_receipt_history',
    'Migration_upgrade_preserves_supplier_snapshots_and_rejects_duplicate_purchase_order_keys',
  ].sort())
  assert.match(source, /dotnet build backend\/IPCManagement.slnx --no-restore/)
  assert.match(source, /npm run test:be:ci -- --no-build --no-restore/)
  const steps = verify.jobs.backend.steps
  const order = marker => steps.findIndex(step => step.run?.includes(marker))
  for (const marker of ['CREATE DATABASE ipcmanagement_ci', 'npm run test:be:ci',
    'migration-replay.trx', 'migration-upgrade-replay.trx', 'ci_schema_parity.py']) {
    assert.ok(order(marker) >= 0, `Missing backend phase: ${marker}`)
  }
  assert.ok(order('CREATE DATABASE ipcmanagement_ci') < order('npm run test:be:ci'))
  assert.ok(order('migration-replay.trx') < order('migration-upgrade-replay.trx'))
  assert.ok(order('migration-upgrade-replay.trx') < order('ci_schema_parity.py'))
})

test('advisory gates remain advisory and diagnostics are scoped', () => {
  const steps = Object.values(verify.jobs).flatMap(job => job.steps ?? [])
  for (const marker of ['check-architecture-growth.mjs --strict', 'check:route-budgets']) {
    assert.equal(steps.find(step => step.run?.includes(marker))?.['continue-on-error'], true)
  }
  const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'))
  const backendUpload = uploads.find(step => step.with.name === 'backend-test-results')
  assert.equal(backendUpload?.with['include-hidden-files'], true)
  assert.deepEqual(backendUpload.with.path.trim().split('\n'), [
    '.artifacts/test-results/**/*.trx', '.artifacts/shape-*.txt',
  ])
  assert.equal(uploads.length, 3)
  assert.ok(uploads.every(step => step.if === 'always()' && step.with['retention-days'] === 7))
  assert.ok(uploads.some(step => step.with.path.includes('shape-*.txt')))
  assert.ok(uploads.some(step => step.with.path.includes('frontend-unit.xml')))
  assert.ok(uploads.every(step => !step.with.path.includes('.artifacts/**')))
})

test('Windows-only PowerShell contracts have a required execution owner', () => {
  const owner = verify.jobs['windows-contracts']
  assert.equal(owner['runs-on'], 'windows-latest')
  assert.match(runs(owner), /npm run test:be:windows/)
  assert.match(runs(owner), /ci_test_results.py/)
  assert.match(pkg.scripts['test:be:windows'], /MrxDisposableEvidenceContractTests/)
  assert.match(pkg.scripts['test:be:windows'], /RecoveryScriptContractTests/)
})
