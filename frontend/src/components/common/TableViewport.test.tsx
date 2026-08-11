import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableViewport } from './TableViewport';
import {
  readTablePreferences,
  resetTablePreferences,
  tablePreferenceOwnerRegistry,
  writeTablePreferences,
  type TablePreferenceConfig,
} from './tablePreferences';

const preferenceConfig: TablePreferenceConfig = {
  tableId: 'unit-table',
  columns: [
    { id: 'identity', label: 'Định danh', locked: true },
    { id: 'status', label: 'Trạng thái' },
    { id: 'cost', label: 'Chi phí' },
  ],
};

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

  it('isolates validated account and table preferences, then resets safely', () => {
    const defaultState = readTablePreferences('account-a', preferenceConfig);
    expect(defaultState).toEqual({ columnIds: ['identity', 'status', 'cost'], hiddenColumnIds: [], density: 'standard' });

    writeTablePreferences('account-a', preferenceConfig, { columnIds: ['identity', 'cost', 'status'], hiddenColumnIds: ['cost'], density: 'comfortable' });
    expect(readTablePreferences('account-a', preferenceConfig)).toEqual({ columnIds: ['identity', 'cost', 'status'], hiddenColumnIds: ['cost'], density: 'comfortable' });
    expect(readTablePreferences('account-b', preferenceConfig)).toEqual(defaultState);

    resetTablePreferences('account-a', preferenceConfig);
    expect(readTablePreferences('account-a', preferenceConfig)).toEqual(defaultState);
  });

  it('fails closed for malformed persisted preferences and a hidden or moved identifying column', () => {
    const key = 'ipc.table-preferences.v1:account-a:unit-table';
    window.localStorage.setItem(key, '{not-json');
    expect(readTablePreferences('account-a', preferenceConfig)).toEqual({ columnIds: ['identity', 'status', 'cost'], hiddenColumnIds: [], density: 'standard' });

    window.localStorage.setItem(key, JSON.stringify({ version: 1, columnIds: ['status', 'identity', 'cost'], hiddenColumnIds: ['identity'], density: 'dense' }));
    expect(readTablePreferences('account-a', preferenceConfig)).toEqual({ columnIds: ['identity', 'status', 'cost'], hiddenColumnIds: [], density: 'standard' });
  });

  it('keeps every operational table owner source-closed and only exposes the approved callsites', () => {
    const ownerIds = tablePreferenceOwnerRegistry.map((owner) => owner.id);
    expect(new Set(ownerIds).size).toBe(ownerIds.length);
    expect(tablePreferenceOwnerRegistry.filter((owner) => owner.disposition === 'customizable').map((owner) => owner.id)).toEqual([
      'admin-audit',
      'service-run-report',
    ]);
    expect(tablePreferenceOwnerRegistry.filter((owner) => owner.disposition === 'exception').every((owner) => owner.reason)).toBe(true);
  });
});
