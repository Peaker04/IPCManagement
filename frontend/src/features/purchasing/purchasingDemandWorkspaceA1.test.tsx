import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApiTypes';
import PurchasingPage from './pages/PurchasingPage';
import { PurchaseWorkflowGuide } from './PurchaseWorkflowGuide';
import { PurchaseServiceDateWorkbench } from './PurchaseServiceDateWorkbench';

const mocks = vi.hoisted(() => ({
  getWorkbench: vi.fn(),
  getServiceRunPage: vi.fn(),
  refetch: vi.fn(),
  confirmSupplier: vi.fn(),
  createRequest: vi.fn(),
  submitRequest: vi.fn(),
  createOrders: vi.fn(),
  getSupplierEvidence: vi.fn(),
  getWarehouseSelector: vi.fn(),
}));

vi.mock('@/api/purchasingApi', () => ({
  useGetPurchaseWorkbenchQuery: mocks.getWorkbench,
  useGetServiceRunPageQuery: mocks.getServiceRunPage,
  useConfirmLineSupplierMutation: () => [mocks.confirmSupplier, { isLoading: false }],
  useCreatePurchaseRequestFromDemandMutation: () => [mocks.createRequest, { isLoading: false }],
  useSubmitPurchaseRequestMutation: () => [mocks.submitRequest, { isLoading: false }],
  useCreatePurchaseOrdersFromRequestMutation: () => [mocks.createOrders, { isLoading: false }],
  useGetSupplierEvidenceQuery: mocks.getSupplierEvidence,
}));

vi.mock('@/api/warehouseApi', () => ({
  useGetWarehouseSelectorQuery: mocks.getWarehouseSelector,
}));

