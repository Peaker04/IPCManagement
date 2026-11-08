import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {
  ALLOWED_SANDBOX_PORT,
  assertSafeMrxE2eDatabase,
  assertTargetConnectionDatabase,
  resolveMrxE2eDatabase,
} from './dbGuardrail';
import { MySQLVerifier } from './mysqlVerifier';
import { readQualificationCredentials } from '../fixtures/authHelpers';
import { readProcessIdentity, stopOwnedProcesses, type OwnedProcess } from './ownedProcesses';

const REPO_ROOT = process.cwd();
const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
const MYSQLDUMP_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysqldump.exe';
const PROCESS_FILE = process.env.MRX_E2E_PROCESS_FILE
  ?? path.resolve('.artifacts/mrx-e2e/processes.json');

function listenerPids(): number[] {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '@(Get-NetTCPConnection -State Listen -LocalPort 5174,5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join ","',
  ]).toString().trim();
  return output ? output.split(',').map(Number).filter(Number.isInteger) : [];
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The run-owned server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`[GLOBAL-SETUP] Timeout waiting for ${url}`);
}

function requireFile(variable: string): string {
  const value = process.env[variable] ?? '';
  if (!value || !fs.existsSync(value)) {
    throw new Error(`[FATAL CONFIGURATION ERROR] ${variable} must name an existing run-owned file.`);
  }
  return value;
}

function runMysql(defaultsFile: string, args: string[], inputFile?: string): void {
  const input = inputFile ? fs.openSync(inputFile, 'r') : 'ignore';
  try {
    const result = spawnSync(MYSQL_BIN, [`--defaults-extra-file=${defaultsFile}`, ...args], {
      stdio: [input, 'pipe', 'pipe'],
    });
    if (result.status !== 0) throw new Error(result.stderr.toString() || 'mysql failed');
  } finally {
    if (typeof input === 'number') fs.closeSync(input);
  }
}

function prepareLegacySandbox(database: string, defaultsFile: string): void {
  const dumpPath = path.resolve('.artifacts/mrx-e2e/source.sql');
  fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
  const existing = execFileSync(MYSQL_BIN, [
    `--defaults-extra-file=${defaultsFile}`,
    '--batch', '--skip-column-names', '--execute',
    `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '${database}';`,
  ]).toString().trim();
  if (existing === '1') runMysql(defaultsFile, ['--execute', `DROP DATABASE \`${database}\`;`]);
  runMysql(defaultsFile, ['--execute', `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4;`]);
  const dump = spawnSync(MYSQLDUMP_BIN, [
    `--defaults-extra-file=${defaultsFile}`,
    '--single-transaction', '--hex-blob', '--set-gtid-purged=OFF',
    `--result-file=${dumpPath}`, 'ipcmanagement',
  ], { stdio: 'pipe' });
  if (dump.status !== 0) throw new Error(dump.stderr.toString() || 'mysqldump failed');
  runMysql(defaultsFile, [database], dumpPath);
  fs.rmSync(dumpPath, { force: true });
}

function cleanGoldenWeek(verifier: MySQLVerifier): void {
  verifier.execute(`
    SET FOREIGN_KEY_CHECKS = 0;
    DELETE FROM reconciliationsourcedeltas WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationdispositions WHERE BatchLineId IN (SELECT BatchLineId FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20')));
    DELETE FROM reconciliationbatchlines WHERE BatchId IN (SELECT BatchId FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20'));
    DELETE FROM reconciliationbatches WHERE MenuVersionId IN (SELECT MenuVersionId FROM menuversions WHERE weekStartDate = '2026-07-20');
    DELETE FROM mealquantityplanlines WHERE quantityPlanId IN (SELECT quantityPlanId FROM mealquantityplans WHERE serviceDate BETWEEN '2026-07-20' AND '2026-07-26');
    DELETE FROM mealquantityplans WHERE serviceDate BETWEEN '2026-07-20' AND '2026-07-26';
    DELETE FROM menuschedules WHERE weekStartDate = '2026-07-20';
    DELETE FROM menuversions WHERE weekStartDate = '2026-07-20';
    UPDATE systemoperationmodes SET Mode = 'MATERIAL_RECONCILIATION', Version = Version + 1, UpdatedAt = NOW() WHERE Id = 1;
    SET FOREIGN_KEY_CHECKS = 1;`);
}

