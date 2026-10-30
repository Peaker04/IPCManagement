import { spawn, execSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { assertSafeSandboxDatabase, ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT } from './dbGuardrail';

const REPO_ROOT = process.cwd();
const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
const MYSQLDUMP_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysqldump.exe';

let kestrelProc: ChildProcess | null = null;
let viteProc: ChildProcess | null = null;

async function waitForHttp(url: string, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 404) return;
    } catch {
      // waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`[GLOBAL-SETUP] Timeout waiting for ${url}`);
}

export default async function globalSetup(): Promise<void> {
  console.log('\n[E2E-MRX-SETUP] Initiating Sandbox E2E Environment Setup...');

  // 1. Hard DB Guardrail Check
  assertSafeSandboxDatabase(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT);

  // 2. Free ports 5174 (Vite Sandbox) and 5263 (Kestrel Sandbox)
  try {
    execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174, 5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
  } catch {}

  // 3. Clone fresh sandbox database
  const dumpPath = path.resolve('D:/Temp/ipc_mrx_harness_dump.sql');
  console.log(`[E2E-MRX-SETUP] Duplicating '${ALLOWED_SANDBOX_DB}' from production 'ipcmanagement'...`);
  execSync(`"${MYSQL_BIN}" -u root -p123456789 -e "CREATE DATABASE IF NOT EXISTS ${ALLOWED_SANDBOX_DB};"`, { stdio: 'pipe' });
  execSync(`"${MYSQLDUMP_BIN}" -u root -p123456789 --single-transaction --hex-blob --set-gtid-purged=OFF --result-file="${dumpPath}" ipcmanagement`, { stdio: 'pipe' });
  execSync(`"${MYSQL_BIN}" -u root -p123456789 ${ALLOWED_SANDBOX_DB} < "${dumpPath}"`, { stdio: 'pipe' });

  // Clean week 2026-07-20 in sandbox for Golden Path testing
  const cleanSql = `
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM reconciliationsourcedeltas WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationdispositions WHERE BatchLineId IN (SELECT BatchLineId FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20')));
    DELETE FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20');
    DELETE FROM mealquantityplanlines WHERE quantityPlanId IN (SELECT quantityPlanId FROM mealquantityplans WHERE serviceDate >= '2026-07-20' AND serviceDate <= '2026-07-26');
    DELETE FROM mealquantityplans WHERE serviceDate >= '2026-07-20' AND serviceDate <= '2026-07-26';
    DELETE FROM menuschedules WHERE weekStartDate = '2026-07-20';
    DELETE FROM menuversions WHERE weekStartDate = '2026-07-20';
    UPDATE systemoperationmodes SET Mode = 'MATERIAL_RECONCILIATION', Version = Version + 1, UpdatedAt = NOW() WHERE Id = 1;
    SET FOREIGN_KEY_CHECKS = 1;
  `;
  const cleanPath = path.resolve('D:/Temp/ipc_mrx_clean_setup.sql');
  fs.writeFileSync(cleanPath, cleanSql);
  execSync(`"${MYSQL_BIN}" -u root -p123456789 ${ALLOWED_SANDBOX_DB} < "${cleanPath}"`, { stdio: 'pipe' });
  console.log(`[E2E-MRX-SETUP] Sandbox DB '${ALLOWED_SANDBOX_DB}' initialized with fresh 2026-07-20 week.`);

  // 4. Start Kestrel Backend on port 5263
  console.log(`[E2E-MRX-SETUP] Starting Sandbox Kestrel on port ${ALLOWED_SANDBOX_PORT}...`);
  kestrelProc = spawn('dotnet', [
    'run',
    '--no-build',
    '--project', 'backend/src/IPCManagement.Api',
    '--urls', `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}`,
    '--ConnectionStrings:DefaultConnection', `server=localhost;port=3306;database=${ALLOWED_SANDBOX_DB};user=root;password=123456789;`,
  ], { cwd: REPO_ROOT, stdio: 'pipe' });

  kestrelProc.stderr?.on('data', (d) => process.stderr.write(`[Kestrel-5263] ${d}`));

  await waitForHttp(`http://127.0.0.1:${ALLOWED_SANDBOX_PORT}/swagger/v1/swagger.json`, 25000);
  console.log(`[E2E-MRX-SETUP] Sandbox Kestrel is live on port ${ALLOWED_SANDBOX_PORT}`);

  // 5. Start Vite Frontend on port 5174 with proxy to 5263
  console.log(`[E2E-MRX-SETUP] Starting Sandbox Vite on port 5174 (proxy -> 5263)...`);
  viteProc = spawn('cmd.exe', [
    '/c', 'npm', 'run', 'dev', '--',
    '--port', '5174',
  ], {
    cwd: path.resolve(REPO_ROOT, 'frontend'),
    stdio: 'pipe',
    env: {
      ...process.env,
      VITE_PROXY_TARGET: `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}`,
    },
  });

  viteProc.stderr?.on('data', (d) => process.stderr.write(`[Vite-5174] ${d}`));

  await waitForHttp('http://127.0.0.1:5174/login', 25000);
  console.log('[E2E-MRX-SETUP] Sandbox Vite is live on port 5174. Ready for E2E Matrix!\n');

  // Stash process PIDs for teardown
  (globalThis as any).__MRX_KESTREL_PID = kestrelProc.pid;
  (globalThis as any).__MRX_VITE_PID = viteProc.pid;
}
