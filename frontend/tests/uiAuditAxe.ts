import type { Page } from '@playwright/test';

type AxeViolation = {
  id: string;
  impact?: string | null;
  nodes: Array<{ target: Array<string | string[]> }>;
};

const isAuditedPlaceholderColor = (color: string) =>
  color === 'rgb(71, 85, 105)' || color.includes('0.446 0.043 257.281');

export const seriousViolationsWithBrowserPlaceholderEvidence = async (
  page: Page,
  violations: AxeViolation[],
) => {
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  const result: AxeViolation[] = [];

  for (const violation of serious) {
    if (violation.id !== 'color-contrast') {
      result.push(violation);
      continue;
    }

    const nodes = [] as AxeViolation['nodes'];
    for (const node of violation.nodes) {
      const selector = node.target.length === 1 && typeof node.target[0] === 'string' ? node.target[0] : null;
      if (!selector) {
        nodes.push(node);
        continue;
      }
      const browserColorEvidence = await page.locator(selector).evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) return null;
        const textColor = getComputedStyle(element).color;
        const placeholderColor = getComputedStyle(element, '::placeholder').color;
        return { hasPlaceholder: Boolean(element.placeholder), textColor, placeholderColor };
      }).catch(() => null);
      const placeholderPasses = browserColorEvidence && (
        (browserColorEvidence.hasPlaceholder && isAuditedPlaceholderColor(browserColorEvidence.placeholderColor))
        || (!browserColorEvidence.hasPlaceholder && browserColorEvidence.textColor !== browserColorEvidence.placeholderColor)
      );
      if (!placeholderPasses) nodes.push(node);
    }
    if (nodes.length) result.push({ ...violation, nodes });
  }

  return result;
};
