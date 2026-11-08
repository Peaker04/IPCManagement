import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import purchasingPageSource from './PurchasingPage.tsx?raw';
import serviceDateWorkbenchSource from '../PurchaseServiceDateWorkbench.tsx?raw';
import recoveryAuthoritySource from '../../../../../.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-BASELINE-RECOVERY-AUTHORITY.json?raw';
import selectedBaselineSource from '../../../../../.artifacts/phase28-ui-audit/baseline-recovery/attempt-3/evidence/canonical-combined.json?raw';

const mocks = vi.hoisted(() => ({
  getWorkbench: vi.fn(),
  getServiceRunPage: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseWorkbenchQuery: mocks.getWorkbench,
  useGetServiceRunPageQuery: mocks.getServiceRunPage,
}));

vi.mock('../quotation/useSupplierQuotations', () => ({
  useSupplierQuotations: () => ({
    ingredients: [],
    suppliers: [],
    response: undefined,
    ingredientView: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
    supplierView: { phase: 'ready', data: [], isRefreshing: false, truncation: null },
    quotationView: { phase: 'uninitialized', instruction: 'Chọn nguyên liệu.' },
    isLookupError: false,
    isLookupForbidden: false,
  }),
}));

vi.mock('../PurchaseDecisionPanel', () => ({
  PurchaseDecisionPanel: () => <div data-testid="purchase-decision-panel" />,
}));
vi.mock('../SupplementalPurchasingWorkbench', () => ({
  SupplementalPurchasingWorkbench: () => <div data-testid="supplemental-workbench" />,
}));
vi.mock('../PurchaseServiceDateWorkbench', () => ({
  PurchaseServiceDateWorkbench: ({ serviceDates, selectedDate, children }: { serviceDates: unknown[]; selectedDate?: string; children: ReactNode }) => (
    <div data-testid="service-date-workbench" data-selected-date={selectedDate}>
      {/* TableViewport mock */}
      <table><thead><tr><th>NHÀ CUNG CẤP</th><th>ĐƠN GIÁ</th></tr></thead></table>
      service dates: {serviceDates.length}{children}
    </div>
  ),
}));
vi.mock('../PurchaseWorkflowGuide', () => ({
  PurchaseWorkflowGuide: () => (
    <nav aria-label="Sáu giai đoạn thu mua" data-testid="purchase-workflow-guide">
      <button type="button">NCC & giá</button>
    </nav>
  ),
}));
vi.mock('../quotation/SupplierQuotationSection', () => ({
  SupplierQuotationSection: () => <div data-testid="supplier-quotation-section" />,
}));
vi.mock('@/components/common/ServiceRunBlockerPanel', () => ({
  ServiceRunBlockerPanel: () => <div data-testid="service-run-blocker" />,
}));

import PurchasingPage from './PurchasingPage';

const workbench = {
  selectedDate: '2026-07-20',
  selectedStage: 'demand',
  stageCounts: {
    demand: 1,
    supplierPrice: 0,
    exception: 0,
    submittedRequest: 0,
    approvedOrder: 0,
    receivingProgress: 0,
  },
  serviceDates: [{
    serviceDate: '2026-07-20',
    scope: 'FULLDAY',
    currentStage: 'demand',
    approvedDemandCount: 1,
    shortageLineCount: 1,
    supplierReadyLineCount: 0,
    blockingExceptionCount: 0,
    orderCount: 0,
    receivingLineCount: 0,
    fullyReceivedLineCount: 0,
    approvedDemands: [],
    purchaseLines: [],
  }],
  page: 1,
  pageSize: 8,
  totalItems: 1,
};

const queryResult = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  currentData: undefined,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  error: undefined,
  refetch: mocks.refetch,
  ...overrides,
});

const renderPage = (entry = '/purchasing?week=2026-07-20') => render(
  <MemoryRouter initialEntries={[entry]}>
    <PurchasingPage />
  </MemoryRouter>,
);

type SealedFinding = {
  identity: string;
  ruleId: string;
  verdict: string;
  expected?: string;
  actual?: string;
  severity?: string;
  lowestOwner?: string;
};

const exactFindingKey = ({ identity, ruleId, expected, actual, severity, lowestOwner }: SealedFinding) => ({
  identity,
  ruleId,
  expected,
  actual,
  severity,
  lowestOwner,
});

