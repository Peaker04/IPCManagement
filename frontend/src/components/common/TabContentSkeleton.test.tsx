import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TabContentSkeleton } from './TabContentSkeleton';

describe('TabContentSkeleton', () => {
  it('renders default table skeleton layout with status role and custom message', () => {
    render(<TabContentSkeleton message="Đang tải dữ liệu kho..." />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đang tải dữ liệu kho...')).toBeInTheDocument();
  });

  it('renders split workbench variant for master-detail views', () => {
    render(<TabContentSkeleton variant="split" message="Đang tải hàng chờ duyệt..." />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(screen.getByText('Đang tải hàng chờ duyệt...')).toBeInTheDocument();
  });

  it('customizes rows and columns in table skeleton', () => {
    const { container } = render(<TabContentSkeleton rows={8} columns={4} />);
    const columnHeaders = container.querySelectorAll('[role="columnheader"]');
    expect(columnHeaders).toHaveLength(4);
    const bodyRows = container.querySelectorAll('[role="rowgroup"]:last-of-type > [role="row"]');
    expect(bodyRows).toHaveLength(8);
  });
});
