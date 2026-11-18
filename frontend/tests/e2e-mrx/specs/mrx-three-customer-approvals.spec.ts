import fs from 'node:fs';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';
import { test, expect, type MrxTestFixtures } from '../fixtures/mrxTest';
import { loginRole, type MrxRole } from '../fixtures/authHelpers';
import { scenarioScope } from '../fixtures/mrxWorkflow';
import { runMultiRoleApprovalLifecycle, runAdminApprovalLifecycle } from '../fixtures/mrxApprovalLifecycle';

for (const session of ['Actors', 'Admin'] as const) {
  test(`@MRX-ThreeCustomer-${session} same-week concurrent approval lifecycle`, async ({ browser, viewport, baseURL, adminPage, dbVerifier }) => {
    test.setTimeout(900_000);
    expect(process.env.MRX_E2E_PROFILE).toBe('qualification');
    const scope = scenarioScope(dbVerifier, 2);
    const evidence = process.env.MRX_E2E_ARTIFACT_DIRECTORY!;
    const customers: Array<{ customerId: string; customerCode: string; customerName: string }> = [];
    for (const suffix of ['A', 'B', 'C']) {
      const customerCode = `TC${scope.caseId.replace(/[^a-z0-9]/gi, '')}${suffix}`.toUpperCase();
      const result = await adminPage.evaluate(async body => {
        const response = await fetch('/api/coordination/customers/contract', { method: 'POST', headers: {
          Authorization: `Bearer ${localStorage.getItem('ipc_v3_token')}`, 'X-Operational-Mode': 'MATERIAL_RECONCILIATION',
          'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
      }, { customerCode, customerName: `MRX concurrent ${customerCode}`, isActive: true });
      expect(result.status).toBe(201);
      expect(result.body.data.customerCode).toBe(customerCode);
      customers.push(result.body.data);
    }
    expect(new Set(customers.map(x => x.customerId)).size).toBe(3);
    const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];
    const traces: Array<{ customer: string; role: string; method: string; pathname: string; at: number; status?: number }> = [];
    const barriers: Array<{ name: string; arrivals: number[]; dispatches: number[]; releasedAt?: number }> = [];
    const stocks = dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;');
    try {
      const actors: MrxTestFixtures[] = [];
      for (const customer of customers) {
        const pages = {} as Record<MrxRole, Page>;
        const roles: MrxRole[] = session === 'Admin' ? ['admin'] : ['admin', 'dieuphoi', 'thukho', 'manager', 'beptruong'];
        for (const role of roles) {
          const context = await browser.newContext({ viewport, baseURL }); contexts.push(context);
          const page = await context.newPage(); await loginRole(page, role, baseURL); pages[role] = page;
          page.on('request', request => {
            if (request.method() === 'POST') traces.push({ customer: customer.customerCode, role, method: 'POST',
              pathname: new URL(request.url()).pathname, at: Date.now() });
          });
          page.on('response', response => {
            const request = response.request();
            if (request.method() === 'POST') traces.push({ customer: customer.customerCode, role, method: 'RESPONSE',
              pathname: new URL(response.url()).pathname, at: Date.now(), status: response.status() });
          });
        }
        actors.push({ adminPage: pages.admin, dieuphoiPage: pages.dieuphoi ?? pages.admin,
          thukhoPage: pages.thukho ?? pages.admin, managerPage: pages.manager ?? pages.admin,
          beptruongPage: pages.beptruong ?? pages.admin, dbVerifier });
      }
      async function synchronizeFirst(pages: Page[], pattern: RegExp, name: string) {
        const observation: typeof barriers[number] = { name, arrivals: [], dispatches: [] }; barriers.push(observation);
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        for (const page of pages) {
          let seen = false;
          await page.route(pattern, async (route: Route) => {
            if (route.request().method() !== 'POST' || seen) { await route.continue(); return; }
            seen = true; observation.arrivals.push(Date.now());
            if (observation.arrivals.length === 3) { observation.releasedAt = Date.now(); release(); }
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([gate, new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Three-customer barrier timed out: ${name}`)), 90_000);
              })]);
              observation.dispatches.push(Date.now()); await route.continue();
            } finally { if (timer) clearTimeout(timer); }
          });
        }
      }
      await synchronizeFirst(actors.map(x => x.dieuphoiPage), /\/weekly-menu\/import\/commit$/, 'menu-import');
      await synchronizeFirst(actors.map(x => x.thukhoPage), /\/inventory-issues$/, 'first-day-issue');
      const results = await Promise.allSettled(actors.map(async (actor, index) => {
        const directory = path.join(evidence, `three-${session.toLowerCase()}-${index + 1}`);
        fs.mkdirSync(directory, { recursive: true });
        const customer = customers[index];
        const customerScope = { ...scope, caseId: `${scope.caseId}_${index}`, reason: `${scope.reason} ${customer.customerCode}`,
          customer: { customerId: customer.customerId, label: `${customer.customerCode} - ${customer.customerName}` } };
        return session === 'Admin' ? runAdminApprovalLifecycle(actor, customerScope, directory, index === 0)
          : runMultiRoleApprovalLifecycle(actor, customerScope, directory, index === 0);
      }));
      fs.writeFileSync(path.join(evidence, `three-${session.toLowerCase()}-transport.json`), JSON.stringify({
        session, week: scope.weekStartDate, customers, barriers, traces,
        results: results.map(x => x.status === 'fulfilled' ? x : { status: x.status, reason: String(x.reason) }) }, null, 2));
      const failures = results.filter(x => x.status === 'rejected');
      expect(failures.map(x => String(x.reason))).toEqual([]);
      for (const barrier of barriers) {
        expect(barrier.arrivals).toHaveLength(3); expect(barrier.dispatches).toHaveLength(3);
        expect(barrier.releasedAt).toBeGreaterThanOrEqual(Math.max(...barrier.arrivals));
      }
      const batchIds = results.map(x => x.status === 'fulfilled' ? x.value.batchId : '');
      expect(new Set(batchIds).size).toBe(3);
      for (const customer of customers) {
        const rows = dbVerifier.query<{ status: string; pending: string }>(`SELECT b.Status status,
          (SELECT COUNT(*) FROM reconciliationsupplementaldemands d WHERE d.BatchId=b.BatchId AND d.Status='PENDING') pending
          FROM reconciliationbatches b JOIN menuversions m ON m.MenuVersionId=b.MenuVersionId
          JOIN customers c ON c.customerId=m.customerId WHERE c.customerCode='${customer.customerCode}';`);
        expect(rows).toEqual([{ status: 'COMPLETED', pending: '0' }]);
      }
      if (session === 'Admin') {
        expect(traces.filter(x => x.method === 'POST' && (x.pathname.endsWith('/decision') || x.pathname.endsWith('/mrx-submit')))).toEqual([]);
        expect(new Set(traces.map(x => x.role))).toEqual(new Set(['admin']));
      } else {
        for (const customer of customers) {
          const requests = traces.filter(x => x.customer === customer.customerCode && x.method === 'POST');
          expect(requests.some(x => x.role === 'manager' && x.pathname.endsWith('/decision'))).toBe(true);
          expect(requests.some(x => x.role === 'thukho' && x.pathname === '/api/inventory-issues')).toBe(true);
        }
      }
      expect(dbVerifier.query('CHECKSUM TABLE currentstock,currentstocklots,stockmovements;')).toEqual(stocks);
    } finally { await Promise.all(contexts.map(context => context.close())); }
  });
}
