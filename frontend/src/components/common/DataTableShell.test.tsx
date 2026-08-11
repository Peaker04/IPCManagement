import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTableShell } from './DataTableShell';

describe('DataTableShell', () => {
  it('preserves the legacy shell contract while callers are migrated', () => {
    render(
      <DataTableShell className="custom-shell" ariaLabel="Bảng kiểm tra">
        <table>
          <caption>Dữ liệu kiểm tra</caption>
          <tbody>
            <tr>
              <td>Một dòng</td>
            </tr>
          </tbody>
        </table>
      </DataTableShell>,
    );

    const region = screen.getByRole('region', { name: 'Bảng kiểm tra' });
    expect(region).toHaveClass('ipc-table-shell', 'w-full', 'overflow-x-auto', 'custom-shell');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('data-ui-table-shell', 'true');
    expect(region).toHaveAttribute('data-density', 'standard');
    expect(region).toHaveAttribute('data-sticky-header', 'true');
    expect(region).toHaveAttribute('data-frozen-identifier', 'true');
    expect(region.querySelector('table')).not.toBeNull();
  });

  it('uses the Vietnamese fallback label when no accessible name is provided', () => {
    render(
      <DataTableShell>
        <table>
          <tbody>
            <tr>
              <td>Trống</td>
            </tr>
          </tbody>
        </table>
      </DataTableShell>,
    );

    expect(screen.getByRole('region', { name: 'Bảng dữ liệu có thể cuộn' })).toBeInTheDocument();
  });

  it('forwards the shared presentation contract without owning preference state', () => {
    render(<DataTableShell ariaLabel="Bảng thoải mái" density="comfortable" stickyHeader={false} frozenFirstIdentifier={false}><table /></DataTableShell>);

    const region = screen.getByRole('region', { name: 'Bảng thoải mái' });
    expect(region).toHaveAttribute('data-density', 'comfortable');
    expect(region).toHaveAttribute('data-sticky-header', 'false');
    expect(region).toHaveAttribute('data-frozen-identifier', 'false');
  });
});
