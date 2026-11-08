import { describe, expect, it } from 'vitest';
import source from './ServiceRunReportPanel.tsx?raw';

describe('Service Run table preferences', () => {
  it('uses the shared account-scoped owner with stable columns and preserves report content', () => {
    expect(source).toContain("tableId: 'service-run-report'");
    expect(source).toContain('preferences={{ accountId: currentAccountId, config: serviceRunPreferenceConfig }}');
    expect(source).toContain("id: 'plan'");
    expect(source).toContain("id: 'status'");
    expect(source).toContain("id: 'blocker'");
    expect(source).toContain("id: 'cost'");
    expect(source).toContain("id: 'servings'");
    expect(source).toContain("id: 'correction'");
    expect(source).toContain('CorrectionOverlay');
    expect(source).toContain('Bản chốt đóng ca được giữ nguyên');
    expect(source).toContain('không mở lại ca');
    expect(source).toContain('PaginationBar');
    expect(source).toContain('getServiceRunStatusPresentation');
  });

  it('keeps the last adjustment visible during background refresh', () => {
    expect(source).toContain('isLoading')
    expect(source).toContain('data-refreshing={isFetching || undefined}')
    expect(source).not.toContain("if (isFetching) return <span")
  })
});
