import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
const ignored = (path) => spawnSync('git', ['check-ignore', '--no-index', '-q', path]).status === 0

test('repository ignore policy separates source from generated and sensitive files', () => {
  const mustIgnore = [
    '.artifacts/dotnet/example/bin/app.dll',
    'artifacts/legacy-output.json',
    'backend/src/IPCManagement.Api/.artifacts/run/output.dll',
    'backend/tests/IPCManagement.Api.Tests/.artifactslk2/Debug/test.dll',
    'backend/tests/IPCManagement.Api.Tests/.tmp-wave/Debug/test.dll',
    'backend/src/IPCManagement.Api/.phase05test/Debug/app.dll',
    'backend/tests/IPCManagement.Api.Tests/bin-phase42-run/Debug/test.dll',
    'backend/src/IPCManagement.Api/backend/tests/copied.dll',
    'frontend/dist/assets/app.js',
    'frontend/test-results/result.json',
    'node_modules/package/index.js',
    'backend/src/IPCManagement.Api/appsettings.Development.json',
    '.planning/phases/example/evidence/trace.zip',
    '.planning/phases/example/evidence/screenshot.png',
    '.planning/workstreams/standardization/example/evidence/trace.zip',
    '.planning/workstreams/standardization/example/evidence/screenshot.png',
  ]
  const mustTrack = [
    'Directory.Build.props',
    'package.json',
    'Dockerfile',
    'vercel.json',
    '.github/workflows/verify.yml',
    '.vscode/settings.json',
    'backend/src/IPCManagement.Api/Program.cs',
    'backend/src/IPCManagement.Api/appsettings.json.example',
    'frontend/src/main.tsx',
    'scripts/check-ignore-policy.test.mjs',
    'docs/ARCHITECTURE.md',
    '.planning/workstreams/standardization/example/PLAN.md',
    '.planning/workstreams/standardization/example/checkpoint.json',
  ]

  for (const path of mustIgnore) assert.equal(ignored(path), true, `${path} must be ignored`)
  for (const path of mustTrack) assert.equal(ignored(path), false, `${path} must remain trackable`)
})

test('Docker context excludes generated trees without excluding backend source', () => {
  const dockerignore = readFileSync('.dockerignore', 'utf8')
  for (const pattern of [
    '/artifacts/', '**/.artifacts/', '**/.artifactslk*/', '**/.tmp-*/',
    '**/.phase*test/', '**/bin-*/', '/backend/src/IPCManagement.Api/backend/',
  ]) assert.ok(dockerignore.includes(pattern), `missing Docker exclusion: ${pattern}`)

  assert.equal(/^backend\/$/m.test(dockerignore), false, 'backend source must stay in Docker context')
  assert.equal(/^backend\/src\/$/m.test(dockerignore), false, 'backend/src must stay in Docker context')
})

test('root ownership keeps source, private data, and legacy evidence in their declared owners', () => {
  const trackedPrivateFiles = git('ls-files', '.docs/**').trim().split(/\r?\n/).filter(Boolean).filter(existsSync)
  assert.deepEqual(trackedPrivateFiles, [], '.docs must not own tracked files that still exist')
  assert.equal(existsSync('src'), false, 'root src must stay absent')

  const legacyArtifacts = git('ls-files', 'artifacts/**').trim().split(/\r?\n/).filter(Boolean).filter(existsSync)
  assert.deepEqual(legacyArtifacts, [], 'root artifacts must stay retired after evidence migration')
  const migratedArtifacts = [
    '.artifacts/performance/legacy-root-probes/perf-probe-admin-audit-pagination.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-coordination-export.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-purchasing-submit.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-warehouse-geometry.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-warehouse-geometry.md',
    '.artifacts/performance/legacy-root-probes/perf-probe-warehouse-inp-search.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-warehouse-inp-smoke-v2.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-warehouse-inp-tab.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-wave7-all-load.json',
    '.artifacts/performance/legacy-root-probes/perf-probe-wave7-all-load.md',
    '.artifacts/performance/probe-h1-preview/probe-h1-preview-report.json',
    '.artifacts/performance/probe-h1-preview/probe-h1-preview-report.md',
  ]
  const evidenceIndex = readFileSync('docs/EVIDENCE-INDEX.md', 'utf8')
  for (const path of migratedArtifacts) {
    assert.ok(existsSync(path), `${path} must exist after migration`)
    assert.ok(evidenceIndex.includes(`\`${path}\``), `${path} must stay indexed`)
  }
})

test('tracked-but-ignored debt is bounded to reviewed legacy owners', () => {
  const paths = git('ls-files', '-ci', '--exclude-standard').trim().split(/\r?\n/).filter(Boolean).filter(existsSync)
  const owners = new Map([
    ['.planning/', 536],
    ['.artifacts/', 32],
    ['backend/src/IPCManagement.Api/appsettings.Development.json', 1],
  ])
  const counts = new Map([...owners.keys()].map((owner) => [owner, 0]))

  for (const path of paths) {
    const owner = [...owners.keys()].find((candidate) =>
      candidate.endsWith('/') ? path.startsWith(candidate) : path === candidate)
    assert.ok(owner, `unreviewed tracked-but-ignored path: ${path}`)
    counts.set(owner, counts.get(owner) + 1)
  }
  for (const [owner, ceiling] of owners) {
    assert.ok(counts.get(owner) <= ceiling, `${owner} debt grew: ${counts.get(owner)} > ${ceiling}`)
  }
})
