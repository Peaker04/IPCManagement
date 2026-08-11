import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock('@/components/common', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/common')>(),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/app/hooks', () => ({
  useAppSelector: () => 'token-1',
}));

vi.mock('@/api/workflowApi', () => ({
  useGetAuditChangePageQuery: () => ({
    data: { items: [], hasNext: false },
    currentData: { items: [], hasNext: false },
    isUninitialized: false,
    isLoading: false,
    isFetching: false,
    isSuccess: true,
    isError: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));

import { AdminAuditPanel } from './AdminAuditPanel';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { useAdminAuditPanelModel } from './useAdminAuditPanelModel';

describe('Admin audit export feedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps a CSV export failure in the audit model instead of a toast', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Mất kết nối')));
    const { result } = renderHook(() => useAdminAuditPanelModel('audit'));

    await act(() => result.current.handleExportAuditCsv());

    expect(result.current.exportError).toBe('Error: Mất kết nối');
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('renders the export failure beside the audit controls', () => {
    const readyView = { phase: 'ready', data: { items: [], hasNext: false }, isRefreshing: false, truncation: null } as const;
    const model = {
      effectiveActiveView: 'audit',
      auditActor: '',
      auditArea: 'InventoryReceipt',
      auditCursors: [],
      auditEntity: '',
      auditField: '',
      auditResult: { data: { hasNext: false } },
      displayLogs: [],
      exportError: 'Error: Mất kết nối',
      handleExportAuditCsv: vi.fn(),
      queryViews: { audit: readyView },
      setAuditActor: vi.fn(),
      setAuditArea: vi.fn(),
      setAuditCursors: vi.fn(),
      setAuditEntity: vi.fn(),
      setAuditField: vi.fn(),
    } as unknown as AdminDataPageModel;

    render(<AdminAuditPanel model={model} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Nhập kho');
    expect(screen.getByRole('combobox')).not.toHaveTextContent('InventoryReceipt');
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa thể tải file CSV');
    expect(screen.getByRole('alert')).toHaveTextContent('Error: Mất kết nối');
  });

  it('keeps complete old and new audit values in bounded value regions', () => {
    const oldValue = 'receivedAt=2026-07-29T18:11:06.5845588+07:00';
    const newValue = 'receivedAt=2026-07-29T18:11:06.5845599+07:00';
    const readyView = { phase: 'ready', data: { items: [], hasNext: false }, isRefreshing: false, truncation: null } as const;
    const model = {
      effectiveActiveView: 'audit', auditActor: '', auditArea: '', auditCursors: [], auditEntity: '', auditField: '',
      auditResult: { data: { hasNext: false } }, exportError: undefined, handleExportAuditCsv: vi.fn(),
      displayLogs: [{ id: 'audit-1', timestamp: '2026-07-29T18:11:06+07:00', actor: 'Admin User', businessArea: 'InventoryReceipt', fieldAffected: 'InventoryReturn / StorekeeperReceived', oldValue, newValue, reason: 'Đối soát phiếu hoàn kho' }],
      queryViews: { audit: readyView }, setAuditActor: vi.fn(), setAuditArea: vi.fn(), setAuditCursors: vi.fn(), setAuditEntity: vi.fn(), setAuditField: vi.fn(),
    } as unknown as AdminDataPageModel;

    render(<AdminAuditPanel model={model} />);

    expect(screen.getByText(oldValue)).toHaveClass('ipc-admin-audit-value');
    expect(screen.getByText(newValue)).toHaveClass('ipc-admin-audit-value');
    expect(screen.getByText('Đối soát phiếu hoàn kho')).toBeInTheDocument();
  });

  it('keeps explicit column scope and the shared audit preference owner', () => {
    const source = require('node:fs').readFileSync(require('node:path').resolve(process.cwd(), 'src/app/pages/admin-data/AdminAuditPanel.tsx'), 'utf8');
    expect(source).toContain("tableId: 'admin-audit'");
    expect(source).toContain('preferences={{ accountId: currentUser?.id, config: adminAuditPreferenceConfig }}');
    expect(source.match(/<th scope="col"/g)).toHaveLength(7);
    expect(source).toContain('handleExportAuditCsv');
    expect(source).toContain('CursorPaginationBar');
  });
});
