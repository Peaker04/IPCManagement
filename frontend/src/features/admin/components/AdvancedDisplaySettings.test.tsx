import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/common';
import {
  defaultNavigationPreferences,
  defaultPageTabPreferences,
  NAVIGATION_PREFERENCES_STORAGE_KEY,
  readNavigationPreferences,
  readPageTabPreferences,
} from '@/lib/navigationPreferences';
import { AdvancedDisplaySettings } from './AdvancedDisplaySettings';

const renderComponent = () => {
  return render(
    <ToastProvider>
      <AdvancedDisplaySettings />
    </ToastProvider>
  );
};

describe('AdvancedDisplaySettings Component', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders all 10 main navigation items and summary counters', () => {
    renderComponent();

    expect(screen.getByText('10/10 menu đang bật')).toBeInTheDocument();

    const expectedItems = [
      'Tổng quan',
      'Thực đơn tuần',
      'Điều phối suất ăn',
      'Duyệt vận hành',
      'Thu mua',
      'Kho nguyên liệu',
      'Bếp trưởng',
      'Báo cáo vận hành',
      'Quản trị dữ liệu',
      'Thiết lập quy trình duyệt',
    ];

    for (const item of expectedItems) {
      expect(screen.getByRole('switch', { name: new RegExp(`^${item}, đang hiện`) })).toBeInTheDocument();
    }
  });

  it('toggles a navigation item and persists to localStorage', async () => {
    const user = userEvent.setup();
    renderComponent();

    const reportsSwitch = screen.getByRole('switch', { name: /Báo cáo vận hành, đang hiện/i });
    expect(reportsSwitch).toBeInTheDocument();
    expect(reportsSwitch).toHaveAttribute('aria-checked', 'true');

    await user.click(reportsSwitch);

    expect(screen.getByText('9/10 menu đang bật')).toBeInTheDocument();
    expect(readNavigationPreferences(window.localStorage).reports).toBe(false);

    // Click again to turn back on
    const reportsSwitchHidden = screen.getByRole('switch', { name: /Báo cáo vận hành, đang ẩn/i });
    expect(reportsSwitchHidden).toHaveAttribute('aria-checked', 'false');
    await user.click(reportsSwitchHidden);

    expect(screen.getByText('10/10 menu đang bật')).toBeInTheDocument();
    expect(readNavigationPreferences(window.localStorage).reports).toBe(true);
  });

  it('guards against turning off all navigation items', async () => {
    const user = userEvent.setup();
    // Pre-populate with only 1 item visible
    const almostAllDisabled = Object.keys(defaultNavigationPreferences).reduce((acc, key) => {
      acc[key as keyof typeof defaultNavigationPreferences] = key === 'dashboard';
      return acc;
    }, {} as typeof defaultNavigationPreferences);

    window.localStorage.setItem(
      NAVIGATION_PREFERENCES_STORAGE_KEY,
      JSON.stringify(almostAllDisabled)
    );

    renderComponent();

    expect(screen.getByText('1/10 menu đang bật')).toBeInTheDocument();

    const dashboardSwitch = screen.getByRole('switch', { name: /Tổng quan, đang hiện/i });
    await user.click(dashboardSwitch);

    // Should remain 1/10 and trigger toast warning
    expect(screen.getByText('1/10 menu đang bật')).toBeInTheDocument();
    expect(readNavigationPreferences(window.localStorage).dashboard).toBe(true);
    expect(screen.getByText('Không thể ẩn')).toBeInTheDocument();
    expect(screen.getByText('Phải giữ lại ít nhất 1 khu vực hiển thị trên thanh menu.')).toBeInTheDocument();
  });

  it('expands tab groups and allows toggling tabs', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Click on "Thực đơn tuần" accordion header
    const weeklyMenuGroup = screen.getByRole('button', { name: /Thực đơn tuần/i });
    await user.click(weeklyMenuGroup);

    // Check that child tabs are visible
    expect(screen.getByText('Kế hoạch tuần')).toBeInTheDocument();
    expect(screen.getByText('Nguyên liệu món')).toBeInTheDocument();

    // Toggle off "Nguyên liệu món"
    const dishMaterialsSwitch = screen.getByRole('switch', {
      name: /Thực đơn tuần, Nguyên liệu món, đang hiện/i,
    });
    await user.click(dishMaterialsSwitch);

    expect(readPageTabPreferences(window.localStorage)['weekly-menu']['dish-materials']).toBe(false);
  });

  it('allows expanding all and collapsing all tab groups', async () => {
    const user = userEvent.setup();
    renderComponent();

    const expandAllButton = screen.getByRole('button', { name: 'Mở rộng tất cả' });
    await user.click(expandAllButton);

    // All groups should now be expanded
    expect(screen.getByText('Kế hoạch tuần')).toBeInTheDocument();
    expect(screen.getByText('Nhập/xuất kho')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu gọn tất cả' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Thu gọn tất cả' }));
    expect(screen.queryByText('Kế hoạch tuần')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog on "Khôi phục mặc định" and resets on confirm', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Disable one nav item
    await user.click(screen.getByRole('switch', { name: /Tổng quan, đang hiện/i }));
    expect(screen.getByText('9/10 menu đang bật')).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: /Khôi phục mặc định/i });
    await user.click(resetButton);

    // Confirmation dialog should be visible
    expect(screen.getByText('Khôi phục thiết lập mặc định?')).toBeInTheDocument();
    expect(
      screen.getByText('Toàn bộ các mục trên menu chính và tất cả tab chức năng sẽ được hiển thị lại đầy đủ.')
    ).toBeInTheDocument();

    // Test cancelling
    const cancelButton = screen.getByRole('button', { name: 'Hủy' });
    await user.click(cancelButton);

    // State should still be 9/10
    expect(screen.getByText('9/10 menu đang bật')).toBeInTheDocument();
    expect(readNavigationPreferences(window.localStorage).dashboard).toBe(false);

    // Reopen and confirm
    await user.click(screen.getByRole('button', { name: /Khôi phục mặc định/i }));
    const dialogConfirmButton = screen.getAllByRole('button', { name: 'Khôi phục mặc định' })[1];
    await user.click(dialogConfirmButton);

    expect(screen.getByText('10/10 menu đang bật')).toBeInTheDocument();
    expect(readNavigationPreferences(window.localStorage)).toEqual(defaultNavigationPreferences);
    expect(readPageTabPreferences(window.localStorage)).toEqual(defaultPageTabPreferences);
    expect(screen.getByText('Đã khôi phục mặc định')).toBeInTheDocument();
  });

  it('guards against disabling the last remaining tab in a page tab group', async () => {
    const user = userEvent.setup();
    // Pre-populate with only 1 tab visible in 'chef' group ('production')
    const customTabPrefs = structuredClone(defaultPageTabPreferences);
    customTabPrefs.chef = { production: true, documents: false };
    window.localStorage.setItem('ipc.page-tab-preferences.v1', JSON.stringify(customTabPrefs));

    renderComponent();

    // Expand Chef group
    const chefGroup = screen.getByRole('button', { name: /Bếp trưởng/i });
    await user.click(chefGroup);

    // Try to disable the only active tab ('production')
    const productionSwitch = screen.getByRole('switch', {
      name: /Bếp trưởng, Ca sản xuất, đang hiện/i,
    });
    await user.click(productionSwitch);

    // Should remain true and show toast
    expect(readPageTabPreferences(window.localStorage).chef.production).toBe(true);
    expect(screen.getByText('Không thể ẩn')).toBeInTheDocument();
    expect(screen.getByText('Mỗi trang nghiệp vụ phải giữ lại ít nhất 1 tab hiển thị.')).toBeInTheDocument();
  });
});
