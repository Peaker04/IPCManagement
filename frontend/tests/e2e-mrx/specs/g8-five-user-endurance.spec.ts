import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import type { Page, BrowserContext } from '@playwright/test';
import { test, expect } from '../fixtures/mrxTest';
import { loginRole, type MrxRole } from '../fixtures/authHelpers';
import { summarizeSamples, installInteractionProbe, collectInteractionSamples } from '../core/qualificationMetrics';

const output = (name: string, value: unknown) => fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, name), JSON.stringify(value, null, 2));
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

test('@G8-Five-User five distinct active browser actors, bounded 2–5s think time, 60-minute endurance', async ({ browser }) => {
  const seconds = Number(process.env.MRX_E2E_SOAK_SECONDS);
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 3600) throw new Error('Explicit bounded soak duration required.');
  test.setTimeout((seconds + 240) * 1000);
  const scope = JSON.parse(fs.readFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'measurement-scope.json'), 'utf8'));
  const routes: Record<MrxRole, string[]> = {
    admin: [`/reconciliation?batchId=${scope.batchId}&date=${scope.serviceDate}`, '/admin-data?view=customers'],
    dieuphoi: [`/weekly-menu?view=mrx-batch&weekStartDate=${scope.serviceDate}`, '/weekly-menu?view=mrx-batch'],
    thukho: [`/warehouse?view=mrx-daily&batchId=${scope.batchId}&date=${scope.serviceDate}`, `/warehouse?view=mrx-preparation&date=${scope.serviceDate}`],
    beptruong: [`/chef?view=mrx-cooking&batchId=${scope.batchId}&date=${scope.serviceDate}`, '/chef?view=mrx-cooking'],
    manager: [`/reconciliation?batchId=${scope.batchId}&date=${scope.serviceDate}`, '/reconciliation?view=completed'],
  };
  const actors: { role: MrxRole; context: BrowserContext; page: Page; identity: { userId: string; roleCode: string; expiresAt: number }; actions: { elapsedMs: number; navigationMs: number; route: string }[]; requests: { status: number; durationMs: number; path: string }[]; errors: string[]; sessions: number }[] = [];
  const resources: unknown[] = [];
  const failures: unknown[] = [];
  const originalTokens = new Map<MrxRole, string>();
  const expiryProof: { role: MrxRole; expiresAt: number; observedAt: number; status: number }[] = [];
  let aborted = false;
  const stop = new AbortController();
  const activities: Promise<unknown>[] = [];
  const browserCdp = await browser.newBrowserCDPSession();
  try {
    for (const role of Object.keys(routes) as MrxRole[]) {
      const context = await browser.newContext({ baseURL: process.env.MRX_E2E_BASE_URL, viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await loginRole(page, role);
      await installInteractionProbe(page);
      const { originalToken, ...identity } = await page.evaluate(async () => {
        const token = localStorage.getItem('ipc_v3_token')!;
        const response = await fetch('/api/Auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Profile read failed: ${response.status}`);
        const profile = (await response.json()).data;
        return { originalToken: token, userId: profile.user.userId, roleCode: profile.user.roleCode, expiresAt: JSON.parse(atob(token.split('.')[1])).exp * 1000 };
      });
      originalTokens.set(role, originalToken);
      const actor = { role, context, page, identity, actions: [] as { elapsedMs: number; navigationMs: number; route: string }[], requests: [] as { status: number; durationMs: number; path: string }[], errors: [] as string[], sessions: 1 };
      page.on('response', (response) => {
        if (response.status() === 429 || response.status() >= 500) { failures.push({ role, status: response.status(), path: new URL(response.url()).pathname }); aborted = true; stop.abort(); }
      });
      page.on('requestfinished', async (request) => {
        const pathname = new URL(request.url()).pathname;
        if (!pathname.startsWith('/api/')) return;
        const response = await request.response();
        const timing = request.timing();
        if (response && actor.requests.length < 20000) actor.requests.push({ status: response.status(), durationMs: timing.responseEnd - timing.requestStart, path: pathname });
      });
      page.on('pageerror', (error) => { actor.errors.push(error.message); aborted = true; stop.abort(); });
      page.on('crash', () => {
        failures.push({ role, event: 'page-crash', observedAtUtc: new Date().toISOString(), actions: actor.actions.length, route: actor.actions.at(-1)?.route });
        output('endurance-crash.json', { role, actions: actor.actions.length, lastAction: actor.actions.at(-1), resources: resources.at(-1), failures });
        aborted = true;
        stop.abort();
      });
      actors.push(actor);
    }
    expect(new Set(actors.map((actor) => actor.identity.userId)).size).toBe(5);
    const start = Date.now();
    const deadline = start + seconds * 1000;
    const sampleResources = async () => {
      const health = await fetch('http://127.0.0.1:5263/health/ready');
      await health.arrayBuffer();
      const freeBytes = os.freemem();
      if (!health.ok || freeBytes < 256 * 1024 * 1024) { aborted = true; throw new Error('Health/headroom safety stop; no automatic load reduction.'); }
      const processFile = process.env.MRX_E2E_PROCESS_FILE!;
      const state = JSON.parse(fs.readFileSync(processFile, 'utf8'));
      const ids = state.processes.map((item: { pid: number }) => item.pid).join(',');
      if (!/^\d+(,\d+)*$/.test(ids)) throw new Error('Invalid owned process sampling identities.');
      const sample = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${ids} -ErrorAction Stop | Select-Object Id,WorkingSet64,PrivateMemorySize64,HandleCount,@{n='ThreadCount';e={$_.Threads.Count}} | ConvertTo-Json -Compress`]).toString();
      const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
      const chromeIds = processInfo.map(item => item.id).filter(id => Number.isSafeInteger(id) && id > 0);
      const chromeSample = chromeIds.length === 0 ? '[]' : execFileSync('powershell.exe', ['-NoProfile', '-Command', `$ids=@(${chromeIds.join(',')}); Get-Process -ErrorAction Stop | Where-Object { $ids -contains $_.Id } | Select-Object Id,WorkingSet64,PrivateMemorySize64,HandleCount,@{n='ThreadCount';e={$_.Threads.Count}} | ConvertTo-Json -Compress`]).toString();
      for (const actor of actors) {
        if (Date.now() >= actor.identity.expiresAt && !expiryProof.some((item) => item.role === actor.role)) {
          const expired = await actor.context.request.get('http://127.0.0.1:5263/api/Auth/me', { headers: { Authorization: `Bearer ${originalTokens.get(actor.role)}` } });
          expiryProof.push({ role: actor.role, expiresAt: actor.identity.expiresAt, observedAt: Date.now(), status: expired.status() });
          output('natural-jwt-expiration.json', expiryProof);
          expect(expired.status()).toBe(401);
          await expired.dispose();
        }
      }
      const activity = actors.map((actor) => ({ role: actor.role, actions: actor.actions.length, lastActionAgeMs: Date.now() - start - (actor.actions.at(-1)?.elapsedMs ?? 0) }));
      console.log(`[ENDURANCE PROGRESS] ${Math.round((Date.now() - start) / 1000)}/${seconds}s health=${health.status} ${JSON.stringify(activity)}`);
      if (activity.some((actor) => actor.lastActionAgeMs > 90_000)) {
        aborted = true;
        throw new Error('Activity watchdog: at least one actor made no progress for90s; stopping, not waiting for the soak deadline.');
      }
      resources.push({ elapsedMs: Date.now() - start, healthStatus: health.status, freeBytes, processes: JSON.parse(sample),
        chromeProcesses: JSON.parse(chromeSample || '[]'), chromeProcessTypes: processInfo.map(item => ({ id: item.id, type: item.type, cpuTime: item.cpuTime })) });
      output('endurance-resources.json', resources);
    };
    const loops = actors.map(async (actor) => {
      let iteration = 0;
      while (Date.now() < deadline && !aborted) {
        const route = routes[actor.role][iteration % routes[actor.role].length];
        const before = Date.now();
        await actor.page.goto(route, { waitUntil: 'networkidle' });
        if (new URL(actor.page.url()).pathname === '/login') {
          // Normal UI reauthentication, not a forged/extended access token.
          actor.sessions++;
          await loginRole(actor.page, actor.role);
          await actor.page.goto(route, { waitUntil: 'networkidle' });
        }
        expect(new URL(actor.page.url()).pathname).not.toBe('/forbidden');
        await expect(actor.page.getByRole('heading', { level: 1 })).toBeVisible();
        actor.actions.push({ elapsedMs: Date.now() - start, navigationMs: Date.now() - before, route });
        if (iteration % 20 === 0) output(`endurance-${actor.role}.json`, { identity: actor.identity, actions: actor.actions, requests: actor.requests, errors: actor.errors, sessions: actor.sessions });
        iteration++;
        await actor.page.waitForTimeout((2 + iteration % 4) * 1000);
      }
    });
    const monitor = (async () => {
      while (Date.now() < deadline && !aborted) {
        await sampleResources();
        await delay(Math.min(60_000, Math.max(0, deadline - Date.now())), undefined, { signal: stop.signal }).catch((error) => { if (error.name !== 'AbortError') throw error; });
      }
    })();
    activities.push(...loops, monitor);
    await Promise.all(activities);
    await sampleResources();
    const summaries = [];
    for (const actor of actors) {
      const data = { identity: actor.identity, actions: actor.actions, requests: actor.requests, errors: actor.errors, sessions: actor.sessions, browser: await collectInteractionSamples(actor.page) };
      output(`endurance-${actor.role}.json`, data);
      const summary = { role: actor.role, userId: actor.identity.userId, actions: actor.actions.length, firstActionMs: actor.actions[0]?.elapsedMs, lastActionMs: actor.actions.at(-1)?.elapsedMs, navigation: summarizeSamples(actor.actions.map((item) => item.navigationMs)), api: summarizeSamples(actor.requests.filter((item) => item.status < 400 && item.durationMs > 0).map((item) => item.durationMs)), errors: actor.errors };
      summaries.push(summary);
      expect(actor.actions.length).toBeGreaterThanOrEqual(20);
      expect(actor.errors).toEqual([]);
    }
    output('endurance-summary.json', { seconds, elapsedMs: Date.now() - start, verdict: seconds === 3600 && !aborted ? 'READ_WORKLOAD_COMPLETED' : 'DIAGNOSTIC_ONLY', summaries, failures, expiryProof, limitation: 'Active role-allowed browser navigation/read workload, not continuous terminal writes/source-edit throughput or full-shift certification. Cold/warm/action classes retained separately in raw routes; unsupported Web Vitals are unavailable.' });
    expect(aborted).toBe(false);
    expect(failures).toEqual([]);
  } finally {
    aborted = true;
    stop.abort();
    await Promise.allSettled(activities);
    await browserCdp.detach().catch(() => {});
    await Promise.allSettled(actors.map((actor) => actor.context.close()));
  }
});

test('@G8-HTTP separate maximum-five-VU ten-minute authenticated MRX read diagnostic', async () => {
  test.setTimeout(900_000);
  await new Promise<void>((resolve, reject) => {
    const child = spawn('k6', ['run', '--quiet', 'tools/perf/k6/mrx-five-user.js'], { env: process.env, stdio: ['ignore','pipe','pipe'] });
    const log = fs.createWriteStream(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'k6.log'));
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      log.end();
      if (code === 0) resolve();
      else reject(new Error(`Bounded HTTP probe failed with code ${code}; inspect private run k6.log.`));
    });
  });
});
