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
    expect(region).toHaveClass('ipc-table-viewport', 'min-w-0', 'overflow-auto', 'overscroll-x-contain');
  });

  it('does not add a dangling description when no caption is provided', () => {
    render(<TableViewport ariaLabel="Bảng không có mô tả"><div>Nội dung</div></TableViewport>);

    expect(screen.getByRole('region', { name: 'Bảng không có mô tả' })).not.toHaveAttribute('aria-describedby');
  });
});
