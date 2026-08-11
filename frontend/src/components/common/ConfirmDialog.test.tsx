import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('dispatches the explicit confirm and cancel actions', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        title="Ngừng áp dụng dòng BOM?"
        description="Dữ liệu vẫn còn trong lịch sử/audit."
        confirmLabel="Ngừng áp dụng"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Ngừng áp dụng dòng BOM?' })).toHaveTextContent('Dữ liệu vẫn còn trong lịch sử/audit.');

    await user.click(screen.getByRole('button', { name: 'Ngừng áp dụng' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'close-control');
  });

  it('blocks both actions while the confirmation is busy', () => {
    render(
      <ConfirmDialog
        open
        busy
        title="Ngừng áp dụng dòng BOM?"
        description="Dữ liệu vẫn còn trong lịch sử/audit."
        confirmLabel="Ngừng áp dụng"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled();
  });

  it('supports contextual busy copy without changing the default contract', () => {
    render(
      <ConfirmDialog
        open
        busy
        ariaLabel="Xác nhận xóa quy tắc duyệt"
        busyLabel="Đang xóa..."
        title="Xóa quy tắc duyệt?"
        description="Quy tắc sẽ không còn áp dụng cho chứng từ mới."
        confirmLabel="Xóa quy tắc"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Xóa quy tắc duyệt?' })).toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('button', { name: 'Đang xóa...' })).toBeDisabled();
  });
});
