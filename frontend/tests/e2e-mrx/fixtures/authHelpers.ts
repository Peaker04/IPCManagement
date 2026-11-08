import type { BrowserContext, Page } from '@playwright/test';
import fs from 'node:fs';

const apiActors = new WeakMap<BrowserContext, MrxRole>();
const apiRequests = new Map<MrxRole, number[]>();

export function trackApiBudget(page: Page, role: MrxRole): void {
  if (process.env.MRX_E2E_PROFILE !== 'qualification') return;
  const context = page.context();
  const tracked = apiActors.has(context);
  apiActors.set(context, role);
  if (!tracked) context.on('request', (request) => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return;
    const actor = apiActors.get(context)!;
    const now = Date.now();
    apiRequests.set(actor, [...(apiRequests.get(actor) ?? []).filter((at) => at > now - 60_000), now]);
  });
}

// Reserve burst headroom before actions, outside timed windows; production's 100/min limiter remains unchanged.
export async function respectApiBudget(page: Page, headroom = 24): Promise<void> {
  if (process.env.MRX_E2E_PROFILE !== 'qualification') return;
  const actor = apiActors.get(page.context());
  if (!actor) throw new Error('Qualification API pacing requires a tracked actor.');
  if (!Number.isSafeInteger(headroom) || headroom < 1 || headroom > 90) throw new Error('Invalid API action headroom.');
  for (;;) {
    const now = Date.now();
    const recent = (apiRequests.get(actor) ?? []).filter((at) => at > now - 60_000);
    apiRequests.set(actor, recent);
    if (recent.length + headroom <= 90) return;
    const release = recent[recent.length + headroom - 91] + 60_001;
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, release - now)));
  }
}

let loginQueue = Promise.resolve();
export function respectLoginBudget(): Promise<void> {
  if (process.env.MRX_E2E_PROFILE !== 'qualification') return Promise.resolve();
  const file = process.env.MRX_E2E_LOGIN_BUDGET_FILE;
  if (!file) throw new Error('Qualification requires a run-owned login budget file.');
  const slot = loginQueue.then(async () => {
    const previous = fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) : 0;
    if (!Number.isFinite(previous)) throw new Error('Invalid run login budget.');
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, previous + 13_000 - Date.now())));
    fs.writeFileSync(file, String(Date.now()));
  });
  loginQueue = slot.catch(() => {});
  return slot;
}


export type MrxRole = 'admin' | 'dieuphoi' | 'thukho' | 'beptruong' | 'manager';
type RoleCredentials = { username: string; password: string };
const QUALIFICATION_ROLES: MrxRole[] = ['admin', 'dieuphoi', 'thukho', 'beptruong', 'manager'];

export function readQualificationCredentials(env: NodeJS.ProcessEnv = process.env): Record<MrxRole, RoleCredentials> {
  const file = env.MRX_E2E_CREDENTIALS_FILE;
  if (!file || !fs.existsSync(file)) throw new Error('A private MRX qualification credential file is required.');
  try {
    const records = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as Record<string, RoleCredentials>;
    const usernames = new Set<string>();
    for (const role of QUALIFICATION_ROLES) {
      const record = records[role];
      if (!record || typeof record.username !== 'string' || !record.username.trim()
        || typeof record.password !== 'string' || !record.password.trim()) throw new Error();
      usernames.add(record.username.trim().toLowerCase());
    }
    if (usernames.size !== QUALIFICATION_ROLES.length) throw new Error();
    return records;
  } catch {
    throw new Error('Qualification requires five distinct, usable role credentials including Manager; no fallback is allowed.');
  }
}

export const MRX_ROLE_CREDENTIALS: Record<Exclude<MrxRole, 'manager'>, { username: string; password: string; expectedName: string }> = {
  admin: { username: 'admin', password: 'Admin@123456', expectedName: 'Admin User' },
  dieuphoi: { username: 'dieuphoi', password: 'Admin@123456', expectedName: 'Điều Phối Viên' },
  thukho: { username: 'thukho', password: 'Admin@123456', expectedName: 'Thủ Kho' },
  beptruong: { username: 'beptruong', password: 'Admin@123456', expectedName: 'Bếp Trưởng' },
};

/**
 * Logs in a designated MRX role and locks mode to MATERIAL_RECONCILIATION
 */
export async function loginRole(
  page: Page,
  role: MrxRole,
  baseURL: string = process.env.MRX_E2E_BASE_URL ?? 'http://127.0.0.1:5174'
): Promise<void> {
  trackApiBudget(page, role);
  const qualification = process.env.MRX_E2E_PROFILE === 'qualification';
  if (!qualification && role === 'manager') throw new Error('Manager requires explicit qualification credentials.');
  const creds = qualification ? readQualificationCredentials()[role] : MRX_ROLE_CREDENTIALS[role as Exclude<MrxRole, 'manager'>];
  let lastFailure = 'không nhận được phản hồi đăng nhập';

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(`${baseURL}/login`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="text"]', creds.username);
    await page.fill('input[type="password"]', creds.password);

    try {
      await respectLoginBudget();
      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
        { timeout: 15_000 }
      );
      await page.click('button[type="submit"]');
      const response = await responsePromise;
      if (!response.ok()) {
        lastFailure = `HTTP ${response.status()}`;
        if (response.status() === 429) throw new Error('Authentication rate limit reached; qualification stops without a bypass.');
        continue;
      }

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
      const hasToken = await page.evaluate(() => Boolean(localStorage.getItem('ipc_v3_token')));
      if (!hasToken) {
        lastFailure = 'đăng nhập thành công nhưng thiếu ipc_v3_token';
        continue;
      }

      if (!qualification) {
        await page.evaluate(() => {
          localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
          localStorage.setItem('ipc_v3_mode_version', '1');
        });
      }
      return;
    } catch (error) {
      if (lastFailure === 'HTTP 429') throw error;
      lastFailure = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Không thể đăng nhập actor MRX ${role}: ${lastFailure}`);
}
