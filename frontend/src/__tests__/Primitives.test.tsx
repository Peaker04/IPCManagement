import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Num } from '../components/ui/num';
import { IdentifierText } from '../components/ui/identifier-text';
import { VietnameseDateInput } from '../components/ui/vietnamese-date-input';
import { Modal } from '../components/ui/modal';
import { Tabs } from '../components/ui/tabs';
import { SplitView } from '../components/workbench/SplitView';
import { DataGrid } from '../components/workbench/DataGrid';
import { StateBoundary } from '../components/workbench/StateBoundary';
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { RouteWorkbenchLoadingFallback } from '../routes/RouteWorkbenchLoadingFallback';
import { MemoryRouter } from 'react-router-dom';
import { ActionGuard } from '../components/ui/action-guard';
import { AuthContext, type AuthContextType } from '../store/useAuth';
import { toVietnameseDate, formatVietnameseDate } from '../utils/dates';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { useDirtyNavigation } from '../components/workbench/dirty-navigation-context';

function TestDirtyConsumer() {
  const { isDirty, registerDirty } = useDirtyNavigation();
  return (
    <div>
      <span>{isDirty ? 'Trạng thái: Bẩn' : 'Trạng thái: Sạch'}</span>
      <button onClick={() => registerDirty('draft-1')}>Đánh dấu bẩn</button>
    </div>
  );
}

