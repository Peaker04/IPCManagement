import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QueryView } from '@/lib/queryView';
import { AdminQueryBoundary } from './AdminQueryBoundary';

const ready = (isRefreshing = false): QueryView<unknown> => ({
  phase: 'ready',
  data: [],
  isRefreshing,
  truncation: null,
});

const renderBoundary = (views: QueryView<unknown>[]) => render(
  <AdminQueryBoundary queries={views.map((view, index) => ({ label: `nguồn ${index + 1}`, view }))}>
    <div>Kết quả quản trị</div>
  </AdminQueryBoundary>,
);

describe('AdminQueryBoundary', () => {
  it('keeps an uninitialized query distinct from an empty result', () => {
    renderBoundary([{ phase: 'uninitialized', instruction: 'Chọn phạm vi trước.' }]);

    expect(screen.getByText('Chọn phạm vi trước.')).toBeInTheDocument();
    expect(screen.queryByText('Kết quả quản trị')).toBeNull();
  });

  it('renders loading without exposing children as a false empty state', () => {
    renderBoundary([{ phase: 'loading' }]);

    expect(screen.getByText('Đang tải nguồn 1')).toBeInTheDocument();
    expect(screen.queryByText('Kết quả quản trị')).toBeNull();
  });

  it('renders forbidden without a retry action', () => {
    renderBoundary([{ phase: 'forbidden', message: 'Không có quyền.' }]);

    expect(screen.getByRole('alert')).toHaveTextContent('Không có quyền.');
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull();
    expect(screen.queryByText('Kết quả quản trị')).toBeNull();
  });

  it('keeps a non-forbidden error retryable', () => {
    const retry = vi.fn();
    renderBoundary([{ phase: 'error', message: 'Máy chủ không phản hồi.', retry, isRetrying: false }]);

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Kết quả quản trị')).toBeNull();
  });

  it('renders children for an authoritative ready-empty result', () => {
    renderBoundary([ready()]);

    expect(screen.getByText('Kết quả quản trị')).toBeInTheDocument();
  });

  it('keeps ready children visible while refreshing', () => {
    renderBoundary([ready(true)]);

    expect(screen.getByText('Kết quả quản trị')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật dữ liệu quản trị')).toBeInTheDocument();
  });

  it('blocks the whole group when one required query fails', () => {
    renderBoundary([
      ready(),
      { phase: 'error', message: 'Nguồn phụ bị lỗi.', retry: vi.fn(), isRetrying: false },
    ]);

    expect(screen.getByText(/Nguồn phụ bị lỗi/)).toBeInTheDocument();
    expect(screen.queryByText('Kết quả quản trị')).toBeNull();
  });
});
