import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const attemptName = process.argv[2];
if (!/^attempt-[1-9]\d*$/.test(attemptName ?? '')) throw new Error('usage: node tools/e2e/run-phase28-remediation.mjs attempt-N');
const repositoryRoot = realpathSync(resolve(import.meta.dirname, '../..'));
const frontendRoot = resolve(repositoryRoot, 'frontend');
const configuredOutput = realpathSync(resolve(frontendRoot, 'test-results'));
const parent = resolve(repositoryRoot, '.artifacts/phase28-ui-audit/remediation');
if (!existsSync(parent) || lstatSync(parent).isSymbolicLink()) throw new Error('remediation parent must exist and cannot be a symlink');
const canonicalParent = realpathSync(parent);
const inside = (base, child) => { const candidate = relative(base, child); return candidate === '' || (!candidate.startsWith(`..${sep}`) && candidate !== '..' && !isAbsolute(candidate)); };
if (!inside(repositoryRoot, canonicalParent) || inside(configuredOutput, canonicalParent) || inside(canonicalParent, configuredOutput)) throw new Error('remediation parent is not canonically path-disjoint');
const root = resolve(canonicalParent, attemptName);
if (!inside(canonicalParent, root) || existsSync(root)) throw new Error('attempt root must be a fresh absent direct child');
mkdirSync(root);
for (const child of ['run-1', 'run-2', 'playwright-run-1', 'playwright-run-2', 'runner']) mkdirSync(resolve(root, child));
const playwrightCli = resolve(repositoryRoot, 'node_modules/@playwright/test/cli.js');
const viteCli = resolve(repositoryRoot, 'node_modules/vite/bin/vite.js');
const viteNodeCli = resolve(repositoryRoot, 'node_modules/vite-node/vite-node.mjs');
for (const entry of [playwrightCli, viteCli, viteNodeCli]) if (!existsSync(entry)) throw new Error(`repository-resolved executable missing: ${entry}`);
const baseEnv = { ...process.env, VITE_ENABLE_MOCK_LOGIN: 'true' };
const run = (name, argv, env = baseEnv) => new Promise((accept, reject) => {
  const child = spawn(process.execPath, argv, { cwd: frontendRoot, env, shell: false, windowsHide: false });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  child.once('error', reject);
  child.once('exit', (code, signal) => { writeFileSync(resolve(root, 'runner', `${name}.log`), `${stdout}\n--- STDERR ---\n${stderr}`); code === 0 ? accept() : reject(new Error(`${name} exited code=${code} signal=${signal ?? 'none'}`)); });
});
const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: frontendRoot, env: baseEnv, shell: false, windowsHide: false });
let viteLog = '';
vite.stdout.on('data', (chunk) => { viteLog += chunk; });
vite.stderr.on('data', (chunk) => { viteLog += chunk; });
for (let count = 0; count < 120; count++) { try { if ((await fetch('http://127.0.0.1:5173/login')).ok) break; } catch {} if (count === 119) throw new Error('controlled frontend did not become ready'); await delay(500); }
const specs = [
  ['bridge', 'tests/ui-audit.spec.ts', '--grep', 'Phase 28 (login production-route baseline bridge|protected production-route ready cohort)'],
  ['dashboard', 'tests/dashboard-production-query.spec.ts'], ['weekly-menu', 'tests/weekly-menu-production-query.spec.ts'], ['reports', 'tests/reports-production-query.spec.ts'], ['meal-orders', 'tests/meal-orders-production-query.spec.ts'], ['chef-dashboard', 'tests/chef-dashboard-production-query.spec.ts'], ['approvals', 'tests/approvals-production-query.spec.ts'], ['purchasing', 'tests/purchasing-production-query.spec.ts'], ['warehouse', 'tests/warehouse-production-query.spec.ts'], ['admin-data', 'tests/admin-data-production-query.spec.ts'], ['approval-rules', 'tests/approval-rules-production-query.spec.ts'], ['static-form', 'tests/static-form-production-route.spec.ts'],
];
try {
  for (const runNumber of [1, 2]) {
    const evidence = resolve(root, `run-${runNumber}`);
    const env = { ...baseEnv, UI_AUDIT_OUTPUT_ROOT: evidence, UI_AUDIT_RECOVERY_OUTPUT_ROOT: evidence };
    for (const [name, ...args] of specs) await run(`run-${runNumber}-${name}`, [playwrightCli, 'test', ...args, '--config', 'playwright.recovery.config.ts', '--headed', '--workers=1', `--output=${resolve(root, `playwright-run-${runNumber}`, name)}`], env);
    await run(`run-${runNumber}-matrix`, [playwrightCli, 'test', 'tests/ui-audit-remediation.spec.ts', '--grep', '^phase 28 remediation / full D5\\+R2 identity matrix$', '--config', 'playwright.recovery.config.ts', '--headed', '--workers=1', `--output=${resolve(root, `playwright-run-${runNumber}`, 'matrix')}`], env);
  }
  const selection = resolve(parent, 'selected-attempt.json');
  if (existsSync(selection)) throw new Error('selected-attempt.json already exists; append-only selection cannot be overwritten');
  await run('reconcile', [viteNodeCli, 'tests/uiAuditRemediationReconciliation.ts', '--recovery-authority', '.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json', '--run1', relative(repositoryRoot, resolve(root, 'run-1')), '--run2', relative(repositoryRoot, resolve(root, 'run-2')), '--attempt-manifest', relative(repositoryRoot, resolve(root, 'manifest.json')), '--write-selection', relative(repositoryRoot, selection)]);
} finally {
  vite.kill('SIGTERM');
  writeFileSync(resolve(root, 'runner', 'vite.log'), viteLog);
}
