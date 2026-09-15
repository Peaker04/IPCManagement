import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextStrip, OperationalFrame } from '@/components/common';
import { AdminContractsPanel } from './AdminContractsPanel';
import type { AdminDataPageModel } from './useAdminDataPageModel';

const ready = <T,>(data: T) => ({ phase: 'ready', data, isRefreshing: false, truncation: null }) as const;

function createMockContractsModel(overrides?: Partial<AdminDataPageModel>): AdminDataPageModel {
  const contract = {
    customerId: 'customer-1',
    customerCode: 'KH-01',
    customerName: 'Nhà máy An Bình',
    note: 'Ca phục vụ, ngày làm việc, ràng buộc menu',
    activeWeekDays: ['t2', 't3', 't4', 't5', 't6'],
    shiftNames: ['MORNING', 'AFTERNOON'],
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    contractStatus: 'ACTIVE',
    defaultMenuPrice: 25000,
    isActive: true,
    latestServiceDate: '2026-07-30',
  };
  const schedule = {
    menuScheduleId: 'schedule-1',
    serviceDate: '2026-07-30',
    shift: 'MORNING',
    menuName: 'Thực đơn ca sáng',
    menuPrice: 25000,
    status: 'ACTIVE',
    sourceImportBatch: null,
    menuVersionNo: 'V01',
    menuVersionStatus: 'APPLIED',
  };

  return {
    contractFeedback: null,
    contractForm: {
      customerCode: 'KH-01',
      customerName: 'Nhà máy An Bình',
      note: 'Ca phục vụ, ngày làm việc, ràng buộc menu',
      isActive: true,
      effectiveFrom: '2026-07-01',
      effectiveTo: '',
      activeWeekDays: 't2, t3, t4, t5, t6',
      shiftNames: 'Ca sáng, Ca chiều',
      defaultMenuPrice: '25000',
    },
    customerContracts: [contract],
    effectiveActiveView: 'contracts',
    handleSaveCustomerContract: vi.fn(),
    handleSaveScheduleRules: vi.fn(),
    handleUpdateScheduleVersion: vi.fn(),
    isCreatingContract: false,
    isSavingContract: false,
    loadContractForm: vi.fn(),
    loadScheduleRuleForm: vi.fn(),
    menuSchedules: [schedule],
    queryViews: {
      contracts: ready([contract]),
      menuSchedules: ready([schedule]),
    },
    scheduleRuleForm: { menuPrice: '25000', status: 'ACTIVE', reason: '' },
    selectedContract: contract,
    selectedSchedule: schedule,
    setContractForm: vi.fn(),
    setIsCreatingContract: vi.fn(),
    setScheduleRuleForm: vi.fn(),
    setSelectedContractCustomerId: vi.fn(),
    setSelectedScheduleId: vi.fn(),
    startNewContract: vi.fn(),
    ...overrides,
  } as unknown as AdminDataPageModel;
}

describe('AdminContractsPanel presentation & information architecture', () => {
  it('does not repeat page-level contract summary inside the contracts work section', () => {
    const model = createMockContractsModel();
    const pageContextItems = [
      { label: 'Khách hàng', value: '1', tone: 'neutral' as const },
      { label: 'Đang dùng', value: '1', tone: 'success' as const },
      { label: 'Phiên bản lịch', value: '1', tone: 'neutral' as const },
    ];

    const { container } = render(
      <OperationalFrame context={<ContextStrip items={pageContextItems} />}>
        <AdminContractsPanel model={model} />
      </OperationalFrame>
    );

    // 1. Page-level context has canonical summary terms
    const summaryTerms = Array.from(container.querySelectorAll('dl.ipc-context-strip dt'));
    const customerSummaryTerms = summaryTerms.filter((term) => term.textContent?.trim() === 'Khách hàng');
    const activeSummaryTerms = summaryTerms.filter((term) => term.textContent?.trim() === 'Đang dùng');

    // Expected: Summary facts appear exactly once across the page context
    expect(customerSummaryTerms).toHaveLength(1);
    expect(activeSummaryTerms).toHaveLength(1);

    // 2. Contracts SectionPanel must NOT contain a second context strip / summary list
    const contractsSection = screen.getByRole('heading', { level: 2, name: 'Hợp đồng khách hàng và quy tắc suất ăn' }).closest('section')!;
    expect(contractsSection).toBeInTheDocument();
    expect(contractsSection.querySelectorAll('dl.ipc-context-strip')).toHaveLength(0);
    expect(within(contractsSection).queryByText('Lịch theo phiên bản')).not.toBeInTheDocument();

    // 3. Work surface controls and fields remain intact
    expect(screen.getByText('Khách hàng', { selector: 'label' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ca phục vụ \(cách nhau bằng dấu phẩy\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ngày làm việc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Đơn giá mặc định \/ mức BOM/i)).toBeInTheDocument();

    // 4. Contracts table and headers remain intact
    expect(screen.getByRole('columnheader', { name: 'Khách hàng' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đơn giá' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Nhà máy An Bình/i })).toBeInTheDocument();
  });

  it('keeps contracts work section clean of internal ContextStrip in isolated panel mount', () => {
    const model = createMockContractsModel();
    const { container } = render(<AdminContractsPanel model={model} />);

    // Section heading must be present
    expect(screen.getByRole('heading', { level: 2, name: 'Hợp đồng khách hàng và quy tắc suất ăn' })).toBeInTheDocument();

    // ContextStrip must not be rendered within AdminContractsPanel
    expect(container.querySelectorAll('dl.ipc-context-strip')).toHaveLength(0);

    // Customer form label still exists
    expect(screen.getByText('Khách hàng', { selector: 'label' })).toBeInTheDocument();

    // Table column 'Ca' still exists
    expect(screen.getByRole('columnheader', { name: 'Ca' })).toBeInTheDocument();
  });
});
