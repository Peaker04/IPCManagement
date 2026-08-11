import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableViewport } from './TableViewport';

describe('TableViewport', () => {
  it('associates its semantic caption with the scroll region', () => {
    render(
      <TableViewport ariaLabel="Bảng kiểm tra" caption="Danh sách bản ghi">
        <table>
          <tbody>
            <tr><td>Bản ghi 1</td></tr>
          </tbody>
        </table>
      </TableViewport>,
    );

    const region = screen.getByRole('region', { name: 'Bảng kiểm tra' });
    const description = screen.getByText('Danh sách bản ghi');

    expect(region).toHaveAttribute('aria-describedby', description.id);
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('data-table-viewport', 'true');
    expect(region).toHaveAttribute('data-density', 'standard');
    expect(region).toHaveAttribute('data-sticky-header', 'true');
    expect(region).toHaveAttribute('data-frozen-identifier', 'true');
    expect(region).toHaveClass('ipc-table-viewport', 'min-w-0', 'overflow-auto', 'overscroll-x-contain');
  });

  it('does not add a dangling description when no caption is provided', () => {
    render(<TableViewport ariaLabel="Bảng không có mô tả"><div>Nội dung</div></TableViewport>);

    expect(screen.getByRole('region', { name: 'Bảng không có mô tả' })).not.toHaveAttribute('aria-describedby');
  });

  it('allows documented structural matrices to opt out of frozen sticky chrome', () => {
    render(<TableViewport ariaLabel="Ma trận" density="compact" stickyHeader={false} frozenFirstIdentifier={false}><div>Nội dung</div></TableViewport>);

    const region = screen.getByRole('region', { name: 'Ma trận' });
    expect(region).toHaveAttribute('data-density', 'compact');
    expect(region).toHaveAttribute('data-sticky-header', 'false');
    expect(region).toHaveAttribute('data-frozen-identifier', 'false');
  });
});
