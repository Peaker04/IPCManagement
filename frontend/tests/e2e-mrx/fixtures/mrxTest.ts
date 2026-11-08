import { test as base, type Page, type TestFixture } from '@playwright/test';
import { loginRole, type MrxRole } from './authHelpers';
import { MySQLVerifier } from '../core/mysqlVerifier';
import { ALLOWED_SANDBOX_PORT, resolveMrxE2eDatabase } from '../core/dbGuardrail';

export interface MrxTestFixtures {
  adminPage: Page;
  dieuphoiPage: Page;
  thukhoPage: Page;
  beptruongPage: Page;
  managerPage: Page;
  dbVerifier: MySQLVerifier;
}

function rolePage(role: MrxRole): TestFixture<Page, { browser: import('@playwright/test').Browser; viewport: { width: number; height: number } | null; baseURL: string | undefined }> {
  return async ({ browser, viewport, baseURL }, fixtureUse) => {
    const context = await browser.newContext({ viewport, baseURL });
    try {
      const page = await context.newPage();
      await loginRole(page, role, baseURL);
      await fixtureUse(page);
    } finally {
      // Playwright's configured recorder also owns custom contexts and failure traces.
      await context.close();
    }
  };
}

export const test = base.extend<MrxTestFixtures>({
  adminPage: rolePage('admin'),
  dieuphoiPage: rolePage('dieuphoi'),
  thukhoPage: rolePage('thukho'),
  beptruongPage: rolePage('beptruong'),
  managerPage: rolePage('manager'),
  dbVerifier: async ({ browser: _browser }, fixtureUse) => {
    void _browser;
    await fixtureUse(new MySQLVerifier(resolveMrxE2eDatabase(process.env).database, ALLOWED_SANDBOX_PORT));
  },
});

export { expect } from '@playwright/test';
