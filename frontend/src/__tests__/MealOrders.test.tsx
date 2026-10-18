import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MealOrdersPage } from '../features/coordination/MealOrdersPage';
import { AuthProvider } from '../store/authContext';
import { coordinationApi } from '../api/coordinationApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_COORDINATION_DATA } from '../test/fixtures';

function renderMealOrders() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/meal-orders']}>
        <Routes>
          <Route path="/meal-orders" element={<MealOrdersPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Meal Orders Feature (FR-COORD — Behavioral Audit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(coordinationApi, 'getOrders').mockResolvedValue(MOCK_COORDINATION_DATA);
  });

  // Kịch bản 1: Success & Data Display
  it('renders only persisted meal-plan facts and filter controls without unsupported actions', async () => {
    renderMealOrders();
    expect(await screen.findByRole('heading', { name: 'Điều phối đơn ăn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ca 1 (Sáng)' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Phân loại suất ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thực đơn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Món ăn theo thực đơn ca' })).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chốt số lượng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xuất báo cáo/i })).not.toBeInTheDocument();
  });

  // Kịch bản 2: Shift Switching & Parameter Isolation
  it('switches shift tabs and queries coordinationApi with AFTERNOON shift', async () => {
    const user = userEvent.setup();
    const getOrdersSpy = vi.spyOn(coordinationApi, 'getOrders').mockResolvedValue(MOCK_COORDINATION_DATA);

    renderMealOrders();

    const afternoonTab = await screen.findByRole('tab', { name: 'Ca 2 (Chiều)' });
    await user.click(afternoonTab);

    expect(getOrdersSpy).toHaveBeenCalledWith(
      expect.any(String),
      'AFTERNOON',
      'DAV'
    );
  });

  // Kịch bản 3: Empty State Handling
  it('renders clean empty state when no orders exist for the selected scope', async () => {
    vi.spyOn(coordinationApi, 'getOrders').mockResolvedValue({
      serviceDate: '2026-10-18',
      shiftName: 'MORNING',
      customerCode: 'DAV',
      registeredServings: 0,
      actualServings: 0,
      varianceServings: 0,
      attendanceRatePercent: null,
      orders: [],
    });

    renderMealOrders();

    expect(await screen.findByText('Chưa có kế hoạch suất ăn')).toBeInTheDocument();
    expect(screen.getByText('Chưa có kế hoạch suất ăn được chốt cho khách hàng, ngày và ca đã chọn.')).toBeInTheDocument();
  });

  // Kịch bản 4: Error Handling & Retry
  it('fails visibly on API errors and allows retry', async () => {
    const user = userEvent.setup();
    const getOrdersSpy = vi.spyOn(coordinationApi, 'getOrders')
      .mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ điều phối'))
      .mockResolvedValueOnce(MOCK_COORDINATION_DATA);

    renderMealOrders();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối máy chủ điều phối')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);

    expect(await screen.findByText('Khô gà lá chanh')).toBeInTheDocument();
    expect(getOrdersSpy).toHaveBeenCalledTimes(2);
  });
});
