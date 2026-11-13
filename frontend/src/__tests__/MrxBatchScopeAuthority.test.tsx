import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as transport from '../api/client';
import type { MrxBatch, MrxQuantityPreview, MrxWeeklySource } from '../api/mrxApi';
import { useMrxBatchWorkspace } from '../features/weekly-menu/hooks/useMrxBatchWorkspace';
import { AuthProvider } from '../store/authContext';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';

const week = '2026-11-02';
const source = (customerId: string): MrxWeeklySource => ({
  customerId, customerCode: customerId, customerName: customerId,
  weekStartDate: week, weekEndDate: '2026-11-08', menuVersionId: `menu-${customerId}`,
  menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
  validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
});
const preview: MrxQuantityPreview = {
  token: 'token-A', contentFingerprint: 'fingerprint-A', fingerprintFormatVersion: 3,
  expiresAt: '2026-11-02T01:00:00Z', plans: [], diagnostics: [],
};
const batch: MrxBatch = {
  batchId: 'batch-A', menuVersionId: 'menu-A', quantityImportBatchId: 'import-A',
  customerId: 'A', weekStartDate: week, status: 'DRAFT', version: 1,
  createdAt: '2026-11-02T00:00:00Z', lines: [],
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider><MemoryRouter>{children}</MemoryRouter></AuthProvider>;
}

function warmA() {
  workspaceSessionStore.setScope({ customerId: 'A', customerCode: 'A', weekStartDate: week, batchId: 'batch-A' });
  localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
  localStorage.setItem('ipc_v3_user', JSON.stringify({
    userId: 'manager-1', username: 'manager', fullName: 'Manager', roleCode: 'Manager', roleName: 'Manager',
    isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
  }));
  serverStateCache.set('catalog_customers', [{ customerId: 'A', customerCode: 'A', customerName: 'A' }]);
  const data = { customerId: 'A', weekStartDate: week, source: source('A'), batch };
  serverStateCache.set('snapshot:mrx_batch', { data });
  serverStateCache.set(`mrx_source_A_${week}`, data);
  serverStateCache.set(`mrx_preview_A_${week}`, preview);
}

describe('MRX weekly mutation scope authority', () => {
  it('does not preview or mutate retained A while loading B, and never caches an A token under B', async () => {
    warmA();
    let resolveSource!: (value: MrxWeeklySource) => void;
    const nextSource = new Promise<MrxWeeklySource>(resolve => { resolveSource = resolve; });
    const calls: string[] = [];
    vi.spyOn(transport, 'apiClient').mockImplementation(async (path) => {
      calls.push(path);
      if (path.includes('/weekly-menu?')) return nextSource;
      if (path.startsWith('/reconciliation/batches?')) return { items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false };
      if (path.endsWith('/quantity-import/preview')) return preview;
      if (path.endsWith('/ready')) return { ...batch, status: 'READY', version: 2 };
      if (path.includes('source-changes')) return [];
      throw new Error(`Unexpected API: ${path}`);
    });
    const { result } = renderHook(useMrxBatchWorkspace, { wrapper });
    await waitFor(() => expect(result.current.batch?.batchId).toBe('batch-A'));
    await act(async () => { result.current.setCustomerId('B'); });
    expect(result.current.stateProps.isPreviousData).toBe(true);
    await act(async () => { await result.current.markReady(); });
    expect(calls.filter(path => path.endsWith('/quantity-import/preview'))).toEqual([]);
    expect(calls.filter(path => path.endsWith('/ready'))).toEqual([]);
    expect(serverStateCache.get(`mrx_preview_B_${week}`)).toBeNull();
    await act(async () => { resolveSource(source('B')); });
    await waitFor(() => expect(result.current.source?.customerId).toBe('B'));
    expect(result.current.preview).toBeNull();
    expect(result.current.batch).toBeNull();
  });

  it.each([
    { operation: 'markReady' as const, returnToA: false },
    { operation: 'checkQuantities' as const, returnToA: false },
    { operation: 'markReady' as const, returnToA: true },
  ])('ignores a late $operation result after A → B (return to A: $returnToA)', async ({ operation, returnToA }) => {
    warmA();
    let resolveResponse!: (value: MrxBatch | MrxQuantityPreview) => void;
    const response = new Promise<MrxBatch | MrxQuantityPreview>(resolve => { resolveResponse = resolve; });
    vi.spyOn(transport, 'apiClient').mockImplementation(async (path) => {
      if (path.includes('/weekly-menu?')) return source('B');
      if (path.startsWith('/reconciliation/batches?')) return { items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false };
      if (path.endsWith('/ready') || path.endsWith('/quantity-import/preview')) return response;
      if (path.includes('source-changes')) return [];
      throw new Error(`Unexpected API: ${path}`);
    });
    const { result } = renderHook(useMrxBatchWorkspace, { wrapper });
    await waitFor(() => expect(result.current.batch?.batchId).toBe('batch-A'));
    let pending!: Promise<void>;
    act(() => { pending = result.current[operation](); });
    await act(async () => { result.current.setCustomerId('B'); });
    await waitFor(() => expect(result.current.source?.customerId).toBe('B'));
    if (returnToA) {
      serverStateCache.set(`mrx_source_A_${week}`, {
        customerId: 'A', weekStartDate: week, source: source('A'),
        batch: { ...batch, status: 'IN_PROGRESS', version: 3 },
      });
      await act(async () => { result.current.setCustomerId('A'); });
      await waitFor(() => expect(result.current.batch?.version).toBe(3));
    }
    await act(async () => {
      resolveResponse(operation === 'markReady' ? { ...batch, status: 'READY', version: 2 } : preview);
      await pending;
    });
    expect(result.current.source?.customerId).toBe(returnToA ? 'A' : 'B');
    if (returnToA) {
      expect(result.current.batch?.version).toBe(3);
      expect(result.current.batch?.status).toBe('IN_PROGRESS');
    } else {
      expect(result.current.batch).toBeNull();
      expect(result.current.preview).toBeNull();
    }
    expect(serverStateCache.get(`mrx_preview_B_${week}`)).toBeNull();
  });

  it('rejects a mutation response for another customer instead of relabelling it as A', async () => {
    warmA();
    vi.spyOn(transport, 'apiClient').mockImplementation(async (path) => {
      if (path.endsWith('/ready')) return { ...batch, batchId: 'batch-B', customerId: 'B', menuVersionId: 'menu-B' };
      if (path.includes('source-changes')) return [];
      throw new Error(`Unexpected API: ${path}`);
    });
    const { result } = renderHook(useMrxBatchWorkspace, { wrapper });
    await waitFor(() => expect(result.current.batch?.batchId).toBe('batch-A'));
    await act(async () => { await result.current.markReady(); });
    expect(result.current.batch?.batchId).toBe('batch-A');
    expect(result.current.actionError?.message).toContain('không khớp');
  });
});
