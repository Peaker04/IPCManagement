import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApprovalRulesPage } from '../features/admin/ApprovalRulesPage';
import { AuthProvider } from '../store/authContext';
import { adminApi, type ApprovalRuleItem } from '../api/adminApi';
import { systemApi } from '../api/systemApi';

const RULES: ApprovalRuleItem[] = [{ ruleId: 'r-1', ruleName: 'Duyệt đơn mua hàng giá trị cao', documentType: 'purchase-order', minAmount: 20000000, slaHours: 4, isActive: true }];
function renderPage() { return render(<AuthProvider><MemoryRouter initialEntries={['/settings/approval-rules']}><Routes><Route path="/settings/approval-rules" element={<ApprovalRulesPage />} /></Routes></MemoryRouter></AuthProvider>); }

describe('Approval Rules', () => {
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-10-18T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(adminApi, 'getApprovalRules').mockResolvedValue(RULES);
  });
  it('renders persisted backend rule fields without unsupported create action', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Tên quy tắc' })).toBeInTheDocument();
    expect(screen.getByText('Duyệt đơn mua hàng giá trị cao')).toBeInTheDocument();
    expect(screen.getAllByText('Đơn mua hàng PO').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Thêm quy tắc/i })).not.toBeInTheDocument();
  });
  it('shows API failures', async () => {
    vi.spyOn(adminApi, 'getApprovalRules').mockRejectedValueOnce(new Error('Lỗi tải quy tắc'));
    renderPage();
    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi tải quy tắc')).toBeInTheDocument();
  });
});
