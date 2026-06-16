import { useState } from 'react';
import { ClipboardList, PackageOpen, Warehouse } from 'lucide-react';
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
  stockMovements,
} from '@/features/workflow';

export default function WarehousePage() {
  const [activeView, setActiveView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const warehouseDocuments = [
    ...getDocumentByType('Phiếu nhập'),
    ...getDocumentByType('Phiếu xuất'),
  ];
  const warehouseInbox = getRoleInboxByLane('warehouse');

  return (
    <OperationalFrame
      title="Kho nguyên liệu"
      eyebrow="Luồng Thủ kho"
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button">Tạo phiếu xuất kho</button>
              <button className="ipc-button ipc-button-success" type="button">Cập nhật tồn kho</button>
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
            Kho mát - ca trưa
          </span>
          <span className="ipc-command-meta">Bàn giao bếp: 10:30</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Phiếu nhập', value: '1 chứng từ chờ nhập', tone: 'warning' },
            { label: 'Phiếu xuất', value: '1 phiếu chờ xuất', tone: 'warning' },
            { label: 'Thiếu hàng', value: 'Gừng 4 kg', tone: 'danger' },
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
            <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
              <StockMovementTable movements={stockMovements} />
            </SectionPanel>
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
                title: 'Gừng còn thiếu 4 kg',
                description: 'Không đủ hàng để xuất theo danh sách. Tạo phiếu xuất bổ sung hoặc danh sách mua thêm.',
                action: 'Thủ kho: Tạo phiếu xuất kho bổ sung',
                tone: 'danger',
              },
              {
                title: 'Bếp chưa ký nhận PX-0613-TRUA',
                description: 'Phiếu đã soạn, cần bàn giao để bếp xác nhận nhận nguyên liệu.',
                action: 'Thủ kho: Xuất kho cho bếp',
                tone: 'warning',
              },
            ]}
          />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
