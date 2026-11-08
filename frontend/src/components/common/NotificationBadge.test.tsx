import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotificationBadge } from './NotificationBadge';

describe('NotificationBadge', () => {
  it('renders numeric count correctly', () => {
    render(<NotificationBadge count={5} />);
    const badge = screen.getByRole('status', { name: '5 thông báo' });
    expect(badge).toHaveTextContent('5');
  });

  it('caps number when exceeding max', () => {
    render(<NotificationBadge count={120} max={99} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders unread indicator dot', () => {
    render(<NotificationBadge dot variant="danger" label="Có thông báo mới" />);
    const dot = screen.getByRole('status', { name: 'Có thông báo mới' });
    expect(dot).toHaveClass('rounded-full');
  });

  it('supports semantic variants', () => {
    render(<NotificationBadge count={3} variant="warning" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveClass('tabular-nums');
  });
});
