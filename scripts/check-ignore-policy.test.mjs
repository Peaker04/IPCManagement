import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const ignored = (path) => spawnSync('git', ['check-ignore', '--no-index', '-q', path]).status === 0

test('source stays trackable while secrets, local data and disposable output stay ignored', () => {
  for (const path of [
    '.artifacts/dotnet/example/bin/app.dll', 'artifacts/output.json',
    'frontend/dist/assets/app.js', 'frontend/test-results/result.json',
    'node_modules/package/index.js', '.env', 'frontend/.env.local',
    'backend/src/IPCManagement.Api/appsettings.Development.json',
    'backend/src/IPCManagement.Api/appsettings.Demo.json',
    'backend/src/IPCManagement.Api/appsettings.Lan.json',
    '.docs/private.xlsx', 'test-results/trace.zip', '.planning/temporary.json',
  ]) assert.equal(ignored(path), true, `${path} must be ignored`)
  for (const path of [
    'Directory.Build.props', 'package.json', 'Dockerfile', 'vercel.json',
    '.github/workflows/verify.yml', 'backend/src/IPCManagement.Api/Program.cs',
    'backend/src/IPCManagement.Api/appsettings.json.example',
    'backend/src/IPCManagement.Api/appsettings.Demo.example.json', 'frontend/src/main.tsx',
    'docs/ARCHITECTURE.md', 'AGENTS.md', 'ROADMAP.md', '.planning/WORK.md',
  ]) assert.equal(ignored(path), false, `${path} must remain trackable`)
})

test('Docker excludes secrets and generated trees without excluding backend source', () => {
  const text = readFileSync('.dockerignore', 'utf8')
  for (const pattern of ['**/.artifacts/', '**/node_modules/', '**/dist/', '**/appsettings.json', '**/.env', '.docs/']) {
    assert.ok(text.includes(pattern), `missing Docker exclusion: ${pattern}`)
  }
  assert.equal(/^backend\/(?:src\/)?$/m.test(text), false)
})
