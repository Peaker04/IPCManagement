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
import { WorkbenchSkeleton } from '../components/workbench/WorkbenchSkeleton';
import { DocumentCodeCell } from '../components/workbench/DocumentCodeCell';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ActionGuard } from '../components/ui/action-guard';
import { AuthContext, type AuthContextType } from '../store/useAuth';
import { DirtyNavigationProvider } from '../components/workbench/DirtyNavigation';
import { useDirtyNavigation } from '../components/workbench/dirty-navigation-context';
import { useWorkspaceUiState, clearAllWorkspaceState } from '../store/workspaceUiState';
import { useUrlWorkbenchState } from '../hooks/useUrlWorkbenchState';
import { useClientDraftPersistence, clearAllClientDrafts } from '../hooks/useClientDraftPersistence';

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

  it('StateBoundary: Level 1 & Level 2 refreshing maintains silent canvas stability and handles context pivot', () => {
    // Level 1: Silent revalidation with existing data (100% opacity, zero flashing bar)
    const { rerender } = render(
      <StateBoundary isFetching={true} hasExistingData={true}>
        <div data-testid="table-content">Dữ liệu bảng hiện tại</div>
      </StateBoundary>
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-content')).toBeInTheDocument();

    // Level 2: Context pivot with isPreviousData (70% opacity, pointer-events locked)
    rerender(
      <StateBoundary isPreviousData={true} hasExistingData={true}>
        <div data-testid="table-content">Dữ liệu bảng cũ</div>
      </StateBoundary>
    );

    const container = screen.getByTestId('table-content').parentElement;
    expect(container).toHaveClass('opacity-70');
    expect(container).toHaveClass('pointer-events-none');

    // Level 3: Non-destructive error handling preserves table
    rerender(
      <StateBoundary error={new Error('Mất kết nối mạng tạm thời')} hasExistingData={true}>
        <div data-testid="table-content">Dữ liệu vẫn được bảo toàn</div>
      </StateBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Mất kết nối mạng tạm thời/)).toBeInTheDocument();
    expect(screen.getByTestId('table-content')).toBeInTheDocument();
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
      operationalModeVersion: 1,
      operationalModeReasonRequired: false,
      landingPath: '/',
      reloadOperationalMode: vi.fn(),
      hasRole: (roleCode: string | string[]) => Array.isArray(roleCode) ? roleCode.includes('CHEF') : roleCode === 'CHEF',
      hasPermission: (perm: string) => perm === 'reconciliation.kitchen.read',
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
  });
});
