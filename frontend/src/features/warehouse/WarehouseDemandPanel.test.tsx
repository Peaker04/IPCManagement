import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WarehouseDemandPanel } from './WarehouseDemandPanel';

const baseProps = {
  demandSearch: '',
  onDemandSearchChange: vi.fn(),
  requestedDemandDate: null,
  requestedDemandWeek: null,
  isError: false,
  isFetching: false,
  onRetry: vi.fn(),
  lines: [],
  page: 1,
  pageSize: 8,
  totalItems: 0,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  inboxItems: [],
};

describe('WarehouseDemandPanel empty composition', () => {
  it('does not present initial loading as an empty demand result', () => {
    render(<MemoryRouter><WarehouseDemandPanel {...baseProps} isFetching /></MemoryRouter>);

    expect(screen.getByRole('status', { name: 'Đang tải nhu cầu xuất kho...' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa có nhu cầu cần xuất trong phạm vi này.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Đang xem/)).not.toBeInTheDocument();
  });

  it('keeps resolved demand and its pagination focus visible while announcing a refresh', () => {
    const line = {
      id: 'demand-1', material: 'Bún tươi', source: 'ANV', required: 10, available: 10, reserved: 0,
      issuedQty: 10, remainingToIssueQty: 0, unit: 'kg', status: 'Bếp đã nhận', nextAction: 'Theo dõi chứng từ',
      tone: 'success' as const, projection: 'physical-handoff' as const, serviceDate: '2026-08-15',
    };
    const onPageChange = vi.fn();
    const { rerender } = render(<MemoryRouter><WarehouseDemandPanel {...baseProps} onPageChange={onPageChange} lines={[line]} totalItems={16} /></MemoryRouter>);
    const next = screen.getByRole('button', { name: /trang 2 trong/ });
    next.focus();
    rerender(<MemoryRouter><WarehouseDemandPanel {...baseProps} onPageChange={onPageChange} isFetching lines={[line]} page={2} totalItems={16} /></MemoryRouter>);

    expect(screen.getByText('Bún tươi')).toBeInTheDocument();
    expect(screen.getByText('Đang cập nhật nhu cầu xuất kho…')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang danh sách' })).toBeInTheDocument();
    expect(next).toHaveFocus();
    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('distinguishes a truly empty demand scope from a search with no matches', () => {
    const { rerender } = render(<MemoryRouter><WarehouseDemandPanel {...baseProps} /></MemoryRouter>);

    expect(screen.getAllByText('Chưa có nhu cầu cần xuất trong phạm vi này.')).toHaveLength(1);
    rerender(<MemoryRouter><WarehouseDemandPanel {...baseProps} demandSearch="không-khớp" /></MemoryRouter>);
    expect(screen.getByText('Không có nhu cầu khớp bộ lọc.')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có nhu cầu cần xuất trong phạm vi này.')).not.toBeInTheDocument();
  });

  it('keeps workflow inbox actions visible when work exists', () => {
    render(
      <MemoryRouter>
        <WarehouseDemandPanel
          {...baseProps}
          inboxItems={[{
            id: 'warehouse-work-1',
            laneId: 'warehouse',
            title: 'Phiếu xuất cần xử lý',
            description: 'Có chứng từ nguồn',
            due: 'Hôm nay',
            owner: 'Thủ kho',
            nextAction: 'Mở phiếu',
            route: '/warehouse',
            tone: 'warning',
          }]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Mở phiếu' })).toHaveAttribute('href', '/warehouse');
  });
});
