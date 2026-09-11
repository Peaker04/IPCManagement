import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vitestBin = fileURLToPath(new URL('../vitest.mjs', import.meta.resolve('vitest')))
const result = spawnSync(
  process.execPath,
  [vitestBin, 'run', 'src/features/reconciliation/reconciliationRequestContract.fixture.test.ts', '--maxWorkers=1'],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, UPDATE_PHASE30_REQUEST_CONTRACT: '1' },
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)
