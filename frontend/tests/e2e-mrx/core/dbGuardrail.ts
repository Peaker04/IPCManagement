import { execFileSync } from 'node:child_process';

/**
 * Mutation guard: legacy G1 uses its fixed sandbox; qualification requires an
 * exact prepared run-owned clone and never falls back to legacy setup.
 * These ports identify API instances, not the MySQL listener.
 */

export const ALLOWED_SANDBOX_DB = 'ipc_mrx_e2e_sandbox';
export const ALLOWED_SANDBOX_PORT = 5263;
export const FORBIDDEN_PROD_DB = 'ipcmanagement';
export const FORBIDDEN_PROD_PORT = 5262;

const EVIDENCE_RUN_ID = /^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$/;

export type MrxE2eDatabase = {
  database: string;
  prepared: boolean;
  runId?: string;
};

export function resolveMrxE2eDatabase(env: NodeJS.ProcessEnv): MrxE2eDatabase {
  if (env.MRX_E2E_PROFILE && env.MRX_E2E_PROFILE !== 'qualification') {
    throw new Error('[FATAL CONFIGURATION ERROR] Unknown MRX E2E profile.');
  }
  if (env.MRX_E2E_PROFILE === 'qualification') {
    if (env.MRX_E2E_PREPARED_DATABASE !== '1') {
      throw new Error('[FATAL CONFIGURATION ERROR] Qualification requires a prepared run-owned database.');
    }
    if (!['functional', 'adversarial', 'data-path-performance', 'desktop', 'memory', 'endurance-smoke', 'endurance', 'http-host'].includes(env.MRX_E2E_PHASE ?? '')) {
      throw new Error('[FATAL CONFIGURATION ERROR] Invalid or missing qualification phase.');
    }
  }
  if (env.MRX_E2E_PREPARED_DATABASE !== '1') {
    return { database: ALLOWED_SANDBOX_DB, prepared: false };
  }

  const database = env.MRX_E2E_DATABASE?.trim() ?? '';
  const runId = env.MRX_EVIDENCE_RUN_ID?.trim() ?? '';
  if (!EVIDENCE_RUN_ID.test(runId) || database !== `ipc_mrx_evidence_${runId}`) {
    throw new Error(
      '[FATAL CONFIGURATION ERROR] Prepared MRX E2E database must be owned by the current evidence run.'
    );
  }

  if (env.MRX_E2E_CAMPAIGN_ID !== undefined && (env.MRX_E2E_CAMPAIGN_ID !== runId
    || !EVIDENCE_RUN_ID.test(env.MRX_EVIDENCE_ATTEMPT_ID ?? '') || env.MRX_E2E_PROFILE !== 'qualification')) {
    throw new Error('[FATAL CONFIGURATION ERROR] Campaign requires matching resource identity and a valid separate attempt.');
  }
  return { database, prepared: true, runId };
}

export function assertTargetConnectionDatabase(connection: string, expectedDatabase: string): void {
  if (expectedDatabase !== ALLOWED_SANDBOX_DB
    && !/^ipc_mrx_evidence_[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$/.test(expectedDatabase)) {
    throw new Error('[FATAL CONFIGURATION ERROR] Invalid expected connection database.');
  }
  // Use the platform parser; splitting on semicolons misreads quoted passwords.
  const script = `$ErrorActionPreference='Stop'; try {
    $b=[System.Data.Common.DbConnectionStringBuilder]::new(); $b.set_ConnectionString([Console]::In.ReadToEnd());
    $keys=@('Database','Initial Catalog' | Where-Object { $b.ContainsKey($_) });
    if ($keys.Count -ne 1 -or -not [string]::Equals([string]$b[$keys[0]], '${expectedDatabase}', [StringComparison]::Ordinal)) { exit 2 }
  } catch { exit 2 }`;
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      input: connection, stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('[FATAL CONFIGURATION ERROR] API connection database does not match the run-owned target.');
  }
}

export function assertSafeMrxE2eDatabase(
  targetDb: string,
  targetPort: number,
  env: NodeJS.ProcessEnv
): MrxE2eDatabase {
  const resolved = resolveMrxE2eDatabase(env);
  if (targetDb !== resolved.database) {
    throw new Error('[FATAL CONFIGURATION ERROR] MRX E2E database does not match the resolved run target.');
  }
  if (targetPort !== ALLOWED_SANDBOX_PORT) {
    throw new Error(`[FATAL CONFIGURATION ERROR] Test must target sandbox port ${ALLOWED_SANDBOX_PORT}.`);
  }
  return resolved;
}

export function assertSafeSandboxDatabase(targetDb: string, targetPort?: number): void {
  const normalizedDb = targetDb.toLowerCase().trim();

  // 1. Check for forbidden production database
  if (normalizedDb === FORBIDDEN_PROD_DB || normalizedDb.includes(`database=${FORBIDDEN_PROD_DB}`)) {
    throw new Error(
      `[FATAL SECURITY VIOLATION] Attempted to run automated mutation tests against production database "${FORBIDDEN_PROD_DB}"! Aborting immediately.`
    );
  }

  // 2. Check for forbidden production port
  if (targetPort === FORBIDDEN_PROD_PORT) {
    throw new Error(
      `[FATAL SECURITY VIOLATION] Attempted to connect to production API port ${FORBIDDEN_PROD_PORT}! Aborting immediately.`
    );
  }

  // 3. Confirm target is the exact designated sandbox database
  if (normalizedDb !== ALLOWED_SANDBOX_DB) {
    throw new Error(
      `[FATAL CONFIGURATION ERROR] Test must target sandbox database "${ALLOWED_SANDBOX_DB}". Received: "${targetDb}".`
    );
  }

  // 4. Confirm target port is designated sandbox port
  if (targetPort && targetPort !== ALLOWED_SANDBOX_PORT) {
    throw new Error(
      `[FATAL CONFIGURATION ERROR] Test must target sandbox port ${ALLOWED_SANDBOX_PORT}. Received: ${targetPort}.`
    );
  }
}
