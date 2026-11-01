import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { WeeklyMenuPage } from '../features/weekly-menu/WeeklyMenuPage';
import { AuthProvider } from '../store/authContext';
import { weeklyMenuApi, type RawWeeklyMenuResponse } from '../api/weeklyMenuApi';
import { MOCK_WEEKLY_MENU_DATA } from '../test/fixtures';
import { mrxApi, type MrxBatch, type MrxMenuChangeResult, type MrxQuantityPreview, type MrxWeeklySource } from '../api/mrxApi';
import { systemApi } from '../api/systemApi';
import { adminApi } from '../api/adminApi';

function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

function mrxChangeResult(overrides: Partial<MrxMenuChangeResult>): MrxMenuChangeResult {
  return {
    affectedDemandCount: 0,
    affectedDocumentIds: [],
    affectedPurchaseRequestCount: 0,
    affectedReconciliationBatchIds: [],
    affectedSourceLineIds: [],
    decisionScopes: [],
    hasIssue: false,
    hasPurchaseOrder: false,
    hasReceipt: false,
    impactLines: [],
    lockedDates: [],
    materialImpact: [],
    menuAmendmentId: '',
    requiresReconciliation: false,
    status: 'PREVIEW',
    ...overrides,
  };
}

function renderWeeklyMenu(initialEntry = '/weekly-menu') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
          <Route path="/warehouse" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Weekly Menu Feature (FR-MENU — 4 Views Zero AI-Slop Workbench)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('ipc_v3_mode', 'DEFAULT');
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'coordinator-1', fullName: 'Điều phối viên', username: 'coord', roleCode: 'Coordinator', roleName: 'Điều phối',
      isActive: true, isAdminFullAccess: false, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 1, totalPages: 0, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1', days: [],
    });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 1000, totalPages: 0, hasPrev: false, hasNext: false,
    });
  });
  it('lets Admin review exact pending impact and approve it from the MRX inbox', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    localStorage.setItem('ipc_v3_user', JSON.stringify({
      userId: 'admin-1', fullName: 'Quản trị viên', username: 'admin', roleCode: 'ADMIN', roleName: 'Admin',
      isActive: true, isAdminFullAccess: true, permissions: ['reconciliation.source.read'],
    }));
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getSourceChangeInbox').mockResolvedValue([{
      menuAmendmentId: 'amendment-1', customerId: 'customer-1', customerName: 'Draxlmaier', weekStartDate: '2026-10-19',
      status: 'PENDING_REVIEW', reason: 'Khách hàng tăng số suất', createdAt: '2026-10-18T00:00:00Z', affectedReconciliationBatchIds: ['batch-1'],
      impactLines: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', dishSlot: 'main', oldDishId: 'dish-1', newDishId: 'dish-1', currentServings: 100, newServings: 120 }],
    }]);
    vi.spyOn(mrxApi, 'decideSourceChange').mockResolvedValue(mrxChangeResult({ menuAmendmentId: 'amendment-1', status: 'EXECUTED', affectedReconciliationBatchIds: ['batch-1'] }));

    renderWeeklyMenu('/weekly-menu?view=mrx-batch');
    await userEvent.click(await screen.findByRole('button', { name: 'Yêu cầu chờ duyệt (1)' }));
    expect(screen.getByText('100 → 120 suất')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Phê duyệt thay đổi' }));

    expect(mrxApi.decideSourceChange).toHaveBeenCalledWith('amendment-1', true, undefined);
    expect(await screen.findByText('Đã áp dụng thay đổi nguồn.')).toBeInTheDocument();
    expect(screen.queryByText('Thành công')).not.toBeInTheDocument();
  });

  it('keeps imported dishes visible and exposes missing servings in the persistent source matrix', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', weekEndDate: '2026-10-25',
      menuVersionId: 'menu-v1', menuVersionNo: 3, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getEditScope').mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1',
      days: [{ serviceDate: '2026-10-19', isLocked: false, lockReason: null, shifts: [{
        shiftName: 'MORNING', savoryServings: null, vegetarianServings: null,
        slots: [
          { dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt' },
          { dishSlot: 'vegetarian-main', menuVariant: 'vegetarian', slotLabel: 'Món chay', dishId: 'dish-2', dishCode: 'C01', dishName: 'Đậu khuôn kho' },
        ],
      }] }],
    });
    vi.spyOn(adminApi, 'getDishes').mockResolvedValue({
      items: [
        { dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt', isActive: true },
        { dishId: 'dish-2', dishCode: 'C01', dishName: 'Đậu khuôn kho', isActive: true },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 1000, totalPages: 1, hasPrev: false, hasNext: false,
    });
    const preview = vi.spyOn(mrxApi, 'previewQuantityImport');

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19');

    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByText('Cơm thịt')).toBeInTheDocument();
    expect(screen.getByText('Đậu khuôn kho')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' })).toHaveValue(null);
    expect(screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 MORNING' })).toHaveValue(null);
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập lại Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();

    const savoryInput = screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' });
    const vegetarianInput = screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 MORNING' });
    await userEvent.type(savoryInput, '125');
    await userEvent.type(vegetarianInput, '20');
    expect(screen.queryByText('Thiếu 2 ô số suất')).not.toBeInTheDocument();
    const reviewTrigger = screen.getByRole('button', { name: 'Tiếp tục xem ảnh hưởng (1)' });
    await userEvent.click(reviewTrigger);
    expect(screen.getByRole('button', { name: 'Quay lại danh sách' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Xem trước ảnh hưởng' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
    expect(screen.queryByRole('button', { name: 'Quay lại danh sách' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' })).toHaveValue(125);
    expect(screen.getByRole('spinbutton', { name: 'Số suất Chay 19/10 MORNING' })).toHaveValue(20);
    expect(screen.getByRole('button', { name: /Tiếp tục xem ảnh hưởng/ })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa món' }));
    expect(screen.getByRole('combobox', { name: 'Món mặn 19/10 MORNING' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Món chay 19/10 MORNING' })).toBeInTheDocument();
  });

  it('keeps MRX source diagnostics visible and blocks commit until the source is valid', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const source: MrxWeeklySource = {
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', menuVersionNo: 3,
      menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    };
    const preview: MrxQuantityPreview = {
      token: 'preview-token', expiresAt: '2026-10-18T10:15:00Z', contentFingerprint: 'fingerprint-v2',
      fingerprintFormatVersion: 2, plans: [], diagnostics: ['Món Canh bí đỏ chưa có định mức nguyên liệu.'],
    };
    const defaultQuery = vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData');
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(source);
    vi.mocked(mrxApi.getEditScope).mockResolvedValue({
      batchId: null, batchStatus: null, batchVersion: null, menuVersionId: 'menu-v1',
      days: [{ serviceDate: '2026-10-19', isLocked: false, lockReason: null, shifts: [{
        shiftName: 'MORNING', savoryServings: 100, vegetarianServings: 20,
        slots: [{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Canh bí đỏ' }],
      }] }],
    });
    vi.mocked(adminApi.getDishes).mockResolvedValue({
      items: [{ dishId: 'dish-1', dishCode: 'M01', dishName: 'Canh bí đỏ', isActive: true }],
      totalCount: 1, pageNumber: 1, pageSize: 1000, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue(preview);
    vi.spyOn(mrxApi, 'commitQuantityImport');

    renderWeeklyMenu('/weekly-menu?view=mrx-batch');
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu & kiểm tra định lượng' }));

    expect(await screen.findByText('Món Canh bí đỏ chưa có định mức nguyên liệu.')).toBeInTheDocument();
    expect(screen.getByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getAllByText('Canh bí đỏ').length).toBeGreaterThan(0);
    expect(screen.getByText('Tóm tắt định lượng và nguyên liệu')).toBeInTheDocument();
    const servings = screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' });
    await userEvent.clear(servings);
    await userEvent.type(servings, '101');
    expect(screen.getByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt định lượng và nguyên liệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Món Canh bí đỏ chưa có định mức nguyên liệu.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo lô nháp' })).not.toBeInTheDocument();
    expect(mrxApi.commitQuantityImport).not.toHaveBeenCalled();
    expect(defaultQuery).not.toHaveBeenCalled();
  });

  it('renders mrx-batch view when accessing /weekly-menu?view=mrx-batch', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderWeeklyMenu('/weekly-menu?view=mrx-batch');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeInTheDocument();
  });

  it('automatically redirects naked /weekly-menu to /weekly-menu?view=mrx-batch in MATERIAL_RECONCILIATION mode (DOM-MODE-1)', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByRole('heading', { name: 'Chuẩn bị lô đối soát' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Thực đơn & KHSX tuần' })).not.toBeInTheDocument();
  });

  it('commits one canonical draft then readies and transfers that batch to Warehouse', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-10-18T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    const source: MrxWeeklySource = {
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', menuVersionId: 'menu-v1', menuVersionNo: 3,
      menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    };
    const preview: MrxQuantityPreview = {
      token: 'preview-token', expiresAt: '2026-10-18T10:15:00Z', contentFingerprint: 'fingerprint-v2',
      fingerprintFormatVersion: 2, diagnostics: [],
      plans: [{ quantityPlanId: 'plan-1', planCode: 'SL-01', serviceDate: '2026-10-19', status: 'COMPLETED', rowVersion: '2026-10-18T00:00:00Z', lines: [] }],
    };
    const draft = { batchId: 'batch-1', menuVersionId: 'menu-v1', quantityImportBatchId: 'import-1', status: 'DRAFT', version: 1, createdAt: '2026-10-18T00:00:00Z', lines: [] } as MrxBatch;
    const createBatch = vi.spyOn(mrxApi, 'createBatch');
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue(source);
    vi.spyOn(mrxApi, 'previewQuantityImport').mockResolvedValue(preview);
    vi.spyOn(mrxApi, 'commitQuantityImport').mockResolvedValue({ importBatchId: 'import-1', reconciliationBatchId: 'batch-1', contentFingerprint: 'fingerprint-v2', idempotentReplay: false });
    vi.spyOn(mrxApi, 'getBatch')
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ ...draft, status: 'TRANSFERRED', version: 3 });
    vi.spyOn(mrxApi, 'markReady').mockResolvedValue({ ...draft, status: 'READY', version: 2 });
    vi.spyOn(mrxApi, 'transferToWarehouse').mockResolvedValue({ batchId: 'batch-1', status: 'TRANSFERRED', sourceVersion: 3, lines: [] });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&weekStartDate=2026-10-19');
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu & kiểm tra định lượng' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tạo lô nháp' }));
    expect(mrxApi.commitQuantityImport).toHaveBeenCalledTimes(1);
    expect(createBatch).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Đóng băng lô' }));
    expect(mrxApi.markReady).toHaveBeenCalledWith('batch-1', 1);
    await userEvent.click(await screen.findByRole('button', { name: 'Chuyển sang Kho' }));
    expect(mrxApi.transferToWarehouse).toHaveBeenCalledWith('batch-1', 2);
    expect(await screen.findByText('Đã bàn giao lô đối soát sang Kho nguyên liệu thành công.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở trạm Kho xuất ngày' })).toBeInTheDocument();
    expect(screen.getByText('Đã chuyển Kho')).toBeInTheDocument();

    // Verify Lifecycle Strip displays 5 steps
    expect(screen.getByRole('navigation', { name: 'Tiến trình vòng đời lô đối soát' })).toBeInTheDocument();

    // Verify RULE-MRX-NAV-01: Header Primary CTA button navigates seamlessly to Warehouse
    const warehouseCta = screen.getByRole('button', { name: 'Đi đến Trạm Kho nguyên liệu →' });
    expect(warehouseCta).toBeInTheDocument();
    await userEvent.click(warehouseCta);
    expect(await screen.findByText('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19')).toBeInTheDocument();
  });

  it('opens WeeklyMenuImportModal, downloads template, and previews excel upload', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderWeeklyMenu();

    const importBtn = await screen.findByRole('button', { name: 'Nhập thực đơn Excel' });
    await userEvent.click(importBtn);

    expect(await screen.findByRole('heading', { name: 'Nhập thực đơn tuần từ file Excel' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Chọn file Excel thực đơn/i)).toBeInTheDocument();

    const templateBtn = screen.getByRole('button', { name: 'Tải file mẫu Excel' });
    await userEvent.click(templateBtn);
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/api/coordination/weekly-menu/template'), '_blank');
  });

  it('renders single 56px WorkspaceHeader with client selectors, dd/MM/yyyy date, and dynamic primary button (Rule D7)', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu();

    expect(await screen.findByRole('heading', { name: 'Thực đơn & KHSX tuần' })).toBeInTheDocument();

    // Client select, week date input, and pricing context pill
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-date-locale', 'vi-VN');
    expect(screen.queryByText('Định mức: 25.000 ₫')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập thực đơn Excel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duyệt kế hoạch tuần' })).not.toBeInTheDocument();
  });

  it('renders dynamic mealTargetPrice in WeeklyScheduleView and avoids hardcoded 25.000 ₫', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 32000,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('32.000 ₫')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('renders "Theo ca / Chưa chốt" when mealTargetPrice is 0', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      mealTargetPrice: 0,
    });

    renderWeeklyMenu('/weekly-menu');

    expect(await screen.findByText('Theo ca / Chưa chốt')).toBeInTheDocument();
    expect(screen.queryByText('25.000 ₫')).not.toBeInTheDocument();
  });

  it('handles null weekly menu response without throwing Cannot read properties of null', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenu').mockResolvedValueOnce(null as unknown as RawWeeklyMenuResponse);
    vi.spyOn(weeklyMenuApi, 'getProductionPlans').mockResolvedValueOnce([]);
    vi.spyOn(weeklyMenuApi, 'getAllDemand').mockResolvedValueOnce({ items: [], totalCount: 0, pageNumber: 1, pageSize: 100, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 });

    const result = await weeklyMenuApi.getWeeklyMenuData('DAV', '2026-10-12');
    expect(result.matrixRows).toEqual([]);
    expect(result.scheduleDays).toEqual([]);
  });

  it('View 1 (Kế hoạch tuần): renders Mon-Sat matrix without duplicate subbar tabs or repetitive cell text', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu');

    // Matrix columns: Monday to Saturday
    expect(await screen.findByRole('columnheader', { name: /Thứ Hai/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Thứ Bảy/i })).toBeInTheDocument();

    // Section headers and real dish names
    expect(screen.getByText('MENU MẶN CA SÁNG')).toBeInTheDocument();
    expect(screen.getByText('Khô gà lá chanh')).toBeInTheDocument();

    // Invariant: Repetitive cell text removed!
    expect(screen.queryByText(/Suất: 25.000 ₫ BOM: Đạt chuẩn/i)).not.toBeInTheDocument();

    // Invariant: NO duplicate horizontal view tabs inside page!
    expect(screen.queryByRole('tab', { name: 'Kế hoạch tuần' })).not.toBeInTheDocument();

    // Invariant: Zero <details> tags in DOM!
    expect(container.querySelectorAll('details').length).toBe(0);
  });

  it('View 2 uses authoritative demand and production-plan facets without fabricating handoff vouchers', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    const { container } = renderWeeklyMenu('/weekly-menu?view=demand');

    expect(screen.queryByRole('button', { name: 'Mở hàng đợi duyệt' })).not.toBeInTheDocument();

    // Day navigator [<] Thứ Hai, 21/09/2026 [>]
    expect(await screen.findByText(/Thứ Hai, 21\/09\/2026/i)).toBeInTheDocument();

    // Segmented tabs replace legacy bottom details!
    expect(screen.getByRole('tab', { name: /Nhu cầu nguyên liệu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /KHSX nguồn/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Chứng từ bàn giao/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tính lại nhu cầu' })).not.toBeInTheDocument();

    // 6 Columns in Primary DataGrid
    expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhu cầu đã tính' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Đã xuất vật lý' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Còn phải xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái bàn giao' })).toBeInTheDocument();

    // HARD INVARIANT: Zero <details> tags anywhere in the DOM!
    expect(container.querySelectorAll('details').length).toBe(0);

    // Switch to "KHSX nguồn" tab
    await userEvent.click(screen.getByRole('tab', { name: /KHSX nguồn/i }));
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();

    // No production plan may be renamed into a signed handoff voucher.
    expect(screen.queryByText(/Đã ký nhận/i)).not.toBeInTheDocument();
  });

  it('View 3 renders production-plan facts without a fake print action', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue(MOCK_WEEKLY_MENU_DATA);

    renderWeeklyMenu('/weekly-menu?view=production-plan');

    expect(screen.queryByRole('button', { name: 'In lệnh sản xuất' })).not.toBeInTheDocument();

    // KHSX lines rendered
    expect((await screen.findAllByText(/KHSX-DAV-20260921/i)).length).toBeGreaterThan(0);

    // DataGrid columns
    expect(screen.getByRole('columnheader', { name: 'Mã KHSX' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên món ăn' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ca sản xuất' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số suất kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngày phục vụ' })).toBeInTheDocument();

    // Date formatted as dd/MM/yyyy
    expect(screen.getAllByText('21/09/2026').length).toBeGreaterThan(0);
  });

  it('View 4 does not expose cost reports or exports without an authoritative backend cost contract', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValue({
      ...MOCK_WEEKLY_MENU_DATA,
      dishCosts: [],
      dailyMaterials: [],
    });

    renderWeeklyMenu('/weekly-menu?view=cost');

    expect(screen.queryByRole('button', { name: 'Xuất bảng chi phí' })).not.toBeInTheDocument();
    expect(await screen.findByText('Chưa có số liệu phân rã chi phí BOM')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Đơn giá vốn' })).not.toBeInTheDocument();


  });

  it('handles empty state and calculation errors gracefully with StateBoundary', async () => {
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockRejectedValueOnce(
      new Error('Không có kết nối mạng')
    );

    renderWeeklyMenu();

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Không có kết nối mạng')).toBeInTheDocument();

    // Click retry
    vi.spyOn(weeklyMenuApi, 'getWeeklyMenuData').mockResolvedValueOnce(MOCK_WEEKLY_MENU_DATA);
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Thực đơn & KHSX tuần')).toBeInTheDocument();
  });

  it('Route 2: persists customerId and weekStartDate in URL search params on change and F5 reload', async () => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
      { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-2', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-2&weekStartDate=2026-11-02');

    const customerSelect = await screen.findByRole('combobox', { name: 'Chọn khách hàng MRX' });
    expect(customerSelect).toHaveValue('cust-2');
  });

  it('uses the unified weekly source workbench when an MRX source exists', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-1', menuVersionNo: 1, menuVersionStatus: 'DRAFT', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');

    expect(await screen.findByRole('heading', { name: 'Hoàn thiện nguồn tuần' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập lại Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
  });

  it('replaces the legacy schedule editor with direct MRX source editing after a batch exists', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 9, updatedAt: '2026-11-01T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
    ]);
    vi.spyOn(mrxApi, 'getWeeklySource').mockResolvedValue({
      customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08',
      menuVersionId: 'mv-1', menuVersionNo: 1, menuVersionStatus: 'PUBLISHED', warnings: [],
      validation: { isValid: true, hasCriticalErrors: false, errorCount: 0, warningCount: 0, issues: [] },
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-transferred-1', customerId: 'cust-1', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08', status: 'TRANSFERRED',
        version: 3, createdAt: '2026-11-01T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 1, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getBatch').mockResolvedValue({
      batchId: 'batch-transferred-1', customerId: 'cust-1', weekStartDate: '2026-11-02', status: 'TRANSFERRED',
      version: 3, lines: [],
    } as unknown as MrxBatch);

    renderWeeklyMenu('/weekly-menu?view=mrx-batch&customerId=cust-1&weekStartDate=2026-11-02');

    expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Điều chỉnh nguồn' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỉnh sửa món' })).toBeInTheDocument();
  });
});