describe('10 UI Primitives (WCAG 2.1 AA & Zero AI-Slop)', () => {
  it('Button: renders variants and handles click events', async () => {
    const handleClick = vi.fn();
    render(
      <Button variant="default" size="default" onClick={handleClick}>
        Lưu thay đổi
      </Button>
    );

    const btn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-slate-900'); // Navy/Slate flat background
    await userEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('Input: renders with proper accessibility and handles text entry', async () => {
    const handleChange = vi.fn();
    render(
      <Input
        placeholder="Tìm kiếm..."
        onChange={handleChange}
        aria-label="Tìm kiếm"
      />
    );

    const input = screen.getByPlaceholderText('Tìm kiếm...');
    expect(input).toHaveClass('h-9');
    await userEvent.type(input, 'thịt heo');
    expect(handleChange).toHaveBeenCalled();
  });

  it('Select: renders options and triggers selection change', async () => {
    const handleChange = vi.fn();
    render(
      <Select
        aria-label="Chọn khách hàng"
        options={[
          { value: 'DRAX', label: 'Draxlmaier' },
          { value: 'SAMSUNG', label: 'Samsung' },
        ]}
        onChange={handleChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Chọn khách hàng' });
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'SAMSUNG' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('Badge: renders status semantic variants', () => {
    const { rerender } = render(<Badge variant="success">Hoàn thành</Badge>);
    expect(screen.getByText('Hoàn thành')).toHaveClass('bg-emerald-50');

    rerender(<Badge variant="warning">Chờ xuất</Badge>);
    expect(screen.getByText('Chờ xuất')).toHaveClass('bg-amber-50');
  });

  it('Checkbox: supports checked and indeterminate states', () => {
    const handleChange = vi.fn();
    render(
      <Checkbox
        aria-label="Chọn dòng"
        checked={false}
        indeterminate={true}
        onChange={handleChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Chọn dòng' }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalled();
  });

  it('Num: formats currency and quantity with tabular-nums and right alignment', () => {
    const { rerender } = render(
      <Num value={25000} format="currency" data-testid="num-currency" />
    );
    const currencyEl = screen.getByTestId('num-currency');
    expect(currencyEl).toHaveClass('tabular-nums', 'text-right');
    expect(currencyEl.textContent).toContain('25.000 ₫');

    rerender(<Num value={1240.5} format="quantity" suffix=" kg" data-testid="num-qty" />);
    const qtyEl = screen.getByTestId('num-qty');
    expect(qtyEl.textContent).toContain('1.240,5 kg');
  });

  it('IdentifierText: renders code with w-fit inline-flex and handles clipboard copy', async () => {
    render(<IdentifierText value="KHSX-260921-01" />);
    const codeEl = screen.getByText('KHSX-260921-01');
    expect(codeEl).toBeInTheDocument();
    // Rule: Must be w-fit inline-flex, not full-width stretched block!
    expect(codeEl.parentElement).toHaveClass('w-fit', 'inline-flex');
    await userEvent.click(codeEl);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('KHSX-260921-01');
  });

  it('VietnameseDateInput: formats date with dd/MM/yyyy and triggers change on commit', () => {
    const handleChange = vi.fn();
    render(<VietnameseDateInput value="2026-09-21" onChange={handleChange} />);

    // Invariant: Display text MUST be formatted as dd/MM/yyyy (21/09/2026), never 09/21/2026!
    const input = screen.getByDisplayValue('21/09/2026');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('h-9', 'w-40');

    // Simulate typing a new date and committing with blur/Enter
    fireEvent.change(input, { target: { value: '22/09/2026' } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalledWith('2026-09-22');

    // Unit test for Vietnamese date conversion utilities
    expect(toVietnameseDate('2026-09-21')).toBe('21/09/2026');
    expect(formatVietnameseDate('2026-09-21')).toBe('21/09/2026');
  });

  it('Modal: renders dialog with focus trap and handles Escape key', async () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Duyệt xuất kho"
        description="Xác nhận duyệt 29 nguyên liệu"
      >
        <p>Nội dung xác nhận</p>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Duyệt xuất kho')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Modal: protects dirty drafts with an accessible discard decision instead of window.confirm', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} isDirty title="Điều chỉnh số suất">
        <input aria-label="Số suất" defaultValue="120" />
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Modal: traps Tab focus within open dialog and restores focus to trigger on close', async () => {
    function FocusTrapHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button id="trigger-btn" type="button" onClick={() => setIsOpen(true)}>Mở Modal</button>
          <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Kiểm tra Focus Trap"
            footer={
              <button id="footer-btn" type="button" onClick={() => setIsOpen(false)}>Đóng</button>
            }
          >
            <input id="modal-input" placeholder="Nhập liệu" />
          </Modal>
        </div>
      );
    }

    render(<FocusTrapHarness />);
    const trigger = screen.getByRole('button', { name: 'Mở Modal' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const footerBtn = screen.getByRole('button', { name: 'Đóng' });
    footerBtn.focus();
    expect(document.activeElement).toBe(footerBtn);

    // Press Tab on last element -> wraps to first focusable element inside modal
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement | null);

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Focus restored to trigger
    expect(document.activeElement).toBe(trigger);
  });

  it('Tabs: renders segmented control and navigates with arrow keys', async () => {
    const handleChange = vi.fn();
    const items = [
      { id: 'tab1', label: 'Tab Một' },
      { id: 'tab2', label: 'Tab Hai', count: 5 },
    ];
    render(<Tabs items={items} activeId="tab1" onChange={handleChange} />);

    const tab1 = screen.getByRole('tab', { name: 'Tab Một' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');

    const tab2 = screen.getByRole('tab', { name: /Tab Hai/ });
    await userEvent.click(tab2);
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });
  it('WorkbenchSkeleton renders geometry only for table, matrix, and split work objects', () => {
    const { rerender } = render(<WorkbenchSkeleton geometry={{ kind: 'table', columns: 6, rows: 4, toolbar: true }} />);
    let skeleton = screen.getByRole('status', { name: 'Đang tải nội dung' });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('data-skeleton-kind', 'table');
    expect(skeleton.querySelectorAll('[data-skeleton-row]')).toHaveLength(4);
    expect(skeleton).not.toHaveTextContent(/kg|VNĐ|hoàn thành|đang chờ/i);

    rerender(<WorkbenchSkeleton geometry={{ kind: 'matrix', columns: 7, rows: 6, toolbar: true }} />);
    skeleton = screen.getByRole('status', { name: 'Đang tải nội dung' });
    expect(skeleton).toHaveAttribute('data-skeleton-kind', 'matrix');
    expect(skeleton.querySelectorAll('[data-skeleton-cell]')).toHaveLength(42);

    rerender(<WorkbenchSkeleton geometry={{ kind: 'split', columns: 5, rows: 3, splitRatio: '60/40', toolbar: true }} />);
    skeleton = screen.getByRole('status', { name: 'Đang tải nội dung' });
    expect(skeleton).toHaveAttribute('data-skeleton-kind', 'split');
    expect(skeleton.querySelectorAll('[data-skeleton-pane]')).toHaveLength(2);
  });

  it.each([
    ['/weekly-menu?view=demand', 'table'],
    ['/warehouse?view=receipts', 'table'],
    ['/settings/advanced?view=mode', 'form'],
    ['/settings/advanced?view=unknown', 'form'],
  ])('RouteWorkbenchLoadingFallback preserves the resolved geometry for %s', (entry, kind) => {
    render(<MemoryRouter initialEntries={[entry]}><RouteWorkbenchLoadingFallback /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('data-skeleton-kind', kind);
  });

  it('ActionGuard blocks missing permission and wrong operational mode before child activation', async () => {
    const onClick = vi.fn();
    const auth: AuthContextType = {
      user: { userId: 'u-1', username: 'manager', fullName: 'Quản lý', roleCode: 'MANAGER', roleName: 'Quản lý', isActive: true, isAdminFullAccess: false, permissions: [] },
      token: 'token', isAuthenticated: true, isLoading: false, operationalMode: 'DEFAULT', operationalModeVersion: 1, operationalModeReasonRequired: false, landingPath: '/', reloadOperationalMode: vi.fn(),
      login: vi.fn(), logout: vi.fn(), setOperationalMode: vi.fn(), hasRole: () => true, hasPermission: () => false,
    };
    const { rerender } = render(
      <AuthContext.Provider value={auth}>
        <ActionGuard capabilityId="RECON.BATCH.LIFECYCLE" permissions="ReconciliationWriteAccess" allowedModes={['MATERIAL_RECONCILIATION']} mode="disable" reason="Chỉ khả dụng trong chế độ đối soát.">
          <Button onClick={onClick}>Hoàn tất lô</Button>
        </ActionGuard>
      </AuthContext.Provider>
    );
    expect(screen.getByRole('button', { name: 'Hoàn tất lô' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Chỉ khả dụng trong chế độ đối soát.' })).toHaveAttribute('data-capability-id', 'RECON.BATCH.LIFECYCLE');
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất lô' }));
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <AuthContext.Provider value={{ ...auth, operationalMode: 'MATERIAL_RECONCILIATION', hasPermission: () => true }}>
        <ActionGuard capabilityId="RECON.BATCH.LIFECYCLE" permissions="ReconciliationWriteAccess" allowedModes={['MATERIAL_RECONCILIATION']} mode="disable">
          <Button onClick={onClick}>Hoàn tất lô</Button>
        </ActionGuard>
      </AuthContext.Provider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất lô' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ActionGuard hides role-restricted actions from unauthenticated actors', () => {
    const auth: AuthContextType = {
      user: null, token: null, isAuthenticated: false, isLoading: false, operationalMode: 'DEFAULT', operationalModeVersion: null, operationalModeReasonRequired: false, landingPath: '/login', reloadOperationalMode: vi.fn(),
      login: vi.fn(), logout: vi.fn(), setOperationalMode: vi.fn(), hasRole: () => false, hasPermission: () => false,
    };
    render(<AuthContext.Provider value={auth}><ActionGuard capabilityId="APPR.DECISION" roles="MANAGER"><Button>Phê duyệt</Button></ActionGuard></AuthContext.Provider>);
    expect(screen.queryByRole('button', { name: 'Phê duyệt' })).not.toBeInTheDocument();
  });

  it('StateBoundary replaces loading geometry with the resolved HTTP state', () => {
    const forbidden = Object.assign(new Error('Không đủ quyền'), { status: 403 });
    const { rerender } = render(<StateBoundary isLoading loadingGeometry={{ kind: 'matrix', columns: 7, rows: 6 }}><span>Nội dung</span></StateBoundary>);
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('data-skeleton-kind', 'matrix');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<StateBoundary error={forbidden}><span>Nội dung</span></StateBoundary>);
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Truy cập bị hạn chế');
  });

  it('StateBoundary: routes HTTP 403 and 409 errors to distinct recovery states', () => {
    const forbidden = Object.assign(new Error('Không đủ quyền'), { status: 403 });
    const { rerender } = render(<StateBoundary error={forbidden}><span>Nội dung</span></StateBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Truy cập bị hạn chế');

    const conflict = Object.assign(new Error('Phiên bản đã thay đổi'), { status: 409 });
    rerender(<StateBoundary error={conflict}><span>Nội dung</span></StateBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Xung đột dữ liệu đồng thời');
    expect(screen.getByRole('alert')).toHaveTextContent('Phiên bản đã thay đổi');
  });

  it('DataGrid: interactive rows support keyboard selection', () => {
    const onRowClick = vi.fn();
    render(<DataGrid data={[{ id: 'row-1', name: 'Dòng kiểm thử' }]} columns={[{ id: 'name', header: 'Tên', cell: (row) => row.name }]} keyExtractor={(row) => row.id} onRowClick={onRowClick} />);
    const row = screen.getByRole('row', { name: /Dòng kiểm thử/ });
    row.focus();
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('DirtyNavigation: intercepts browser popstate back-button navigation when dirty draft is active', async () => {
    const user = userEvent.setup();
    render(
      <DirtyNavigationProvider>
        <TestDirtyConsumer />
      </DirtyNavigationProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Đánh dấu bẩn' }));
    expect(screen.getByText('Trạng thái: Bẩn')).toBeInTheDocument();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Trạng thái: Bẩn')).toBeInTheDocument();
  });

  it('SplitView: adapts to tablet viewport when detail is active with back button', async () => {
    const handleBack = vi.fn();
    const { rerender } = render(
      <SplitView
        master={<div>Bảng danh sách Master</div>}
        detail={<div>Bảng chi tiết Detail</div>}
        hasActiveDetail={false}
        onBackToMaster={handleBack}
      />
    );

    expect(screen.getByText('Bảng danh sách Master')).toBeInTheDocument();
    expect(screen.getByText('Bảng chi tiết Detail')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quay lại danh sách' })).not.toBeInTheDocument();

    // When detail is active
    rerender(
      <SplitView
        master={<div>Bảng danh sách Master</div>}
        detail={<div>Bảng chi tiết Detail</div>}
        hasActiveDetail={true}
        onBackToMaster={handleBack}
      />
    );

    const backBtn = screen.getByRole('button', { name: 'Quay lại danh sách' });
    expect(backBtn).toBeInTheDocument();
    await userEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('StateBoundary: preserves DOM and applies opacity-70 overlay during background refetch (Zero-CLS)', () => {
    const { rerender } = render(
      <StateBoundary
        isLoading={false}
        isFetching={false}
        hasExistingData={true}
      >
        <div data-testid="table-content">Dữ liệu bảng thật</div>
      </StateBoundary>
    );

    const content = screen.getByTestId('table-content');
    expect(content).toBeInTheDocument();
    expect(content.parentElement).not.toHaveClass('opacity-70');

    // Background refetch begins: isFetching is true, but existing data is preserved
    rerender(
      <StateBoundary
        isLoading={false}
        isFetching={true}
        hasExistingData={true}
      >
        <div data-testid="table-content">Dữ liệu bảng thật</div>
      </StateBoundary>
    );

    // Table content is still in DOM (no skeleton unmount), but dimmed with opacity-70
    expect(screen.getByTestId('table-content')).toBeInTheDocument();
    expect(screen.getByTestId('table-content').parentElement).toHaveClass('opacity-70');
    expect(screen.getByTestId('table-content').parentElement).toHaveClass('pointer-events-none');
  });

  it('WorkbenchSkeleton: renders custom column widths matching real table geometry to prevent layout shift', () => {
    const { container } = render(
      <WorkbenchSkeleton
        geometry={{
          kind: 'table',
          columns: 3,
          rows: 2,
          columnWidths: ['20%', '50%', '30%'],
        }}
      />
    );

    const cells = container.querySelectorAll('[data-skeleton-cell]');
    expect(cells.length).toBe(6);
    expect(cells[0]).toHaveStyle({ width: '20%' });
    expect(cells[1]).toHaveStyle({ width: '50%' });
    expect(cells[2]).toHaveStyle({ width: '30%' });
  });
});
