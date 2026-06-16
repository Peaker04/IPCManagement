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
  demandLines,
  getDocumentByType,
  getRoleInboxByLane,
  getStockMovementsByType,
} from '@/features/workflow';

export default function PurchasingPage() {
  const [activeView, setActiveView] = useState<'demand' | 'supplier' | 'handoff'>('demand');
  const purchasingDocuments = getDocumentByType('Đơn mua');
  const purchaseInbox = getRoleInboxByLane('purchasing');
  const receiptMovements = getStockMovementsByType('receipt');

  return (
    <OperationalFrame
      title="Thu mua"
      eyebrow="Luồng Thu mua"
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
            { label: 'Trạng thái mua', value: 'Chờ chọn nhà cung cấp', tone: 'warning' },
            { label: 'Cảnh báo giá', value: 'Hành lá +18%', tone: 'danger' },
            { label: 'Hạn chuyển kho', value: '10:00', tone: 'warning' },
            { label: 'Nhà cung cấp đề xuất', value: 'Thực phẩm Minh An', tone: 'neutral' },
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
              <DemandSummary lines={demandLines.filter((line) => line.tone === 'danger')} />
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
              <strong className="text-slate-900">Thực phẩm Minh An</strong>
              <p>Giao trước 10:00, phù hợp kho mát.</p>
            </div>
            <div className="ipc-lane-summary-card cursor-pointer hover:shadow-md hover:border-slate-300 bg-white">
              <span>Giá nhập hiện tại</span>
              <strong className="text-slate-900">42.000 đ/kg - +18%</strong>
              <p>Vượt ngưỡng 15%, cần cảnh báo quản lí.</p>
            </div>
            <div className="ipc-lane-summary-card cursor-pointer hover:shadow-md hover:border-slate-300 bg-white">
              <span>Trạng thái đơn mua</span>
              <strong className="text-slate-900">Chờ đặt nguyên liệu</strong>
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
                  title: 'Hành lá +18%',
                  description: 'Giá mới cao hơn lần nhập gần nhất, cần gửi cảnh báo biến động giá.',
                  action: 'Thu mua: Gửi cảnh báo biến động giá',
                  tone: 'danger',
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
