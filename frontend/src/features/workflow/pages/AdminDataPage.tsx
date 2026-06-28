import { useMemo, useState } from 'react';
import { BarChart3, Bell, Database, History, PackageCheck, Pencil, PlusCircle, Save, SlidersHorizontal, TrendingUp, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  DocumentRail,
  OperationalFrame,
  RoleInbox,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StatusBadge,
  StockMovementTable,
  DataTableShell,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetApprovalRecordsQuery,
  useGetAuditChangesQuery,
  useGetCurrentStockQuery,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';
import {
  useAddDishBomLineMutation,
  useCloseDishBomLineMutation,
  useGetDishesCatalogQuery,
  useGetIngredientsQuery,
  useUpdateDishBomLineMutation,
  type CatalogIngredient,
} from '@/features/projects/dishCatalogApi';

type AdminView = 'adjustments' | 'inventory' | 'audit' | 'statistics';

type BomFormState = {
  ingredientId: string;
  grossQtyPerServing: string;
  wasteRatePercent: string;
  reason: string;
};

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center text-slate-500">
      Chưa có dữ liệu để hiển thị
    </td>
  </tr>
);

export default function AdminDataPage() {
  const [activeView, setActiveView] = useState<AdminView>('adjustments');
  const [auditPage, setAuditPage] = useState(1);
  const [selectedDishId, setSelectedDishId] = useState('');
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [bomForm, setBomForm] = useState<BomFormState>({
    ingredientId: '',
    grossQtyPerServing: '',
    wasteRatePercent: '0',
    reason: '',
  });
  const [bomFeedback, setBomFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const auditPageSize = 8;
  const { data: catalogDishes = [], isLoading: isCatalogLoading } = useGetDishesCatalogQuery();
  const { data: ingredientLookup = [] } = useGetIngredientsQuery();
  const [addDishBomLine, addDishBomLineState] = useAddDishBomLineMutation();
  const [updateDishBomLine, updateDishBomLineState] = useUpdateDishBomLineMutation();
  const [closeDishBomLine, closeDishBomLineState] = useCloseDishBomLineMutation();
  const { data: approvalRecords = [] } = useGetApprovalRecordsQuery({ limit: 100 });
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: auditLogs = [] } = useGetAuditChangesQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: ingredientDemandRows = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: purchaseDemandRows = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 100 });
  const { data: priceVarianceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });
  const { data: kitchenIssueRows = [] } = useGetKitchenIssuesQuery({ limit: 100 });
  const { data: usageRows = [] } = useGetIssueVsReturnUsageQuery({ limit: 100 });
  const { roleInboxItems } = useWorkflowOverview();
  const adjustmentDocuments = workflowDocuments.filter((document) => document.type === 'Điều chỉnh');
  const adminInbox = roleInboxItems.filter((item) => item.laneId === 'admin');
  const adjustmentMovements = stockMovements.filter((movement) => movement.type === 'adjustment');
  const shortageRows = ingredientDemandRows.filter((row) => row.tone === 'danger');
  const priceWarnings = priceVarianceRows.filter((row) => row.warning);
  const totalPurchaseQty = purchaseDemandRows.reduce((total, row) => total + row.reserved, 0);
  const totalIssuedQty = kitchenIssueRows.reduce((total, row) => total + row.issuedQty, 0);
  const totalUsedQty = usageRows.reduce((total, row) => total + row.usedQty, 0);
  const totalReturnedQty = usageRows.reduce((total, row) => total + row.returnedQty, 0);
  const selectedDish = useMemo(
    () => catalogDishes.find((dish) => dish.id === selectedDishId) ?? catalogDishes[0],
    [catalogDishes, selectedDishId],
  );
  const selectedDishBomLines = selectedDish?.ingredients ?? [];
  const activeBomCount = selectedDishBomLines.filter((line) => !line.effectiveTo).length;
  const selectedIngredient = ingredientLookup.find((ingredient) => ingredient.ingredientId === bomForm.ingredientId);
  const isSavingBom = addDishBomLineState.isLoading || updateDishBomLineState.isLoading || closeDishBomLineState.isLoading;

  const displayLogs = auditLogs;
  const totalAuditPages = Math.max(1, Math.ceil(displayLogs.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAuditLogs = displayLogs.slice((safeAuditPage - 1) * auditPageSize, safeAuditPage * auditPageSize);

  const resetBomForm = () => {
    setEditingBomId(null);
    setBomForm({
      ingredientId: ingredientLookup[0]?.ingredientId ?? '',
      grossQtyPerServing: '',
      wasteRatePercent: '0',
      reason: '',
    });
  };

  const startEditBomLine = (line: CatalogIngredient) => {
    setEditingBomId(line.bomId);
    setBomForm({
      ingredientId: line.ingredientId,
      grossQtyPerServing: String(line.grossQtyPerServing),
      wasteRatePercent: String(line.wasteRatePercent),
      reason: '',
    });
    setBomFeedback(null);
  };

  const handleSaveBomLine = async () => {
    if (!selectedDish) {
      setBomFeedback({ type: 'error', message: 'Chưa có món ăn để cập nhật BOM.' });
      return;
    }

    const ingredientId = bomForm.ingredientId || ingredientLookup[0]?.ingredientId;
    const grossQtyPerServing = Number(bomForm.grossQtyPerServing);
    const wasteRatePercent = Number(bomForm.wasteRatePercent || 0);
    if (!ingredientId || !Number.isFinite(grossQtyPerServing) || grossQtyPerServing <= 0) {
      setBomFeedback({ type: 'error', message: 'Vui lòng chọn nguyên liệu và nhập định lượng lớn hơn 0.' });
      return;
    }
    if (!Number.isFinite(wasteRatePercent) || wasteRatePercent < 0 || wasteRatePercent > 100) {
      setBomFeedback({ type: 'error', message: 'Tỷ lệ hao hụt phải nằm trong khoảng 0-100%.' });
      return;
    }

    const request = {
      dishId: selectedDish.id,
      ingredientId,
      unitId: selectedIngredient?.unitId,
      grossQtyPerServing,
      wasteRatePercent,
      reason: bomForm.reason.trim() || undefined,
    };

    try {
      if (editingBomId) {
        await updateDishBomLine({ ...request, bomId: editingBomId }).unwrap();
        setBomFeedback({ type: 'success', message: 'Đã cập nhật dòng BOM.' });
      } else {
        await addDishBomLine(request).unwrap();
        setBomFeedback({ type: 'success', message: 'Đã thêm dòng BOM cho món ăn.' });
      }
      resetBomForm();
    } catch {
      setBomFeedback({ type: 'error', message: 'Chưa lưu được BOM. Kiểm tra trùng nguyên liệu hoặc dữ liệu nhập.' });
    }
  };

  const handleCloseBomLine = async (line: CatalogIngredient) => {
    if (!selectedDish) return;

    try {
      await closeDishBomLine({ dishId: selectedDish.id, bomId: line.bomId }).unwrap();
      setBomFeedback({ type: 'success', message: `Đã ngừng áp dụng ${line.name} trong BOM.` });
      if (editingBomId === line.bomId) {
        resetBomForm();
      }
    } catch {
      setBomFeedback({ type: 'error', message: 'Chưa ngừng áp dụng được dòng BOM này.' });
    }
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => setActiveView('adjustments')}>
                <PackageCheck size={16} />
                Điều chỉnh BOM
              </button>
              <button className="ipc-button ipc-button-ghost" type="button">
                <Bell size={16} />
                Gửi thông báo vận hành
              </button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.WEEKLY_MENU}>
                <Database size={16} />
                Xem KHSX/BOM
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.DASHBOARD}>
                Về bàn điều hành
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <SlidersHorizontal size={16} />
            Phạm vi: BOM và tồn kho
          </span>
          <span className="ipc-command-meta">Yêu cầu có lý do điều chỉnh</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Thiếu nguyên liệu', value: shortageRows.length.toString(), tone: shortageRows.length ? 'danger' : 'success' },
            { label: 'Cảnh báo giá', value: priceWarnings.length.toString(), tone: priceWarnings.length ? 'danger' : 'success' },
            { label: 'Tồn kho', value: `${currentStockRows.length} dòng`, tone: 'neutral' },
            { label: 'Audit', value: `${displayLogs.length} thay đổi`, tone: 'neutral' },
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn quản trị dữ liệu"
        tabs={[
          { id: 'admin-adjustments', label: 'Điều chỉnh' },
          { id: 'admin-inventory', label: 'Tồn kho' },
          { id: 'admin-statistics', label: 'Thống kê' },
          { id: 'admin-audit', label: 'Audit' },
        ]}
        activeTab={`admin-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('admin-', '') as AdminView)}
      />

      {activeView === 'adjustments' && (
        <div id="admin-adjustments-panel" role="tabpanel" aria-labelledby="admin-adjustments-tab" className="flex flex-col gap-4">
          <SectionPanel title="Quản trị BOM món ăn" icon={<PackageCheck size={18} />}>
            <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-slate-700" htmlFor="admin-bom-dish">
                  Món ăn
                </label>
                <select
                  id="admin-bom-dish"
                  className="ipc-select w-full"
                  value={selectedDish?.id ?? ''}
                  disabled={isCatalogLoading || catalogDishes.length === 0}
                  onChange={(event) => {
                    setSelectedDishId(event.target.value);
                    resetBomForm();
                    setBomFeedback(null);
                  }}
                >
                  {catalogDishes.map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name}
                    </option>
                  ))}
                </select>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="font-bold text-slate-900">{selectedDish?.name ?? 'Chưa có món'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedDish ? `${activeBomCount} dòng BOM đang áp dụng / ${selectedDishBomLines.length} tổng dòng` : 'Chọn món để cập nhật định lượng'}
                  </div>
                </div>

                {bomFeedback && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      bomFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {bomFeedback.message}
                  </div>
                )}

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-bold text-slate-800">
                      {editingBomId ? 'Sửa dòng BOM' : 'Thêm nguyên liệu vào BOM'}
                    </div>
                    <button className="ipc-button ipc-button-ghost" type="button" onClick={resetBomForm}>
                      <PlusCircle size={15} />
                      Dòng mới
                    </button>
                  </div>

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-bom-ingredient">
                    Nguyên liệu
                  </label>
                  <select
                    id="admin-bom-ingredient"
                    className="ipc-select w-full"
                    value={bomForm.ingredientId}
                    onChange={(event) => setBomForm((prev) => ({ ...prev, ingredientId: event.target.value }))}
                  >
                    <option value="">Chọn nguyên liệu</option>
                    {ingredientLookup.map((ingredient) => (
                      <option key={ingredient.ingredientId} value={ingredient.ingredientId}>
                        {ingredient.ingredientName} ({ingredient.unitName ?? 'đơn vị'})
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Định lượng/suất
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        min="0"
                        type="number"
                        value={bomForm.grossQtyPerServing}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, grossQtyPerServing: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Hao hụt (%)
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        max="100"
                        min="0"
                        type="number"
                        value={bomForm.wasteRatePercent}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, wasteRatePercent: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                    Lý do điều chỉnh
                    <input
                      className="ipc-input"
                      value={bomForm.reason}
                      onChange={(event) => setBomForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Ví dụ: cập nhật định lượng theo test bếp"
                    />
                  </label>

                  <button
                    className="ipc-button ipc-button-primary justify-center"
                    type="button"
                    disabled={isSavingBom || !selectedDish}
                    onClick={() => void handleSaveBomLine()}
                  >
                    <Save size={15} />
                    {editingBomId ? 'Lưu thay đổi BOM' : 'Thêm vào BOM'}
                  </button>
                </div>
              </div>

              <DataTableShell ariaLabel="Bảng BOM món ăn">
                <table className="ipc-data-table">
                  <thead>
                    <tr>
                      <th>Nguyên liệu</th>
                      <th>Định lượng/suất</th>
                      <th>Hao hụt</th>
                      <th>Hiệu lực</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDishBomLines.length === 0 ? <EmptyRow colSpan={5} /> : selectedDishBomLines.map((line) => (
                      <tr key={line.bomId}>
                        <td className="font-semibold text-slate-900">{line.name}</td>
                        <td className="ipc-numeric-cell">
                          {line.grossQtyPerServing.toLocaleString('vi-VN')} {line.unit}
                        </td>
                        <td className="ipc-numeric-cell">{line.wasteRatePercent.toLocaleString('vi-VN')}%</td>
                        <td>
                          {line.effectiveTo ? (
                            <StatusBadge variant="neutral">Đến {new Date(line.effectiveTo).toLocaleDateString('vi-VN')}</StatusBadge>
                          ) : (
                            <StatusBadge variant="success">Đang áp dụng</StatusBadge>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap justify-center gap-2">
                            <button className="ipc-button ipc-button-ghost ipc-button-bounded" type="button" onClick={() => startEditBomLine(line)}>
                              <Pencil size={14} />
                              Sửa
                            </button>
                            {!line.effectiveTo && (
                              <button
                                className="ipc-button ipc-button-ghost ipc-button-bounded"
                                type="button"
                                disabled={isSavingBom}
                                onClick={() => void handleCloseBomLine(line)}
                              >
                                <XCircle size={14} />
                                Ngừng
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </div>
          </SectionPanel>

          <SplitWorkbench
            detailLabel="Chứng từ"
            detail={
              <DocumentRail
                documents={adjustmentDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở điều chỉnh
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title="Hàng đợi điều chỉnh" icon={<Database size={18} />}>
              <ApprovalQueue records={approvalRecords.filter((record) => record.type === 'adjustment')} title={null} />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'inventory' && (
        <SectionPanel title="Điều chỉnh tồn và thông báo">
          <div id="admin-inventory-panel" role="tabpanel" aria-labelledby="admin-inventory-tab">
          <StockMovementTable movements={adjustmentMovements} />
          <div className="mt-4">
            <RoleInbox
              items={adminInbox}
              title={null}
              actionForItem={(item) => (
                <Link className="ipc-button ipc-button-ghost" to={item.route}>
                  {item.nextAction}
                </Link>
              )}
            />
          </div>
          </div>
        </SectionPanel>
      )}

      {activeView === 'statistics' && (
        <div id="admin-statistics-panel" role="tabpanel" aria-labelledby="admin-statistics-tab" className="flex flex-col gap-4">
          <SectionPanel title="Thống kê vận hành cho Admin" icon={<BarChart3 size={18} />}>
            <DataTableShell ariaLabel="Bảng chỉ số thống kê vận hành">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Nhóm thống kê</th>
                    <th>Chỉ số</th>
                    <th>Ý nghĩa vận hành</th>
                    <th>Trạng thái</th>
                    <th>Handoff</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">Nhu cầu nguyên liệu</td>
                    <td className="ipc-numeric-cell">{shortageRows.length} dòng thiếu</td>
                    <td className="text-left">Tổng hợp sau bước hệ thống tính nhu cầu trước khi kiểm tồn.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={shortageRows.length ? 'danger' : 'success'}>{shortageRows.length ? 'Cần xử lý' : 'Đủ tồn'}</StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở mua thêm</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Mua hàng</td>
                    <td className="ipc-numeric-cell">{totalPurchaseQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Nhu cầu mua theo nhà cung cấp, ngày và ca từ danh sách mua.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={totalPurchaseQty > 0 ? 'warning' : 'success'}>{totalPurchaseQty > 0 ? 'Có phát sinh' : 'Không phát sinh'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Theo dõi thu mua</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Xuất bếp</td>
                    <td className="ipc-numeric-cell">{totalIssuedQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Theo phiếu xuất kho cho bếp, phục vụ kiểm tra luồng thủ kho.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={kitchenIssueRows.length ? 'neutral' : 'warning'}>{kitchenIssueRows.length ? 'Đã ghi nhận' : 'Chưa có phiếu'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Sử dụng thực tế</td>
                    <td className="ipc-numeric-cell">{totalUsedQty.toLocaleString('vi-VN')} dùng / {totalReturnedQty.toLocaleString('vi-VN')} hoàn</td>
                    <td className="text-left">Ghép xuất kho và hoàn kho để tránh tách trùng bước kiểm nguyên liệu dư.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={usageRows.length ? 'success' : 'neutral'}>{usageRows.length ? 'Có đối chiếu' : 'Chưa có dữ liệu'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Biến động giá</td>
                    <td className="ipc-numeric-cell">{priceWarnings.length} cảnh báo</td>
                    <td className="text-left">So giá nhập từ phiếu nhập với giá tham chiếu để admin theo dõi rủi ro.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={priceWarnings.length ? 'danger' : 'success'}>{priceWarnings.length ? 'Vượt ngưỡng' : 'Ổn định'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>

          <SectionPanel title="Theo dõi tồn kho và xuất bếp" icon={<PackageCheck size={18} />}>
            <DataTableShell ariaLabel="Bảng tồn kho ưu tiên">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Kho</th>
                    <th>Nguyên liệu</th>
                    <th>Tồn hiện tại</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStockRows.slice(0, 8).length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.warehouse}</td>
                      <td>{row.ingredient}</td>
                      <td className="ipc-numeric-cell">{row.currentQty} {row.unit}</td>
                      <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>

          <SectionPanel title="Cảnh báo cần admin theo dõi" icon={<TrendingUp size={18} />}>
            <DataTableShell ariaLabel="Bảng cảnh báo biến động giá">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá tham chiếu</th>
                    <th>Giá nhập</th>
                    <th>Biến động</th>
                  </tr>
                </thead>
                <tbody>
                  {priceWarnings.slice(0, 8).length === 0 ? <EmptyRow colSpan={5} /> : priceWarnings.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.supplier}</td>
                      <td className="ipc-numeric-cell">{row.pricePrev.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell">{row.priceCurrent.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell font-bold text-[var(--ipc-danger)]">+{row.change.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>
        </div>
      )}

      {activeView === 'audit' && (
        <SectionPanel title="Nhật ký thay đổi hệ thống (Audit Trail)" icon={<History size={18} />}>
          <div id="admin-audit-panel" role="tabpanel" aria-labelledby="admin-audit-tab" className="flex flex-col gap-4">
            <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5">
                <Bell size={15} className="text-blue-600" />
                <span>Nội dung thông báo vận hành ca</span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                BOM <b>Cá kho tiêu</b> đã chờ kiểm tra. Khi duyệt xong, gửi thông báo cho Điều phối, KHSX và Bếp trưởng trước ca tiếp theo để đồng bộ thông tin định lượng.
              </p>
              <button className="ipc-button ipc-button-ghost mt-3 shadow-sm bg-white" type="button">
                <Bell size={15} />
                Gửi thông báo vận hành
              </button>
            </div>

            <DataTableShell ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell">
              <table className="ipc-data-table ipc-admin-audit-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Đối tượng/Trường ảnh hưởng</th>
                    <th>Giá trị cũ</th>
                    <th>Giá trị mới</th>
                    <th className="text-left">Lý do thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-mono text-slate-500 text-left">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')} {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="font-semibold text-slate-800">{log.actor}</td>
                      <td className="font-medium text-blue-700">{log.fieldAffected}</td>
                      <td className="text-slate-500 font-mono">{log.oldValue}</td>
                      <td className="font-bold text-slate-900 font-mono">{log.newValue}</td>
                      <td className="ipc-admin-audit-reason text-left text-slate-600">
                        <span>{log.reason}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
            <PaginationBar page={safeAuditPage} pageSize={auditPageSize} totalItems={displayLogs.length} onPageChange={setAuditPage} />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
