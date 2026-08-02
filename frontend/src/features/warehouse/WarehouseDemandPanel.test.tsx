import { render, screen } from '@testing-library/react';
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
  inboxItems: [],
};

describe('WarehouseDemandPanel empty composition', () => {
  it('renders one contextual empty state when demand and inbox are both empty', () => {
    render(<MemoryRouter><WarehouseDemandPanel {...baseProps} /></MemoryRouter>);

    expect(screen.getAllByText('Chưa có dữ liệu để hiển thị')).toHaveLength(1);
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
