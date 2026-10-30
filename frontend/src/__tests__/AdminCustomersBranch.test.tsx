import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminCustomersBranch } from '../features/admin/branches/AdminCustomersBranch';
import { customerApi } from '../api/customerApi';
import { AuthProvider } from '../store/authContext';

vi.mock('../api/customerApi', () => ({
  customerApi: {
    getCustomerContracts: vi.fn(),
    createCustomerContract: vi.fn(),
  },
}));

describe('AdminCustomersBranch Component Tests (Rule TA-2 & TA-4)', () => {
  const mockContracts = [
    {
      customerId: 'cust-1',
      customerCode: 'ANV',
      customerName: 'Công ty May Amann',
      isActive: true,
      contractStatus: 'ACTIVE',
      defaultMenuPrice: 25000,
      shiftNames: ['MORNING', 'AFTERNOON'],
      activeWeekDays: ['MONDAY', 'TUESDAY'],
      menuScheduleCount: 12,
    },
    {
      customerId: 'cust-2',
      customerCode: 'DAV',
      customerName: 'Công ty Draxlmaier',
      isActive: true,
      contractStatus: 'ACTIVE',
      defaultMenuPrice: 30000,
      shiftNames: ['MORNING'],
      activeWeekDays: ['MONDAY', 'TUESDAY'],
      menuScheduleCount: 6,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(customerApi.getCustomerContracts).mockResolvedValue(mockContracts as any);
  });

  it('renders customer list and contract telemetry', async () => {
    render(
      <AuthProvider>
        <AdminCustomersBranch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Công ty May Amann')).toBeInTheDocument();
      expect(screen.getByText('Công ty Draxlmaier')).toBeInTheDocument();
    });

    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('doanh nghiệp')).toBeInTheDocument();
  });

  it('opens CreateCustomerModal when clicking Thêm khách hàng mới', async () => {
    render(
      <AuthProvider>
        <AdminCustomersBranch />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Công ty May Amann')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: 'Thêm khách hàng mới' });
    fireEvent.click(addBtn);

    expect(await screen.findByText('Thêm khách hàng & Kích hoạt hợp đồng mới')).toBeInTheDocument();
  });
});
