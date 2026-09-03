import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TableViewport } from './TableViewport';
import {
  readTablePreferences,
  resetTablePreferences,
  tablePreferenceOwnerRegistry,
  writeTablePreferences,
  type TableDensity,
  type TablePreferenceColumn,
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
    expect(region).toHaveAttribute('data-vertical-scroll', 'page');
  });

  it('does not add a dangling description when no caption is provided', () => {
    render(<TableViewport ariaLabel="Bảng không có mô tả"><div>Nội dung</div></TableViewport>);

    expect(screen.getByRole('region', { name: 'Bảng không có mô tả' })).not.toHaveAttribute('aria-describedby');
  });

  it('does not manufacture blank row capacity for paginated tables', () => {
    render(<TableViewport ariaLabel="Bảng phân trang theo nội dung thật"><table><tbody><tr><td>Một dòng</td></tr></tbody></table></TableViewport>);

    const region = screen.getByRole('region', { name: 'Bảng phân trang theo nội dung thật' });
    expect(region).not.toHaveAttribute('data-row-capacity');
    expect(region).toHaveAttribute('data-vertical-scroll', 'page');
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

  it('contains preferences in a labelled toolbar and persists density from the popover', async () => {
    const user = userEvent.setup();
    render(
      <TableViewport ariaLabel="Bảng có tùy chỉnh" caption="Dữ liệu thử nghiệm" preferences={{ accountId: 'account-a', config: preferenceConfig }}>
        {({ columns }) => (
          <table>
            <tbody>
              <tr>{columns.map((column) => <td key={column.id}>{column.label}</td>)}</tr>
            </tbody>
          </table>
        )}
      </TableViewport>,
    );

    const region = screen.getByRole('region', { name: 'Bảng có tùy chỉnh' });
    const toolbar = screen.getByRole('toolbar', { name: 'Tùy chỉnh bảng' });
    const trigger = await within(toolbar).findByRole('button', { name: 'Tùy chỉnh bảng' }, { timeout: 5000 });
    expect(region).not.toContainElement(trigger);
    expect(region).toContainElement(screen.getByRole('table'));
    expect(region).toHaveClass('overflow-auto');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole('heading', { name: 'Cột hiển thị' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mật độ hàng' })).toBeVisible();
    expect(region).not.toContainElement(screen.getByRole('checkbox', { name: 'Trạng thái' }));
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual(['Gọn', 'Tiêu chuẩn', 'Thoáng']);

    radios[1].focus();
    await user.keyboard('{ArrowDown}');
    expect(region).toHaveAttribute('data-density', 'comfortable');
    expect(window.localStorage.getItem('ipc.table-preferences.v1:account-a:unit-table')).toContain('"density":"comfortable"');
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu tùy chỉnh bảng');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { name: 'Cột hiển thị' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Đóng tùy chỉnh bảng' }));
    expect(trigger).toHaveFocus();
  });

  it('protects locked reorder boundaries and restores default preferences', async () => {
    const user = userEvent.setup();
    const renderedColumns = ({ columns, density }: { columns: TablePreferenceColumn[]; density: TableDensity }) => (
      <div data-columns={columns.map((column) => column.id).join(',')} data-rendered-density={density}>
        {columns.map((column) => <span key={column.id}>{column.label}</span>)}
      </div>
    );
    const firstRender = render(
      <TableViewport ariaLabel="Bảng sắp xếp" preferences={{ accountId: 'account-a', config: preferenceConfig }}>
        {renderedColumns}
      </TableViewport>,
    );
    const region = screen.getByRole('region', { name: 'Bảng sắp xếp' });

    await user.click(await screen.findByRole('button', { name: 'Tùy chỉnh bảng' }, { timeout: 5000 }));
    const upStatus = screen.getByRole('button', { name: 'Đưa Trạng thái lên' });
    const downCost = screen.getByRole('button', { name: 'Đưa Chi phí xuống' });
    expect(screen.queryByRole('button', { name: 'Đưa Định danh lên' })).not.toBeInTheDocument();
    expect(upStatus).toBeDisabled();
    expect(downCost).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Đưa Trạng thái xuống' }));
    expect(screen.getByText((_, element) => element?.getAttribute('data-columns') === 'identity,cost,status')).toBeInTheDocument();
    expect(window.localStorage.getItem('ipc.table-preferences.v1:account-a:unit-table')).toContain('"columnIds":["identity","cost","status"]');

    await user.click(screen.getByRole('checkbox', { name: 'Chi phí' }));
    await user.click(screen.getByRole('radio', { name: 'Thoáng' }));
    expect(within(region).queryByText('Chi phí')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('ipc.table-preferences.v1:account-a:unit-table')).toContain('"hiddenColumnIds":["cost"]');

    firstRender.unmount();
    render(
      <TableViewport ariaLabel="Bảng sắp xếp đã tải lại" preferences={{ accountId: 'account-a', config: preferenceConfig }}>
        {renderedColumns}
      </TableViewport>,
    );
    const reloadedRegion = screen.getByRole('region', { name: 'Bảng sắp xếp đã tải lại' });
    expect(within(reloadedRegion).queryByText('Chi phí')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Tùy chỉnh bảng' }, { timeout: 5000 }));
    await user.click(screen.getByRole('button', { name: 'Khôi phục mặc định' }));
    expect(within(reloadedRegion).getByText('Chi phí')).toBeInTheDocument();
    expect(within(reloadedRegion).getByText((_, element) => element?.getAttribute('data-columns') === 'identity,status,cost')).toBeInTheDocument();
    expect(within(reloadedRegion).getByText((_, element) => element?.getAttribute('data-rendered-density') === 'standard')).toBeInTheDocument();
    expect(window.localStorage.getItem('ipc.table-preferences.v1:account-a:unit-table')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Đã khôi phục tùy chỉnh bảng mặc định');
  });
});
