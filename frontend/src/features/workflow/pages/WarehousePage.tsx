import { useState } from 'react';
import { ClipboardList, PackageOpen, Warehouse } from 'lucide-react';
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
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetCurrentStockQuery,
  useGetIngredientDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';
import { formatQuantityWithUnit } from '@/lib/formatters';

export default function WarehousePage() {
  const [activeView, setActiveView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 12 });
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

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button">Tạo phiếu xuất kho</button>
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
                </DataTableShell>
              </SectionPanel>

              <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
                <StockMovementTable movements={stockMovements} />
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
    </OperationalFrame>
  );
}
