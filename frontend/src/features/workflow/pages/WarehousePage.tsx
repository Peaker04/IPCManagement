import { useState, useMemo } from 'react';
import { ClipboardList, PackageOpen, Warehouse, Plus, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  DataTableShell,
  DemandSummary,
  DocumentRail,
  ExceptionLane,
  OperationalFrame,
  RoleInbox,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  ViewSwitcher,
  InlineAlert,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetCurrentStockQuery,
  useGetIngredientDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
  useGetWarehousesQuery,
  useGetSuppliersQuery,
  useCreateInventoryReceiptMutation,
  useCreateInventoryIssueMutation,
  useGetPurchaseDemandQuery,
} from '@/features/workflow';
import { formatQuantityWithUnit } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';


export default function WarehousePage() {
  const [activeView, setActiveView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const [stockSearch, setStockSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 12 });
  const { roleInboxItems, isLoading, isError } = useWorkflowOverview();

  const filteredStockRows = useMemo(() => {
    return currentStockRows.filter(row => {
      const matchSearch = !stockSearch || row.ingredient.toLowerCase().includes(stockSearch.toLowerCase());
      const matchWarehouse = !warehouseFilter || row.warehouse === warehouseFilter;
      return matchSearch && matchWarehouse;
    });
  }, [currentStockRows, stockSearch, warehouseFilter]);

  const filteredMovements = useMemo(() => {
    return stockMovements.filter(row => {
      const query = movementSearch.toLowerCase();
      return !movementSearch ||
        row.material?.toLowerCase().includes(query) ||
        row.documentNo?.toLowerCase().includes(query) ||
        row.status?.toLowerCase().includes(query);
    });
  }, [stockMovements, movementSearch]);

  // Dialog Open/Close State
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isIssueOpen, setIsIssueOpen] = useState(false);

  // Form State - Receipt
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('');
  const [receiptSupplierId, setReceiptSupplierId] = useState('');
  const [receiptPrId, setReceiptPrId] = useState('');
  const [receiptLines, setReceiptLines] = useState<Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unitId: string;
    unitName: string;
    unitPrice: number;
    lotNumber?: string;
    manufactureDate?: string;
    expiredDate?: string;
  }>>([]);

  // Form State - Issue
  const [issueWarehouseId, setIssueWarehouseId] = useState('');
  const [issueMrId, setIssueMrId] = useState('');
  const [issueLines, setIssueLines] = useState<Array<{
    ingredientId: string;
    ingredientName: string;
    requestedQty: number;
    issuedQty: number;
    unitId: string;
    unitName: string;
  }>>([]);
  const [issueReceivedBy, setIssueReceivedBy] = useState('');

  // Alerts
  const [warehouseFeedback, setWarehouseFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // RTK Queries & Mutations
  const { data: warehousesResponse } = useGetWarehousesQuery();
  const warehouses = warehousesResponse?.data?.items ?? [];
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const { data: purchaseDemandLines = [] } = useGetPurchaseDemandQuery({ limit: 100 });

  const [createReceipt, { isLoading: isCreatingReceipt }] = useCreateInventoryReceiptMutation();
  const [createIssue, { isLoading: isCreatingIssue }] = useCreateInventoryIssueMutation();

  // Filter pending documents
  const activePrs = useMemo(() => {
    return workflowDocuments.filter((doc: any) => doc.type === 'Đơn mua');
  }, [workflowDocuments]);

  const activeMrs = useMemo(() => {
    return workflowDocuments.filter((doc: any) => doc.type === 'KHSX');
  }, [workflowDocuments]);

  // Extract unique active ingredients for custom additions
  const uniqueIngredients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; unitId: string; unitName: string }>();
    
    demandLines.forEach((line: any) => {
      if (line.ingredientId) {
        map.set(line.ingredientId, {
          id: line.ingredientId,
          name: line.material,
          unitId: line.unitId || '',
          unitName: line.unit,
        });
      }
    });

    currentStockRows.forEach((row: any) => {
      if (row.ingredientId && !map.has(row.ingredientId)) {
        map.set(row.ingredientId, {
          id: row.ingredientId,
          name: row.ingredient,
          unitId: row.unitId || '',
          unitName: row.unit || '',
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demandLines, currentStockRows]);

  const handlePrChange = (prId: string) => {
    setReceiptPrId(prId);
    if (!prId) {
      setReceiptLines([]);
      return;
    }
    const prLines = purchaseDemandLines.filter(line => line.purchaseRequestId === prId);
    setReceiptLines(prLines.map(line => ({
      ingredientId: line.ingredientId || '',
      ingredientName: line.material || 'Nguyên liệu',
      quantity: line.reserved,
      unitId: line.unitId || '',
      unitName: line.unit || 'ĐVT',
      unitPrice: line.estimatedUnitPrice || 0,
      lotNumber: '',
      manufactureDate: '',
      expiredDate: '',
    })));
  };

  const handleMrChange = (mrId: string) => {
    setIssueMrId(mrId);
    if (!mrId) {
      setIssueLines([]);
      return;
    }
    const mrLines = demandLines.filter(line => line.materialRequestId === mrId);
    setIssueLines(mrLines.map(line => ({
      ingredientId: line.ingredientId || '',
      ingredientName: line.material || 'Nguyên liệu',
      requestedQty: line.required,
      issuedQty: line.required,
      unitId: line.unitId || '',
      unitName: line.unit || 'ĐVT',
    })));
  };

  const addReceiptLine = () => {
    const firstIngredient = uniqueIngredients[0];
    if (!firstIngredient) return;
    setReceiptLines([...receiptLines, {
      ingredientId: firstIngredient.id,
      ingredientName: firstIngredient.name,
      quantity: 1,
      unitId: firstIngredient.unitId,
      unitName: firstIngredient.unitName,
      unitPrice: 0,
      lotNumber: '',
      manufactureDate: '',
      expiredDate: '',
    }]);
  };

  const removeReceiptLine = (index: number) => {
    setReceiptLines(receiptLines.filter((_, i) => i !== index));
  };

  const updateReceiptLine = (index: number, field: string, value: any) => {
    setReceiptLines(receiptLines.map((line, i) => {
      if (i !== index) return line;
      if (field === 'ingredientId') {
        const found = uniqueIngredients.find((ing: any) => ing.id === value);
        return {
          ...line,
          ingredientId: value,
          ingredientName: found?.name || line.ingredientName,
          unitId: found?.unitId || line.unitId,
          unitName: found?.unitName || line.unitName,
        };
      }
      return { ...line, [field]: value };
    }));
  };

  const handleSaveReceipt = async () => {
    if (!receiptWarehouseId) {
      setWarehouseFeedback({ type: 'error', message: 'Vui lòng chọn kho nhập.' });
      return;
    }
    if (!receiptSupplierId) {
      setWarehouseFeedback({ type: 'error', message: 'Vui lòng chọn nhà cung cấp.' });
      return;
    }
    if (receiptLines.length === 0) {
      setWarehouseFeedback({ type: 'error', message: 'Vui lòng thêm ít nhất một dòng nguyên liệu.' });
      return;
    }
    for (let i = 0; i < receiptLines.length; i++) {
      const line = receiptLines[i];
      if (line.quantity <= 0) {
        setWarehouseFeedback({ type: 'error', message: `Số lượng dòng ${i + 1} phải lớn hơn 0.` });
        return;
      }
      if (line.unitPrice < 0) {
        setWarehouseFeedback({ type: 'error', message: `Đơn giá dòng ${i + 1} không được âm.` });
        return;
      }
    }

    try {
      setWarehouseFeedback(null);
      const payload = {
        receiptDate: new Date().toISOString().split('T')[0],
        supplierId: receiptSupplierId,
        warehouseId: receiptWarehouseId,
        purchaseRequestId: receiptPrId || undefined,
        lines: receiptLines.map(line => ({
          ingredientId: line.ingredientId,
          quantity: Number(line.quantity),
          unitId: line.unitId,
          unitPrice: Number(line.unitPrice),
          lotNumber: line.lotNumber || undefined,
          manufactureDate: line.manufactureDate || undefined,
          expiredDate: line.expiredDate || undefined,
        }))
      };

      await createReceipt(payload).unwrap();
      setWarehouseFeedback({ type: 'success', message: 'Tạo phiếu nhập kho thành công.' });
      setIsReceiptOpen(false);
      setReceiptPrId('');
      setReceiptSupplierId('');
      setReceiptLines([]);
    } catch (err) {
      const apiError = err as { data?: { message?: string } };
      setWarehouseFeedback({
        type: 'error',
        message: apiError.data?.message || 'Có lỗi xảy ra khi tạo phiếu nhập.'
      });
    }
  };

  const handleSaveIssue = async () => {
    if (!issueWarehouseId) {
      setWarehouseFeedback({ type: 'error', message: 'Vui lòng chọn kho xuất.' });
      return;
    }
    if (!issueMrId) {
      setWarehouseFeedback({ type: 'error', message: 'Vui lòng chọn yêu cầu nguyên liệu.' });
      return;
    }
    if (issueLines.length === 0) {
      setWarehouseFeedback({ type: 'error', message: 'Yêu cầu nguyên liệu không có dòng nào.' });
      return;
    }
    for (let i = 0; i < issueLines.length; i++) {
      const line = issueLines[i];
      if (line.issuedQty <= 0) {
        setWarehouseFeedback({ type: 'error', message: `Số lượng xuất dòng ${i + 1} phải lớn hơn 0.` });
        return;
      }
    }

    try {
      setWarehouseFeedback(null);
      const payload = {
        issueDate: new Date().toISOString().split('T')[0],
        shiftName: 'Ca trưa',
        warehouseId: issueWarehouseId,
        materialRequestId: issueMrId,
        receivedBy: issueReceivedBy.trim() || undefined,
        lines: issueLines.map(line => ({
          ingredientId: line.ingredientId,
          requestedQty: Number(line.requestedQty),
          issuedQty: Number(line.issuedQty),
          unitId: line.unitId,
        }))
      };

      await createIssue(payload).unwrap();
      setWarehouseFeedback({ type: 'success', message: 'Tạo phiếu xuất kho thành công.' });
      setIsIssueOpen(false);
      setIssueMrId('');
      setIssueReceivedBy('');
      setIssueLines([]);
    } catch (err) {
      const apiError = err as { data?: { message?: string } };
      setWarehouseFeedback({
        type: 'error',
        message: apiError.data?.message || 'Có lỗi xảy ra khi tạo phiếu xuất.'
      });
    }
  };

  const warehouseDocuments = [
    ...workflowDocuments.filter((document) => document.type === 'Phiếu nhập'),
    ...workflowDocuments.filter((document) => document.type === 'Phiếu xuất'),
  ];
  const warehouseInbox = roleInboxItems.filter((item) => item.laneId === 'warehouse');
  const shortageLine = demandLines.find((line) => line.tone === 'danger');
  const issueDocument = warehouseDocuments.find((document) => document.type === 'Phiếu xuất');
  const receiptDocument = warehouseDocuments.find((document) => document.type === 'Phiếu nhập');
  const warehouseName = currentStockRows[0]?.warehouse ?? receiptDocument?.owner ?? issueDocument?.owner ?? 'Kho';

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => setIsReceiptOpen(true)}>
                Tạo phiếu nhập kho
              </button>
              <button className="ipc-button ipc-button-secondary bg-blue-700 text-white hover:bg-blue-800" type="button" onClick={() => setIsIssueOpen(true)}>
                Tạo phiếu xuất kho
              </button>
              <Link className="ipc-button ipc-button-success" to={ROUTES.REPORTS}>
                Xem tồn kho
              </Link>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.CHEF_DASHBOARD}>
                <PackageOpen size={16} />
                Bàn giao cho bếp
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.PURCHASING}>
                Quay lại thu mua
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <Warehouse size={16} />
            {warehouseName}
          </span>
          <span className="ipc-command-meta">Bàn giao bếp: {issueDocument?.title ?? 'Chưa có phiếu xuất'}</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Phiếu nhập', value: `${warehouseDocuments.filter((document) => document.type === 'Phiếu nhập').length} chứng từ`, tone: 'warning' },
            { label: 'Phiếu xuất', value: `${warehouseDocuments.filter((document) => document.type === 'Phiếu xuất').length} phiếu`, tone: 'warning' },
            { label: 'Dòng tồn kho', value: currentStockRows.length.toString(), tone: currentStockRows.length > 0 ? 'success' : 'warning' },
            { label: 'Thiếu hàng', value: shortageLine ? `${shortageLine.material} ${formatQuantityWithUnit(Math.max(shortageLine.required - shortageLine.available, 0), shortageLine.unit)}` : 'Không có', tone: shortageLine ? 'danger' : 'success' },
            { label: 'Bếp nhận', value: 'Chưa ký nhận', tone: 'warning' },
          ]}
        />
      }
    >
      {warehouseFeedback && (
        <InlineAlert
          title={warehouseFeedback.type === 'success' ? 'Thao tác thành công' : 'Thao tác thất bại'}
          variant={warehouseFeedback.type === 'success' ? 'info' : 'warning'}
          className="mb-4"
        >
          {warehouseFeedback.message}
        </InlineAlert>
      )}

      {isLoading && (
        <InlineAlert title="Đang tải dữ liệu..." variant="info" className="mb-4">
          Hệ thống đang tải thông tin tồn kho và luân chuyển kho từ API.
        </InlineAlert>
      )}
      {isError && (
        <InlineAlert title="Lỗi tải dữ liệu" variant="warning" className="mb-4">
          Không thể kết nối đến máy chủ để lấy thông tin kho. Vui lòng thử lại.
        </InlineAlert>
      )}

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn kho"
        tabs={[
          { id: 'warehouse-movement', label: 'Luân chuyển' },
          { id: 'warehouse-demand', label: 'Nhu cầu xuất' },
          { id: 'warehouse-exceptions', label: 'Ngoại lệ' },
        ]}
        activeTab={`warehouse-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('warehouse-', '') as 'movement' | 'demand' | 'exceptions')}
      />

      {activeView === 'movement' && (
        <div id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab">
          <SplitWorkbench
            detailLabel="Phiếu kho"
            detail={
              <DocumentRail
                documents={warehouseDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở phiếu
                  </Link>
                )}
              />
            }
          >
            <div className="flex flex-col gap-4">
              <SectionPanel title="Tồn kho hiện tại" icon={<Warehouse size={18} />}>
                <div className="flex flex-wrap gap-2 mb-4 bg-slate-900 border border-slate-700 p-3 rounded-md">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Tìm theo tên nguyên liệu..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="w-[180px]">
                    <select
                      value={warehouseFilter}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded px-3 py-1.5 text-sm"
                    >
                      <option value="">Tất cả kho</option>
                      {Array.from(new Set(currentStockRows.map((r: any) => r.warehouse))).map((w, idx) => (
                        <option key={idx} value={w as string}>{w as string}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <DataTableShell ariaLabel="Bảng tồn kho hiện tại trong kho">
                  <table className="ipc-data-table">
                    <thead>
                      <tr>
                        <th>Kho</th>
                        <th>Nguyên liệu</th>
                        <th>Số lượng</th>
                        <th>Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStockRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-slate-500">Chưa có dữ liệu tồn kho</td>
                        </tr>
                      ) : filteredStockRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.warehouse}</td>
                          <td>{row.ingredient}</td>
                          <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                          <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              </SectionPanel>

              <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
                <div className="flex gap-2 mb-4 bg-slate-900 border border-slate-700 p-3 rounded-md">
                  <input
                    type="text"
                    placeholder="Tìm theo chứng từ, nguyên liệu, trạng thái..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <StockMovementTable movements={filteredMovements} />
              </SectionPanel>
            </div>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="Nhu cầu xuất và thiếu hàng">
          <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab">
          <DemandSummary lines={demandLines} />
          <div className="mt-4">
            <RoleInbox
              items={warehouseInbox}
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

      {activeView === 'exceptions' && (
        <SectionPanel title="Nhánh thiếu hàng và xuất bổ sung">
          <div id="warehouse-exceptions-panel" role="tabpanel" aria-labelledby="warehouse-exceptions-tab">
          <ExceptionLane
            title="Thiếu hàng cần xử lí"
            items={[
              {
                title: shortageLine ? `${shortageLine.material} còn thiếu` : 'Không có thiếu hàng',
                description: shortageLine
                  ? 'Không đủ hàng để xuất theo danh sách. Tạo phiếu xuất bổ sung hoặc danh sách mua thêm.'
                  : 'Các dòng nhu cầu hiện có đủ tồn kho để xử lí.',
                action: 'Thủ kho: Tạo phiếu xuất kho bổ sung',
                tone: shortageLine ? 'danger' : 'info',
              },
              {
                title: issueDocument ? `Bếp chưa ký nhận ${issueDocument.title}` : 'Chưa có phiếu xuất chờ ký nhận',
                description: issueDocument
                  ? `Phiếu ${issueDocument.status.toLowerCase()} cần bàn giao để bếp xác nhận nhận nguyên liệu.`
                  : 'Khi có phiếu xuất từ workflow report, thủ kho bàn giao để bếp xác nhận nhận nguyên liệu.',
                action: 'Thủ kho: Xuất kho cho bếp',
                tone: issueDocument ? 'warning' : 'info',
              },
            ]}
          />
          </div>
        </SectionPanel>
      )}

      {/* Dialog Tạo phiếu nhập kho */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-4xl bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Tạo phiếu nhập kho</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Kho hàng</label>
              <select
                aria-label="Chọn kho nhập"
                value={receiptWarehouseId}
                onChange={(e) => setReceiptWarehouseId(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              >
                <option value="">-- Chọn kho nhập --</option>
                {warehouses.map(w => (
                  <option key={w.warehouseId} value={w.warehouseId}>{w.warehouseName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Nhà cung cấp</label>
              <select
                aria-label="Chọn nhà cung cấp"
                value={receiptSupplierId}
                onChange={(e) => setReceiptSupplierId(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map(s => (
                  <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Liên kết Đề xuất mua hàng (Tùy chọn)</label>
              <select
                aria-label="Liên kết đề xuất mua hàng"
                value={receiptPrId}
                onChange={(e) => handlePrChange(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              >
                <option value="">-- Tạo thủ công / Không liên kết --</option>
                {activePrs.map((doc: any) => (
                  <option key={doc.id} value={doc.documentId}>{doc.id} ({doc.lines[0]?.value})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="my-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-300">Chi tiết nguyên liệu</span>
              <button
                type="button"
                onClick={addReceiptLine}
                className="ipc-button ipc-button-primary flex items-center gap-1 text-xs"
              >
                <Plus size={14} /> Thêm dòng
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-md">
              <table className="w-full text-sm text-left text-slate-200">
                <thead className="text-xs uppercase bg-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-1/3">Nguyên liệu</th>
                    <th className="px-4 py-2 w-1/6">Số lượng</th>
                    <th className="px-4 py-2 w-1/6">ĐVT</th>
                    <th className="px-4 py-2 w-1/6">Đơn giá (đ)</th>
                    <th className="px-4 py-2">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {receiptLines.map((line, idx) => (
                    <tr key={idx} className="bg-slate-900 hover:bg-slate-800/50">
                      <td className="px-4 py-2">
                        <select
                          aria-label={`Chọn nguyên liệu dòng ${idx + 1}`}
                          value={line.ingredientId}
                          onChange={(e) => updateReceiptLine(idx, 'ingredientId', e.target.value)}
                          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded p-1 text-xs"
                        >
                          {uniqueIngredients.map((ing: any) => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          aria-label={`Nhập số lượng dòng ${idx + 1}`}
                          value={line.quantity}
                          onChange={(e) => updateReceiptLine(idx, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded p-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2 text-slate-400">{line.unitName}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          aria-label={`Nhập đơn giá dòng ${idx + 1}`}
                          value={line.unitPrice}
                          onChange={(e) => updateReceiptLine(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded p-1 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => removeReceiptLine(idx)}
                          className="text-red-500 hover:text-red-400 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {receiptLines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-slate-500">Chưa có dòng nguyên liệu nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setIsReceiptOpen(false)}
              className="ipc-button ipc-button-ghost text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isCreatingReceipt}
              onClick={handleSaveReceipt}
              className="ipc-button ipc-button-primary flex items-center gap-2"
            >
              {isCreatingReceipt && <Loader2 size={14} className="animate-spin" />}
              Xác nhận nhập kho
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tạo phiếu xuất kho */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="max-w-3xl bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Tạo phiếu xuất kho cho bếp</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Kho hàng</label>
              <select
                aria-label="Chọn kho xuất"
                value={issueWarehouseId}
                onChange={(e) => setIssueWarehouseId(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              >
                <option value="">-- Chọn kho xuất --</option>
                {warehouses.map(w => (
                  <option key={w.warehouseId} value={w.warehouseId}>{w.warehouseName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">Yêu cầu nguyên liệu (KHSX)</label>
              <select
                aria-label="Chọn yêu cầu nguyên liệu"
                value={issueMrId}
                onChange={(e) => handleMrChange(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              >
                <option value="">-- Chọn yêu cầu nguyên liệu --</option>
                {activeMrs.map((doc: any) => (
                  <option key={doc.id} value={doc.documentId}>{doc.id} ({doc.lines[0]?.value})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-400">Người nhận (Bếp trưởng/Nhân viên nhận)</label>
              <input
                type="text"
                aria-label="Nhập tên người nhận"
                value={issueReceivedBy}
                onChange={(e) => setIssueReceivedBy(e.target.value)}
                placeholder="Nhập tên người nhận"
                className="bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm w-full"
              />
            </div>
          </div>

          <div className="my-4">
            <span className="text-sm font-semibold text-slate-300 mb-2 block">Chi tiết nguyên liệu xuất</span>
            <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-md">
              <table className="w-full text-sm text-left text-slate-200">
                <thead className="text-xs uppercase bg-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-1/2">Nguyên liệu</th>
                    <th className="px-4 py-2 w-1/4">Yêu cầu</th>
                    <th className="px-4 py-2 w-1/4">Số lượng xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {issueLines.map((line, idx) => (
                    <tr key={idx} className="bg-slate-900 hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-white font-medium">{line.ingredientName}</td>
                      <td className="px-4 py-2 text-slate-400">{line.requestedQty} {line.unitName}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          aria-label={`Nhập số lượng xuất dòng ${idx + 1}`}
                          value={line.issuedQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setIssueLines(issueLines.map((l, i) => i === idx ? { ...l, issuedQty: val } : l));
                          }}
                          className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded p-1 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                  {issueLines.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-slate-500">Chưa chọn yêu cầu nguyên liệu</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setIsIssueOpen(false)}
              className="ipc-button ipc-button-ghost text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isCreatingIssue}
              onClick={handleSaveIssue}
              className="ipc-button ipc-button-primary flex items-center gap-2"
            >
              {isCreatingIssue && <Loader2 size={14} className="animate-spin" />}
              Xác nhận xuất kho
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
}
