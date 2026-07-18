import { useState } from 'react';
import { ClipboardList, PackageOpen, Warehouse } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  ExceptionLane,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  RoleInbox,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  TableViewport,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useCreateInventoryIssueMutation,
  useGetCurrentStockPageQuery,
  useGetIngredientDemandQuery,
  useGetKitchenIssuesQuery,
  useGetStockMovementPageQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { formatWorkflowStatus } from '../workflowConfig';

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data && typeof data === 'object' && 'message' in data) {
      return String(data.message);
    }
  }

  return fallback;
};

export default function WarehousePage() {
  const [activeView, setActiveView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [stockMovementCursors, setStockMovementCursors] = useState<Array<{ cursorDate: string; cursorId?: string }>>([]);
  const [warehouseFeedback, setWarehouseFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const stockMovementCursor = stockMovementCursors.at(-1);
  const { data: stockMovementPage } = useGetStockMovementPageQuery({
    cursorDate: stockMovementCursor?.cursorDate,
    cursorId: stockMovementCursor?.cursorId,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'movement' });
  const { data: currentStockPageResponse } = useGetCurrentStockPageQuery({
    pageNumber: currentStockPage,
    pageSize: 8,
  }, { skip: activeView !== 'movement' });
  const currentStockRows = currentStockPageResponse?.items ?? [];
  const { data: kitchenIssueRows = [] } = useGetKitchenIssuesQuery({ limit: 100 });
  const [createInventoryIssue, { isLoading: isCreatingIssue }] = useCreateInventoryIssueMutation();
  const { roleInboxItems } = useWorkflowOverview();
  const warehouseDocuments = [
    ...workflowDocuments.filter((document) => document.type === 'Phiếu nhập'),
    ...workflowDocuments.filter((document) => document.type === 'Phiếu xuất'),
  ];
  const warehouseInbox = roleInboxItems.filter((item) => item.laneId === 'warehouse');
  const shortageLine = demandLines.find((line) => line.tone === 'danger');
  const issueDocument = warehouseDocuments.find((document) => document.type === 'Phiếu xuất');
  const receiptDocument = warehouseDocuments.find((document) => document.type === 'Phiếu nhập');
  const warehouseName = currentStockRows[0]?.warehouse ?? receiptDocument?.owner ?? issueDocument?.owner ?? 'Kho';
  const issueCandidate = demandLines.find((line) => line.materialRequestId);
  const selectedWarehouse = currentStockRows.find((row) => row.warehouseId);
  const pendingKitchenReceiptCount = kitchenIssueRows.filter((row) => !row.isReceivedByKitchen).length;

  const handleCreateInventoryIssue = async () => {
    setWarehouseFeedback(null);

    if (!issueCandidate?.materialRequestId) {
      setWarehouseFeedback({
        title: 'Chưa có nhu cầu xuất kho',
        message: 'Kho cần có nhu cầu nguyên liệu và kế hoạch sản xuất hợp lệ trước khi tạo phiếu xuất.',
        variant: 'warning',
      });
      setActiveView('demand');
      return;
    }

    if (!selectedWarehouse?.warehouseId) {
      setWarehouseFeedback({
        title: 'Chưa xác định kho xuất',
        message: 'Chưa có dòng tồn kho live để xác định warehouseId cho phiếu xuất.',
        variant: 'warning',
      });
      setActiveView('movement');
      return;
    }

    try {
      const response = await createInventoryIssue({
        issueDate: issueCandidate.serviceDate ?? new Date().toISOString().slice(0, 10),
        warehouseId: selectedWarehouse.warehouseId,
        materialRequestId: issueCandidate.materialRequestId,
        lines: [],
      }).unwrap();

      setWarehouseFeedback({
        title: 'Đã tạo phiếu xuất kho',
        message: response.data
          ? `Phiếu ${response.data.issueCode} đã được ghi nhận và chờ bếp ký nhận.`
          : response.message || 'Phiếu xuất kho đã được ghi nhận.',
        variant: 'info',
      });
      setActiveView('movement');
    } catch (error) {
      setWarehouseFeedback({
        title: 'Chưa tạo được phiếu xuất kho',
        message: getMutationErrorMessage(error, 'Kiểm tra tồn kho, demand còn lại hoặc quyền thủ kho rồi thử lại.'),
        variant: 'danger',
      });
      setActiveView('exceptions');
    }
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-warehouse-actions"
          actions={
            <>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={handleCreateInventoryIssue}
                disabled={isCreatingIssue}
              >
                {isCreatingIssue ? 'Đang tạo phiếu...' : 'Tạo phiếu xuất kho'}
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
            { label: 'Bếp nhận', value: pendingKitchenReceiptCount > 0 ? `${pendingKitchenReceiptCount} dòng chờ ký` : 'Không còn chờ ký', tone: pendingKitchenReceiptCount > 0 ? 'warning' : 'success' },
          ]}
        />
      }
    >

      {warehouseFeedback && (
        <InlineAlert title={warehouseFeedback.title} variant={warehouseFeedback.variant}>
          {warehouseFeedback.message}
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
                <TableViewport className="ipc-warehouse-table-shell" ariaLabel="Bảng tồn kho hiện tại trong kho" caption="Danh sách tồn kho hiện tại trong kho">
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
                      {currentStockRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-slate-500">Chưa có dữ liệu tồn kho</td>
                        </tr>
                      ) : currentStockRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.warehouse}</td>
                          <td>{row.ingredient}</td>
                          <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                          <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableViewport>
                <PaginationBar
                  page={currentStockPageResponse?.pageNumber ?? currentStockPage}
                  pageSize={currentStockPageResponse?.pageSize ?? 8}
                  totalItems={currentStockPageResponse?.totalCount ?? 0}
                  onPageChange={setCurrentStockPage}
                />
              </SectionPanel>

              <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
                <StockMovementTable
                  movements={stockMovementPage?.items ?? []}
                  cursorPagination={{
                    page: stockMovementCursors.length + 1,
                    hasNext: stockMovementPage?.hasNext ?? false,
                    onPrevious: () => setStockMovementCursors((current) => current.slice(0, -1)),
                    onNext: () => {
                      const nextCursorDate = stockMovementPage?.nextCursorDate;
                      if (nextCursorDate) {
                        setStockMovementCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: stockMovementPage?.nextCursorId }]);
                      }
                    },
                  }}
                />
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
                  {formatWorkflowStatus(item.nextAction)}
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
                  ? `Phiếu ${formatWorkflowStatus(issueDocument.status).toLowerCase()} cần bàn giao để bếp xác nhận nhận nguyên liệu.`
                  : 'Khi có phiếu xuất từ báo cáo vận hành, thủ kho bàn giao để bếp xác nhận nhận nguyên liệu.',
                action: 'Thủ kho: Xuất kho cho bếp',
                tone: issueDocument ? 'warning' : 'info',
              },
            ]}
          />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
