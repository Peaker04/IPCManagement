import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {
  ALLOWED_SANDBOX_PORT,
  assertSafeMrxE2eDatabase,
  resolveMrxE2eDatabase,
} from './dbGuardrail';
import { MySQLVerifier } from './mysqlVerifier';
import { stopOwnedProcesses, type OwnedProcess } from './ownedProcesses';

const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';
const PROCESS_FILE = process.env.MRX_E2E_PROCESS_FILE
  ?? path.resolve('.artifacts/mrx-e2e/processes.json');

export default async function globalTeardown(): Promise<void> {
  const database = resolveMrxE2eDatabase(process.env);
  assertSafeMrxE2eDatabase(database.database, ALLOWED_SANDBOX_PORT, process.env);
  const defaultsFile = process.env.IPC_MRX_MYSQL_DEFAULTS_FILE ?? '';
  const errors: unknown[] = [];

  try {
    if (process.env.MRX_E2E_PROFILE !== 'qualification') {
      if (!defaultsFile || !fs.existsSync(defaultsFile)) {
        throw new Error('[FATAL CONFIGURATION ERROR] IPC_MRX_MYSQL_DEFAULTS_FILE must name an existing run-owned file.');
      }
      const verifier = new MySQLVerifier(database.database, ALLOWED_SANDBOX_PORT, MYSQL_BIN, defaultsFile);
      const residual = verifier.assertZeroResidualTestData('TC_');
      if (!residual.passed) throw new Error(`MRX E2E left ${residual.residualCount} residual test customers.`);
    }
  } catch (error) { errors.push(error); }

  try {
    if (fs.existsSync(PROCESS_FILE)) {
      const state = JSON.parse(fs.readFileSync(PROCESS_FILE, 'utf8')) as {
        runId: string;
        database: string;
        pids: number[];
        processes?: OwnedProcess[];
      };
      if (state.database !== database.database || state.runId !== (database.runId ?? 'legacy')) {
        throw new Error('[FATAL CONFIGURATION ERROR] Process ownership record does not match this MRX E2E run.');
      }
      if (process.env.MRX_E2E_PROFILE === 'qualification') {
        if (!Array.isArray(state.processes) || !Array.isArray(state.pids)
          || state.processes.length !== state.pids.length
          || state.processes.some((owned) => !state.pids.includes(owned.pid))) {
          throw new Error('Missing qualification process creation identities.');
        }
        await stopOwnedProcesses(state.processes);
      } else {
        const stopErrors: unknown[] = [];
        for (const pid of state.pids) {
          try { process.kill(pid); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') stopErrors.push(error);
          }
        }
        if (stopErrors.length) throw new AggregateError(stopErrors, 'Could not release every owned MRX process.');
      }
      fs.rmSync(PROCESS_FILE);
    }
  } catch (error) { errors.push(error); }

  if (!database.prepared) {
    try {
      if (!defaultsFile || !fs.existsSync(defaultsFile)) throw new Error('Missing MySQL defaults for legacy cleanup.');
      execFileSync(MYSQL_BIN, [
        `--defaults-extra-file=${defaultsFile}`,
        '--execute',
        `DROP DATABASE \`${database.database}\`;`,
      ], { stdio: 'pipe' });
    } catch (error) { errors.push(error); }
  }

  if (errors.length) throw new AggregateError(errors, 'MRX cleanup failed; independent cleanup attempts completed.');
}
