import type { Page } from '@playwright/test';

type AxeViolation = {
  id: string;
  impact?: string | null;
  nodes: Array<{ target: Array<string | string[]> }>;
};

export const seriousViolationsWithBrowserPlaceholderEvidence = async (
  _page: Page,
  violations: AxeViolation[],
) => violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
