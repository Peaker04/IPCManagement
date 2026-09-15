import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import source from './ServiceRunReportPanel.tsx?raw';
import { CorrectionOverlay } from './ServiceRunReportPanel';

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
    expect(source).toContain('correctionOverlay={lifecycle.correctionOverlay}');
    expect(source).not.toContain('useGetServiceRunAdjustmentsQuery');
    expect(source).toContain('Bản chốt đóng ca được giữ nguyên');
    expect(source).toContain('không mở lại ca');
    expect(source).toContain('PaginationBar');
    expect(source).toContain('getServiceRunStatusPresentation');
  });

  it('renders the latest correction embedded in the page projection', () => {
    const { rerender } = render(<CorrectionOverlay
      isCloseSnapshot
      correctionOverlay={{ state: 'PENDING', correctedActualServings: 108, actualServingsDelta: 8, reason: 'Đối chiếu lại chứng từ' }}
    />);
    expect(screen.getByText(/108 suất \(\+8\)/)).toBeInTheDocument();
    expect(screen.getByText('Đối chiếu lại chứng từ')).toBeInTheDocument();

    rerender(<CorrectionOverlay isCloseSnapshot correctionOverlay={{ state: 'PENDING', correctedActualServings: 95, actualServingsDelta: -5, reason: null }} />);
    expect(screen.getByText(/95 suất \(-5\)/)).toBeInTheDocument();

    rerender(<CorrectionOverlay isCloseSnapshot correctionOverlay={{ state: 'NONE', correctedActualServings: null, actualServingsDelta: null, reason: null }} />);
    expect(screen.getByText('Không có điều chỉnh hậu kiểm.')).toBeInTheDocument();

    rerender(<CorrectionOverlay isCloseSnapshot={false} correctionOverlay={{ state: 'NONE', correctedActualServings: null, actualServingsDelta: null, reason: null }} />);
    expect(screen.getByText('Dữ liệu lịch sử chưa có bản chốt.')).toBeInTheDocument();
  })
});
