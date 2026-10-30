/**
 * Hard Database & Port Security Guardrail (Rule DOM-MODE-1 & Safety Invariant)
 * Strictly enforces that automated E2E mutation tests ONLY execute against the isolated sandbox database
 * 'ipc_mrx_e2e_sandbox' on port 5263.
 *
 * FATAL ERROR INTERCEPTOR: Immediately aborts process if any target points to production 'ipcmanagement' or port 5262.
 */

export const ALLOWED_SANDBOX_DB = 'ipc_mrx_e2e_sandbox';
export const ALLOWED_SANDBOX_PORT = 5263;
export const FORBIDDEN_PROD_DB = 'ipcmanagement';
export const FORBIDDEN_PROD_PORT = 5262;

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

  // 3. Confirm target is the designated sandbox database
  if (!normalizedDb.includes(ALLOWED_SANDBOX_DB)) {
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
