import { describe, it, expect } from 'vitest';
import {
  assertSafeSandboxDatabase,
  resolveMrxE2eDatabase,
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

  it('resolves legacy mode only to the fixed sandbox', () => {
    expect(resolveMrxE2eDatabase({})).toEqual({
      database: ALLOWED_SANDBOX_DB,
      prepared: false,
    });
    expect(() => assertSafeSandboxDatabase(`prefix_${ALLOWED_SANDBOX_DB}`)).toThrow(
      /FATAL CONFIGURATION ERROR/i
    );
  });

  it.each([[undefined, 'functional'], ['qualification', 'functional'], ['qualification', 'endurance-smoke'], ['qualification', 'adversarial'], ['qualification', 'data-path-performance']])('accepts an exact prepared database under profile %s phase %s', (profile, phase) => {
    const runId = '20261101t120000z_a1b2c3';

    expect(resolveMrxE2eDatabase({
      MRX_E2E_PROFILE: profile,
      MRX_E2E_PHASE: phase,
      MRX_E2E_PREPARED_DATABASE: '1',
      MRX_E2E_DATABASE: `ipc_mrx_evidence_${runId}`,
      MRX_EVIDENCE_RUN_ID: runId,
    })).toEqual({
      database: `ipc_mrx_evidence_${runId}`,
      prepared: true,
      runId,
    });
  });

  it('requires a separate valid attempt for a campaign without changing its exact database guard', () => {
    const runId = '20261101t120000z_a1b2c3';
    const env = { MRX_E2E_PROFILE: 'qualification', MRX_E2E_PHASE: 'functional', MRX_E2E_PREPARED_DATABASE: '1',
      MRX_E2E_DATABASE: `ipc_mrx_evidence_${runId}`, MRX_EVIDENCE_RUN_ID: runId, MRX_E2E_CAMPAIGN_ID: runId };
    expect(() => resolveMrxE2eDatabase(env)).toThrow(/campaign.*attempt/i);
    expect(resolveMrxE2eDatabase({ ...env, MRX_EVIDENCE_ATTEMPT_ID: '20261103t120001z_aaaaaa' }).database)
      .toBe(`ipc_mrx_evidence_${runId}`);
    expect(() => resolveMrxE2eDatabase({ ...env, MRX_E2E_CAMPAIGN_ID: '20261103t120001z_aaaaaa', MRX_EVIDENCE_ATTEMPT_ID: '20261103t120001z_aaaaaa' }))
      .toThrow(/campaign.*attempt/i);
  });

  it('rejects qualification before falling back to a legacy sandbox', () => {
    expect(() => resolveMrxE2eDatabase({
      MRX_E2E_PROFILE: 'qualification',
      MRX_E2E_PHASE: 'functional',
    })).toThrow(/qualification requires.*prepared/i);
  });

  it.each(['qualificaton', 'QUALIFICATION'])('rejects unknown profile %s rather than using legacy mode', (profile) => {
    expect(() => resolveMrxE2eDatabase({ MRX_E2E_PROFILE: profile }))
      .toThrow(/unknown.*profile/i);
  });

  it.each([undefined, 'stress'])('rejects qualification phase %s before running any scenario', (phase) => {
    const runId = '20261101t120000z_a1b2c3';
    expect(() => resolveMrxE2eDatabase({
      MRX_E2E_PROFILE: 'qualification',
      MRX_E2E_PREPARED_DATABASE: '1',
      MRX_E2E_DATABASE: `ipc_mrx_evidence_${runId}`,
      MRX_EVIDENCE_RUN_ID: runId,
      MRX_E2E_PHASE: phase,
    })).toThrow(/qualification phase/i);
  });

  it.each([
    ['ipcmanagement', '20261101t120000z_a1b2c3'],
    ['ipc_lane9', '20261101t120000z_a1b2c3'],
    ['ipc_e2e_template', '20261101t120000z_a1b2c3'],
    [ALLOWED_SANDBOX_DB, '20261101t120000z_a1b2c3'],
    ['ipc_mrx_evidence_20261101t120000z_other1', '20261101t120000z_a1b2c3'],
    ['ipc_mrx_evidence_20261101t120000z_a1b2c3_extra', '20261101t120000z_a1b2c3'],
  ])('rejects prepared database %s for run %s', (database, runId) => {
    expect(() => resolveMrxE2eDatabase({
      MRX_E2E_PREPARED_DATABASE: '1',
      MRX_E2E_DATABASE: database,
      MRX_EVIDENCE_RUN_ID: runId,
    })).toThrow(/FATAL CONFIGURATION ERROR/i);
  });
});
