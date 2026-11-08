import { File as NativeFile } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { isRouteEligible } from '../routes/navigationEligibility';
import { systemApi } from '../api/systemApi';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import { serverStateCache } from '../store/serverStateCache';
import { MOCK_WEEKLY_MENU_DATA } from '../test/fixtures';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiTransport from '../api/client';
import { ApiError } from '../api/client';
import { adminApi } from '../api/adminApi';
import { mrxApi, type MrxEditScope, type MrxMenuChangeResult } from '../api/mrxApi';
import { bomApi } from '../api/bomApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MrxSourceEditGrid } from '../features/weekly-menu/MrxSourceEditGrid';
import { MrxSourceChangePanel } from '../features/weekly-menu/MrxSourceChangePanel';
import { MrxPendingRequestsPanel } from '../features/weekly-menu/MrxPendingRequestsPanel';
import { WeeklyMenuImportPreview } from '../features/weekly-menu/WeeklyMenuImportPreview';
import { WeeklyMenuImportModal } from '../features/weekly-menu/WeeklyMenuImportModal';
import { useMrxSourceEdit, type MrxSourceDraft } from '../features/weekly-menu/hooks/useMrxSourceEdit';
import { buildMrxSourceMatrix } from '../features/weekly-menu/mrxSourceMatrixModel';

