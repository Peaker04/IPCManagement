import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MealOrdersPage } from '../features/coordination/MealOrdersPage';
import { AuthProvider } from '../store/authContext';
import { coordinationApi } from '../api/coordinationApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_COORDINATION_DATA } from '../test/fixtures';

function renderMealOrders() {
  return render(<AuthProvider><MemoryRouter initialEntries={['/meal-orders']}><Routes><Route path="/meal-orders" element={<MealOrdersPage />} /></Routes></MemoryRouter></AuthProvider>);
}

describe('Meal Orders Feature', () => {
  beforeEach(() => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]);
    vi.spyOn(coordinationApi, 'getOrders').mockResolvedValue(MOCK_COORDINATION_DATA);
  });

  it('renders only persisted meal-plan facts and filter controls', async () => {
    renderMealOrders();
    expect(await screen.findByRole('heading', { name: 'Điều phối đơn ăn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ca 1 (Sáng)' })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Phân loại suất ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Thực đơn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Món ăn persisted' })).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chốt số lượng/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xuất báo cáo/i })).not.toBeInTheDocument();
  });

  it('fails visibly on API errors', async () => {
    vi.spyOn(coordinationApi, 'getOrders').mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ điều phối'));
    renderMealOrders();
    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối máy chủ điều phối')).toBeInTheDocument();
  });
});
