import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminCustomersBranch } from '../features/admin/branches/AdminCustomersBranch';
import type { CustomerContractItem } from '../api/customerApi';
import { AuthProvider } from '../store/authContext';
import * as apiTransport from '../api/client';

describe('AdminCustomersBranch Component Tests (Rule TA-2 & TA-4)', () => {
  const mockContracts: CustomerContractItem[] = [
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

  let createFailure: Error | null = null;
  let visibleContracts = mockContracts;
  beforeEach(() => {
    vi.restoreAllMocks();
    createFailure = null;
    visibleContracts = mockContracts;
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (endpoint, options) => {
      if (endpoint === '/system-operation-mode') return { mode: localStorage.getItem('ipc_v3_mode') || 'DEFAULT', label: 'Chế độ kiểm thử', version: 1, updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      if (endpoint === '/coordination/customer-contracts') return visibleContracts;
      if (endpoint === '/coordination/customers/contract' && options?.method === 'POST') {
        if (createFailure) { const failure = createFailure; createFailure = null; throw failure; }
        return { ...mockContracts[0], customerId: 'cust-new', customerCode: 'NEW', customerName: 'Khách hàng mới', menuScheduleCount: 0 };
      }
      throw new Error(`Unexpected customer test request ${endpoint}`);
    });
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
    const reads = vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path === '/coordination/customer-contracts').length;
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm khách hàng trong danh sách' }), { target: { value: '  CONG  TY  MAY ' } });
    expect(screen.getByText('Công ty May Amann')).toBeInTheDocument();
    expect(screen.queryByText('Công ty Draxlmaier')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getByText('Công ty Draxlmaier')).toBeInTheDocument();
    expect(vi.mocked(apiTransport.apiClient).mock.calls.filter(([path]) => path === '/coordination/customer-contracts')).toHaveLength(reads);
  });

  it('submits the shared customer form in MRX and retains server validation errors before successful retry', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    createFailure = new Error('Mã khách hàng đã tồn tại.');
    render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    await screen.findByText('Công ty May Amann');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng mới' }));
    fireEvent.change(screen.getByLabelText('Mã khách hàng', { exact: true }), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByLabelText('Tên khách hàng', { exact: true }), { target: { value: 'Khách hàng mới' } });
    const submit = screen.getByRole('button', { name: 'Tạo khách hàng' });
    expect(screen.queryByRole('radiogroup', { name: 'Mốc giá suất ăn' })).not.toBeInTheDocument();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await screen.findByText('Mã khách hàng đã tồn tại.');
    expect(screen.getByLabelText('Mã khách hàng', { exact: true })).toHaveValue('NEW');
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(apiTransport.apiClient).toHaveBeenCalledWith('/coordination/customers/contract', { method: 'POST', body: JSON.stringify({ customerCode: 'NEW', customerName: 'Khách hàng mới', isActive: true }) });
    expect(vi.mocked(apiTransport.apiClient).mock.calls.some(([path]) => path === '/Dishes/bom-price-tiers')).toBe(false);
    localStorage.removeItem('ipc_v3_mode');
  });

  it('does not present a customer price column even when legacy contracts have prices', async () => {
    visibleContracts = [{ ...mockContracts[0], defaultMenuPrice: null }, mockContracts[1]];
    render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    await screen.findByText('Công ty May Amann');
    expect(screen.queryByRole('columnheader', { name: 'Mốc giá hợp đồng' })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Công ty Draxlmaier/ })).not.toHaveTextContent('30.000');
  });

  it('edits selected customer note/status through toolbar, retaining failed drafts without contract or name fields', async () => {
    let failUpdate = true;
    const transport = vi.mocked(apiTransport.apiClient).getMockImplementation()!;
    vi.mocked(apiTransport.apiClient).mockImplementation(async (endpoint, options) => {
      if (endpoint === '/coordination/customers/cust-1/contract' && options?.method === 'PUT') {
        if (failUpdate) { failUpdate = false; throw new Error('Không thể cập nhật khách hàng'); }
        return { ...mockContracts[0], ...JSON.parse(String(options.body)) };
      }
      return transport(endpoint, options);
    });
    render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    await screen.findByText('Công ty May Amann');
    const edit = screen.getByRole('button', { name: 'Chỉnh sửa' });
    expect(edit).toBeDisabled();
    expect(screen.queryByRole('columnheader', { name: 'Thao tác' })).not.toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Công ty May Amann/ });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(row).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(edit);
    expect(screen.queryByRole('textbox', { name: 'Tên khách hàng' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(vi.mocked(apiTransport.apiClient).mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
    fireEvent.click(edit);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú khách hàng' }), { target: { value: 'Giao tại cổng B' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Đang hoạt động' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText('Không thể cập nhật khách hàng');
    expect(screen.getByRole('textbox', { name: 'Ghi chú khách hàng' })).toHaveValue('Giao tại cổng B');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(row).toHaveTextContent('Tạm dừng');
    expect(row).toHaveTextContent('Giao tại cổng B');
    fireEvent.click(edit);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ghi chú khách hàng' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Đang hoạt động' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const bodies = vi.mocked(apiTransport.apiClient).mock.calls.filter(([, options]) => options?.method === 'PUT').map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies).toEqual([{ note: 'Giao tại cổng B', isActive: false }, { note: 'Giao tại cổng B', isActive: false }, { note: '', isActive: true }]);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm khách hàng trong danh sách' }), { target: { value: 'Draxlmaier' } });
    expect(edit).toBeDisabled();
  });

  it('does not expose customer status mutations to a read-only Chef', async () => {
    const user = JSON.parse(localStorage.getItem('ipc_v3_user')!);
    localStorage.setItem('ipc_v3_user', JSON.stringify({ ...user, roleCode: 'CHEF', roleName: 'Chef', isAdminFullAccess: false, permissions: ['catalog.read'] }));
    render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    await screen.findByText('Công ty May Amann');
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();
  });

  it('keeps customer input on canceled discard and resets it after confirmed footer discard', async () => {
    render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    await screen.findByText('Công ty May Amann');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng mới' }));
    fireEvent.change(screen.getByLabelText('Mã khách hàng', { exact: true }), { target: { value: 'NEW' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(screen.getByLabelText('Mã khách hàng', { exact: true })).toHaveValue('NEW');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng mới' }));
    expect(screen.getByLabelText('Mã khách hàng', { exact: true })).toHaveValue('');
    expect(vi.mocked(apiTransport.apiClient).mock.calls.some(([path, options]) => path === '/coordination/customers/contract' && options?.method === 'POST')).toBe(false);
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

    expect(await screen.findByRole('dialog', { name: 'Thêm khách hàng mới' })).toBeInTheDocument();
  });

  it('H5: AdminCustomersBranch renders min-h-11 TelemetrySubbar and keeps tạm dừng pill mounted even when inactiveCount is 0', async () => {
    const { container } = render(<AuthProvider><AdminCustomersBranch /></AuthProvider>);
    expect(await screen.findByText('Công ty May Amann')).toBeInTheDocument();
    expect(screen.getByText(/tạm dừng/)).toBeInTheDocument();
    expect(screen.getByText('Khách hàng:').closest('div.min-h-11')).not.toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm khách hàng trong danh sách' }), { target: { value: 'KHONG_KHOP_XYZ' } });
    expect(screen.getByText('Không có khách hàng khớp tìm kiếm')).toBeInTheDocument();
    expect(container.querySelectorAll('table').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByText('Công ty May Amann')).toBeInTheDocument();
  });
});