const scope: MrxEditScope = {
  batchId: 'batch-1',
  batchStatus: 'IN_PROGRESS',
  batchVersion: 3,
  menuVersionId: 'menu-v1',
  days: [
    {
      serviceDate: '2026-06-15', isLocked: true, lockReason: 'Đã xuất kho',
      shifts: [{ shiftName: 'MORNING', savoryServings: 100, vegetarianServings: 20, slots: [
        { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt' },
      ] }],
    },
    {
      serviceDate: '2026-06-16', isLocked: false,
      shifts: [{ shiftName: 'MORNING', savoryServings: 90, vegetarianServings: 10, slots: [
        { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt' },
        { dishSlot: 'vegetarian-main', menuVariant: 'vegetarian', slotLabel: 'Món chay', dishId: 'dish-2', dishCode: 'C01', dishName: 'Cơm chay' },
      ] }],
    },
  ],
};

const matrixScope: MrxEditScope = {
  batchId: null,
  batchStatus: null,
  batchVersion: null,
  menuVersionId: 'menu-v1',
  days: [
    {
      serviceDate: '2026-09-21', isLocked: false, lockReason: null,
      shifts: [{ shiftName: 'MORNING', savoryServings: null, vegetarianServings: null, slots: [
        { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn 1', dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc' },
        { dishSlot: 'savory-sub1', menuVariant: 'savory', slotLabel: 'Món mặn 2', dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc' },
        { dishSlot: 'savory-rau', menuVariant: 'savory', slotLabel: 'Rau', dishId: 'dish-b', dishCode: 'B', dishName: 'Bún mọc' },
        { dishSlot: 'savory-canh', menuVariant: 'savory', slotLabel: 'Canh', dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc' },
      ] }],
    },
    {
      serviceDate: '2026-09-22', isLocked: false, lockReason: null,
      shifts: [{ shiftName: 'MORNING', savoryServings: 120, vegetarianServings: 20, slots: [
        { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn 1', dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc' },
        { dishSlot: 'savory-sub1', menuVariant: 'savory', slotLabel: 'Món mặn 2', dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc' },
        { dishSlot: 'savory-rau', menuVariant: 'savory', slotLabel: 'Rau', dishId: 'dish-c', dishCode: 'C', dishName: 'Rau xào' },
        { dishSlot: 'savory-canh', menuVariant: 'savory', slotLabel: 'Canh', dishId: 'dish-d', dishCode: 'D', dishName: 'Canh bí' },
      ] }],
    },
  ],
};

const matrixDraft = {
  '2026-09-21': { MORNING: { savoryServings: null, vegetarianServings: null, dishes: {
    'savory-main': 'dish-a', 'savory-sub1': 'dish-a', 'savory-rau': 'dish-b', 'savory-canh': 'dish-a',
  } } },
  '2026-09-22': { MORNING: { savoryServings: 120, vegetarianServings: 20, dishes: {
    'savory-main': 'dish-a', 'savory-sub1': 'dish-a', 'savory-rau': 'dish-c', 'savory-canh': 'dish-d',
  } } },
};

describe('MRX weekly source matrix model', () => {
  it('groups only adjacent equal-DishId slots and adjacent matching day blocks in completion mode', () => {
    const matrix = buildMrxSourceMatrix({ ...matrixScope, days: [
      ...matrixScope.days,
      { ...matrixScope.days[1], serviceDate: '2026-09-23' },
      { ...matrixScope.days[1], serviceDate: '2026-09-24', isLocked: true, lockReason: 'Đã xuất kho' },
    ] }, matrixDraft, 'completion');
    const savoryMorning = matrix.sections.find((section) => section.key === 'MORNING-savory');

    expect(savoryMorning).toBeDefined();
    const first = savoryMorning!.rows[0].positions[0];
    expect(first.kind).toBe('cell');
    if (first.kind !== 'cell') throw new Error('Expected grouped matrix cell.');
    expect(first.cell.rowSpan).toBe(2);
    expect(first.cell.colSpan).toBe(3);
    expect(first.cell.slots.map((slot) => `${slot.serviceDate}:${slot.dishSlot}`)).toEqual([
      '2026-09-21:savory-main', '2026-09-21:savory-sub1',
      '2026-09-22:savory-main', '2026-09-22:savory-sub1',
      '2026-09-23:savory-main', '2026-09-23:savory-sub1',
    ]);
    expect(first.cell.serviceDates).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(savoryMorning!.rows[0].positions[3]).toMatchObject({ kind: 'cell', cell: { colSpan: 1, isLocked: true } });
    expect(savoryMorning!.rows[1].positions[0].kind).toBe('covered');
    expect(savoryMorning!.rows[2].positions[0].kind).toBe('cell');
    expect(savoryMorning!.rows[3].positions[0].kind).toBe('cell');
  });

  it('keeps an empty variant section available for web-owned servings', () => {
    const matrix = buildMrxSourceMatrix(matrixScope, matrixDraft, 'completion');
    const vegetarianMorning = matrix.sections.find((section) => section.key === 'MORNING-vegetarian');

    expect(vegetarianMorning).toBeDefined();
    expect(vegetarianMorning!.rows).toHaveLength(0);
    expect(vegetarianMorning!.servings).toHaveLength(2);
  });

  it('groups adjacent slots vertically in dish-edit mode without merging dates or dropping slot identities', () => {
    const matrix = buildMrxSourceMatrix(matrixScope, matrixDraft, 'dish-edit');
    const savoryMorning = matrix.sections.find((section) => section.key === 'MORNING-savory')!;

    expect(savoryMorning.rows[0].positions[0]).toMatchObject({ kind: 'cell', cell: { rowSpan: 2, colSpan: 1, slots: [{ dishSlot: 'savory-main' }, { dishSlot: 'savory-sub1' }] } });
    expect(savoryMorning.rows[1].positions[0]).toEqual({ kind: 'covered' });
    expect(savoryMorning.rows[0].positions[1]).toMatchObject({ kind: 'cell', cell: { rowSpan: 2, colSpan: 1 } });
    expect(savoryMorning.rows[2].positions[0]).toMatchObject({ kind: 'cell', cell: { dishId: 'dish-b', rowSpan: 1 } });
  });
});

function importPreview(outcome?: string): NonNullable<Awaited<ReturnType<typeof weeklyMenuApi.previewWeeklyMenuImport>>> {
  return {
    committed: false,
    counts: {
      bomLinesCreated: 0, bomLinesUpdated: 0, currentStockRowsCreated: 0, currentStockRowsUpdated: 0,
      customersCreated: 0, customersUpdated: 0, dishesCreated: 0, dishesUpdated: 0,
      ingredientsCreated: 0, ingredientsUpdated: 0, inventoryReceiptLinesCreated: 0, inventoryReceiptLinesUpdated: 0,
      inventoryReceiptsCreated: 0, inventoryReceiptsUpdated: 0, mealQuantityPlanLinesCreated: 0, mealQuantityPlanLinesUpdated: 0,
      mealQuantityPlansCreated: 0, mealQuantityPlansUpdated: 0, menuItemsCreated: 0, menuItemsUpdated: 0,
      menuSchedulesCreated: 0, menuSchedulesUpdated: 0, menusCreated: 0, menusUpdated: 0,
      quantityImportBatchesCreated: 0, rolesCreated: 0, stockMovementsCreated: 0, stockMovementsUpdated: 0,
      suppliersCreated: 0, suppliersUpdated: 0, unitsCreated: 0, usersCreated: 0, warehousesCreated: 0,
    },
    customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
    detectedLayout: { dayColumns: [], labelColumn: 'Món', rowsImported: 0, rowsScanned: 0, rowsSkipped: 0, sections: [], sheetName: 'Thực đơn' },
    fileName: 'menu.xlsx', importedWeeklyMenu: {}, previewDiff: { addedSlots: 0, changedSlots: 0, removedSlots: 0, unchangedSlots: 0, rows: [] },
    weekStartDate: '2026-06-15', weekEndDate: '2026-06-21', menuVersionId: 'menu-v1', menuVersionNo: 1, menuVersionStatus: 'DRAFT', previewToken: 'token', previewExpiresAt: new Date(Date.now() + 300_000).toISOString(), rows: [], warnings: [],
    mrxDayOutcomes: outcome ? [{ serviceDate: '2026-06-15', outcome }] : [],
    validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
  };
}

const preview: MrxMenuChangeResult = {
  affectedDemandCount: 0, affectedDocumentIds: [], affectedPurchaseRequestCount: 0,
  affectedReconciliationBatchIds: ['batch-1'], affectedSourceLineIds: [], decisionScopes: [],
  hasIssue: true, hasPurchaseOrder: false, hasReceipt: false, impactLines: [{
    serviceDate: '2026-06-16', shiftName: 'MORNING', dishSlot: 'savory-main',
    oldDishId: 'dish-1', newDishId: 'dish-1', currentServings: 100, newServings: 105,
    currentSavoryServings: 90, newSavoryServings: 95, currentVegetarianServings: 10, newVegetarianServings: 10,
  }],
  lockedDates: ['2026-06-15'], materialImpact: [{ serviceDate: '2026-06-16', ingredientCode: 'NL01', ingredientName: 'Gạo', unitName: 'kg', previousQuantity: 10, newQuantity: 12 }],
  menuAmendmentId: '', requiresReconciliation: true, status: 'PREVIEW',
};

const fourSectionScope: MrxEditScope = {
  ...matrixScope,
  days: matrixScope.days.map((day) => {
    const morning = day.shifts[0];
    return {
      ...day,
      shifts: [
        {
          ...morning,
          slots: [...morning.slots, {
            dishSlot: 'vegetarian-main', menuVariant: 'vegetarian', slotLabel: 'Món chay',
            dishId: 'dish-v', dishCode: 'V', dishName: 'Đậu khuôn kho',
          }],
        },
        {
          shiftName: 'AFTERNOON', savoryServings: day.serviceDate === '2026-09-21' ? null : 100,
          vegetarianServings: day.serviceDate === '2026-09-21' ? null : 15,
          slots: [
            { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn 1', dishId: 'dish-c', dishCode: 'C', dishName: 'Rau xào' },
            { dishSlot: 'vegetarian-main', menuVariant: 'vegetarian', slotLabel: 'Món chay', dishId: 'dish-v', dishCode: 'V', dishName: 'Đậu khuôn kho' },
          ],
        },
      ],
    };
  }),
};

const fourSectionDraft: MrxSourceDraft = Object.fromEntries(fourSectionScope.days.map((day) => [
  day.serviceDate,
  Object.fromEntries(day.shifts.map((shift) => [shift.shiftName, {
    savoryServings: shift.savoryServings ?? null,
    vegetarianServings: shift.vegetarianServings ?? null,
    dishes: Object.fromEntries(shift.slots.map((slot) => [slot.dishSlot, slot.dishId ?? ''])),
  }])),
]));

const matrixDishOptions = [
  { dishId: 'dish-a', dishCode: 'A', dishName: 'Bún mọc', isActive: true },
  { dishId: 'dish-b', dishCode: 'B', dishName: 'Bún mọc', isActive: true },
  { dishId: 'dish-c', dishCode: 'C', dishName: 'Rau xào', isActive: true },
  { dishId: 'dish-d', dishCode: 'D', dishName: 'Canh bí', isActive: true },
  { dishId: 'dish-v', dishCode: 'V', dishName: 'Đậu khuôn kho', isActive: true },
];

describe('MRX weekly source matrix component', () => {
  it('renders four canonical sections with merged read blocks and explicit slot controls while editing', () => {
    const props = {
      editScope: fourSectionScope,
      draft: fourSectionDraft,
      dishOptions: matrixDishOptions,
      onServingsChange: vi.fn(),
      onDishChange: vi.fn(),
      lockedHighlight: [],
    };
    const { rerender } = render(<MrxSourceEditGrid {...props} mode="completion" />);

    expect(screen.getByText('MẶN · Sáng')).toBeInTheDocument();
    expect(screen.getByText('CHAY · Sáng')).toBeInTheDocument();
    expect(screen.getByText('MẶN · Chiều')).toBeInTheDocument();
    expect(screen.getByText('CHAY · Chiều')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(8);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByRole('cell', { name: /Bún mọc.*2 ngày.*2 loại món/i })).toBeInTheDocument();

    rerender(<MrxSourceEditGrid {...props} mode="dish-edit" />);
    expect(screen.getAllByRole('combobox')).toHaveLength(12);

    rerender(<MrxSourceEditGrid {...props} mode="dish-edit" readOnly />);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getAllByText('Chưa nhập').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('cell', { name: /Bún mọc/ }).length).toBeGreaterThan(0);
  });
  it('replaces every slot in a four-row dish, exposes stable individual editors and regroups only when finished', async () => {
    const user = userEvent.setup();
    const groupedScope: MrxEditScope = { ...matrixScope, days: [{ ...matrixScope.days[0], shifts: [{ ...matrixScope.days[0].shifts[0], savoryServings: 100, vegetarianServings: 0,
      slots: matrixScope.days[0].shifts[0].slots.map((slot) => ({ ...slot, dishId: 'dish-a' })),
    }] }] };
    // Exercise the real grid callback contract with a stateful draft.
    function Editor() {
      const [draft, setDraft] = useState<MrxSourceDraft>({ '2026-09-21': { MORNING: { savoryServings: 100, vegetarianServings: 0, dishes: Object.fromEntries(groupedScope.days[0].shifts[0].slots.map((slot) => [slot.dishSlot, 'dish-a'])) } } });
      return <MrxSourceEditGrid editScope={groupedScope} draft={draft} dishOptions={matrixDishOptions} lockedHighlight={[]} onServingsChange={() => {}} onDishChange={(date, shift, slot, id) => setDraft((current) => ({ ...current, [date]: { ...current[date], [shift]: { ...current[date][shift], dishes: { ...current[date][shift].dishes, [slot]: id } } } }))} />;
    }
    const { rerender } = render(<Editor />);
    expect(screen.getByRole('cell', { name: /Bún mọc, 1 ngày, 4 loại món/ })).toHaveAttribute('rowspan', '4');
    await user.click(screen.getByRole('combobox', { name: /Món mặn 1 21\/09 Sáng/ }));
    await user.click(screen.getByRole('option', { name: /Rau xào/ }));
    expect(screen.getByRole('cell', { name: /Rau xào, 1 ngày, 4 loại món/ })).toHaveAttribute('rowspan', '4');
    expect(screen.getByText('Nhóm · 4 dòng')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Tách để sửa riêng/ }));
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
    await user.click(screen.getByRole('combobox', { name: 'Món mặn 2 21/09 Sáng' }));
    await user.click(screen.getByRole('option', { name: /Canh bí/ }));
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Hoàn tất sửa từng dòng' }));
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 21/09 Sáng' })).toHaveValue(100);
    rerender(<MrxSourceEditGrid editScope={{ ...groupedScope, days: [{ ...groupedScope.days[0], isLocked: true, lockReason: 'Đã xuất kho' }] }} draft={{}} dishOptions={matrixDishOptions} lockedHighlight={[]} onServingsChange={() => {}} onDishChange={() => { throw new Error('Locked source must not mutate'); }} />);
    expect(screen.queryByRole('button', { name: /Tách để sửa riêng/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByRole('columnheader', { name: /21\/09.*Đã xuất kho/ })).toBeVisible();
  });
});

describe('MRX direct source edit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(bomApi, 'getSupportedPriceTiers').mockResolvedValue([25000, 30000, 34000]);
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue(scope);
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [
        { dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true },
        { dishId: 'dish-2', dishCode: 'C01', dishName: 'Cơm chay', isActive: true },
      ], totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
  });

  it('does not resend an accepted source change when its authoritative reload fails, and recovers by reading only', async () => {
    vi.mocked(mrxApi.getEditScope).mockRestore();
    vi.mocked(adminApi.getDishes).mockRestore();
    let reads = 0;
    let writes = 0;
    vi.spyOn(apiTransport, 'apiClient').mockImplementation(async (path, options) => {
      if (path.startsWith('/reconciliation/weekly-menu/edit-scope')) {
        reads += 1;
        if (reads === 2) throw new ApiError(500, 'Không thể tải lại nguồn');
        return { ...scope, days: scope.days.map(day => day.isLocked || reads === 1 ? day : { ...day, shifts: day.shifts.map(shift => ({ ...shift, savoryServings: 125 })) }) };
      }
      if (path.startsWith('/Dishes')) return { items: [{ dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true }, { dishId: 'dish-2', dishCode: 'C01', dishName: 'Cơm chay', isActive: true }], totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      if (path === '/coordination/weekly-menu/amendments/mrx-apply' && options?.method === 'POST') { writes += 1; return { ...preview, status: 'APPLIED' }; }
      throw new Error(`Unexpected source reconciliation request ${path}`);
    });
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.editScope).not.toBeNull());
    act(() => result.current.setServings('2026-06-16', 'MORNING', 'savory', 125));
    await act(async () => expect(await result.current.apply('Cập nhật số suất đã chốt')).toBe(false));
    expect(result.current.error?.message).toMatch(/tiếp nhận.*tải lại/i);
    await act(async () => { await result.current.apply('Cập nhật số suất đã chốt'); });
    expect(writes).toBe(1);
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBeNull();
    expect(result.current.changedLines).toHaveLength(0);
    expect(result.current.draft['2026-06-16'].MORNING.savoryServings).toBe(125);
    expect(writes).toBe(1);
  });

  it('disables locked-day inputs while keeping open-day inputs editable', async () => {
    vi.mocked(adminApi.getDishes).mockResolvedValue({ items: [{ dishId: 'dish-2', dishCode: 'C01', dishName: 'Cơm chay', isActive: true }], totalCount: 150, pageNumber: 1, pageSize: 100, totalPages: 2, hasPrev: false, hasNext: true });
    vi.spyOn(adminApi, 'getDish').mockResolvedValue({ dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true });
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.editScope).toEqual(scope));
    expect(result.current.dishOptions).toContainEqual(expect.objectContaining({ dishId: 'dish-1', dishName: 'Cơm thịt' }));

    render(<MrxSourceEditGrid mode="dish-edit" editScope={scope} draft={result.current.draft} dishOptions={result.current.dishOptions}
      onServingsChange={result.current.setServings} onDishChange={result.current.setDish} lockedHighlight={[]} />);

    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 15/06 Sáng' })).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: 'Món mặn 15/06 Sáng' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 16/06 Sáng' })).toBeEnabled();
    expect(screen.getByText('Đã xuất kho')).toBeInTheDocument();
    vi.spyOn(mrxApi, 'applySourceChange').mockResolvedValue({ ...preview, status: 'APPLIED' });
    act(() => result.current.setServings('2026-06-16', 'MORNING', 'savory', 95));
    await act(async () => { expect(await result.current.apply('Đổi số suất')).toBe(true); });
    expect(adminApi.getDish).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.reload(); });
    expect(adminApi.getDish).toHaveBeenCalledTimes(2);
  });

  it('lets an unreferenced dish beyond the first catalog page be selected', async () => {
    vi.restoreAllMocks();
    const first = Array.from({ length: 100 }, (_, i) => ({ dishId: `dish-${i + 1}`, dishCode: `M${i + 1}`, dishName: 'Cơm thịt', isActive: true }));
    const last = { dishId: 'dish-101', dishCode: 'M101', dishName: 'Cơm thịt', isActive: true };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/edit-scope')) return Response.json({ success: true, data: scope });
      if (url.pathname.endsWith('/Dishes')) {
        const page = Number(url.searchParams.get('pageNumber') ?? 1);
        return Response.json({ success: true, data: { items: page === 1 ? first : [last], totalCount: 101, pageNumber: page, pageSize: 100, totalPages: 2, hasPrev: page > 1, hasNext: page < 2 } });
      }
      throw new Error(`Unexpected source picker request: ${url.pathname}`);
    });
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.dishOptions).toContainEqual(expect.objectContaining({ dishId: last.dishId })));
    render(<MrxSourceEditGrid mode="dish-edit" editScope={scope} draft={result.current.draft} dishOptions={result.current.dishOptions}
      onServingsChange={result.current.setServings} onDishChange={result.current.setDish} lockedHighlight={[]} />);
    const picker = screen.getByRole('combobox', { name: 'Món mặn 16/06 Sáng' });
    await userEvent.clear(picker);
    await userEvent.type(picker, last.dishCode);
    await userEvent.click(screen.getByRole('option', { name: /M101/ }));
    expect(result.current.changedLines).toContainEqual(expect.objectContaining({ newDishId: last.dishId }));
  });

  it('emits only changed unlocked lines and carries both serving splits', async () => {
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.editScope).toEqual(scope));

    act(() => {
      result.current.setServings('2026-06-15', 'MORNING', 'savory', 999);
      result.current.setServings('2026-06-16', 'MORNING', 'savory', 95);
    });

    expect(result.current.changedLines).toEqual([{
      serviceDate: '2026-06-16', shiftName: 'MORNING', dishSlot: 'savory-main', newDishId: 'dish-1',
      newSavoryServings: 95, newVegetarianServings: 10,
    }]);
  });

  it('shows role-appropriate action and requires reason plus confirmation for apply', async () => {
    const apply = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const user = userEvent.setup();
    const { rerender } = render(<MrxSourceChangePanel previewResult={{ ...preview, materialImpact: [] }} actorRole="MANAGER" changedLinesCount={1}
      reason="" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);

    expect(screen.getByText(/Nguồn thay đổi:/)).toHaveTextContent('Nguồn thay đổi: 1 ngày.');
    expect(screen.queryByText(/Chi tiết định lượng nguyên liệu/)).not.toBeInTheDocument();
    await user.click(screen.getByText(/Thay đổi thực đơn và số suất/));
    const sourceRow = screen.getByRole('row', { name: /16\/06\/2026/ });
    expect(sourceRow).toHaveTextContent('90');
    expect(screen.getByRole('columnheader', { name: 'Mặn đã lưu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mặn đề nghị' })).toBeInTheDocument();
    expect(sourceRow).toHaveTextContent('95');
    expect(sourceRow).not.toHaveTextContent('→');

    expect(screen.getByRole('button', { name: 'Áp dụng ngay' })).toBeDisabled();
    rerender(<MrxSourceChangePanel previewResult={preview} actorRole="COORDINATOR" changedLinesCount={1}
      reason="Đổi theo yêu cầu khách hàng" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);
    expect(screen.getByRole('button', { name: 'Gửi duyệt' })).toBeInTheDocument();

    rerender(<MrxSourceChangePanel previewResult={preview} actorRole="MANAGER" changedLinesCount={1}
      reason="Đổi theo yêu cầu khách hàng" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);
    await user.click(screen.getByRole('button', { name: 'Áp dụng ngay' }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByText('Áp dụng thay đổi cho 1 ngày, 1 nguyên liệu?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận áp dụng' }));
    expect(apply).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Xác nhận áp dụng thay đổi' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xác nhận áp dụng' }));
    expect(apply).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog', { name: 'Xác nhận áp dụng thay đổi' })).not.toBeInTheDocument();

    rerender(<MrxSourceChangePanel previewResult={preview} actorRole="WAREHOUSE" changedLinesCount={1}
      reason="Đổi theo yêu cầu khách hàng" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);
    expect(screen.queryByRole('button', { name: 'Áp dụng ngay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).not.toBeInTheDocument();
  });

  it('recovers the saved draft week by file bytes after discard and makes a new week an explicit choice', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const user = userEvent.setup();
    const history = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { items: [{
      menuVersionId: 'draft-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-06-15', versionNo: 1, status: 'DRAFT', sourceFileName: 'old-name.xlsx',
      createdAt: '2026-06-10T07:00:00Z', successRowCount: 2, errorRowCount: 0, warningRowCount: 0, canRollback: true,
    }], totalCount: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    function Entry() {
      const [open, setOpen] = useState(true);
      return open ? <WeeklyMenuImportModal isOpen onClose={() => setOpen(false)} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} onImportSuccess={() => {}} />
        : <button onClick={() => setOpen(true)}>Mở nhập</button>;
    }
    render(<Entry />);
    for (const name of ['original.xlsx', 'renamed.xlsx']) {
      await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new NativeFile(['abc'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) as unknown as File);
      await user.click(await screen.findByRole('radio', { name: /25.000/ }));
      const date = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
      await waitFor(() => expect(date).toHaveValue('15/06/2026'));
      expect(date).toHaveAttribute('readonly');
      expect(date).toHaveAccessibleDescription('Đang dùng bản nháp tuần 15/06/2026');
      expect(screen.getByRole('button', { name: 'Mở lịch chọn ngày' })).toBeDisabled();
      expect(String(history.mock.calls.at(-1)![0])).toContain('sourceChecksum=BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
      if (name === 'original.xlsx') {
        await user.click(screen.getByRole('button', { name: 'Đóng' }));
        await user.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
        await user.click(screen.getByRole('button', { name: 'Mở nhập' }));
      }
    }
    await user.click(screen.getByRole('button', { name: 'Đổi tuần' }));
    const date = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
    expect(date).not.toHaveAttribute('readonly');
    await user.clear(date);
    await user.type(date, '22/06/2026');
    await user.tab();
    expect(date).toHaveValue('22/06/2026');
    expect(screen.queryByText(/Đang dùng bản nháp tuần/)).not.toBeInTheDocument();
  });

  it('does not let a late draft lookup overwrite an explicitly changed week', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const user = userEvent.setup();
    let respond!: (response: Response) => void;
    const history = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { respond = resolve; }));
    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new NativeFile(['abc'], 'menu.xlsx') as unknown as File);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await waitFor(() => expect(history).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Đổi tuần' }));
    const date = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
    await user.type(date, '22/06/2026');
    await user.tab();
    await act(async () => respond(new Response(JSON.stringify({ success: true, data: { items: [{ menuVersionId: 'draft-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-06-15', versionNo: 1, status: 'DRAFT', createdAt: '2026-06-10T07:00:00Z', successRowCount: 1, errorRowCount: 0, warningRowCount: 0, canRollback: true }], totalCount: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(date).toHaveValue('22/06/2026');
    expect(screen.queryByText(/Đang dùng bản nháp tuần/)).not.toBeInTheDocument();
  });

  it('requires a choice between matching draft weeks and clears recovery when the customer changes', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const user = userEvent.setup();
    const history = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const secondCustomer = String(url).includes('customerId=customer-2');
      const items = secondCustomer ? [] : ['2026-06-15', '2026-06-22'].map((weekStartDate, index) => ({
        menuVersionId: `draft-${index}`, customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate,
        versionNo: 1, status: 'DRAFT', createdAt: '2026-06-10T07:00:00Z', successRowCount: 1, errorRowCount: 0, warningRowCount: 0, canRollback: true,
      }));
      return new Response(JSON.stringify({ success: true, data: { items, totalCount: items.length } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }, { customerId: 'customer-2', customerCode: 'NEW', customerName: 'Khách mới' }]} onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new NativeFile(['abc'], 'menu.xlsx') as unknown as File);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    const choice = await screen.findByRole('combobox', { name: 'Chọn tuần bản nháp' });
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
    await user.selectOptions(choice, 'draft-1');
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('22/06/2026');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng nhập thực đơn' }), 'customer-2');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).not.toHaveAttribute('readonly'));
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('');
    expect(String(history.mock.calls.at(-1)![0])).toContain('customerId=customer-2');
    expect(screen.queryByText(/Đang dùng bản nháp tuần/)).not.toBeInTheDocument();
  });

  it('switches the single importer between fixed current scope and new-week recovery without retaining a stale preview or lookup', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const user = userEvent.setup();
    let resolveHistory!: (response: Response) => void;
    const previewScopes: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).includes('import-history')) return new Promise<Response>(resolve => { resolveHistory = resolve; });
      if (String(url).includes('/import/preview')) {
        const body = options!.body as FormData;
        expect(body.get('file')).toBeInstanceOf(File);
        previewScopes.push(`${body.get('customerId')}:${body.get('weekStartDate')}`);
        return new Response(JSON.stringify({ success: true, data: importPreview() }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`Unexpected importer read ${url}`);
    });
    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]}
      initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" currentWeekStartDate="2026-06-15" initialScopeIntent="current-week" mrxActorRole="MANAGER" onImportSuccess={() => {}} />);
    const intent = screen.getByRole('combobox', { name: 'Phạm vi nhập Excel' });
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng nhập thực đơn' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveAttribute('readonly');
    const file = new File(['abc'], 'menu.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('abc').buffer });
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), file);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    expect(await screen.findByRole('region', { name: 'Kết quả phân tích file' })).toBeVisible();
    await user.selectOptions(intent, 'new-week');
    expect(screen.queryByRole('region', { name: 'Kết quả phân tích file' })).not.toBeInTheDocument();
    await waitFor(() => expect(resolveHistory).toBeDefined());
    await user.selectOptions(intent, 'current-week');
    await act(async () => resolveHistory(new Response(JSON.stringify({ success: true, data: { items: [{
      menuVersionId: 'old-draft', customerId: 'customer-1', weekStartDate: '2026-06-22', status: 'DRAFT', versionNo: 1,
      customerCode: 'DAV', customerName: 'Draxlmaier', createdAt: '2026-06-10T07:00:00Z', successRowCount: 1, errorRowCount: 0, warningRowCount: 0, canRollback: true,
    }], totalCount: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    expect(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' })).toHaveValue('15/06/2026');
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await waitFor(() => expect(previewScopes).toEqual(['customer-1:2026-06-15', 'customer-1:2026-06-15']));
  });

  it('bounds a large normalized preview without dropping the final menu row', async () => {
    const user = userEvent.setup();
    const result = { ...importPreview(), detectedLayout: { ...importPreview().detectedLayout, rowsScanned: 52, rowsImported: 52 }, rows: Array.from({ length: 52 }, (_, index) => ({
      serviceDate: index === 51 ? '2026-06-16' : '2026-06-15', dayKey: 't2', sourceRowNumber: 9 + index, sourceColumn: 'D', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'main', slotLabel: 'Món chính', dishName: index === 51 ? 'Món ngày sau' : index === 50 ? 'Canh bí' : 'Cơm thịt', rowSpan: 1, isMergedContinuation: false, dishId: index >= 50 ? 'dish-2' : 'dish-1', existingDish: true,
    })) };
    render(<WeeklyMenuImportPreview result={result} priceTierAmount={30000} />);
    expect(screen.getByText('Canh bí')).toBeVisible();
    expect(screen.getByText('Món ngày sau')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: '15/06/2026' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: '16/06/2026' })).toBeVisible();
    expect(screen.getAllByText('Cơm thịt')).toHaveLength(50);
    expect(screen.queryByRole('button', { name: 'Trang sau' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chi tiết nguồn' }));
    expect(screen.queryByText('Canh bí')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(screen.getByText('Món ngày sau')).toBeVisible();
    expect(screen.getByText('Canh bí')).toBeVisible();
    expect(screen.queryByText('Cơm thịt')).not.toBeInTheDocument();
  });

  it('preserves verified workbook merges while keeping identical unmerged occurrences and every raw source cell', async () => {
    const row = { serviceDate: '2026-06-15', dayKey: 't2', sourceRowNumber: 9, sourceColumn: 'D', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'main', slotLabel: 'Món chính', dishName: 'Cơm thịt', rowSpan: 2, isMergedContinuation: false, dishId: 'dish-1', existingDish: true };
    render(<WeeklyMenuImportPreview result={{ ...importPreview(), rows: [
      row,
      { ...row, sourceRowNumber: 10, slot: 'sub1', slotLabel: 'Món mặn 2', rowSpan: 1, isMergedContinuation: true },
      { ...row, serviceDate: '2026-06-16', dayKey: 't3', sourceColumn: 'E', rowSpan: 1 },
      { ...row, serviceDate: '2026-06-16', dayKey: 't3', sourceColumn: 'E', sourceRowNumber: 10, slot: 'sub1', slotLabel: 'Món mặn 2', dishName: 'Canh bí', dishId: 'dish-2', rowSpan: 1 },
      { ...row, serviceDate: '2026-06-17', dayKey: 't4', sourceColumn: 'F', rowSpan: 1 },
      { ...row, serviceDate: '2026-06-17', dayKey: 't4', sourceColumn: 'F', sourceRowNumber: 10, slot: 'sub1', slotLabel: 'Món mặn 2', dishName: 'Canh bí', dishId: 'dish-2', rowSpan: 1 },
    ] }} priceTierAmount={25000} />);
    const table = screen.getByRole('table', { name: 'Thực đơn tuần xem trước' });
    const cells = within(table).getAllByRole('cell', { name: 'Cơm thịt' });
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveAttribute('rowspan', '2');
    expect(cells[1]).toHaveAttribute('colspan', '2');
    expect(within(table).getByText('Canh bí')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Chi tiết nguồn' }));
    expect(screen.getAllByText('Cơm thịt')).toHaveLength(4);
    expect(screen.getByText('D9')).toBeVisible();
    expect(screen.getByText('D10')).toBeVisible();
    expect(screen.getByText('E9')).toBeVisible();
    expect(screen.getByText('E10')).toBeVisible();
    expect(screen.getByText('F9')).toBeVisible();
    expect(screen.getByText('F10')).toBeVisible();
  });

  it('previews actual duplicate slots and atomically imports two scopes, retaining files on failure and opening the chosen result', async () => {
    const user = userEvent.setup();
    const first = { ...importPreview(), detectedLayout: { ...importPreview().detectedLayout, rowsScanned: 2, rowsImported: 2 }, previewToken: 'first-token', rows: [
      { serviceDate: '2026-06-15', dayKey: 't2', sourceRowNumber: 9, sourceColumn: 'D', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'main', slotLabel: 'Món chính', dishName: 'Cơm thịt', rowSpan: 1, isMergedContinuation: false, dishId: 'dish-1', existingDish: true },
      { serviceDate: '2026-06-15', dayKey: 't2', sourceRowNumber: 10, sourceColumn: 'D', sourceSection: 'Mặn', sourceShift: 'Ca sáng', dbShiftName: 'MORNING', variant: 'savory', slot: 'sub1', slotLabel: 'Món mặn 2', dishName: 'Cơm thịt', rowSpan: 1, isMergedContinuation: true, dishId: 'dish-1', existingDish: true },
    ] };
    const second = { ...importPreview(), customerId: 'customer-2', customerCode: 'NEW', customerName: 'Khách hàng mới', weekStartDate: '2026-06-22', weekEndDate: '2026-06-28', previewToken: 'second-token', menuVersionId: 'menu-v2' };
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const single = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport');
    const commit = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImportBatch');
    const fetchBatch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: 'Nhóm chưa được lưu' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [{ ...first, committed: true }, { ...second, committed: true }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const publish = vi.spyOn(weeklyMenuApi, 'publishMenuSchedule');
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify({ userId: 'manager-1', fullName: 'Manager', username: 'manager', roleCode: 'Manager', roleName: 'Quản lý', isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'] }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-06-15T00:00:00Z', reasonRequired: true, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }, { customerId: 'customer-2', customerCode: 'NEW', customerName: 'Khách hàng mới' }]);
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false });
    vi.mocked(mrxApi.getEditScope).mockResolvedValue({ batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1', days: [] });
    const getSource = vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId, weekStartDate, customerCode: customerId === 'customer-1' ? 'DAV' : 'NEW', customerName: customerId === 'customer-1' ? 'Draxlmaier' : 'Khách hàng mới',
      weekEndDate: customerId === 'customer-1' ? '2026-06-21' : '2026-06-28', menuVersionId: customerId === 'customer-1' ? 'menu-v1' : 'menu-v2', menuVersionNo: 1, menuVersionStatus: 'DRAFT', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    const router = createMemoryRouter([{ path: '/weekly-menu', element: <WeeklyMenuPage /> }], { initialEntries: ['/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-06-15'] });
    render(<AuthProvider resolveEligibility={(actor, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, actor, mode)}><RouterProvider router={router} /></AuthProvider>);
    await user.click(await screen.findByRole('button', { name: 'Nhập Excel' }));
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), [new File(['first'], 'first.xlsx'), new File(['second'], 'second.xlsx')]);
    await user.click(await screen.findByRole('radio', { name: /30.000/ }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    const table = within(await screen.findByRole('region', { name: 'Thực đơn xem trước' })).getByRole('table');
    expect(within(table).getAllByText('Cơm thịt')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Chi tiết nguồn' }));
    expect(screen.getByText('Món mặn 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'second.xlsx' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng nhập thực đơn' }), 'customer-2');
    await user.click(screen.getByRole('button', { name: 'Đổi tuần' }));
    await user.type(screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' }), '22/06/2026');
    await user.tab();
    await user.click(screen.getByRole('radio', { name: /34.000/ }));
    expect(screen.getByRole('checkbox', { name: /Tự động xuất bản/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    serverStateCache.set('weekly_menu_DAV_2026-06-15', MOCK_WEEKLY_MENU_DATA);
    serverStateCache.set('weekly_menu_NEW_2026-06-22', MOCK_WEEKLY_MENU_DATA);
    serverStateCache.set('weekly_menu_DAV_2026-06-29', MOCK_WEEKLY_MENU_DATA);
    serverStateCache.set('snapshot:weekly_menu', { customerCode: 'DAV', weekStartDate: '2026-06-15', data: MOCK_WEEKLY_MENU_DATA });
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nhập nhóm' }));
    expect(await screen.findByText('Nhóm chưa được lưu')).toBeVisible();
    expect(serverStateCache.get('weekly_menu_DAV_2026-06-15')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'first.xlsx' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'second.xlsx' })).toBeVisible();
    expect(router.state.location.search).toContain('customerId=customer-1&weekStartDate=2026-06-15');
    await user.click(screen.getByRole('button', { name: 'Xác nhận nhập nhóm' }));
    await user.click(await screen.findByRole('button', { name: /Mở tuần Khách hàng mới/ }));
    expect(serverStateCache.get('weekly_menu_DAV_2026-06-15')).toBeNull();
    expect(serverStateCache.get('weekly_menu_NEW_2026-06-22')).toBeNull();
    expect(serverStateCache.get('snapshot:weekly_menu')).toBeNull();
    expect(serverStateCache.get('weekly_menu_DAV_2026-06-29')).not.toBeNull();
    expect(fetchBatch).toHaveBeenCalledTimes(2);
    expect(fetchBatch).toHaveBeenLastCalledWith(expect.stringMatching(/\/coordination\/weekly-menu\/import\/commit-batch$/), expect.objectContaining({ method: 'POST', body: commit.mock.calls[1][0] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toContain('customerId=customer-2&weekStartDate=2026-06-22');
    await waitFor(() => expect(getSource).toHaveBeenLastCalledWith('customer-2', '2026-06-22'));
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'customer-2', weekStartDate: '2026-06-22' });
    expect(single).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    const body = commit.mock.calls[1][0];
    expect(body.getAll('files').map((file) => (file as File).name)).toEqual(['first.xlsx', 'second.xlsx']);
    expect(body.getAll('customerIds')).toEqual(['customer-1', 'customer-2']);
    expect(body.getAll('weekStartDates')).toEqual(['2026-06-15', '2026-06-22']);
    expect(body.getAll('priceTierAmounts')).toEqual(['30000', '34000']);
    expect(body.getAll('previewTokens')).toEqual(['first-token', 'second-token']);
  });

  it('ignores a pending preview after its week changes instead of restoring a stale commit token', async () => {
    const user = userEvent.setup();
    let resolvePreview!: (value: ReturnType<typeof importPreview>) => void;
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockImplementationOnce(() => new Promise(resolve => { resolvePreview = resolve; }));
    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    const date = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
    expect(date).toBeEnabled();
    await user.clear(date);
    await user.type(date, '22/06/2026');
    await user.tab();
    await act(async () => resolvePreview(importPreview()));
    expect(date).toHaveValue('22/06/2026');
    expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Số dòng quét/)).not.toBeInTheDocument();
  });

  it.each([{ mode: 'MRX', role: 'MANAGER' as const }, { mode: 'DEFAULT', role: undefined }])('retains an accepted import after publication fails and never offers a duplicate commit - $mode', async ({ role }) => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview());
    const commit = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockResolvedValue({ ...importPreview(), committed: true });
    let rejectPublication!: (error: Error) => void;
    vi.spyOn(weeklyMenuApi, 'getMenuSchedules').mockImplementation(() => new Promise((_, reject) => { rejectPublication = reject; }));
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<WeeklyMenuImportModal isOpen mrxActorRole={role} onClose={onClose} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={onSuccess} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nhập' }));
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled();
    if (role) {
      const open = await screen.findByRole('button', { name: /Mở tuần Draxlmaier/ });
      expect(open).toBeDisabled();
      await user.click(open);
    } else expect(screen.queryByRole('button', { name: /Mở tuần/ })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectPublication(new ApiError(500, 'Không công bố được')));
    expect(await screen.findByText(/Đã nhập, chưa công bố/)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).not.toBeInTheDocument();
    if (role) {
      await user.click(screen.getByRole('button', { name: /Mở tuần Draxlmaier/ }));
      expect(onSuccess).toHaveBeenCalledWith({ customerId: 'customer-1', weekStartDate: '2026-06-15' });
    } else {
      await user.click(screen.getByRole('button', { name: 'Đóng' }));
      expect(onSuccess).toHaveBeenCalledWith();
    }
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate default servings after a successful menu import', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview());
    vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockResolvedValue({ ...importPreview(), committed: true });
    vi.spyOn(weeklyMenuApi, 'getMenuSchedules').mockResolvedValue([{ menuScheduleId: 'schedule-1', serviceDate: '2026-06-15', shiftName: 'MORNING', status: 'DRAFT' }]);
    vi.spyOn(weeklyMenuApi, 'publishMenuSchedule').mockResolvedValue({});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const onImportSuccess = vi.fn();
    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={onImportSuccess} />);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await screen.findByText(/Số dòng quét/);
    const weekInput = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
    await user.clear(weekInput);
    await user.type(weekInput, '16/06/2026');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày bắt đầu tuần phải là Thứ Hai');
    expect(screen.queryByRole('button', { name: 'Xác nhận nhập' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
    expect(weeklyMenuApi.commitWeeklyMenuImport).not.toHaveBeenCalled();
    await user.clear(weekInput);
    await user.type(weekInput, '15/06/2026');
    await user.tab();
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await screen.findByText(/Số dòng quét/);
    await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }));

    expect(onImportSuccess).toHaveBeenCalledWith({ customerId: 'customer-1', weekStartDate: '2026-06-15' });
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/meal-quantity-plans/quick-servings'))).toBe(false);
  });

  it('protects a selected import file on close and blocks dismissal during preview', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let resolvePreview!: (value: ReturnType<typeof importPreview>) => void;
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockImplementation(() => new Promise(resolve => { resolvePreview = resolve; }));
    render(<WeeklyMenuImportModal isOpen onClose={onClose} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), [new File(['menu'], 'menu.xlsx'), new File(['other'], 'other.xlsx')]);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Hủy thay đổi chưa lưu?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => resolvePreview(importPreview()));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('selects only the successfully imported MRX customer and week after a failed commit', async () => {
    const user = userEvent.setup();
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-06-14T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'NEW', customerName: 'Khách hàng mới' },
    ]);
    const getSource = vi.spyOn(mrxApi, 'getWeeklySource').mockImplementation(async (customerId, weekStartDate) => ({
      customerId, weekStartDate, customerCode: customerId === 'customer-1' ? 'DAV' : 'NEW', customerName: customerId === 'customer-1' ? 'Draxlmaier' : 'Khách hàng mới',
      weekEndDate: customerId === 'customer-1' ? '2026-06-21' : '2026-06-28', menuVersionId: customerId === 'customer-1' ? 'menu-v1' : 'menu-v2', menuVersionNo: 1, menuVersionStatus: 'DRAFT', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    }));
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false });
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([]);
    vi.mocked(mrxApi.getEditScope).mockResolvedValue({ batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1', days: [] });
    const nextPreview = { ...importPreview(), customerId: 'customer-2', customerCode: 'NEW', customerName: 'Khách hàng mới', weekStartDate: '2026-06-22', weekEndDate: '2026-06-28', menuVersionId: 'menu-v2' };
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(nextPreview);
    const commit = vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockRejectedValueOnce(new ApiError(409, 'Nguồn đã thay đổi')).mockResolvedValue({ ...nextPreview, committed: true });
    const createBatch = vi.spyOn(mrxApi, 'commitQuantityImport');
    const router = createMemoryRouter([{ path: '/weekly-menu', element: <WeeklyMenuPage /> }], { initialEntries: ['/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-06-15'] });
    render(<AuthProvider resolveEligibility={(actor, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, actor, mode)}><RouterProvider router={router} /></AuthProvider>);
    await user.click(await screen.findByRole('button', { name: 'Nhập Excel' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Phạm vi nhập Excel' }), 'new-week');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng nhập thực đơn' }), 'customer-2');
    await user.click(screen.getByRole('button', { name: 'Đổi tuần' }));
    const date = screen.getByRole('textbox', { name: 'Tuần bắt đầu nhập' });
    await user.clear(date);
    await user.type(date, '22/06/2026');
    await user.tab();
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'new-menu.xlsx'));
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.click(screen.getByRole('checkbox', { name: /Tự động xuất bản/ }));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nhập' }));
    expect(await screen.findByText('Nguồn đã thay đổi')).toBeVisible();
    expect(router.state.location.search).toContain('weekStartDate=2026-06-15');
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toContain('customerId=customer-2');
    expect(router.state.location.search).toContain('weekStartDate=2026-06-22');
    await waitFor(() => expect(getSource).toHaveBeenLastCalledWith('customer-2', '2026-06-22'));
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng MRX' })).toHaveValue('customer-2');
    expect(screen.getByRole('textbox', { name: 'Tuần MRX bắt đầu' })).toHaveValue('22/06/2026');
    expect(workspaceSessionStore.getScope()).toMatchObject({ customerId: 'customer-2', weekStartDate: '2026-06-22', batchId: '' });
    expect(commit.mock.calls[1][0].get('customerId')).toBe('customer-2');
    expect(commit.mock.calls[1][0].get('weekStartDate')).toBe('2026-06-22');
    expect(createBatch).not.toHaveBeenCalled();
  });

  it('uses the coordinator review action without legacy auto-publish on reimport', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview('CHANGED'));
    const onSuccess = vi.fn();
    vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockResolvedValue({ ...importPreview('CHANGED'), committed: false, menuVersionId: null, menuVersionNo: null, menuVersionStatus: null, mrxSourceChange: { ...preview, status: 'PENDING_REVIEW' } });
    vi.spyOn(weeklyMenuApi, 'getMenuSchedules').mockResolvedValue([{ menuScheduleId: 'schedule-1', serviceDate: '2026-06-15', shiftName: 'MORNING', status: 'PUBLISHED' }]);
    const publish = vi.spyOn(weeklyMenuApi, 'publishMenuSchedule').mockResolvedValue({});
    render(<WeeklyMenuImportModal isOpen mrxActorRole="COORDINATOR" onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={onSuccess} />);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await user.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));

    expect(weeklyMenuApi.commitWeeklyMenuImport).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('blocks reimport commit and explains a locked-day conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview('LOCKED_CONFLICT'));
    render(<WeeklyMenuImportModal isOpen mrxActorRole="MANAGER" onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
    await user.click(await screen.findByRole('radio', { name: /25.000/ }));
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));

    expect(await screen.findByText('Đã xuất kho – khác, bị chặn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Áp dụng ngay' })).toBeDisabled();
  });

  it('requires a rejection reason and forwards approve or reject decisions for pending requests', async () => {
    const decide = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const user = userEvent.setup();
    render(<MrxPendingRequestsPanel requests={[{
      menuAmendmentId: 'amendment-1', customerId: 'customer-1', customerName: 'Draxlmaier', weekStartDate: '2026-06-15',
      status: 'PENDING_REVIEW', reason: 'Đổi món', createdAt: '2026-06-14T08:00:00Z', affectedReconciliationBatchIds: ['batch-1'], impactLines: [],
    }, {
      menuAmendmentId: 'amendment-2', customerId: 'customer-2', customerName: 'Samsung', weekStartDate: '2026-06-15',
      status: 'PENDING_REVIEW', reason: 'Đổi suất', createdAt: '2026-06-14T09:00:00Z', affectedReconciliationBatchIds: ['batch-2'], impactLines: [],
    }]} isSubmitting={false} onDecide={decide} />);

    await user.click(screen.getByRole('button', { name: 'Xem yêu cầu Draxlmaier' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Yêu cầu nguồn cần duyệt' }), 'amendment-2');
    expect(screen.getByText('Lý do yêu cầu:').parentElement).toHaveTextContent('Đổi suất');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Duyệt thay đổi nguồn MRX' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Lý do từ chối thay đổi nguồn' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Phê duyệt thay đổi' }));
    expect(decide).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Xác nhận phê duyệt' }));
    await user.click(screen.getByRole('button', { name: 'Quay lại xem yêu cầu' }));
    expect(screen.getByRole('region', { name: 'Duyệt thay đổi nguồn MRX' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Từ chối…' }));
    expect(screen.getByRole('button', { name: 'Xác nhận từ chối' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Lý do từ chối thay đổi nguồn' }), 'Không đúng yêu cầu');
    await user.click(screen.getByRole('button', { name: 'Xác nhận từ chối' }));
    expect(decide).toHaveBeenNthCalledWith(2, 'amendment-2', false, 'Không đúng yêu cầu');
  });

  it('keeps the draft and highlights locked dates when apply loses to warehouse issue', async () => {
    vi.spyOn(mrxApi, 'previewSourceChange').mockResolvedValue(preview);
    vi.spyOn(mrxApi, 'applySourceChange').mockRejectedValue(new ApiError(409, 'locked', undefined, 'MRX_DAY_LOCKED', ['2026-06-16']));
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.editScope).toEqual(scope));
    act(() => result.current.setServings('2026-06-16', 'MORNING', 'savory', 95));
    await act(async () => { await result.current.preview(); });
    let applied: boolean | undefined;
    await act(async () => { applied = await result.current.apply('Điều chỉnh ca sáng'); });

    expect(applied).toBe(false);
    expect(result.current.draft['2026-06-16'].MORNING.savoryServings).toBe(95);
    expect(result.current.lockedHighlight).toEqual(['2026-06-16']);
    expect(result.current.error?.message).toContain('16/06');
  });
});