function stopProcess(process: ChildProcess | null): void {
  if (process?.pid) {
    try { process.kill(); } catch { /* already stopped */ }
  }
}

export default async function globalSetup(): Promise<void> {
  const database = resolveMrxE2eDatabase(process.env);
  assertSafeMrxE2eDatabase(database.database, ALLOWED_SANDBOX_PORT, process.env);
  const defaultsFile = requireFile('IPC_MRX_MYSQL_DEFAULTS_FILE');
  const targetConnection = process.env.IPC_MRX_TARGET_CONNECTION_STRING;
  if (!targetConnection) {
    throw new Error('[FATAL CONFIGURATION ERROR] IPC_MRX_TARGET_CONNECTION_STRING is required.');
  }

  assertTargetConnectionDatabase(targetConnection, database.database);
  const qualification = process.env.MRX_E2E_PROFILE === 'qualification';
  const owned: OwnedProcess[] = [];
  const artifactDirectory = process.env.MRX_E2E_ARTIFACT_DIRECTORY;
  const contentRoot = process.env.MRX_E2E_CONTENT_ROOT;
  const apiDll = path.resolve(REPO_ROOT, '.artifacts/dotnet/bin/IPCManagement.Api/release/IPCManagement.Api.dll');
  const feIndex = path.resolve(REPO_ROOT, 'frontend/dist/index.html');
  if (qualification) {
    readQualificationCredentials();
    if (!contentRoot || !fs.existsSync(path.join(contentRoot, 'appsettings.json'))) {
      throw new Error('Qualification requires private run-owned runtime settings.');
    }
    if (!artifactDirectory || !fs.statSync(artifactDirectory).isDirectory()) {
      throw new Error('Qualification requires an existing private artifact directory.');
    }
    for (const [file, expected] of [
      [apiDll, process.env.MRX_E2E_API_SHA256], [feIndex, process.env.MRX_E2E_FE_SHA256],
    ]) {
      if (!expected || !/^[a-fA-F0-9]{64}$/.test(expected) || !file
        || !fs.existsSync(file) || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expected.toLowerCase()) {
        throw new Error('Qualification Release artifacts must match the runner build hashes.');
      }
    }
    if (fs.readFileSync(feIndex, 'utf8').includes('/@vite/client')) throw new Error('Qualification cannot serve DEV assets.');
  }
  const listeners = listenerPids().join(',');
  if (listeners) throw new Error(`[FATAL CONFIGURATION ERROR] Ports 5174/5263 are already owned by PID(s) ${listeners}.`);

  if (!database.prepared) prepareLegacySandbox(database.database, defaultsFile);
  const verifier = new MySQLVerifier(database.database, ALLOWED_SANDBOX_PORT, MYSQL_BIN, defaultsFile);
  if (qualification) {
    const modes = verifier.query<{ mode: string; version: string }>('SELECT Mode AS mode, Version AS version FROM systemoperationmodes WHERE Id=1;');
    if (modes.length !== 1 || modes[0].mode !== 'MATERIAL_RECONCILIATION'
      || !Number.isSafeInteger(Number(modes[0].version)) || Number(modes[0].version) < 1) {
      throw new Error('Qualification requires actual server MRX mode/version; setup cannot switch modes.');
    }
  } else {
    cleanGoldenWeek(verifier);
  }

  async function track(child: ChildProcess, label: string): Promise<void> {
    await once(child, 'spawn');
    if (qualification) {
      const identity = child.pid ? readProcessIdentity(child.pid) : null;
      if (!identity) throw new Error(`Could not establish ${label} process ownership.`);
      owned.push(identity);
      fs.mkdirSync(path.dirname(PROCESS_FILE), { recursive: true });
      fs.writeFileSync(PROCESS_FILE, JSON.stringify({
        runId: database.runId, database: database.database, pids: owned.map((entry) => entry.pid), processes: owned,
      }));
      const log = fs.createWriteStream(path.join(artifactDirectory!, `${process.env.MRX_E2E_PHASE}-${label}.log`), { flags: 'a' });
      child.stdout?.on('data', (data: Buffer) => log.write(data));
      child.stderr?.on('data', (data: Buffer) => log.write(data));
      child.once('close', () => log.end());
    } else {
      child.stdout?.resume();
      child.stderr?.on('data', (data: Buffer) => process.stderr.write(`[${label}] ${data}`));
    }
  }

  let kestrel: ChildProcess | null = null;
  let vite: ChildProcess | null = null;
  try {
    kestrel = spawn('dotnet', qualification ? [apiDll, '--urls', `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}`] : [
      'run', '--no-build', '--project', 'backend/src/IPCManagement.Api',
      '--urls', `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}`,
    ], {
      cwd: qualification ? contentRoot : REPO_ROOT,
      stdio: 'pipe',
      env: {
        ...process.env, ConnectionStrings__DefaultConnection: targetConnection,
        ...(qualification ? { ASPNETCORE_ENVIRONMENT: 'Production', DOTNET_ENVIRONMENT: 'Production' } : {}),
      },
    });
    await track(kestrel, 'api');
    await waitForHttp(`http://127.0.0.1:${ALLOWED_SANDBOX_PORT}/${qualification ? 'health/ready' : 'swagger/v1/swagger.json'}`, 25_000);

    const viteCli = qualification
      ? path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js') : '';
    vite = qualification
      ? spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
        cwd: path.resolve(REPO_ROOT, 'frontend'), stdio: 'pipe',
        env: { ...process.env, VITE_PROXY_TARGET: `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}` },
      })
      : spawn('cmd.exe', ['/c', 'npm', 'run', 'dev', '--', '--port', '5174'], {
        cwd: path.resolve(REPO_ROOT, 'frontend'), stdio: 'pipe',
        env: { ...process.env, VITE_PROXY_TARGET: `http://127.0.0.1:${ALLOWED_SANDBOX_PORT}` },
      });
    await track(vite, 'frontend');
    await waitForHttp('http://127.0.0.1:5174/login', 25_000);
    if (qualification) {
      const response = await fetch('http://127.0.0.1:5174/login');
      if (!response.ok || await response.text() !== fs.readFileSync(feIndex, 'utf8')) {
        throw new Error('Served frontend differs from the approved Release index.');
      }
      if (listenerPids().some((pid) => !owned.some((entry) => entry.pid === pid))) {
        throw new Error('A listener is not owned by the current Release processes.');
      }
    }

    fs.mkdirSync(path.dirname(PROCESS_FILE), { recursive: true });
    fs.writeFileSync(PROCESS_FILE, JSON.stringify({
      runId: database.runId ?? 'legacy',
      database: database.database,
      pids: listenerPids(),
      ...(qualification ? { processes: owned } : {}),
    }));
  } catch (error) {
    if (qualification) {
      try {
        for (const child of [vite, kestrel]) {
          // A child handle is still ours if creation-time capture failed before recording it.
          if (child?.pid && !owned.some((entry) => entry.pid === child.pid)) stopProcess(child);
        }
        await stopOwnedProcesses(owned);
        fs.rmSync(PROCESS_FILE, { force: true });
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Qualification setup and owned-process cleanup failed.', { cause: cleanupError });
      }
    } else {
      stopProcess(vite);
      stopProcess(kestrel);
    }
    throw error;
  }
}
