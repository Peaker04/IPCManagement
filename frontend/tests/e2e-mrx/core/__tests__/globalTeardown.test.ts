import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const children: ChildProcess[] = [];
const directories: string[] = [];
const originalEnv = { ...process.env };

afterEach(() => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null) child.kill();
  }
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  process.env = { ...originalEnv };
  vi.resetModules();
});

it('releases owned processes even when database cleanup prerequisites are missing', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  children.push(child);
  await once(child, 'spawn');
  const exited = once(child, 'exit');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-teardown-'));
  directories.push(directory);
  const runId = '20261101t120000z_a1b2c3';
  const database = `ipc_mrx_evidence_${runId}`;
  const processFile = path.join(directory, 'processes.json');
  fs.writeFileSync(processFile, JSON.stringify({ runId, database, pids: [child.pid] }));
  Object.assign(process.env, {
    MRX_E2E_PREPARED_DATABASE: '1', MRX_E2E_DATABASE: database,
    MRX_EVIDENCE_RUN_ID: runId, MRX_E2E_PROCESS_FILE: processFile,
    IPC_MRX_MYSQL_DEFAULTS_FILE: path.join(directory, 'missing.cnf'),
  });

  const { default: globalTeardown } = await import('../globalTeardown');
  await expect(globalTeardown()).rejects.toThrow(/defaults|cleanup/i);
  expect(fs.existsSync(processFile)).toBe(false);
  await exited;
}, 15_000);

it('refuses a reused PID but still stops another process owned by the same qualification run', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const other = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  children.push(child, other);
  await Promise.all([once(child, 'spawn'), once(other, 'spawn')]);
  const otherExited = once(other, 'exit');
  const ticks = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `[Diagnostics.Process]::GetProcessById(${other.pid}).StartTime.ToUniversalTime().Ticks`,
  ]).toString().trim();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-teardown-'));
  directories.push(directory);
  const runId = '20261101t120000z_a1b2c3';
  const database = `ipc_mrx_evidence_${runId}`;
  const processFile = path.join(directory, 'processes.json');
  fs.writeFileSync(processFile, JSON.stringify({
    runId, database, pids: [child.pid, other.pid],
    processes: [
      { pid: child.pid, startTimeUtcTicks: '1' },
      { pid: other.pid, startTimeUtcTicks: ticks },
    ],
  }));
  Object.assign(process.env, {
    MRX_E2E_PROFILE: 'qualification', MRX_E2E_PHASE: 'functional',
    MRX_E2E_PREPARED_DATABASE: '1', MRX_E2E_DATABASE: database,
    MRX_EVIDENCE_RUN_ID: runId, MRX_E2E_PROCESS_FILE: processFile,
  });

  const { default: globalTeardown } = await import('../globalTeardown');
  await expect(globalTeardown()).rejects.toThrow(/cleanup/i);
  expect(() => process.kill(child.pid!, 0)).not.toThrow();
  await otherExited;
  expect(fs.existsSync(processFile)).toBe(true);
}, 20_000);
