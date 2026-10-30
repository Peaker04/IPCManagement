import { describe, it, expect } from 'vitest';
import {
  assertSafeSandboxDatabase,
  FORBIDDEN_PROD_DB,
  FORBIDDEN_PROD_PORT,
  ALLOWED_SANDBOX_DB,
  ALLOWED_SANDBOX_PORT,
} from '../dbGuardrail';

describe('Hard DB & Port Security Guardrail', () => {
  it('throws FATAL SECURITY VIOLATION if targeting production database name', () => {
    expect(() => assertSafeSandboxDatabase(FORBIDDEN_PROD_DB)).toThrow(
      /FATAL SECURITY VIOLATION.*production database "ipcmanagement"/i
    );
  });

  it('throws FATAL SECURITY VIOLATION if targeting production port 5262', () => {
    expect(() => assertSafeSandboxDatabase(ALLOWED_SANDBOX_DB, FORBIDDEN_PROD_PORT)).toThrow(
      /FATAL SECURITY VIOLATION.*production API port 5262/i
    );
  });

  it('throws CONFIGURATION ERROR if database name is not the designated sandbox', () => {
    expect(() => assertSafeSandboxDatabase('some_other_db')).toThrow(
      /FATAL CONFIGURATION ERROR.*sandbox database "ipc_mrx_e2e_sandbox"/i
    );
  });

  it('passes cleanly when targeting designated sandbox database and port 5263', () => {
    expect(() =>
      assertSafeSandboxDatabase(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT)
    ).not.toThrow();
  });
});
