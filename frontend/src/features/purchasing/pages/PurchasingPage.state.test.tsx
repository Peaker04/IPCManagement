import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import purchasingPageSource from './PurchasingPage.tsx?raw';
import serviceDateWorkbenchSource from '../PurchaseServiceDateWorkbench.tsx?raw';

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
  PurchaseServiceDateWorkbench: ({ serviceDates, children }: { serviceDates: unknown[]; children: ReactNode }) => (
    <div data-testid="service-date-workbench">service dates: {serviceDates.length}{children}</div>
  ),
}));
vi.mock('../PurchaseWorkflowGuide', () => ({
  PurchaseWorkflowGuide: () => <div data-testid="purchase-workflow-guide" />,
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
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
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

  it('keeps authoritative workbench data rendered while refreshing', () => {
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
    expect(screen.getByTestId('purchase-decision-panel')).toBeInTheDocument();
    expect(screen.getByTestId('supplemental-workbench').closest('[hidden]')).not.toBeNull();
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
});
