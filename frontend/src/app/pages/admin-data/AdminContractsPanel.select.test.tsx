import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminContractsPanel } from './AdminContractsPanel';
import type { AdminDataPageModel } from './useAdminDataPageModel';

const ready = <T,>(data: T) => ({ phase: 'ready', data, isRefreshing: false, truncation: null }) as const;

describe('AdminContractsPanel select labels', () => {
  it('keeps customer, schedule, and version labels visible in closed triggers', () => {
    const contract = {
      customerId: 'customer-1',
      customerCode: 'KH-01',
      customerName: 'Nhà máy An Bình',
      note: null,
      activeWeekDays: ['t2'],
      shiftNames: ['MORNING'],
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
      menuVersionNo: null,
      menuVersionStatus: null,
    };
    const model = {
      contractFeedback: null,
      contractForm: {
        customerCode: 'KH-01', customerName: 'Nhà máy An Bình', note: '', isActive: true,
        effectiveFrom: '2026-07-01', effectiveTo: '', activeWeekDays: 't2', shiftNames: 'MORNING', defaultMenuPrice: '25000',
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
      queryViews: { contracts: ready([contract]), menuSchedules: ready([schedule]) },
      scheduleRuleForm: { menuPrice: '25000', status: 'ACTIVE', reason: '' },
      selectedContract: contract,
      selectedSchedule: schedule,
      setContractForm: vi.fn(),
      setIsCreatingContract: vi.fn(),
      setScheduleRuleForm: vi.fn(),
      setSelectedContractCustomerId: vi.fn(),
      setSelectedScheduleId: vi.fn(),
      startNewContract: vi.fn(),
    } as unknown as AdminDataPageModel;

    render(<AdminContractsPanel model={model} />);

    const triggers = screen.getAllByRole('combobox');
    expect(triggers[0]).toHaveTextContent('KH-01 - Nhà máy An Bình');
    expect(triggers[0]).not.toHaveTextContent('customer-1');
    expect(triggers[1]).toHaveTextContent('2026-07-30 / MORNING / Thực đơn ca sáng');
    expect(triggers[1]).not.toHaveTextContent('schedule-1');
    expect(triggers[2]).toHaveTextContent('ACTIVE');
  });
});
