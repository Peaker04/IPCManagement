import { useState } from 'react';
import { Bell, Database, SlidersHorizontal, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuditLogs } from '@/app/hooks';
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
  StockMovementTable,
  DataTableShell,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  approvalRecords,
  getDocumentByType,
  getRoleInboxByLane,
  getStockMovementsByType,
} from '@/features/workflow';

export default function AdminDataPage() {
  const [activeView, setActiveView] = useState<'adjustments' | 'inventory' | 'audit'>('adjustments');
  const [auditPage, setAuditPage] = useState(1);
  const auditPageSize = 8;
  const logs = useAuditLogs();
  const adjustmentDocuments = getDocumentByType('Điều chỉnh');
  const adminInbox = getRoleInboxByLane('admin');
  const adjustmentMovements = getStockMovementsByType('adjustment');

  const defaultAuditLogs = [
    {
      id: 'aud-01',
      timestamp: '2026-06-13T08:30:12.000Z',
      actor: 'Quản lý Bếp trưởng (Đặng Ánh Vàng)',
      fieldAffected: 'Khóa định mức',
      oldValue: 'Chưa khóa',
      newValue: 'Đã khóa',
      reason: 'Chốt số suất ăn phục vụ ca trưa ngày 13/06',
      orderId: 'KHSX-0613-TRUA',
      shiftType: 'Ca Sáng' as const,
    },
    {
      id: 'aud-02',
      timestamp: '2026-06-13T09:12:45.000Z',
      actor: 'Admin Hệ Thống',
      fieldAffected: 'BOM / Định lượng cá kho tiêu',
      oldValue: '120g/suất',
      newValue: '110g/suất',
      reason: 'Điều chỉnh lượng cá theo yêu cầu của bếp trưởng để tránh hao hụt',
      orderId: 'BOM-FISH-01',
      shiftType: 'Ca Sáng' as const,
    },
    {
      id: 'aud-03',
      timestamp: '2026-06-13T09:40:00.000Z',
      actor: 'Quản lý vận hành (DAV)',
      fieldAffected: 'Giá thu mua hành lá',
      oldValue: '35.000 đ/kg',
      newValue: '42.000 đ/kg (+18%)',
      reason: 'Duyệt giá tăng đột xuất từ NCC Minh An do khan hiếm thị trường',
      orderId: 'MUA-0613-01',
      shiftType: 'Ca Sáng' as const,
    },
  ];

  const displayLogs = [...logs, ...defaultAuditLogs];
  const totalAuditPages = Math.max(1, Math.ceil(displayLogs.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAuditLogs = displayLogs.slice((safeAuditPage - 1) * auditPageSize, safeAuditPage * auditPageSize);

  return (
    <OperationalFrame
      title="Quản trị dữ liệu"
      eyebrow="Luồng Admin"
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button">Điều chỉnh BOM</button>
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
            { label: 'BOM chờ kiểm tra', value: 'Cá kho tiêu', tone: 'warning' },
            { label: 'Điều chỉnh tồn', value: 'Hành lá +3 kg', tone: 'success' },
            { label: 'Thông báo', value: 'Chưa gửi cho ca trưa', tone: 'warning' },
            { label: 'Audit', value: 'Có lý do thay đổi', tone: 'neutral' },
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
          { id: 'admin-audit', label: 'Audit' },
        ]}
        activeTab={`admin-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('admin-', '') as 'adjustments' | 'inventory' | 'audit')}
      />

      {activeView === 'adjustments' && (
        <div id="admin-adjustments-panel" role="tabpanel" aria-labelledby="admin-adjustments-tab">
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
