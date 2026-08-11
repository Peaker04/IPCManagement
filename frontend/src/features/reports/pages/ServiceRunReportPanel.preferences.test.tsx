import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/reports/pages/ServiceRunReportPanel.tsx'), 'utf8');

describe('Service Run table preferences', () => {
  it('uses the shared account-scoped owner with stable columns and preserves report content', () => {
    expect(source).toContain("tableId: 'service-run-report'");
    expect(source).toContain('preferences={{ accountId: currentUser?.id, config: serviceRunPreferenceConfig }}');
    expect(source).toContain("id: 'plan'");
    expect(source).toContain("id: 'status'");
    expect(source).toContain("id: 'blocker'");
    expect(source).toContain("id: 'cost'");
    expect(source).toContain("id: 'servings'");
    expect(source).toContain('PaginationBar');
    expect(source).toContain('getServiceRunStatusPresentation');
  });
});
