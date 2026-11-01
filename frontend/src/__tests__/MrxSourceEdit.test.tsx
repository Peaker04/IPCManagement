import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { adminApi } from '../api/adminApi';
import { mrxApi, type MrxEditScope, type MrxMenuChangeResult } from '../api/mrxApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MrxSourceEditGrid } from '../features/weekly-menu/MrxSourceEditGrid';
import { MrxSourceChangePanel } from '../features/weekly-menu/MrxSourceChangePanel';
import { MrxPendingRequestsPanel } from '../features/weekly-menu/MrxPendingRequestsPanel';
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
    const matrix = buildMrxSourceMatrix(matrixScope, matrixDraft, 'completion');
    const savoryMorning = matrix.sections.find((section) => section.key === 'MORNING-savory');

    expect(savoryMorning).toBeDefined();
    const first = savoryMorning!.rows[0].positions[0];
    expect(first.kind).toBe('cell');
    if (first.kind !== 'cell') throw new Error('Expected grouped matrix cell.');
    expect(first.cell.rowSpan).toBe(2);
    expect(first.cell.colSpan).toBe(2);
    expect(first.cell.slots.map((slot) => `${slot.serviceDate}:${slot.dishSlot}`)).toEqual([
      '2026-09-21:savory-main', '2026-09-21:savory-sub1',
      '2026-09-22:savory-main', '2026-09-22:savory-sub1',
    ]);
    expect(first.cell.serviceDates).toEqual(['2026-09-21', '2026-09-22']);
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

  it('keeps every persisted slot and date separate in dish-edit mode', () => {
    const matrix = buildMrxSourceMatrix(matrixScope, matrixDraft, 'dish-edit');
    const savoryMorning = matrix.sections.find((section) => section.key === 'MORNING-savory')!;

    expect(savoryMorning.rows.flatMap((row) => row.positions).every((position) => position.kind === 'cell')).toBe(true);
    expect(savoryMorning.rows[0].positions[0]).toMatchObject({ kind: 'cell', cell: { rowSpan: 1, colSpan: 1 } });
    expect(savoryMorning.rows[1].positions[0]).toMatchObject({ kind: 'cell', cell: { rowSpan: 1, colSpan: 1 } });
  });
});

function importPreview(outcome?: string): Awaited<ReturnType<typeof weeklyMenuApi.previewWeeklyMenuImport>> {
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
    weekStartDate: '2026-06-15', weekEndDate: '2026-06-21', menuVersionId: 'menu-v1', menuVersionNo: 1, menuVersionStatus: 'DRAFT', previewToken: 'token', rows: [], warnings: [],
    mrxDayOutcomes: outcome ? [{ serviceDate: '2026-06-15', outcome }] : [],
    validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
  };
}

const preview: MrxMenuChangeResult = {
  affectedDemandCount: 0, affectedDocumentIds: [], affectedPurchaseRequestCount: 0,
  affectedReconciliationBatchIds: ['batch-1'], affectedSourceLineIds: [], decisionScopes: [],
  hasIssue: true, hasPurchaseOrder: false, hasReceipt: false, impactLines: [],
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

    expect(screen.getByText('MẶN · CA SÁNG')).toBeInTheDocument();
    expect(screen.getByText('CHAY · CA SÁNG')).toBeInTheDocument();
    expect(screen.getByText('MẶN · CA CHIỀU')).toBeInTheDocument();
    expect(screen.getByText('CHAY · CA CHIỀU')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(8);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getByRole('cell', { name: /Bún mọc.*2 ngày.*2 loại món/i })).toBeInTheDocument();

    rerender(<MrxSourceEditGrid {...props} mode="dish-edit" />);
    expect(screen.getAllByRole('combobox')).toHaveLength(14);

    rerender(<MrxSourceEditGrid {...props} mode="dish-edit" readOnly />);
    expect(screen.getAllByRole('spinbutton').every((input) => input.hasAttribute('disabled'))).toBe(true);
    expect(screen.getAllByRole('combobox').every((input) => input.getAttribute('aria-disabled') === 'true')).toBe(true);
  });
});

