import { useState } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  DataTableShell,
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
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
  useGetSuppliersQuery,
  useUpdateLineSupplierMutation,
  useSubmitPurchaseRequestMutation,
} from '@/features/workflow';
import type { DemandLine, SupplierDto } from '@/features/workflow';




export default function PurchasingPage() {
  const [activeView, setActiveView] = useState<'demand' | 'supplier' | 'handoff'>('demand');
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: purchaseDemandLines = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: priceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });
  const { roleInboxItems, isLoading, isError } = useWorkflowOverview();

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateLineSupplier] = useUpdateLineSupplierMutation();
  const [submitPurchaseRequest, { isLoading: isSubmitting }] = useSubmitPurchaseRequestMutation();

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active lines to display (those that have shortage to buy)
  const activePrLines = purchaseDemandLines.filter((line) => line.reserved > 0);

  const firstPrLine = purchaseDemandLines.find((line) => line.purchaseRequestId);
  const prId = firstPrLine?.purchaseRequestId;
  const prCode = firstPrLine?.sourceDocumentCode;
  const prStatus = firstPrLine?.status; // e.g. "DRAFT", "SENTTOSUPPLIER"

  const handleSupplierChange = async (line: DemandLine, supplierId: string) => {
    if (!line.purchaseRequestId || !line.purchaseRequestLineId) return;
    try {
      setFeedback(null);
      await updateLineSupplier({
        requestId: line.purchaseRequestId,
        lineId: line.purchaseRequestLineId,
        body: {
          supplierId,
          estimatedUnitPrice: line.estimatedUnitPrice ?? 0,
        }
      }).unwrap();
    } catch (err) {
      const apiError = err as { data?: { message?: string } };
      setFeedback({
        type: 'error',
        message: apiError.data?.message || 'Không cập nhật được nhà cung cấp.'
      });
    }
  };

  const handlePriceChange = async (line: DemandLine, price: number) => {
    if (!line.purchaseRequestId || !line.purchaseRequestLineId) return;
    try {
      setFeedback(null);
      await updateLineSupplier({
        requestId: line.purchaseRequestId,
        lineId: line.purchaseRequestLineId,
        body: {
          supplierId: line.supplierId ?? '',
          estimatedUnitPrice: price,
        }
      }).unwrap();
    } catch (err) {
      const apiError = err as { data?: { message?: string } };
      setFeedback({
        type: 'error',
        message: apiError.data?.message || 'Không cập nhật được đơn giá.'
      });
    }
  };

  const handleSubmitPr = async () => {
    if (!prId) return;
    try {
      setFeedback(null);
      await submitPurchaseRequest(prId).unwrap();
      setFeedback({
        type: 'success',
        message: 'Đã gửi duyệt đề xuất mua hàng thành công.'
      });
    } catch (err) {
      const apiError = err as { data?: { message?: string } };
      setFeedback({
        type: 'error',
        message: apiError.data?.message || 'Gửi duyệt thất bại. Vui lòng kiểm tra lại nhà cung cấp và đơn giá của các dòng.'
      });
    }
  };


  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua' || document.type === 'Danh sách mua thêm');
  const purchaseInbox = roleInboxItems.filter((item) => item.laneId === 'purchasing');
  const receiptMovements = stockMovements.filter((movement) => movement.type === 'receipt');
  const warningPrice = priceRows.find((row) => row.warning);
  const primaryPurchaseDemand = purchaseDemandLines.find((line) => line.tone === 'danger') ?? purchaseDemandLines[0];


  const statusLabel = prStatus === 'DRAFT' ? 'Nháp' : prStatus === 'SENTTOSUPPLIER' ? 'Đã gửi duyệt' : prStatus ?? 'Chưa có';

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              {prId && (
                <button
                  className="ipc-button ipc-button-primary"
                  type="button"
                  disabled={prStatus !== 'DRAFT' || isSubmitting || activePrLines.length === 0}
                  onClick={() => void handleSubmitPr()}
                >
                  {isSubmitting ? 'Đang gửi...' : 'Gửi duyệt'}
                </button>
              )}
              <Link className="ipc-button ipc-button-primary" to={ROUTES.WAREHOUSE}>
                <PackageCheck size={16} />
                Chuyển sang nhập kho
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.APPROVALS}>
                Quay lại duyệt
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <ShoppingCart size={16} />
            Đề xuất mua: {prCode ?? 'Chưa có'} ({statusLabel})
          </span>
          <span className="ipc-command-meta">Ngưỡng cảnh báo: 15%</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái mua', value: prStatus ? statusLabel : 'Chưa có đơn mua', tone: prStatus === 'DRAFT' ? 'warning' : prStatus === 'SENTTOSUPPLIER' ? 'success' : 'neutral' },
            { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
            { label: 'Handoff kho', value: receiptMovements.length > 0 ? `${receiptMovements.length} phiếu nhập` : 'Chờ phiếu nhập', tone: receiptMovements.length > 0 ? 'success' : 'warning' },
            { label: 'Nhà cung cấp đề xuất', value: warningPrice?.supplier ?? primaryPurchaseDemand?.source ?? 'Chưa có', tone: 'neutral' },
          ]}
        />
      }
    >
      {isLoading && (
        <InlineAlert title="Đang tải dữ liệu..." variant="info" className="mb-4">
          Hệ thống đang tải dữ liệu nhu cầu mua và nhà cung cấp từ API.
        </InlineAlert>
      )}
      {isError && (
        <InlineAlert title="Lỗi tải dữ liệu" variant="warning" className="mb-4">
          Không thể kết nối đến máy chủ để lấy thông tin đặt hàng. Vui lòng thử lại.
        </InlineAlert>
      )}

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn thu mua"
        tabs={[
          { id: 'purchasing-demand', label: 'Nhu cầu mua' },
          { id: 'purchasing-supplier', label: 'Giá và NCC' },
          { id: 'purchasing-handoff', label: 'Handoff kho' },
        ]}
        activeTab={`purchasing-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('purchasing-', '') as 'demand' | 'supplier' | 'handoff')}
      />

      {activeView === 'demand' && (
        <div id="purchasing-demand-panel" role="tabpanel" aria-labelledby="purchasing-demand-tab">
          <SplitWorkbench
            detailLabel="Đơn mua"
            detail={
              <DocumentRail
                documents={purchasingDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Xem đơn mua
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title={`Nhu cầu mua thêm: ${prCode ?? 'Chưa có'}`} icon={<ShoppingCart size={18} />}>
              {feedback && (
                <div className={`p-3 rounded mb-4 text-sm ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {feedback.message}
                </div>
              )}
              
              <div className="flex flex-col gap-4">
                <DataTableShell ariaLabel="Bảng quản lý đề xuất mua hàng">
                  <table className="ipc-data-table text-sm">
                    <thead>
                      <tr>
                        <th>Nguyên liệu</th>
                        <th>Nhu cầu</th>
                        <th>Tồn kho</th>
                        <th>Cần mua thêm</th>
                        <th>Đơn vị</th>
                        <th>Nhà cung cấp</th>
                        <th>Đơn giá ước tính (đ)</th>
                        <th>Thành tiền (đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePrLines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-500">
                            Không có dòng thiếu nguyên liệu cần đặt mua cho tuần này.
                          </td>
                        </tr>
                      ) : (
                        activePrLines.map((line) => (
                          <tr key={line.id}>
                            <td className="font-semibold text-slate-900">{line.material}</td>
                            <td className="text-right">{line.required.toLocaleString()}</td>
                            <td className="text-right">{line.available.toLocaleString()}</td>
                            <td className="text-right font-bold text-rose-600">{line.reserved.toLocaleString()}</td>
                            <td>{line.unit}</td>
                            <td>
                              <select
                                className="ipc-select min-w-[200px]"
                                value={line.supplierId ?? ''}
                                disabled={prStatus !== 'DRAFT'}
                                onChange={(e) => void handleSupplierChange(line, e.target.value)}
                              >
                                <option value="" disabled>-- Chọn nhà cung cấp --</option>
                                {suppliers.map((s: SupplierDto) => (
                                  <option key={s.supplierId} value={s.supplierId}>
                                    {s.supplierName} ({s.supplierCode})
                                  </option>
                                ))}
                              </select>

                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="ipc-input w-28 text-right"
                                defaultValue={line.estimatedUnitPrice ?? 0}
                                disabled={prStatus !== 'DRAFT'}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val !== line.estimatedUnitPrice) {
                                    void handlePriceChange(line, val);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val !== line.estimatedUnitPrice) {
                                      void handlePriceChange(line, val);
                                    }
                                  }
                                }}
                              />
                            </td>
                            <td className="text-right font-semibold">
                              {(line.reserved * (line.estimatedUnitPrice ?? 0)).toLocaleString()} đ
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </DataTableShell>
              </div>
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'supplier' && (
        <SectionPanel title="Nhà cung cấp, đơn mua và nhập giá">
          <div id="purchasing-supplier-panel" role="tabpanel" aria-labelledby="purchasing-supplier-tab">
            <div className="ipc-lane-summary-grid">
              <div className="ipc-lane-summary-card cursor-pointer hover:shadow-md hover:border-slate-300 bg-white">
                <span>Nhà cung cấp đề xuất</span>
                <strong className="text-slate-900">{warningPrice?.supplier ?? primaryPurchaseDemand?.source ?? 'Chưa có dữ liệu'}</strong>
                <p>Dữ liệu lấy từ danh sách mua và phiếu nhập backend.</p>
              </div>
              <div className="ipc-lane-summary-card cursor-pointer hover:shadow-md hover:border-slate-300 bg-white">
                <span>Giá nhập hiện tại</span>
                <strong className="text-slate-900">
                  {warningPrice ? `${warningPrice.priceCurrent.toLocaleString()} đ/${warningPrice.unit} - +${warningPrice.change.toFixed(1)}%` : 'Không có cảnh báo'}
                </strong>
                <p>{warningPrice ? 'Vượt ngưỡng 15%, cần cảnh báo quản lí.' : 'Các dòng giá đang dưới ngưỡng cảnh báo.'}</p>
              </div>
              <div className="ipc-lane-summary-card cursor-pointer hover:shadow-md hover:border-slate-300 bg-white">
                <span>Trạng thái đơn mua</span>
                <strong className="text-slate-900">{prStatus ? statusLabel : 'Chưa có dữ liệu'}</strong>
                <p>Sau khi đặt, chuyển chứng từ sang kho nhập.</p>
              </div>
            </div>

            <div className="mt-4">
              <RoleInbox
                items={purchaseInbox}
                title={null}
                actionForItem={(item) => (
                  <Link className="ipc-button ipc-button-ghost" to={item.route}>
                    {item.nextAction}
                  </Link>
                )}
              />
            </div>
            <div className="mt-4">
              <ExceptionLane
                title="Biến động giá trên 15%"
                items={[
                  {
                    title: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có nguyên liệu vượt ngưỡng',
                    description: warningPrice
                      ? 'Giá mới cao hơn giá tham chiếu, cần gửi cảnh báo biến động giá.'
                      : 'Chưa ghi nhận dòng giá vượt ngưỡng 15%.',
                    action: 'Thu mua: Gửi cảnh báo biến động giá',
                    tone: warningPrice ? 'danger' : 'info',
                  },
                ]}
              />
            </div>
          </div>
        </SectionPanel>
      )}

      {activeView === 'handoff' && (
        <SectionPanel title="Handoff sang kho" icon={<PackageCheck size={18} />}>
          <div id="purchasing-handoff-panel" role="tabpanel" aria-labelledby="purchasing-handoff-tab">
            <StockMovementTable movements={receiptMovements} />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}

