import { execSync } from 'node:child_process';
import { assertSafeSandboxDatabase, ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT } from './dbGuardrail';
import { MySQLVerifier } from './mysqlVerifier';

const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe';

export default async function globalTeardown(): Promise<void> {
  console.log('\n[E2E-MRX-TEARDOWN] Initiating Environment Teardown...');

  assertSafeSandboxDatabase(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT);

  // 1. Teardown Residual Assertion
  try {
    const verifier = new MySQLVerifier(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT);
    const residualResult = verifier.assertZeroResidualTestData('TC_');
    console.log(`[E2E-MRX-TEARDOWN] Sandbox residual test customers: ${residualResult.residualCount}`);
  } catch (err) {
    console.warn('[E2E-MRX-TEARDOWN] Residual check warning:', err);
  }

  // 2. Terminate background processes
  try {
    execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174, 5263 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
    console.log('[E2E-MRX-TEARDOWN] Ports 5174 and 5263 processes terminated.');
  } catch {}

  // 3. Drop sandbox database
  try {
    execSync(`"${MYSQL_BIN}" -u root -p123456789 -e "DROP DATABASE IF EXISTS ${ALLOWED_SANDBOX_DB};"`, { stdio: 'pipe' });
    console.log(`[E2E-MRX-TEARDOWN] Sandbox DB '${ALLOWED_SANDBOX_DB}' dropped cleanly.`);
  } catch (err) {
    console.error('[E2E-MRX-TEARDOWN] Error dropping sandbox database:', err);
  }

  console.log('[E2E-MRX-TEARDOWN] Teardown Complete.\n');
}