vi.mock('./quotation/useSupplierQuotations', () => ({
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

vi.mock('./SupplementalPurchasingWorkbench', () => ({
  SupplementalPurchasingWorkbench: () => <div data-testid="supplemental-workbench" />,
}));
vi.mock('./quotation/SupplierQuotationSection', () => ({
  SupplierQuotationSection: () => <div data-testid="supplier-quotation-section" />,
}));
vi.mock('@/components/common/ServiceRunBlockerPanel', () => ({
  ServiceRunBlockerPanel: () => <div data-testid="service-run-blocker" />,
}));

const mockApprovedDemand = {
  materialRequestId: 'req-demand-123',
  requestCode: 'MD-2027-01-11-D1',
  serviceDate: '2027-01-11',
  shortageLineCount: 254,
  scope: 'FULLDAY',
  currentStage: 'demand',
  status: 'APPROVED',
};

const mockServiceDateDemand: PurchaseWorkbenchServiceDate = {
  serviceDate: '2027-01-11',
  scope: 'FULLDAY',
  currentStage: 'demand',
  approvedDemandCount: 1,
  shortageLineCount: 254,
  supplierReadyLineCount: 0,
  blockingExceptionCount: 0,
  orderCount: 0,
  receivingLineCount: 0,
  fullyReceivedLineCount: 0,
  approvedDemands: [mockApprovedDemand],
  purchaseLines: [],
};

const mockServiceDateSupplierPrice: PurchaseWorkbenchServiceDate = {
  serviceDate: '2027-01-11',
  scope: 'FULLDAY',
  currentStage: 'supplier-price',
  approvedDemandCount: 0,
  shortageLineCount: 1,
  supplierReadyLineCount: 0,
  blockingExceptionCount: 0,
  purchaseRequestId: 'pr-123',
  purchaseRequestCode: 'PR-20270111-001',
  purchaseRequestStatus: 'DRAFT',
  orderCount: 0,
  receivingLineCount: 0,
  fullyReceivedLineCount: 0,
  approvedDemands: [],
  purchaseLines: [
    {
      purchaseRequestLineId: 'line-1',
      materialRequestLineId: 'm-line-1',
      ingredientId: 'ing-1',
      ingredientName: 'Thịt heo nạc xay',
      unitId: 'unit-kg',
      unitName: 'kg',
      requiredQty: 145.5,
      currentStockQty: 0,
      purchaseQty: 145.5,
      estimatedUnitPrice: 0,
      supplierId: undefined,
      supplierName: undefined,
      supplierDecisionStatus: '',
      supplierDecisionHistory: [],
    },
  ],
};

describe('PURCHASING VISIBLE PILOT — WAVE A1: DEMAND CREATION WORKSPACE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRequest.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ data: { purchaseRequestCode: 'PR-20270111-001' } }),
    });
    mocks.getSupplierEvidence.mockReturnValue({
      data: { candidates: [] },
      isLoading: false,
      isSuccess: true,
    });
    mocks.getWarehouseSelector.mockReturnValue({
      data: [{ warehouseId: 'wh-1', warehouseName: 'Kho mẫu IPC', isOperational: true }],
      isLoading: false,
    });
  });

  describe('Test A — One canonical action at stage demand', () => {
    it('retires CommandBar focus button and preserves single canonical creation mutation', async () => {
      mocks.getWorkbench.mockReturnValue({
        data: {
          serviceDates: [mockServiceDateDemand],
          selectedDate: '2027-01-11',
          selectedStage: 'demand',
          stageCounts: { demand: 1, supplierPrice: 0, exception: 0, submittedRequest: 0, approvedOrder: 0, receivingProgress: 0 },
          page: 1,
          pageSize: 8,
          totalItems: 0,
        },
        isLoading: false,
        isSuccess: true,
        refetch: mocks.refetch,
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/purchasing?week=2027-01-11&date=2027-01-11&stage=demand']}>
          <PurchasingPage />
        </MemoryRouter>,
      );

      // 1. In CommandBar, the duplicate shortcut button "Tạo đề xuất mua" must NOT exist
      const commandBar = container.querySelector<HTMLElement>('.ipc-command-bar')!;
      expect(commandBar).toBeInTheDocument();
      expect(within(commandBar).queryByRole('button', { name: 'Tạo đề xuất mua' })).toBeNull();

      // 2. Exactly ONE primary button "Tạo đề xuất mua" exists on the whole page (in DecisionPanel)
      const canonicalButtons = screen.getAllByRole('button', { name: 'Tạo đề xuất mua' });
      expect(canonicalButtons).toHaveLength(1);
      const canonicalBtn = canonicalButtons[0];

      // 3. Dropdown is present
      const demandSelect = screen.getByLabelText('Nhu cầu nguyên liệu đã duyệt');
      expect(demandSelect).toBeInTheDocument();

      // Initially disabled because no candidate selected
      expect(canonicalBtn).toBeDisabled();

      // Select approved candidate
      fireEvent.change(demandSelect, { target: { value: 'req-demand-123' } });
      expect(canonicalBtn).toBeEnabled();

      // Click canonical action -> opens confirmation dialog
      fireEvent.click(canonicalBtn);
      const dialog = screen.getByRole('dialog', { name: 'Tạo đề xuất mua' });
      expect(dialog).toBeInTheDocument();

      // Confirm in dialog -> triggers create mutation with exact materialRequestId
      const confirmSubmitBtn = within(dialog).getByRole('button', { name: 'Tạo đề xuất mua' });
      fireEvent.click(confirmSubmitBtn);

      await waitFor(() => {
        expect(mocks.createRequest).toHaveBeenCalledWith({ materialRequestId: 'req-demand-123' });
      });
    });
  });

  describe('Test B — Demand workspace order and empty table retirement', () => {
    it('renders Guide -> Date selector -> DecisionPanel in DOM order and retires empty 7-column table', () => {
      mocks.getWorkbench.mockReturnValue({
        data: {
          serviceDates: [mockServiceDateDemand],
          selectedDate: '2027-01-11',
          selectedStage: 'demand',
          stageCounts: { demand: 1, supplierPrice: 0, exception: 0, submittedRequest: 0, approvedOrder: 0, receivingProgress: 0 },
          page: 1,
          pageSize: 8,
          totalItems: 0,
        },
        isLoading: false,
        isSuccess: true,
        refetch: mocks.refetch,
      });

      render(
        <MemoryRouter initialEntries={['/purchasing?week=2027-01-11&date=2027-01-11&stage=demand']}>
          <PurchasingPage />
        </MemoryRouter>,
      );

      // DOM order verification
      const guide = screen.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
      const dateSelector = screen.getByText('Ngày phục vụ').closest('section')!;
      const decisionPanel = screen.getByLabelText('Nhu cầu nguyên liệu đã duyệt').closest('section')!;

      expect(guide.compareDocumentPosition(dateSelector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(dateSelector.compareDocumentPosition(decisionPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // At stage demand, empty seven-column purchase-line table is RETIRED
      expect(screen.queryByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' })).toBeNull();
      expect(screen.queryByText('Chưa có dòng nguyên liệu cho giai đoạn đang xem.')).toBeNull();
      expect(screen.queryByText('Nguyên liệu')).toBeNull();
      expect(screen.queryByText('Bằng chứng hiện tại')).toBeNull();
    });
  });

  describe('Test C — Guide navigation contract', () => {
    it('preserves all six stages, clickable prior stages, disabled future stages, and updates URL', () => {
      const onStageChange = vi.fn();
      const { rerender } = render(
        <PurchaseWorkflowGuide
          currentStage="demand"
          selectedStage="demand"
          onStageChange={onStageChange}
        />,
      );

      const nav = screen.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
      const buttons = within(nav).getAllByRole('button');
      expect(buttons).toHaveLength(6);

      // Stage 1 (demand) is active
      expect(buttons[0]).toHaveAttribute('aria-current', 'step');
      expect(buttons[0]).not.toBeDisabled();

      // Stages 2-6 are future & disabled
      for (let i = 1; i < 6; i++) {
        expect(buttons[i]).toBeDisabled();
        expect(buttons[i]).toHaveAttribute('title');
      }

      // If currentStage is exception (Stage 3), stages 1 and 2 are clickable prior stages
      rerender(
        <PurchaseWorkflowGuide
          currentStage="exception"
          selectedStage="exception"
          onStageChange={onStageChange}
        />,
      );

      const updatedButtons = screen.getAllByRole('button');
      // Stage 1 (demand) is clickable prior stage
      expect(updatedButtons[0]).not.toBeDisabled();
      fireEvent.click(updatedButtons[0]);
      expect(onStageChange).toHaveBeenCalledWith('demand');
    });
  });

  describe('Test D — Date selection contract', () => {
    it('preserves all service dates, selected state, and onDateChange trigger', () => {
      const onDateChange = vi.fn();
      const dates = [
        mockServiceDateDemand,
        { ...mockServiceDateDemand, serviceDate: '2027-01-12', shortageLineCount: 48 },
        { ...mockServiceDateDemand, serviceDate: '2027-01-13', shortageLineCount: 48 },
        { ...mockServiceDateDemand, serviceDate: '2027-01-14', shortageLineCount: 48 },
        { ...mockServiceDateDemand, serviceDate: '2027-01-15', shortageLineCount: 48 },
      ];

      render(
        <PurchaseServiceDateWorkbench
          serviceDates={dates}
          selectedDate="2027-01-11"
          selectedStage="demand"
          page={1}
          pageSize={8}
          totalItems={0}
          isLoading={false}
          onDateChange={onDateChange}
          onLineChange={vi.fn()}
          onPageChange={vi.fn()}
        />,
      );

      const dateButtons = screen.getAllByRole('button', { name: /11\/01|12\/01|13\/01|14\/01|15\/01/ });
      expect(dateButtons).toHaveLength(5);

      // Active date is expanded/selected
      expect(dateButtons[0]).toHaveAttribute('aria-expanded', 'true');

      // Clicking another date calls onDateChange
      fireEvent.click(dateButtons[1]);
      expect(onDateChange).toHaveBeenCalledWith(dates[1]);
    });
  });

  describe('Test E — Supplier-price stage regression', () => {
    it('preserves 7-column table, lines, and decision panel when stage is supplier-price', () => {
      mocks.getWorkbench.mockReturnValue({
        data: {
          serviceDates: [mockServiceDateSupplierPrice],
          selectedDate: '2027-01-11',
          selectedStage: 'supplier-price',
          stageCounts: { demand: 0, supplierPrice: 1, exception: 0, submittedRequest: 0, approvedOrder: 0, receivingProgress: 0 },
          page: 1,
          pageSize: 8,
          totalItems: 1,
        },
        isLoading: false,
        isSuccess: true,
        refetch: mocks.refetch,
      });

      render(
        <MemoryRouter initialEntries={['/purchasing?week=2027-01-11&date=2027-01-11&stage=supplier-price']}>
          <PurchasingPage />
        </MemoryRouter>,
      );

      // 7 table columns remain present at stage supplier-price
      expect(screen.getByText('Nguyên liệu')).toBeInTheDocument();
      expect(screen.getByText('Số lượng mua')).toBeInTheDocument();
      expect(screen.getByText('Nhà cung cấp')).toBeInTheDocument();
      expect(screen.getByText('Bằng chứng hiện tại')).toBeInTheDocument();
      expect(screen.getByText('Giá đề xuất')).toBeInTheDocument();
      expect(screen.getByText('Ngày giao')).toBeInTheDocument();
      expect(screen.getByText('Thao tác')).toBeInTheDocument();

      // Worklist row is rendered
      expect(screen.getByText('Thịt heo nạc xay')).toBeInTheDocument();

      // Demand creation controls are NOT rendered
      expect(screen.queryByLabelText('Nhu cầu nguyên liệu đã duyệt')).toBeNull();
    });
  });

  describe('Supplier-price progressive decision workspace', () => {
    it('keeps the full worklist primary and opens the selected-line decision in the canonical drawer', () => {
      mocks.getWorkbench.mockReturnValue({
        data: {
          serviceDates: [mockServiceDateSupplierPrice],
          selectedDate: '2027-01-11',
          selectedStage: 'supplier-price',
          stageCounts: { demand: 0, supplierPrice: 1, exception: 0, submittedRequest: 0, approvedOrder: 0, receivingProgress: 0 },
          page: 1,
          pageSize: 8,
          totalItems: 1,
        },
        isLoading: false,
        isSuccess: true,
        refetch: mocks.refetch,
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/purchasing?week=2027-01-11&date=2027-01-11&stage=supplier-price']}>
          <PurchasingPage />
        </MemoryRouter>,
      );

      expect(screen.queryByText('Tiến độ nhà cung cấp:')).toBeNull();
      expect(screen.queryByText('Ngày cần xử lý')).toBeNull();
      expect(screen.queryByLabelText('Một luồng sáu giai đoạn từ nhu cầu đã duyệt đến tiến độ nhập kho.')).toBeNull();
      expect(within(container.querySelector<HTMLElement>('.ipc-command-bar')!).queryByRole('button', { name: 'Xác nhận nhà cung cấp' })).toBeNull();
      expect(screen.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /Xử lý nhà cung cấp/ })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Xem bằng chứng' }));

      const drawer = screen.getByRole('dialog', { name: /Xử lý nhà cung cấp/ });
      expect(drawer).toBeInTheDocument();
      expect(within(drawer).getByText('Thịt heo nạc xay')).toBeInTheDocument();
      expect(within(drawer).getByRole('button', { name: 'Xác nhận nhà cung cấp' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Dòng nguyên liệu của ngày phục vụ đang chọn' })).toBeInTheDocument();
    });
  });

  describe('Test F — Empty/loading/error robustness', () => {
    it('preserves IA-14A ready-empty guidance when week has zero service dates', () => {
      mocks.getWorkbench.mockReturnValue({
        data: {
          serviceDates: [],
          selectedDate: undefined,
          selectedStage: 'demand',
          stageCounts: { demand: 0, supplierPrice: 0, exception: 0, submittedRequest: 0, approvedOrder: 0, receivingProgress: 0 },
          page: 1,
          pageSize: 8,
          totalItems: 0,
        },
        isLoading: false,
        isSuccess: true,
        refetch: mocks.refetch,
      });

      render(
        <MemoryRouter initialEntries={['/purchasing?week=2027-01-11']}>
          <PurchasingPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Chưa có nhu cầu nguyên liệu đã duyệt trong tuần này.')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Sáu giai đoạn thu mua' })).toBeNull();
    });
  });
});
