import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const attemptName = process.argv[2];
if (!/^attempt-[1-9]\d*$/.test(attemptName ?? '')) throw new Error('usage: node tools/e2e/run-phase28-baseline-recovery.mjs attempt-N');

const repositoryRoot = realpathSync(resolve(import.meta.dirname, '../..'));
const frontendRoot = resolve(repositoryRoot, 'frontend');
const configuredOutput = realpathSync(resolve(frontendRoot, 'test-results'));
const recoveryParent = resolve(repositoryRoot, '.artifacts/phase28-ui-audit/baseline-recovery');
if (!existsSync(recoveryParent) || lstatSync(recoveryParent).isSymbolicLink()) throw new Error('recovery parent must exist and cannot be a symlink');
const canonicalParent = realpathSync(recoveryParent);
const inside = (parent, child) => {
  const candidate = relative(parent, child);
  return candidate === '' || (!candidate.startsWith(`..${sep}`) && candidate !== '..' && !isAbsolute(candidate));
};
if (!inside(repositoryRoot, canonicalParent)) throw new Error('recovery parent escapes repository');
if (inside(configuredOutput, canonicalParent) || inside(canonicalParent, configuredOutput)) throw new Error('recovery root overlaps Playwright configured output');
const attemptRoot = resolve(canonicalParent, attemptName);
if (!inside(canonicalParent, attemptRoot) || existsSync(attemptRoot)) throw new Error('attempt root must be a new absent direct child');
mkdirSync(attemptRoot);
const evidenceRoot = resolve(attemptRoot, 'evidence');
const playwrightRoot = resolve(attemptRoot, 'playwright');
const runnerRoot = resolve(attemptRoot, 'runner');
mkdirSync(evidenceRoot);
mkdirSync(playwrightRoot);
mkdirSync(runnerRoot);
if (inside(configuredOutput, evidenceRoot) || inside(evidenceRoot, configuredOutput) || inside(configuredOutput, playwrightRoot) || inside(playwrightRoot, configuredOutput)) throw new Error('canonical disjointness failed after parent creation');

const workspaceModules = resolve(repositoryRoot, 'node_modules');
const viteCli = resolve(workspaceModules, 'vite/bin/vite.js');
const playwrightCli = resolve(workspaceModules, '@playwright/test/cli.js');
const vitestCli = resolve(workspaceModules, 'vitest/vitest.mjs');
for (const executable of [viteCli, playwrightCli, vitestCli]) {
  if (!existsSync(executable)) throw new Error(`direct Node executable is missing: ${executable}`);
}
const childEnv = { ...process.env, VITE_ENABLE_MOCK_LOGIN: 'true', UI_AUDIT_OUTPUT_ROOT: evidenceRoot, UI_AUDIT_RECOVERY_OUTPUT_ROOT: evidenceRoot };

function runNode(name, argv, env = childEnv) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, argv, { cwd: frontendRoot, env, shell: false, windowsHide: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { const text = chunk.toString(); stdout += text; process.stdout.write(text); });
    child.stderr.on('data', (chunk) => { const text = chunk.toString(); stderr += text; process.stderr.write(text); });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      writeFileSync(resolve(runnerRoot, `${name}.log`), `${stdout}\n--- STDERR ---\n${stderr}`);
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${name} exited code=${code} signal=${signal ?? 'none'}`));
    });
  });
}

const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: frontendRoot,
  env: childEnv,
  shell: false,
  windowsHide: false,
});
let viteStdout = '';
let viteStderr = '';
vite.stdout.on('data', (chunk) => { viteStdout += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteStderr += chunk.toString(); });

async function waitForFrontend() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5173/login', { method: 'GET' });
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error('controlled frontend did not become ready');
}

const runs = [
  ['bridge', ['tests/ui-audit.spec.ts', '--grep', 'Phase 28 (login production-route baseline bridge|protected production-route ready cohort)']],
  ['dashboard', ['tests/dashboard-production-query.spec.ts']],
  ['weekly-menu', ['tests/weekly-menu-production-query.spec.ts']],
  ['reports', ['tests/reports-production-query.spec.ts']],
  ['meal-orders', ['tests/meal-orders-production-query.spec.ts']],
  ['chef-dashboard', ['tests/chef-dashboard-production-query.spec.ts']],
  ['approvals', ['tests/approvals-production-query.spec.ts']],
  ['purchasing', ['tests/purchasing-production-query.spec.ts']],
  ['warehouse', ['tests/warehouse-production-query.spec.ts']],
  ['admin-data', ['tests/admin-data-production-query.spec.ts']],
  ['approval-rules', ['tests/approval-rules-production-query.spec.ts']],
  ['static-form', ['tests/static-form-production-route.spec.ts']],
];

try {
  await waitForFrontend();
  for (const [name, specArgs] of runs) {
    const output = resolve(playwrightRoot, name);
    await runNode(name, [playwrightCli, 'test', ...specArgs, '--config', 'playwright.recovery.config.ts', '--headed', '--workers=1', `--output=${output}`]);
  }
  await runNode('reconcile', [vitestCli, 'run', '--run', 'tests/uiAuditBaselineReconciliation.emit.test.ts', '--maxWorkers=1']);
  const methods = [];
  for (const name of [
    'ui-audit-phase28-login-production-route.json', 'ui-audit-phase28-protected-production-routes.json',
    'ui-audit-phase28-dashboard-query-states.json', 'ui-audit-phase28-weekly-menu-query-states.json',
    'ui-audit-phase28-reports-query-states.json', 'ui-audit-phase28-meal-orders-query-states.json',
    'ui-audit-phase28-chef-dashboard-query-states.json', 'ui-audit-phase28-approvals-query-states.json',
    'ui-audit-phase28-purchasing-query-states.json', 'ui-audit-phase28-warehouse-query-states.json',
    'ui-audit-phase28-admin-data-query-states.json', 'ui-audit-phase28-approval-rules-query-states.json',
    'ui-audit-phase28-static-form-production-routes.json',
  ]) {
    const artifact = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(evidenceRoot, name), 'utf8'));
    for (const record of artifact.records) for (const request of record.network) methods.push(request.method);
  }
  if (methods.some((method) => !['GET', 'HEAD'].includes(method))) throw new Error('non-GET/HEAD request found in recovered evidence');
  const methodProof = `${JSON.stringify({ allowed: ['GET', 'HEAD'], observed: [...new Set(methods)].sort(), requestCount: methods.length }, null, 2)}\n`;
  writeFileSync(resolve(evidenceRoot, 'network-method-proof.json'), methodProof);
  writeFileSync(resolve(attemptRoot, 'attempt-complete.json'), `${JSON.stringify({ attemptName, status: 'IMMUTABLE_COMPLETE', evidenceRoot: 'evidence', playwrightRoot: 'playwright', networkMethodProofSha256: createHash('sha256').update(methodProof).digest('hex') }, null, 2)}\n`);
} finally {
  vite.kill('SIGTERM');
  writeFileSync(resolve(runnerRoot, 'vite.log'), `${viteStdout}\n--- STDERR ---\n${viteStderr}`);
}
