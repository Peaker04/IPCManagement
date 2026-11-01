import type { Page } from '@playwright/test';

export type MrxRole = 'admin' | 'dieuphoi' | 'thukho' | 'beptruong';

export const MRX_ROLE_CREDENTIALS: Record<MrxRole, { username: string; password: string; expectedName: string }> = {
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
  baseURL: string = 'http://127.0.0.1:5174'
): Promise<void> {
  const creds = MRX_ROLE_CREDENTIALS[role];
  let lastFailure = 'không nhận được phản hồi đăng nhập';

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto(`${baseURL}/login`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[type="text"]', creds.username);
    await page.fill('input[type="password"]', creds.password);

    try {
      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
        { timeout: 15_000 }
      );
      await page.click('button[type="submit"]');
      const response = await responsePromise;
      if (!response.ok()) {
        lastFailure = `HTTP ${response.status()}: ${await response.text()}`;
        continue;
      }

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
      const hasToken = await page.evaluate(() => Boolean(localStorage.getItem('ipc_v3_token')));
      if (!hasToken) {
        lastFailure = 'đăng nhập thành công nhưng thiếu ipc_v3_token';
        continue;
      }

      await page.evaluate(() => {
        localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
        localStorage.setItem('ipc_v3_mode_version', '1');
      });
      return;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`Không thể đăng nhập actor MRX ${role}: ${lastFailure}`);
}
