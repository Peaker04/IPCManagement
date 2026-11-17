import { test } from '../fixtures/mrxTest';
import { scenarioScope } from '../fixtures/mrxWorkflow';
import { runMultiRoleApprovalLifecycle, runAdminApprovalLifecycle } from '../fixtures/mrxApprovalLifecycle';

test('@MRX-Supplemental-Demand Thu kho creates extra servings, Manager approves, Kho allocates and Chef reads the increase',
  async ({ dieuphoiPage, adminPage, thukhoPage, managerPage, beptruongPage, dbVerifier }) => {
    test.setTimeout(540_000);
    await runMultiRoleApprovalLifecycle({ dieuphoiPage, adminPage, thukhoPage, managerPage, beptruongPage, dbVerifier },
      scenarioScope(dbVerifier, 1), process.env.MRX_E2E_ARTIFACT_DIRECTORY!);
  });

test('@MRX-Supplemental-Demand Admin alone imports, applies source, issues, confirms demand and closes the week',
  async ({ adminPage, dbVerifier }) => {
    test.setTimeout(420_000);
    await runAdminApprovalLifecycle({ adminPage, dbVerifier }, scenarioScope(dbVerifier, 40), process.env.MRX_E2E_ARTIFACT_DIRECTORY!);
  });
