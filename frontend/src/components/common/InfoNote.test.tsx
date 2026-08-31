import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { InfoNote } from './InfoNote';
import { SectionPanel } from './SectionPanel';

describe('InfoNote', () => {
  it('renders info trigger icon button with accessible aria-label', () => {
    render(<InfoNote content="Hướng dẫn thao tác kho" ariaLabel="Xem hướng dẫn kho" />);
    const button = screen.getByRole('button', { name: 'Xem hướng dẫn kho' });
    expect(button).toBeInTheDocument();
  });

  it('opens popover popup with title and content when clicked', async () => {
    const user = userEvent.setup();
    render(
      <InfoNote
        title="Quy trình nhập kho"
        content="Tạo phiếu → kiểm tra chất lượng → Quản lý duyệt"
      />
    );

    const button = screen.getByRole('button', { name: 'Xem hướng dẫn' });
    await user.click(button);

    expect(await screen.findByText('Quy trình nhập kho')).toBeInTheDocument();
    expect(screen.getByText('Tạo phiếu → kiểm tra chất lượng → Quản lý duyệt')).toBeInTheDocument();
  });

  it('renders InfoNote inside SectionPanel by default when description is provided', async () => {
    const user = userEvent.setup();
    render(
      <SectionPanel
        title="Đơn mua chờ nhập kho"
        description="Chọn đúng đơn và dòng thực nhận để đối chiếu số lượng thực tế từ nhà cung cấp."
      >
        <div>Content</div>
      </SectionPanel>
    );

    // Title should be present
    expect(screen.getByText('Đơn mua chờ nhập kho')).toBeInTheDocument();

    // Trigger button should be rendered next to title
    const infoButton = screen.getByRole('button', { name: 'Xem hướng dẫn' });
    expect(infoButton).toBeInTheDocument();

    // Click trigger and verify popover note displays
    await user.click(infoButton);
    expect(
      await screen.findByText(
        'Chọn đúng đơn và dòng thực nhận để đối chiếu số lượng thực tế từ nhà cung cấp.'
      )
    ).toBeInTheDocument();
  });

  it('renders actions slot inline in the SectionPanel header', () => {
    render(
      <SectionPanel
        title="Bảng dữ liệu"
        actions={<input placeholder="Tìm kiếm nhanh..." aria-label="Tìm kiếm nhanh" />}
      >
        <div>Nội dung bảng</div>
      </SectionPanel>
    );

    expect(screen.getByText('Bảng dữ liệu')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm kiếm nhanh...')).toBeInTheDocument();
  });
});
