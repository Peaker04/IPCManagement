import { useState } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
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
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';

export default function PurchasingPage() {
  const [activeView, setActiveView] = useState<'demand' | 'supplier' | 'handoff'>('demand');
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: purchaseDemandLines = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: priceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });
  const { roleInboxItems } = useWorkflowOverview();
  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua' || document.type === 'Danh sách mua thêm');
  const purchaseInbox = roleInboxItems.filter((item) => item.laneId === 'purchasing');
  const receiptMovements = stockMovements.filter((movement) => movement.type === 'receipt');
  const warningPrice = priceRows.find((row) => row.warning);
  const primaryPurchaseDemand = purchaseDemandLines.find((line) => line.tone === 'danger') ?? purchaseDemandLines[0];

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button">Chọn nhà cung cấp</button>
              <button className="ipc-button ipc-button-warning" type="button">Gửi cảnh báo biến động giá</button>
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
            Danh sách mua thêm: MUA-0613-01
          </span>
          <span className="ipc-command-meta">Ngưỡng cảnh báo: 15%</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái mua', value: primaryPurchaseDemand?.status ?? 'Chưa có đơn mua', tone: primaryPurchaseDemand ? 'warning' : 'neutral' },
            { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
            { label: 'Hạn chuyển kho', value: '10:00', tone: 'warning' },
            { label: 'Nhà cung cấp đề xuất', value: warningPrice?.supplier ?? primaryPurchaseDemand?.source ?? 'Chưa có', tone: 'neutral' },
          ]}
        />
      }
    >

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
            <SectionPanel title="Nhu cầu mua thêm" icon={<ShoppingCart size={18} />}>
              <DemandSummary lines={purchaseDemandLines.filter((line) => line.tone === 'danger')} />
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
              <strong className="text-slate-900">{primaryPurchaseDemand?.status ?? 'Chưa có dữ liệu'}</strong>
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
