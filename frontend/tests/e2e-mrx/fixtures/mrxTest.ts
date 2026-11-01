import { test as base, type Page } from '@playwright/test';
import { loginRole } from './authHelpers';
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
  adminPage: async ({ browser }, fixtureUse) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'admin');
    await fixtureUse(page);
    await context.close();
  },

  dieuphoiPage: async ({ browser }, fixtureUse) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'dieuphoi');
    await fixtureUse(page);
    await context.close();
  },

  thukhoPage: async ({ browser }, fixtureUse) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'thukho');
    await fixtureUse(page);
    await context.close();
  },

  beptruongPage: async ({ browser }, fixtureUse) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginRole(page, 'beptruong');
    await fixtureUse(page);
    await context.close();
  },

  dbVerifier: async ({ browser: _browser }, fixtureUse) => {
    void _browser; // Playwright requires an object destructuring fixture signature.
    const verifier = new MySQLVerifier(ALLOWED_SANDBOX_DB, ALLOWED_SANDBOX_PORT);
    await fixtureUse(verifier);
  },
});

export { expect } from '@playwright/test';
