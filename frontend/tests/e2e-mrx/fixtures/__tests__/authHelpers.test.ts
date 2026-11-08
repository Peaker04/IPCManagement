import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { BrowserContext, Page, Request, Response } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directories: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

it('paces action headroom against all browser requests for the same actor without delaying another actor', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100_000); vi.resetModules();
  vi.stubEnv('MRX_E2E_PROFILE', 'qualification');
  const { trackApiBudget, respectApiBudget } = await import('../authHelpers');
  const first = new EventEmitter(), second = new EventEmitter(), chef = new EventEmitter();
  const page = (context: EventEmitter) => ({ context: () => context as unknown as BrowserContext }) as Page;
  trackApiBudget(page(first), 'admin'); trackApiBudget(page(second), 'admin'); trackApiBudget(page(chef), 'beptruong');
  const request = { url: () => 'http://127.0.0.1:5174/api/system-operation-mode' } as Request;
  for (let index = 0; index < 40; index++) { first.emit('request', request); second.emit('request', request); }
  let admitted = false;
  const pending = respectApiBudget(page(first)).then(() => { admitted = true; });
  await respectApiBudget(page(chef));
  await vi.advanceTimersByTimeAsync(59_999);
  expect(admitted).toBe(false);
  await vi.advanceTimersByTimeAsync(2);
  await pending;
  expect(admitted).toBe(true);
});

it('five queued role logins capture their own immediate submit response without timing out in the queue', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-14T08:00:00Z'));
  vi.resetModules();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ipc-login-queue-contract-'));
  directories.push(directory);
  const credentials = path.join(directory, 'roles.json');
  const budget = path.join(directory, 'login-budget');
  const roles = ['admin', 'dieuphoi', 'thukho', 'beptruong', 'manager'] as const;
  fs.writeFileSync(credentials, JSON.stringify(Object.fromEntries(roles.map(role => [role, {
    username: `fixture-${role}`, password: 'fixture-only-not-a-real-account',
  }]))));
  fs.writeFileSync(budget, String(Date.now()));
  vi.stubEnv('MRX_E2E_PROFILE', 'qualification');
  vi.stubEnv('MRX_E2E_CREDENTIALS_FILE', credentials);
  vi.stubEnv('MRX_E2E_LOGIN_BUDGET_FILE', budget);
  const { loginRole } = await import('../authHelpers');
  const submissions: { username: string; at: number }[] = [];
  const pages = roles.map(() => {
    let username = '';
    let onResponse: ((response: Response) => void) | undefined;
    const context = new EventEmitter();
    return {
      context: () => context,
      goto: async () => {},
      evaluate: async () => true,
      reload: async () => {},
      fill: async (selector: string, value: string) => { if (selector === 'input[type="text"]') username = value; },
      waitForResponse: (matches: (response: Response) => boolean, options: { timeout: number }) => {
        const promise = new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Response timeout while login is still queued')), options.timeout);
          onResponse = response => {
            if (matches(response)) { clearTimeout(timer); resolve(response); }
          };
        });
        // The transport owns rejection observation even while the consumer is awaiting its queue slot.
        void promise.catch(() => {});
        return promise;
      },
      click: async () => {
        submissions.push({ username, at: Date.now() });
        onResponse?.({
          url: () => 'http://127.0.0.1:5263/api/auth/login',
          request: () => ({ method: () => 'POST' }),
          ok: () => true,
          status: () => 200,
        } as Response);
      },
      waitForURL: async () => {},
    } as unknown as Page;
  });

  const completed = Promise.allSettled(roles.map((role, index) => loginRole(pages[index], role)));
  await vi.runAllTimersAsync();
  const outcomes = await completed;
  expect(outcomes.map(result => result.status)).toEqual(roles.map(() => 'fulfilled'));
  expect(submissions.map(item => item.username)).toEqual(roles.map(role => `fixture-${role}`));
  expect(submissions[0].at).toBe(new Date('2026-09-14T08:00:13Z').getTime());
  for (let index = 1; index < submissions.length; index++) {
    expect(submissions[index].at - submissions[index - 1].at).toBeGreaterThanOrEqual(13_000);
  }
});
