import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AuthProvider } from '../store/authContext';
import { adminApi } from '../api/adminApi';

function renderPage() { return render(<AuthProvider><MemoryRouter initialEntries={['/admin-data']}><Routes><Route path="/admin-data" element={<AdminDataPage />} /></Routes></MemoryRouter></AuthProvider>); }
describe('Admin Data', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'getIngredients').mockResolvedValue([{ ingredientId: 'i1', ingredientCode: 'NL-1', ingredientName: 'Gạo', unitName: 'Kilogram', referencePrice: 20000, isActive: true }]);
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue([{ dishId: 'd1', dishCode: 'MON-1', dishName: 'Cơm', dishGroup: undefined, isActive: true }]);
  });
  it('renders authoritative catalog fields without fabricated HACCP or unsupported create action', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Gạo')).toBeInTheDocument();
    expect(screen.queryByText(/Đạt chuẩn HACCP/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm nguyên liệu/i })).not.toBeInTheDocument();
  });
  it('shows API errors', async () => {
    vi.spyOn(adminApi, 'getIngredients').mockRejectedValueOnce(new Error('Lỗi danh mục'));
    renderPage();
    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi danh mục')).toBeInTheDocument();
  });
});
