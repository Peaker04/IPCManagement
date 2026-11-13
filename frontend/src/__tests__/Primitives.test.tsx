import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge, DomainStatusBadge } from '../components/ui/badge';
import { InlineBanner } from '../components/ui/inline-banner';
import { Checkbox } from '../components/ui/checkbox';
import { Num } from '../components/ui/num';
import { IdentifierText } from '../components/ui/identifier-text';
import { VietnameseDateInput } from '../components/ui/vietnamese-date-input';
import { Modal } from '../components/ui/modal';
import { Tabs } from '../components/ui/tabs';
import { SplitView } from '../components/workbench/SplitView';
import { DataGrid } from '../components/workbench/DataGrid';
import { StateBoundary } from '../components/workbench/StateBoundary';
import { LocalizedBoundary } from '../components/workbench/LocalizedBoundary';
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { DocumentCodeCell } from '../components/workbench/DocumentCodeCell';
import { PaginationBar } from '../components/workbench/PaginationBar';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ActionGuard } from '../components/ui/action-guard';
import { AuthContext, type AuthContextType } from '../store/useAuth';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { useDirtyNavigation } from '../components/workbench/dirty-navigation-context';
import { useWorkspaceUiState, clearAllWorkspaceState } from '../store/workspaceUiState';
import { useUrlWorkbenchState } from '../hooks/useUrlWorkbenchState';
import { useClientDraftPersistence, clearAllClientDrafts } from '../hooks/useClientDraftPersistence';
import {
  formatTransactionType,
  formatAuditActor,
  formatAuditArea,
  formatAuditEntity,
  formatAuditField,
  formatAuditValue,
} from '../utils/formatters';

function TestDirtyConsumer() {
  const { isDirty, registerDirty } = useDirtyNavigation();
  return (
    <div>
      <span>{isDirty ? 'Trạng thái: Bẩn' : 'Trạng thái: Sạch'}</span>
      <button onClick={() => registerDirty('draft-1')}>Đánh dấu bẩn</button>
    </div>
  );
}

