import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WarehouseMovementPanel } from './WarehouseMovementPanel';
import { ToastProvider } from '@/components/common';
import warehouseMovementPanelSource from './WarehouseMovementPanel.tsx?raw';

describe('WarehouseMovementPanel contract', () => {
  it('phase27-baseline-responsive-wide-rail-stacked: uses the bounded responsive rail and keeps one tab-level Phiếu kho owner', () => {
    expect(warehouseMovementPanelSource).toContain("wideDetailRail={activeTask === 'stock'}");
    expect(warehouseMovementPanelSource.match(/detailLabel=/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource).not.toMatch(/tabIndex|\border\s*:/);
  });

  it('keeps current-stock failure ownership to one explanatory surface', () => {
    expect(warehouseMovementPanelSource).not.toContain("currentStockView.phase === 'forbidden' ? 'Không có quyền xem tồn kho' : isCurrentStockError ? 'Không tải được tồn kho'");
  });

  it('uses business table semantics for the BOTH-mode warehouse movement family', () => {
    expect(warehouseMovementPanelSource).toContain('scope="col"')
    expect(warehouseMovementPanelSource).toContain('data-cell-role="numeric"')
    expect(warehouseMovementPanelSource).toContain('ariaLabel="Tồn kho hiện tại theo kho và nguyên liệu"')
    expect(warehouseMovementPanelSource).toContain('caption="Snapshot tồn kho hiện tại theo kho và nguyên liệu"')
    expect(warehouseMovementPanelSource).toContain('ariaLabel="Sổ luân chuyển kho"')
    expect(warehouseMovementPanelSource).toContain('caption="Các bút toán nhập, xuất, trả và điều chỉnh kho"')
    expect(warehouseMovementPanelSource).toContain('Chưa có snapshot tồn kho hiện tại.')
  })

  it('retains independent current-stock and movement-history controls and states', () => {
    expect(warehouseMovementPanelSource.match(/title="Tồn kho hiện tại"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource.match(/title="Sổ luân chuyển kho"/g)).toHaveLength(1);
    expect(warehouseMovementPanelSource).toContain('warehouse-current-stock-search');
    expect(warehouseMovementPanelSource).toContain('warehouse-stock-movement-search');
    expect(warehouseMovementPanelSource).toContain('onCurrentStockPageChange');
    expect(warehouseMovementPanelSource).toContain('onStockMovementNext');
    for (const phase of ['loading', 'ready', 'error', 'forbidden', 'uninitialized']) {
      expect(warehouseMovementPanelSource).toContain(`phase === '${phase}'`);
    }
  });

  it('distinguishes an unmatched ledger search from a ledger with no entries', () => {
    const uninitialized = { phase: 'uninitialized' as const };
    const props = {
      documents: [], currentStockSearch: '', onCurrentStockSearchChange: vi.fn(), currentStockView: uninitialized,
      currentStockRows: [], currentStockPage: 1, currentStockPageSize: 8, currentStockTotalItems: 0,
      onCurrentStockPageChange: vi.fn(), onCurrentStockPageSizeChange: vi.fn(),
      stockMovementSearch: 'impossible-probe-00000', onStockMovementSearchChange: vi.fn(),
      stockMovementView: { phase: 'ready' as const }, stockMovements: [], stockMovementPage: 1,
      stockMovementHasNext: false, onStockMovementPrevious: vi.fn(), onStockMovementNext: vi.fn(),
      activeTask: 'ledger' as const,
    };
    const view = render(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} /></ToastProvider></MemoryRouter>);
    expect(screen.getByText('Không có bút toán khớp bộ lọc.')).toBeInTheDocument();
    view.rerender(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} stockMovementSearch="" /></ToastProvider></MemoryRouter>);
    expect(screen.getByText('Không có bút toán trong phạm vi mặc định.')).toBeInTheDocument();
  });

  it('does not report no documents while the document query is loading or failed', () => {
    const retry = vi.fn();
    const props = {
      documents: [], documentState: 'loading' as const, onRetryDocuments: retry,
      currentStockSearch: '', onCurrentStockSearchChange: vi.fn(), currentStockView: { phase: 'ready' as const },
      currentStockRows: [], currentStockPage: 1, currentStockPageSize: 8, currentStockTotalItems: 0,
      onCurrentStockPageChange: vi.fn(), onCurrentStockPageSizeChange: vi.fn(),
      stockMovementSearch: '', onStockMovementSearchChange: vi.fn(), stockMovementView: { phase: 'uninitialized' as const },
      stockMovements: [], stockMovementPage: 1, stockMovementHasNext: false,
      onStockMovementPrevious: vi.fn(), onStockMovementNext: vi.fn(),
    };
    const view = render(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} /></ToastProvider></MemoryRouter>);
    expect(screen.getByText('Đang tải phiếu kho')).toBeVisible();
    expect(screen.queryByText('Chưa có chứng từ vận hành.')).toBeNull();
    view.rerender(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} documentState="error" /></ToastProvider></MemoryRouter>);
    expect(screen.getByText('Không tải được phiếu kho')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Chưa có chứng từ vận hành.')).toBeNull();
    const document = { id: 'ISS-1', type: 'Phiếu xuất' as const, title: 'Phiếu xuất kho', status: 'Chờ bếp nhận', owner: 'Bếp', summary: 'Chờ ký nhận', route: '/chef-dashboard', lines: [], tone: 'warning' as const };
    view.rerender(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} documents={[document]} documentState="ready" /></ToastProvider></MemoryRouter>);
    expect(screen.getByText('Bếp phụ trách chứng từ này')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đến phân hệ' })).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} documents={[document]} documentState="ready" canViewChef /></ToastProvider></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Đến phân hệ' })).toHaveAttribute('href', '/chef-dashboard');
    view.rerender(<MemoryRouter><ToastProvider><WarehouseMovementPanel {...props} documents={[{ ...document, type: 'Phiếu nhập', documentId: 'receipt-1', route: '/warehouse' }]} documentState="ready" /></ToastProvider></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Xem phiếu nhập' })).toHaveAttribute('href', '/warehouse?view=receiving&receiptId=receipt-1');
    expect(screen.getByText(/Trích từ tối đa 20 chứng từ vận hành gần nhất/)).toBeInTheDocument();
  });

  it('shows one lookup work object at a time and retains the selected task semantics', () => {
    const uninitialized = { phase: 'uninitialized' as const, instruction: 'Mở dữ liệu tra cứu.' };
    render(<MemoryRouter><ToastProvider><WarehouseMovementPanel
      documents={[]}
      currentStockSearch=""
      onCurrentStockSearchChange={vi.fn()}
      currentStockView={uninitialized}
      currentStockRows={[]}
      currentStockPage={1}
      currentStockPageSize={8}
      currentStockTotalItems={0}
      onCurrentStockPageChange={vi.fn()}
      onCurrentStockPageSizeChange={vi.fn()}
      stockMovementSearch=""
      onStockMovementSearchChange={vi.fn()}
      stockMovementView={uninitialized}
      stockMovements={[]}
      stockMovementPage={1}
      stockMovementHasNext={false}
      onStockMovementPrevious={vi.fn()}
      onStockMovementNext={vi.fn()}
    /></ToastProvider></MemoryRouter>);

    expect(screen.getByRole('tabpanel', { name: 'Tồn kho hiện tại' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sổ luân chuyển kho' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Sổ luân chuyển' }));
    expect(screen.getByRole('tabpanel', { name: 'Sổ luân chuyển' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Sổ luân chuyển kho' })).toBeVisible();
  });
});
