import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test, expect, type Page, type Response } from '@playwright/test';
import { respectApiBudget } from './authHelpers';
import type { MrxScenarioScope } from './mrxWorkflow';

// Test-only recorder: no business outcomes are inferred from a screenshot or from a successful click.
export async function evidenceStep(
  page: Page,
  scope: MrxScenarioScope,
  name: string,
  role: 'COORDINATOR' | 'ADMIN' | 'WAREHOUSESTAFF' | 'CHEF' | 'MANAGER',
  action: () => Promise<Response | void>,
  target: { batchId?: string; serviceDate?: string } = {},
): Promise<Response | undefined> {
  const info = test.info();
  expect(name).toMatch(/^[a-z0-9-]+$/);
  expect(process.env.MRX_EVIDENCE_RUN_ID).toBe(scope.runId);
  for (const key of ['MRX_E2E_API_SHA256', 'MRX_E2E_FE_SHA256']) expect(process.env[key]).toMatch(/^[a-f0-9]{64}$/i);
  expect(process.env.MRX_E2E_PROFILE).toBe('qualification');
  expect(process.env.MRX_E2E_PHASE).toBe('functional');
  const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const observedRequests: Response[] = [];
  const summarizeResponse = async (response: Response) => {
    const request = response.request();
    const rawBody = request.postDataBuffer() ?? Buffer.alloc(0);
    const body = request.headers()['content-type']?.includes('application/json') && rawBody.length
      ? JSON.parse(rawBody.toString('utf8')) as Record<string, unknown> : {};
    return {
      method: request.method(), endpoint: new URL(response.url()).pathname, status: response.status(),
      requestBodySha256: digest(rawBody), responseBodySha256: digest(await response.body()),
      requestScope: Object.fromEntries(['reconciliationBatchId', 'issueDate', 'expectedVersion', 'commandId'].filter((key) => key in body).map((key) => [key, body[key]])),
    };
  };
  const capture = async (phase: 'before' | 'after' | 'failed', response?: Response) => {
    const startedAtUtc = new Date().toISOString();
    const identity = await page.evaluate(async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION' };
      const me = await fetch('/api/Auth/me', { headers });
      const mode = await fetch('/api/system-operation-mode', { headers });
      if (!me.ok || !mode.ok) throw new Error('Step evidence cannot establish server actor/mode.');
      const profile = (await me.json()).data;
      const operation = (await mode.json()).data;
      return { userId: profile.user.userId, role: profile.user.roleCode, mode: operation.mode, modeVersion: operation.version,
        localMode: localStorage.getItem('ipc_v3_mode'), localVersion: localStorage.getItem('ipc_v3_mode_version') };
    });
    const url = new URL(page.url());
    const prefix = info.outputPath('steps', `${scope.caseId}-${name}-${phase}`);
    fs.mkdirSync(path.dirname(prefix), { recursive: true });
    const png = await page.screenshot();
    const aria = await page.locator('body').ariaSnapshot();
    const responses = [...new Set([...observedRequests, ...(response ? [response] : [])])];
    const metadata = {
      runId: scope.runId, attemptId: scope.attemptId, caseId: scope.caseId, test: info.titlePath,
      step: name, phase, startedAtUtc, capturedAtUtc: new Date().toISOString(),
      build: { apiSha256: process.env.MRX_E2E_API_SHA256, frontendIndexSha256: process.env.MRX_E2E_FE_SHA256 },
      sourceWorkbook: { file: path.basename(scope.workbook), sha256: digest(fs.readFileSync(scope.workbook)) },
      expected: { role, weekStartDate: scope.weekStartDate, ...target }, observed: identity,
      url: url.pathname + url.search, viewport: page.viewportSize(),
      observedScope: { batchId: url.searchParams.get('batchId'), serviceDate: url.searchParams.get('date'), weekStartDate: url.searchParams.get('weekStartDate') },
      screenshot: { file: path.basename(prefix) + '.png', sha256: digest(png) },
      aria: { file: path.basename(prefix) + '.aria.yml', sha256: digest(aria) },
      requests: await Promise.all(responses.map(summarizeResponse)),
    };
    fs.writeFileSync(prefix + '.png', png, { flag: 'wx' });
    fs.writeFileSync(prefix + '.aria.yml', aria, { flag: 'wx' });
    fs.writeFileSync(prefix + '.json', JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
    await info.attach(`${name}-${phase}`, { path: prefix + '.json', contentType: 'application/json' });
    await info.attach(`${name}-${phase}-screen`, { path: prefix + '.png', contentType: 'image/png' });
    await info.attach(`${name}-${phase}-aria`, { path: prefix + '.aria.yml', contentType: 'text/yaml' });
    expect(identity.userId).toBeTruthy();
    expect(identity.role).toBe(role);
    expect(identity.mode).toBe('MATERIAL_RECONCILIATION');
    expect(identity.localMode).toBe(identity.mode);
    expect(identity.localVersion).toBe(String(identity.modeVersion));
    expect(page.url()).toBe(url.href);
    if (phase === 'after' && target.batchId && ['/warehouse', '/chef', '/reconciliation'].includes(url.pathname)) expect(url.searchParams.get('batchId')).toBe(target.batchId);
    if (phase === 'after' && target.serviceDate && url.pathname === '/warehouse') expect(url.searchParams.get('date')).toBe(target.serviceDate);
    if (url.pathname === '/weekly-menu') expect(url.searchParams.get('weekStartDate')).toBe(scope.weekStartDate);
    for (const request of metadata.requests) {
      if (request.requestScope.reconciliationBatchId) expect(request.requestScope.reconciliationBatchId).toBe(target.batchId);
      if (request.requestScope.issueDate) expect(request.requestScope.issueDate).toBe(target.serviceDate);
    }
    if (response) expect(response.ok()).toBe(true);
    return metadata;
  };
  return test.step(name, async () => {
    await respectApiBudget(page);
    const before = await capture('before');
    let response: Response | undefined;
    const observe = (item: Response) => {
      if (new URL(item.url()).pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(item.request().method())) observedRequests.push(item);
    };
    page.on('response', observe);
    try {
      response = (await action()) || undefined;
      const after = await capture('after', response);
      expect(after.observed.userId).toBe(before.observed.userId);
      expect(after.observed.modeVersion).toBe(before.observed.modeVersion);
      return response;
    } catch (error) {
      try { await capture('failed', response); }
      catch (captureError) { throw new AggregateError([error, captureError], 'Action failed and its failure checkpoint could not be completed.', { cause: captureError }); }
      throw error;
    } finally {
      page.off('response', observe);
    }
  });
}
