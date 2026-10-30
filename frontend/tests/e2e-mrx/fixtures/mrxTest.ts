import { test as base, type Page } from '@playwright/test';
import { loginRole, type MrxRole } from './authHelpers';
import { MySQLVerifier } from '../core/mysqlVerifier';
import { ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT } from '../core/dbGuardrail';

export interface MrxTestFixtures {
  adminPage: Page;
  dieuphoiPage: Page;
  thukhoPage: Page;
  beptruongPage: Page;
  dbVerifier: MySQLVerifier;
}

export const test = base.extend<MrxTestFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'admin');
    await use(page);
    await context.close();
  },

  dieuphoiPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'dieuphoi');
    await use(page);
    await context.close();
  },

  thukhoPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'thukho');
    await use(page);
    await context.close();
  },

  beptruongPage: async ({ browser }, use) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'beptruong');
    await use(page);
    await context.close();
  },

  dbVerifier: async ({}, use) => {
    const verifier = new MySQLVerifier(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT);
    await use(verifier);
  },
});

export { expect } from '@playwright/test';