describe('Purchasing sealed remediation contract', () => {
  it('keeps one route H1 and demotes the view-specific heading', () => {
    expect(purchasingPageSource).not.toContain('<h1 className="text-[20px]');
    expect(purchasingPageSource).toContain('<h2 className="text-[20px]');
  });

  it('uses native named date grouping and headers for loading and empty workflow tables', () => {
    expect(serviceDateWorkbenchSource).toContain('<fieldset');
    expect(serviceDateWorkbenchSource).toContain('<legend className="sr-only">Các ngày cần xử lý</legend>');
    expect(serviceDateWorkbenchSource.match(/<thead>/g)).toHaveLength(2);
    expect(serviceDateWorkbenchSource).not.toContain('<div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:min-h-[11.4rem] xl:grid-cols-3" aria-label="Các ngày cần xử lý">');
  });

  it('partitions exact current recovery FAIL keys without consuming NEEDS_EVIDENCE', async () => {
    const authority = JSON.parse(recoveryAuthoritySource) as {
      selectedRecovery: { root: string; counts: { verdictTotals: Record<string, number> } };
    };
    expect(authority.selectedRecovery.root).toBe('.artifacts/phase28-ui-audit/baseline-recovery/attempt-3');
    const baseline = JSON.parse(selectedBaselineSource) as {
      records: Array<{ findings: SealedFinding[] }>;
    };
    const findings = baseline.records.flatMap(({ findings: recordFindings }) => recordFindings);
    const failures = findings.filter(({ verdict }) => verdict === 'FAIL');
    const purchasing = failures.filter(({ identity }) => identity.split('|')[0] === '/purchasing');
    const residual = failures.filter(({ identity }) => identity.split('|')[0] !== '/purchasing');
    const purchasingKeys = purchasing.map(exactFindingKey);
    const residualKeys = residual.map(exactFindingKey);
    const serialize = (keys: ReturnType<typeof exactFindingKey>[]) => JSON.stringify(
      [...keys].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    );
    const purchasingSet = new Set(purchasingKeys.map((key) => JSON.stringify(key)));
    const residualSet = new Set(residualKeys.map((key) => JSON.stringify(key)));

    expect(failures).toHaveLength(authority.selectedRecovery.counts.verdictTotals.FAIL);
    expect(purchasing).toHaveLength(203);
    expect(residual).toHaveLength(1_258);
    expect(purchasingKeys.every((key) => key.identity.split('|').length === 6 && key.expected && key.actual && key.severity && key.lowestOwner)).toBe(true);
    expect(residualKeys.every((key) => key.identity.split('|').length === 6 && key.expected && key.actual && key.severity && key.lowestOwner)).toBe(true);
    expect([...purchasingSet].some((key) => residualSet.has(key))).toBe(false);
    expect(new Set([...purchasingSet, ...residualSet]).size).toBe(failures.length);
    expect(findings.filter(({ verdict }) => verdict === 'NEEDS_EVIDENCE')).toHaveLength(47_208);
    expect(failures.some(({ verdict }) => verdict === 'NEEDS_EVIDENCE')).toBe(false);

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialize(residualKeys)));
    const residualSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(residualSha256).toBe('b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a');
    console.info(`PHASE28_PURCHASING_FAIL_KEYS=${purchasing.length}`);
    console.info(`PHASE28_RESIDUAL_FAIL_KEYS=${residual.length}`);
    console.info(`PHASE28_RESIDUAL_FAIL_KEYS_SHA256=${residualSha256}`);
  });
});

