import fs from 'node:fs';
import path from 'node:path';
import { test } from '../fixtures/mrxTest';
import { createTransferredBatch, scenarioScope } from '../fixtures/mrxWorkflow';

test('@T7-Export-Consistency setup one real transferred source', async ({ adminPage, dieuphoiPage, dbVerifier }) => {
  test.setTimeout(300_000);
  const scope = scenarioScope(dbVerifier, 30);
  const batch = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage }, scope);
  const currentCustomer = await dieuphoiPage.getByLabel('Chọn khách hàng MRX', { exact: true }).inputValue();
  const otherCustomer = await dieuphoiPage.getByLabel('Chọn khách hàng MRX', { exact: true }).locator('option').evaluateAll((options, current) =>
    options.map(option => ({ customerId: (option as HTMLOptionElement).value, label: option.textContent?.trim() || '' }))
      .find(option => /^[0-9a-f-]{36}$/i.test(option.customerId) && option.customerId !== current), currentCustomer);
  let otherBatchId: string | null = null;
  if (otherCustomer) {
    const otherScope = scenarioScope(dbVerifier, 31);
    otherScope.customer = otherCustomer;
    const other = await createTransferredBatch({ coordinator: dieuphoiPage, admin: adminPage, sourceScenario: async page => {
      for (const input of await page.getByRole('spinbutton', { name: /Số suất Mặn/ }).all()) await input.fill('1000');
      for (const input of await page.getByRole('spinbutton', { name: /Số suất Chay/ }).all()) await input.fill('50');
    } }, otherScope);
    otherBatchId = other.batchId;
  }
  fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'export-scope.json'), JSON.stringify({
    runId: scope.runId, week: scope.weekStartDate, batchId: batch.batchId, otherBatchId,
  }, null, 2));
});