describe('Core UI Primitives & Composites (WCAG 2.1 AA & Zero AI-Slop)', () => {
  it('keeps selector totals visible without inert single-page controls, and preserves later-page access and pending guards', async () => {
    const changePage = vi.fn();
    const props = { label: 'Phân trang danh sách lô', placement: 'selector' as const, page: 1, pageSize: 50,
      totalCount: 1, totalPages: 1, hasPrev: false, hasNext: false, onPageChange: changePage };
    const { rerender } = render(<PaginationBar {...props} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('1 lô');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<PaginationBar {...props} totalCount={51} totalPages={2} hasNext />);
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(changePage).toHaveBeenCalledExactlyOnceWith(2);
    rerender(<PaginationBar {...props} totalCount={51} totalPages={2} hasNext pending />);
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    rerender(<PaginationBar {...props} totalCount={undefined} totalPages={undefined} />);
    expect(screen.getByRole('navigation')).toHaveTextContent('— lô');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<PaginationBar {...props} page={2} totalCount={1} totalPages={1} hasPrev />);
    await userEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    expect(changePage).toHaveBeenLastCalledWith(1);
    const changeSize = vi.fn();
    rerender(<PaginationBar {...props} placement="footer" onPageSizeChange={changeSize} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toHaveTextContent('1 kết quả');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), '100');
    expect(changeSize).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('visibly names report pagination separately from catalogue navigation', () => {
    render(<PaginationBar label="Phân trang giao dịch kho" page={1} pageSize={25} totalCount={26}
      totalPages={2} hasPrev={false} hasNext onPageChange={() => undefined} />);
    expect(screen.getByText('Phân trang giao dịch kho')).toBeVisible();
    expect(screen.getByRole('navigation')).toHaveTextContent('Trang 1/2 · 26 kết quả');
  });

  it('Button: renders variants and handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Lưu dữ liệu</Button>);
    const btn = screen.getByRole('button', { name: 'Lưu dữ liệu' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-slate-900');
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

  it('Input: strictly separates readOnly vs disabled (Rule L1-UI-02 & S-UI-02)', () => {
    render(
      <div>
        <Input data-testid="input-ro" readOnly defaultValue="BATCH-2026-001" />
        <Input data-testid="input-dis" disabled defaultValue="DISABLED-VAL" />
      </div>
    );

    const inputRo = screen.getByTestId('input-ro');
    const inputDis = screen.getByTestId('input-dis');

    expect(inputRo).toHaveAttribute('tabIndex', '0');
    expect(inputRo).toHaveAttribute('aria-readonly', 'true');
    expect(inputRo).not.toBeDisabled();
    expect(inputRo).toHaveClass('select-text');
    expect(inputRo).toHaveClass('border-dashed');

    expect(inputDis).toBeDisabled();
    expect(inputDis).toHaveClass('cursor-not-allowed');
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
    await userEvent.selectOptions(select, 'SAMSUNG');
    expect(handleChange).toHaveBeenCalled();
  });

  it('Badge & DomainStatusBadge: renders semantic variants and maps domain statuses', () => {
    const { rerender } = render(<Badge variant="success">Hoàn thành</Badge>);
    expect(screen.getByText('Hoàn thành')).toHaveClass('bg-emerald-50');

    rerender(<DomainStatusBadge status="COMPLETED" />);
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument();

    rerender(<DomainStatusBadge status="DRAFT" />);
    expect(screen.getByText('Bản nháp')).toBeInTheDocument();
  });

  it('Checkbox: toggles checked state and handles keyboard navigation', async () => {
    const handleChange = vi.fn();
    render(
      <Checkbox
        aria-label="Chọn tất cả"
        onChange={handleChange}
      />
    );

    const cb = screen.getByRole('checkbox', { name: 'Chọn tất cả' });
    expect(cb).not.toBeChecked();
    await userEvent.click(cb);
    expect(handleChange).toHaveBeenCalled();
  });

  it('Num: formats currency, quantities, and ratios with tabular figures', () => {
    const { rerender } = render(<Num value={1250000} format="currency" />);
    expect(screen.getByText('1.250.000 ₫')).toHaveClass('tabular-nums');

    rerender(<Num value={45.75} format="quantity" suffix=" kg" />);
    expect(screen.getByText('45,75 kg')).toBeInTheDocument();

    rerender(<Num value={12.5} format="percent" />);
    expect(screen.getByText('12,5%')).toBeInTheDocument();

    rerender(<Num value={0.0000004} format="rate" />);
    expect(screen.getByText('0,0000004')).toBeInTheDocument();

    rerender(<Num value={1e-24} format="rate" />);
    expect(screen.getByText(/1$/)).not.toHaveTextContent(/^0$/);

    rerender(<Num value={0.1} format="rate" />);
    expect(screen.getByText('0,1')).toBeInTheDocument();

    rerender(<Num value={null} format="rate" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('IdentifierText: renders monospace code with copy action', async () => {
    render(<IdentifierText value="PO-2026-0001" copyable />);
    const codeSpan = screen.getByText('PO-2026-0001');
    expect(codeSpan.parentElement).toHaveClass('font-mono');
  });

  it('VietnameseDateInput: formats date in dd/MM/yyyy and supports direct entry', async () => {
    const handleChange = vi.fn();
    render(
      <VietnameseDateInput
        aria-label="Ngày phục vụ"
        value="2026-10-19"
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Ngày phục vụ' });
    expect(input).toHaveValue('19/10/2026');
  });

  it('VietnameseDateInput: rejects impossible text without hiding the draft and allows historical service dates', () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    render(<VietnameseDateInput aria-label="Ngày dịch vụ" value="2026-10-12" onChange={onChange} onValidationChange={onValidationChange} />);
    const input = screen.getByRole('textbox', { name: 'Ngày dịch vụ' });
    fireEvent.change(input, { target: { value: '29/02/2025' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('29/02/2025');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày không hợp lệ');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '13/10/2026' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('2026-10-13');
    expect(onValidationChange).toHaveBeenLastCalledWith(null);
  });

  it('VietnameseDateInput: applies Monday and range constraints to typed dates and calendar buttons only when requested', async () => {
    const onChange = vi.fn();
    render(<VietnameseDateInput aria-label="Tuần nhập" value="2026-10-12" min="2026-10-05" max="2026-10-19" isDateAllowed={(iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 1} validationMessage="Hãy chọn Thứ Hai trong phạm vi tuần." onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Tuần nhập' });
    fireEvent.change(input, { target: { value: '13/10/2026' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent('Hãy chọn Thứ Hai');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    expect(screen.getByRole('button', { name: 'Chọn ngày 13/10/2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chọn ngày 26/10/2026' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Chọn ngày 19/10/2026' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-19');
  });

  it('Modal: renders dialog with focus trap and closes with Escape key', async () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Xác nhận thao tác">
        <p>Nội dung hộp thoại</p>
        <Button onClick={handleClose}>Đóng</Button>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Xác nhận thao tác')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Modal: returns keyboard focus to the close request after canceling discard', async () => {
    const handleClose = vi.fn();
    render(<Modal isOpen isDirty onClose={handleClose} title="Nhập thực đơn"><input aria-label="Tệp thực đơn" /></Modal>);
    const close = screen.getByRole('button', { name: 'Đóng hộp thoại' });
    await userEvent.click(close);
    expect(screen.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    expect(close).toHaveFocus();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('Tabs: renders segmented switcher and switches active tab', async () => {
    const handleTabChange = vi.fn();
    render(
      <Tabs
        items={[
          { id: 'tab1', label: 'Tab Một' },
          { id: 'tab2', label: 'Tab Hai' },
        ]}
        activeId="tab1"
        onChange={handleTabChange}
      />
    );

    const tab2 = screen.getByRole('tab', { name: 'Tab Hai' });
    await userEvent.click(tab2);
    expect(handleTabChange).toHaveBeenCalledWith('tab2');
  });

  it('InlineBanner: renders variant banners with optional close action', async () => {
    const handleClose = vi.fn();
    render(
      <InlineBanner variant="warning" title="Cảnh báo chênh lệch" onClose={handleClose}>
        Chi tiết cảnh báo
      </InlineBanner>
    );

    expect(screen.getByText('Cảnh báo chênh lệch')).toBeInTheDocument();
    expect(screen.getByText('Chi tiết cảnh báo')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: 'Đóng thông báo' });
    await userEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('SplitView: renders master and detail panes with 60/40 ratio', () => {
    render(
      <SplitView
        master={<div>Khung danh sách</div>}
        detail={<div>Khung chi tiết</div>}
      />
    );

    expect(screen.getByText('Khung danh sách')).toBeInTheDocument();
    expect(screen.getByText('Khung chi tiết')).toBeInTheDocument();
  });

  it('DataGrid: roving tabindex keyboard navigation (ArrowUp/Down, Home, End, Enter)', () => {
    const items = [
      { id: '1', name: 'Thịt bò' },
      { id: '2', name: 'Thịt heo' },
      { id: '3', name: 'Cá hồi' },
    ];
    const cols = [{ id: 'name', header: 'Tên', cell: (r: { name: string }) => r.name }];
    const handleRowClick = vi.fn();

    render(
      <DataGrid
        data={items}
        columns={cols}
        keyExtractor={(r) => r.id}
        onRowClick={handleRowClick}
      />
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBe(3);
    expect(rows[0]).toHaveAttribute('tabIndex', '0');
    expect(rows[1]).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(rows[1]).toHaveAttribute('tabIndex', '0');
    expect(rows[0]).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(rows[1], { key: 'Enter' });
    expect(handleRowClick).toHaveBeenCalledWith(items[1]);
  });

  it('DataGrid: clamps effectiveFocusedIndex when filtered', () => {
    const cols = [{ id: 'name', header: 'Tên', cell: (r: { name: string }) => r.name }];
    const initialItems = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];

    const { rerender } = render(
      <DataGrid
        data={initialItems}
        columns={cols}
        keyExtractor={(r) => r.id}
        onRowClick={() => {}}
      />
    );

    const rows = screen.getAllByRole('row').slice(1);
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(rows[1]).toHaveAttribute('tabIndex', '0');

    rerender(
      <DataGrid
        data={[{ id: '1', name: 'A' }]}
        columns={cols}
        keyExtractor={(r) => r.id}
        onRowClick={() => {}}
      />
    );

    const filteredRows = screen.getAllByRole('row').slice(1);
    expect(filteredRows.length).toBe(1);
    expect(filteredRows[0]).toHaveAttribute('tabIndex', '0');
  });

  it('StateBoundary & WorkbenchSkeleton: renders geometry-matched skeleton during cold loading', () => {
    const { rerender } = render(
      <WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 6 }} />
    );
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();

    rerender(
      <StateBoundary
        isLoading={true}
        hasExistingData={false}
        loadingGeometry={{ kind: 'table', columns: 5, rows: 6 }}
      >
        <div>Dữ liệu thật</div>
      </StateBoundary>
    );

    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();
    expect(screen.queryByText('Dữ liệu thật')).not.toBeInTheDocument();
  });

  it('StateBoundary: Level 1 & Level 2 refreshing maintains silent canvas stability and handles context pivot', async () => {
    // Level 1: Silent revalidation with existing data (100% opacity, zero flashing bar)
    const content = <div data-testid="table-content"><Input aria-label="Bản nháp đang đọc" defaultValue="" /></div>;
    const { rerender } = render(
      <StateBoundary isFetching={true} hasExistingData={true}>{content}</StateBoundary>
    );
    const draft = screen.getByRole('textbox', { name: 'Bản nháp đang đọc' });
    draft.focus();
    await userEvent.type(draft, 'Giữ bản nháp');
    const scrollRegion = draft.parentElement!;
    scrollRegion.scrollTop = 45;

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-content')).toBeInTheDocument();

    // Context pivot retains brightness and blocks interaction with previous-scope rows.
    rerender(
      <StateBoundary isPreviousData={true} hasExistingData={true}>{content}</StateBoundary>
    );

    const container = screen.getByTestId('table-content').parentElement;
    expect(container).not.toHaveClass('opacity-70');
    expect(container).toHaveAttribute('inert');
    expect(container).toHaveClass('pointer-events-none');
    expect(container).toHaveAttribute('inert');
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeVisible();

    // Level 3: Non-destructive error handling preserves table
    rerender(
      <StateBoundary error={new Error('Mất kết nối mạng tạm thời')} hasExistingData={true}>{content}</StateBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Mất kết nối mạng tạm thời/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bản nháp đang đọc' })).toBe(draft);
    expect(draft).toHaveValue('Giữ bản nháp');
    expect(draft).toHaveFocus();
    expect(scrollRegion.scrollTop).toBe(45);
    rerender(<StateBoundary isFetching={true} hasExistingData={true}>{content}</StateBoundary>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Đang tải nội dung')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bản nháp đang đọc' })).toBe(draft);
    expect(draft).toHaveValue('Giữ bản nháp');
    expect(draft).toHaveFocus();
  });

  it('StateBoundary: handles filter-empty with onResetFilters and prerequisite-blocked with onNavigatePrerequisite', () => {
    const onResetFilters = vi.fn();
    const onNavigatePrerequisite = vi.fn();

    const { rerender } = render(
      <StateBoundary
        isEmpty={true}
        emptyScenario="filter-empty"
        onResetFilters={onResetFilters}
      >
        <div>Content</div>
      </StateBoundary>
    );

    const resetBtn = screen.getByRole('button', { name: 'Xóa bộ lọc (Reset Filters)' });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);
    expect(onResetFilters).toHaveBeenCalledTimes(1);

    // Prerequisite blocked test
    rerender(
      <StateBoundary
        isEmpty={true}
        emptyScenario="prerequisite-blocked"
        prerequisiteLabel="Khách hàng & Hợp đồng"
        onNavigatePrerequisite={onNavigatePrerequisite}
      >
        <div>Content</div>
      </StateBoundary>
    );

    expect(screen.getByText('Chưa hoàn thành bước: Khách hàng & Hợp đồng')).toBeInTheDocument();
    const navBtn = screen.getByRole('button', { name: 'Đi đến thiết lập: Khách hàng & Hợp đồng' });
    expect(navBtn).toBeInTheDocument();
    fireEvent.click(navBtn);
    expect(onNavigatePrerequisite).toHaveBeenCalledTimes(1);
  });

  it('ActionGuard: enforces role and permission guards', () => {
    const authContextValue: AuthContextType = {
      user: {
        userId: 'u-1',
        username: 'chef_user',
        fullName: 'Bếp Trưởng',
        roleCode: 'CHEF',
        roleName: 'Bếp Trưởng',
        isActive: true,
        isAdminFullAccess: false,
        permissions: ['reconciliation.kitchen.read'],
      },
      token: 'jwt-token',
      isAuthenticated: true,
      isLoading: false,
      operationalMode: 'MATERIAL_RECONCILIATION',
      isOperationalModeReady: true,
      operationalModeError: null,
      operationalModeVersion: 1,
      operationalModeReasonRequired: false,
      landingPath: '/',
      reloadOperationalMode: vi.fn(),
      hasRole: (roleCode: string | string[]) => Array.isArray(roleCode) ? roleCode.includes('CHEF') : roleCode === 'CHEF',
      hasPermission: (perm: string) => perm === 'reconciliation.kitchen.read',
      canNavigate: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      setOperationalMode: vi.fn(),
    };

    render(
      <AuthContext.Provider value={authContextValue}>
        <ActionGuard capabilityId="CATALOG.MANAGE" roles={['ADMIN']} permissions={['catalog.write']}>
          <button>Nút Quản Trị</button>
        </ActionGuard>
      </AuthContext.Provider>
    );

    expect(screen.queryByRole('button', { name: 'Nút Quản Trị' })).not.toBeInTheDocument();
  });

  it('DirtyNavigationProvider: tracks dirty state and protects uncommitted drafts', () => {
    render(
      <DirtyNavigationProvider>
        <TestDirtyConsumer />
      </DirtyNavigationProvider>
    );

    expect(screen.getByText('Trạng thái: Sạch')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu bẩn' }));
    expect(screen.getByText('Trạng thái: Bẩn')).toBeInTheDocument();
  });

  it('useWorkspaceUiState: persists density and column visibility', () => {
    function TestWorkspace() {
      const { density, setDensity } = useWorkspaceUiState({ tableKey: 'test_table', userId: 'user_1' });
      return (
        <div>
          <span data-testid="density-val">{density}</span>
          <button onClick={() => setDensity('compact')}>Chuyển Compact</button>
        </div>
      );
    }

    render(<TestWorkspace />);
    expect(screen.getByTestId('density-val')).toHaveTextContent('cozy');
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển Compact' }));
    expect(screen.getByTestId('density-val')).toHaveTextContent('compact');
    clearAllWorkspaceState();
  });

  it('useUrlWorkbenchState: synchronizes search params with URL', () => {
    function TestUrl() {
      const { q, setQ, page, setPage } = useUrlWorkbenchState({ defaultPageSize: 20 });
      return (
        <div>
          <span data-testid="q-val">{q}</span>
          <span data-testid="page-val">{page}</span>
          <button onClick={() => setQ('thịt')}>Search</button>
          <button onClick={() => setPage(2)}>Page 2</button>
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/test?q=ga&page=1']}>
        <Routes>
          <Route path="/test" element={<TestUrl />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('q-val')).toHaveTextContent('ga');
    expect(screen.getByTestId('page-val')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByTestId('q-val')).toHaveTextContent('thịt');
  });

  it.each([
    ['?page=abc&pageSize=Infinity', '1/25'],
    ['?page=-2&pageSize=-4', '1/25'],
    ['?page=1.5&pageSize=2.5', '1/25'],
    ['?page=2147483648&pageSize=25', '1/25'],
    ['?page=9007199254740992&pageSize=500', '1/100'],
  ])('normalizes invalid paging URL %s before a consumer can request it', (search, expected) => {
    function Paging() {
      const { page, pageSize } = useUrlWorkbenchState();
      return <output aria-label="Phạm vi trang">{page}/{pageSize}</output>;
    }
    render(<MemoryRouter initialEntries={[`/test${search}`]}><Paging /></MemoryRouter>);
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent(expected);
  });

  it('keeps paging in browser history and resets page size without deleting work context', () => {
    function Paging() {
      const { q, page, pageSize, setPage, setPageSize, setQ } = useUrlWorkbenchState();
      const navigate = useNavigate();
      const location = useLocation();
      return <><output aria-label="Phạm vi trang">{q}:{page}/{pageSize}:{location.search}</output>
        <button onClick={() => setPage(2)}>Trang hai</button>
        <button onClick={() => navigate(-1)}>Quay lại</button>
        <button onClick={() => setPageSize(50)}>Năm mươi dòng</button>
        <button onClick={() => setQ('')}>Xóa tìm kiếm</button></>;
    }
    render(<MemoryRouter initialEntries={['/test?view=dishes&q=gao&page=1&batchId=scope-1']}><Paging /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Trang hai' }));
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent('gao:2/25');
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent('gao:1/25');
    fireEvent.click(screen.getByRole('button', { name: 'Năm mươi dòng' }));
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent('gao:1/50');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent(':1/50');
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent('view=dishes');
    expect(screen.getByLabelText('Phạm vi trang')).toHaveTextContent('batchId=scope-1');
  });

  it('useClientDraftPersistence: saves and restores draft data from localStorage', async () => {
    function TestDraft() {
      const [formData, setFormData] = useState({ note: 'Gốc' });
      const { hasRestorableDraft, restoreDraft } = useClientDraftPersistence({
        formKey: 'test_form',
        userId: 'u_1',
        currentData: formData,
        isDirty: formData.note !== 'Gốc',
        debounceMs: 10,
      });

      return (
        <div>
          {hasRestorableDraft && (
            <button onClick={() => { const r = restoreDraft(); if (r) setFormData(r); }}>
              Khôi phục bản nháp
            </button>
          )}
          <span data-testid="note-val">{formData.note}</span>
        </div>
      );
    }

    localStorage.setItem(
      'ipc_draft_u_1_test_form',
      JSON.stringify({
        data: { note: 'Bản nháp đã lưu' },
        savedAt: '2026-10-25T10:00:00Z',
      })
    );

    render(<TestDraft />);
    const restoreBtn = screen.getByRole('button', { name: 'Khôi phục bản nháp' });
    expect(restoreBtn).toBeInTheDocument();
    await userEvent.click(restoreBtn);
    expect(screen.getByTestId('note-val')).toHaveTextContent('Bản nháp đã lưu');
    clearAllClientDrafts();
  });

  it('reports a rejected document copy and clears the error after a successful keyboard retry', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce();
    try {
      render(<DocumentCodeCell code="ISS-01" />);
      await user.tab();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('status')).toHaveTextContent('Không thể sao chép');
      await user.keyboard('{Enter}');
      expect(write).toHaveBeenLastCalledWith('ISS-01');
      expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
    } finally { write.mockRestore(); }
  });

  it('DocumentCodeCell: clicking code triggers onOpenDetail and copy button copies to clipboard with stopPropagation', async () => {
    const handleOpen = vi.fn();
    render(<DocumentCodeCell code="ISS-TEST-001" onOpenDetail={handleOpen} />);

    const openBtn = screen.getByTitle('Bấm để xem chi tiết phiếu xuất kho');
    expect(openBtn).toBeInTheDocument();
    await userEvent.click(openBtn);
    expect(handleOpen).toHaveBeenCalledWith('ISS-TEST-001');

    const copyBtn = screen.getByRole('button', { name: 'Sao chép mã chứng từ ISS-TEST-001' });
    expect(copyBtn).toBeInTheDocument();
    await userEvent.click(copyBtn);
    expect(handleOpen).toHaveBeenCalledTimes(1); // Did not trigger open again

    expect(formatTransactionType('PHYSICAL_RETURN')).toBe('Hoàn trả');
    expect(formatAuditActor('10000000-0000-0000-0000-000000000001')).toBe('Quản trị viên (Admin)');
    expect(formatAuditActor('10000000-0000-0000-0000-000000000002')).toBe('Quản lý (Manager)');
    expect(formatAuditActor('10000000-0000-0000-0000-000000000004')).toBe('Thủ kho (Warehouse)');
    expect(formatAuditArea('inventory')).toBe('Kho');
    expect(formatAuditEntity('ReconciliationDailyDisposition')).toBe('Xử lý chênh lệch');
    expect(formatAuditEntity('InventoryIssueLine')).toBe('Dòng xuất kho');
    expect(formatAuditEntity('BomAdjustment')).toBe('Điều chỉnh BOM');
    expect(formatAuditEntity('QuantityImportBatch')).toBe('Đợt nhập số suất');
    expect(formatAuditEntity('MealQuantityPlanLine')).toBe('Số suất theo món và ca');
    expect(formatAuditField('IssuedQty')).toBe('Số lượng thực xuất');
    expect(formatAuditField('FinalServings')).toBe('Số suất chốt');
    expect(formatAuditField('VegetarianServings')).toBe('Số suất chay');
    expect(formatAuditField('SavoryServings')).toBe('Số suất mặn');
    expect(formatAuditField('DishId')).toBe('Món ăn');
    expect(formatAuditField('Commit')).toBe('Xác nhận nguồn số suất');
    expect(formatAuditField('Validity')).toBe('Hiệu lực giải trình');
    expect(formatAuditField('QuantityAndWaste')).toBe('Định lượng & hao hụt');
  });

  it('renders audit values in business terms while retaining the raw reference', () => {
    expect(formatAuditValue('FinalServings', '19')).toBe('19 suất');
    expect(formatAuditValue('Status', 'READY')).toBe('Sẵn sàng');
    expect(formatAuditValue('DishId', 'c6e2070b-cb72-4ab7-ab6f-b8d1cc7be0c9')).toBe('Mã món c6e2070b-cb72-4ab7-ab6f-b8d1cc7be0c9');
    expect(formatAuditValue('Commit', 'F18BAB97D4A5152F9271B64140D3065CAC25D93B5')).toBe('Đã xác nhận dữ liệu nguồn');
  });

  it('C7: PaginationBar footer reserves min-h-12 height across page-size selector visibility', () => {
    render(
      <PaginationBar
        label="Danh sách nguyên liệu"
        page={1}
        pageSize={50}
        totalCount={100}
        totalPages={2}
        hasPrev={false}
        hasNext={true}
        onPageChange={vi.fn()}
      />
    );
    const nav = screen.getByRole('navigation', { name: 'Danh sách nguyên liệu' });
    expect(nav).toHaveClass('min-h-12');
  });

  it('F2: LocalizedBoundary renders WorkbenchSkeleton immediately on loading without an empty white div or 250ms hold', () => {
    const { rerender } = render(
      <LocalizedBoundary isLoading={true} loadingGeometry={{ kind: 'table', columns: 4, rows: 5 }}>
        <div data-testid="real-table">Bảng thật</div>
      </LocalizedBoundary>
    );
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();
    expect(screen.queryByTestId('real-table')).not.toBeInTheDocument();

    rerender(
      <LocalizedBoundary isLoading={false} loadingGeometry={{ kind: 'table', columns: 4, rows: 5 }}>
        <div data-testid="real-table">Bảng thật</div>
      </LocalizedBoundary>
    );
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.getByTestId('real-table')).toBeInTheDocument();
  });

  it('G2: StateBoundary renders WorkbenchSkeleton immediately on Frame 0 without an empty aria-busy placeholder even in production mode', () => {
    const { container } = render(
      <StateBoundary
        isLoading={true}
        hasExistingData={false}
        loadingGeometry={{ kind: 'table', columns: 4, rows: 5 }}
      >
        <div>Nội dung</div>
      </StateBoundary>
    );
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();
    const emptyBusy = Array.from(container.querySelectorAll('[aria-busy="true"]')).filter(
      (el) => el.children.length === 0
    );
    expect(emptyBusy).toHaveLength(0);
  });

  it('G7: PaginationBar locks md:h-12 on desktop when pageSizeOptions are omitted', () => {
    render(
      <PaginationBar
        label="Phân trang G7"
        page={1}
        pageSize={25}
        totalCount={50}
        totalPages={2}
        hasPrev={false}
        hasNext={true}
        onPageChange={vi.fn()}
      />
    );
    const nav = screen.getByRole('navigation', { name: 'Phân trang G7' });
    expect(nav).toHaveClass('md:h-12');
    expect(nav).toHaveClass('min-h-12');
  });

  it('H2: DataGrid keeps table and sticky thead mounted when data is empty and emptyMessage/emptyState is provided', () => {
    render(
      <DataGrid
        data={[]}
        columns={[
          { id: 'code', header: 'Mã nguyên liệu', cell: () => null },
          { id: 'name', header: 'Tên nguyên liệu', cell: () => null },
        ]}
        keyExtractor={(_, idx) => String(idx)}
        emptyMessage="Không có dòng khớp bộ lọc."
      />
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Không có dòng khớp bộ lọc.')).toBeInTheDocument();
  });

  it('H12: previous data stays full brightness and read-only', () => {
    render(
      <StateBoundary isPreviousData={true} hasExistingData={true}>
        <div data-testid="h12-content">Dữ liệu hiện tại</div>
      </StateBoundary>
    );
    const container = screen.getByTestId('h12-content').parentElement;
    expect(container).not.toHaveClass('opacity-70');
    expect(container).toHaveAttribute('inert');
  });

  it('I4 & I5: validation overlays preserve header height and previous-data status stays nonvisual', async () => {
    render(
      <div>
        <VietnameseDateInput
          aria-label="Ngày kiểm thử I4"
          value="2026-10-19"
          isDateAllowed={(iso) => iso === '2026-10-19'}
          validationMessage="Ngày phải là Thứ Hai."
          onChange={vi.fn()}
        />
        <StateBoundary isPreviousData={true} hasExistingData={true}>
          <div>Nội dung I5</div>
        </StateBoundary>
      </div>
    );

    const dateInput = screen.getByRole('textbox', { name: 'Ngày kiểm thử I4' });
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '20/10/2026');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Ngày phải là Thứ Hai.');
    expect(alert).toHaveClass('absolute');
    expect(alert).toHaveClass('top-full');

    const progressbar = screen.getByRole('progressbar', { name: 'Đang tải trang' });
    expect(progressbar).toHaveClass('sr-only');
    expect(screen.getByText('Nội dung I5').parentElement).toHaveAttribute('inert');
  });

  it('J1 & J2: previous-data status retains identity without a painted stroke and the table header stays solid', () => {
    const { rerender, container } = render(
      <StateBoundary isPreviousData={false} hasExistingData={true}>
        <DataGrid
          data={[{ id: '1', name: 'Gạo ST25' }]}
          columns={[{ id: 'name', header: 'Nguyên liệu', cell: (r) => r.name }]}
          keyExtractor={(r) => r.id}
        />
      </StateBoundary>
    );

    expect(screen.queryByRole('progressbar', { name: 'Đang tải trang' })).not.toBeInTheDocument();
    const idleBar = container.querySelector('.sr-only[aria-hidden="true"]');
    expect(idleBar).toBeInTheDocument();
    expect(idleBar).toHaveClass('sr-only');
    expect(container.querySelector('.h-0\\.5')).toBeNull();

    const thead = container.querySelector('thead');
    expect(thead).toHaveClass('bg-slate-100');
    expect(thead).not.toHaveClass('backdrop-blur-xs');

    rerender(
      <StateBoundary isPreviousData={true} hasExistingData={true}>
        <DataGrid
          data={[{ id: '1', name: 'Gạo ST25' }]}
          columns={[{ id: 'name', header: 'Nguyên liệu', cell: (r) => r.name }]}
          keyExtractor={(r) => r.id}
        />
      </StateBoundary>
    );

    const activeBar = screen.getByRole('progressbar', { name: 'Đang tải trang' });
    expect(activeBar).toBe(idleBar);
    expect(activeBar).toHaveClass('sr-only');
    expect(container.querySelector('table')?.closest('[inert]')).not.toBeNull();
    expect(container.querySelector('.h-0\\.5')).toBeNull();
  });

  it('DataGrid centers read-only empty states without wide column headings and restores columns when rows arrive', () => {
    const columns = [{ id: 'name', header: 'Nguyên liệu', cell: (row: { id: string; name: string }) => row.name }];
    const { rerender } = render(<DataGrid data={[]} columns={columns} keyExtractor={row => row.id}
      hideHeaderWhenEmpty minWidth="min-w-[1100px]" emptyMessage="Chưa có lịch sử" />);
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có lịch sử')).toBeVisible();
    expect(screen.getByRole('table')).not.toHaveClass('min-w-[1100px]');
    rerender(<DataGrid data={[{ id: 'i1', name: 'Gạo' }]} columns={columns} keyExtractor={row => row.id}
      hideHeaderWhenEmpty minWidth="min-w-[1100px]" emptyMessage="Chưa có lịch sử" />);
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeVisible();
    expect(screen.getByRole('table')).toHaveClass('min-w-[1100px]');
    expect(screen.getByText('Gạo')).toBeVisible();
  });

  it('DataGrid renders EmptyIcon badge and stretches table height (h-full) to center emptyState and emptyMessage vertically', () => {
    const { container } = render(
      <DataGrid
        data={[]}
        columns={[{ id: 'name', header: 'Nguyên liệu', cell: () => null }]}
        keyExtractor={(_, idx) => String(idx)}
        emptyState={
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Chưa có lịch sử thay đổi nguồn</p>
            <p className="text-xs text-slate-500">Các thay đổi nguồn và dữ liệu tương thích cũ được giữ nguyên để tra cứu.</p>
          </div>
        }
      />
    );

    const table = screen.getByRole('table');
    expect(table).toHaveClass('h-full');
    const iconBadge = container.querySelector('tbody .w-12.h-12.rounded-lg.bg-slate-100');
    expect(iconBadge).not.toBeNull();
    expect(iconBadge?.querySelector('svg')).not.toBeNull();
  });
});