describe('PurchasingPage query state boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServiceRunPage.mockReturnValue(queryResult());
  });

  it('renders query-level forbidden without presenting recovery or empty metrics', () => {
    mocks.getWorkbench.mockReturnValue(queryResult({
      isError: true,
      error: { status: 403 },
    }));

    renderPage();

    expect(screen.getByText('Bạn không có quyền xem quy trình thu mua.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(screen.queryByText('Ngày cần xử lý')).toBeNull();
    expect(screen.queryByTestId('service-date-workbench')).toBeNull();
  });

  it('keeps a non-forbidden load failure actionable', () => {
    mocks.getWorkbench.mockReturnValue(queryResult({
      isError: true,
      error: { status: 500 },
    }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(screen.getAllByText(/Không tải được quy trình thu mua/).length).toBeGreaterThan(0);
  });

  it('keeps authoritative workbench data rendered while refreshing', async () => {
    mocks.getWorkbench.mockReturnValue(queryResult({
      data: workbench,
      currentData: workbench,
      isFetching: true,
      isSuccess: true,
    }));

    renderPage();

    expect(screen.getByText('Đang tải')).toBeInTheDocument();
    expect(mocks.getWorkbench).toHaveBeenCalledWith({
      week: '2026-07-20',
      date: undefined,
      stage: undefined,
      page: 1,
      pageSize: 8,
    }, { skip: false });
    expect(screen.getByTestId('service-date-workbench')).toHaveTextContent('service dates: 1');
    expect(await screen.findByTestId('purchase-decision-panel')).toBeInTheDocument();
    expect(screen.getByTestId('supplemental-workbench').closest('[hidden]')).not.toBeNull();
  });

  it('opens the service date that owns a purchase-request deep link', async () => {
    const linkedWorkbench = {
      ...workbench,
      serviceDates: [
        workbench.serviceDates[0],
        { ...workbench.serviceDates[0], serviceDate: '2026-07-21', purchaseRequestId: 'purchase-request-2' },
      ],
    };
    mocks.getWorkbench.mockReturnValue(queryResult({
      data: linkedWorkbench,
      currentData: linkedWorkbench,
      isSuccess: true,
    }));

    renderPage('/purchasing?week=2026-07-20&purchaseRequestId=purchase-request-2');

    expect(await screen.findByTestId('service-date-workbench')).toHaveAttribute('data-selected-date', '2026-07-21');
  });

  it('keeps supplemental purchasing in its own URL-addressable tab', () => {
    mocks.getWorkbench.mockReturnValue(queryResult());

    renderPage('/purchasing?week=2026-07-20&view=supplemental');

    expect(screen.getByRole('tab', { name: 'Mua bổ sung' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('supplemental-workbench')).toBeInTheDocument();
    expect(document.getElementById('purchasing-workflow-panel')).toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { name: 'Mua bổ sung cho bếp' })).toBeInTheDocument();
  });

  it('opens the supplemental tab without letting workflow URL reconciliation clobber the selected view', async () => {
    mocks.getWorkbench.mockReturnValue(queryResult({ data: workbench, currentData: workbench, isSuccess: true }));
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Mua bổ sung' }));

    expect(screen.getByTestId('supplemental-workbench')).toBeInTheDocument();
    expect(screen.getByTestId('service-date-workbench').closest('[hidden]')).not.toBeNull();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Mua bổ sung' })).toHaveAttribute('aria-selected', 'true'));
    expect(document.getElementById('purchasing-supplemental-panel')).not.toHaveAttribute('hidden');
  });

  it('retires workflow chrome when the ready week has no approved demand', () => {
    const emptyWorkbench = {
      ...workbench,
      selectedDate: undefined,
      stageCounts: {
        demand: 0,
        supplierPrice: 0,
        exception: 0,
        submittedRequest: 0,
        approvedOrder: 0,
        receivingProgress: 0,
      },
      serviceDates: [],
      totalItems: 0,
    };
    mocks.getWorkbench.mockReturnValue(queryResult({ data: emptyWorkbench, currentData: emptyWorkbench, isSuccess: true }));

    renderPage('/purchasing?week=2026-07-20');

    // Compact guidance xuất hiện
    expect(screen.getByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeInTheDocument();
    expect(screen.getByText(/Chọn tuần khác hoặc kiểm tra KHSX tại Thực đơn tuần/i)).toBeInTheDocument();

    // Workflow chrome absent
    expect(screen.queryByRole('navigation', { name: /Sáu giai đoạn thu mua/i })).toBeNull();
    expect(screen.queryByText('NCC & giá')).toBeNull();
    expect(screen.queryByTestId('service-date-workbench')).toBeNull();
    expect(screen.queryByText('NHÀ CUNG CẤP')).toBeNull();
    expect(screen.queryByText('ĐƠN GIÁ')).toBeNull();
    expect(screen.queryByTestId('service-run-blocker')).toBeNull();
    expect(screen.queryByTestId('purchase-decision-panel')).toBeNull();

    // ContextStrip 4 zero facts absent
    expect(screen.queryByText('Ngày cần xử lý')).toBeNull();
    expect(screen.queryByText('Nhu cầu chờ duyệt')).toBeNull();
    expect(screen.queryByText('Ngoại lệ giá')).toBeNull();
    expect(screen.queryByText('Đơn chờ nhập')).toBeNull();

    // Scope CommandBar, page heading, ViewSwitcher still present
    expect(screen.getByRole('heading', { name: 'Thu mua theo nhu cầu đã duyệt' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Xử lý thu mua' })).toBeInTheDocument();
    expect(screen.getByText(/Tuần mua hàng/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Mua bổ sung' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Báo giá nhà cung cấp' })).toBeInTheDocument();
  });

  it('keeps workflow guide and workbench when ready service dates exist', () => {
    mocks.getWorkbench.mockReturnValue(queryResult({ data: workbench, currentData: workbench, isSuccess: true }));

    renderPage('/purchasing?week=2026-07-20');

    expect(screen.getByTestId('purchase-workflow-guide')).toBeInTheDocument();
    expect(screen.getByTestId('service-date-workbench')).toBeInTheDocument();
    expect(screen.getByTestId('purchase-decision-panel')).toBeInTheDocument();
    expect(screen.queryByText('Ngày cần xử lý')).toBeNull();
    expect(screen.queryByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeNull();
  });

  it('does not mistake loading, error, or forbidden states for ready-empty', () => {
    // Loading
    mocks.getWorkbench.mockReturnValue(queryResult({ isLoading: true, isFetching: true }));
    const { unmount } = renderPage('/purchasing?week=2026-07-20');
    expect(screen.queryByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeNull();
    expect(screen.getByText('Đang tải quy trình thu mua')).toBeInTheDocument();
    unmount();

    // Error
    mocks.getWorkbench.mockReturnValue(queryResult({ isError: true, error: { status: 500 } }));
    const { unmount: unmountError } = renderPage('/purchasing?week=2026-07-20');
    expect(screen.queryByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeNull();
    expect(screen.getAllByText(/Không tải được quy trình thu mua/).length).toBeGreaterThan(0);
    unmountError();

    // Forbidden
    mocks.getWorkbench.mockReturnValue(queryResult({ isError: true, error: { status: 403 } }));
    renderPage('/purchasing?week=2026-07-20');
    expect(screen.queryByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeNull();
    expect(screen.getByText('Bạn không có quyền xem quy trình thu mua.')).toBeInTheDocument();
  });
});