describe('MRX direct source edit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue(scope);
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [
        { dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true },
        { dishId: 'dish-2', dishCode: 'C01', dishName: 'Cơm chay', isActive: true },
      ], totalCount: 2, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
  });

  it('disables locked-day inputs while keeping open-day inputs editable', async () => {
    const { result } = renderHook(() => useMrxSourceEdit({ customerId: 'customer-1', weekStartDate: '2026-06-15' }));
    await waitFor(() => expect(result.current.editScope).toEqual(scope));

    render(<MrxSourceEditGrid mode="dish-edit" editScope={scope} draft={result.current.draft} dishOptions={result.current.dishOptions}
      onServingsChange={result.current.setServings} onDishChange={result.current.setDish} lockedHighlight={[]} />);

    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 15/06 MORNING' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Món mặn 15/06 MORNING' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 16/06 MORNING' })).toBeEnabled();
    expect(screen.getByText('Đã xuất kho')).toBeInTheDocument();
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
    const apply = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(<MrxSourceChangePanel previewResult={preview} actorRole="MANAGER" changedLinesCount={1}
      reason="" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);

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

    rerender(<MrxSourceChangePanel previewResult={preview} actorRole="WAREHOUSE" changedLinesCount={1}
      reason="Đổi theo yêu cầu khách hàng" onReasonChange={() => {}} onPreview={() => {}} onApply={apply} onSubmit={() => {}} isSubmitting={false} />);
    expect(screen.queryByRole('button', { name: 'Áp dụng ngay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi duyệt' })).not.toBeInTheDocument();
  });

  it('does not fabricate default servings after a successful menu import', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview());
    vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockResolvedValue({} as never);
    vi.spyOn(weeklyMenuApi, 'getMenuSchedules').mockResolvedValue([{ menuScheduleId: 'schedule-1', serviceDate: '2026-06-15', shiftName: 'MORNING', status: 'DRAFT' }]);
    vi.spyOn(weeklyMenuApi, 'publishMenuSchedule').mockResolvedValue({});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<WeeklyMenuImportModal isOpen onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await screen.findByText(/Số dòng quét/);
    await user.click(screen.getByRole('button', { name: 'Xác nhận nhập' }));

    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/meal-quantity-plans/quick-servings'))).toBe(false);
  });

  it('uses the coordinator review action without legacy auto-publish on reimport', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview('CHANGED'));
    vi.spyOn(weeklyMenuApi, 'commitWeeklyMenuImport').mockResolvedValue({} as never);
    vi.spyOn(weeklyMenuApi, 'getMenuSchedules').mockResolvedValue([{ menuScheduleId: 'schedule-1', serviceDate: '2026-06-15', shiftName: 'MORNING', status: 'PUBLISHED' }]);
    const publish = vi.spyOn(weeklyMenuApi, 'publishMenuSchedule').mockResolvedValue({});
    render(<WeeklyMenuImportModal isOpen mrxActorRole="COORDINATOR" onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
    await user.upload(screen.getByLabelText(/Chọn file Excel thực đơn/i), new File(['menu'], 'menu.xlsx'));
    await user.click(screen.getByRole('button', { name: 'Xem trước' }));
    await user.click(await screen.findByRole('button', { name: 'Gửi duyệt' }));

    expect(weeklyMenuApi.commitWeeklyMenuImport).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('blocks reimport commit and explains a locked-day conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(weeklyMenuApi, 'previewWeeklyMenuImport').mockResolvedValue(importPreview('LOCKED_CONFLICT'));
    render(<WeeklyMenuImportModal isOpen mrxActorRole="MANAGER" onClose={() => {}} customers={[{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]} initialCustomerId="customer-1" initialWeekStartDate="2026-06-15" onImportSuccess={() => {}} />);
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
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Phê duyệt thay đổi' }));
    expect(screen.getByRole('dialog', { name: 'Duyệt thay đổi nguồn MRX' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Lý do từ chối thay đổi nguồn' }), 'Không đúng yêu cầu');
    await user.click(screen.getByRole('button', { name: 'Từ chối' }));
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
