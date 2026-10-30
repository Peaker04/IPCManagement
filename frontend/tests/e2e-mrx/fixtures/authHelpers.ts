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
  await page.goto(`${baseURL}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.fill('input[type="text"]', creds.username);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');

  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_mode_version', '1');
  });
}
