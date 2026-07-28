import { Database, PackageCheck, SlidersHorizontal, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CommandBar, ContextStrip, OperationalFrame, ViewSwitcher } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';
import { AdminAuditPanel } from './admin-data/AdminAuditPanel';
import { AdminBomPanel } from './admin-data/AdminBomPanel';
import { AdminCleanupPanel } from './admin-data/AdminCleanupPanel';
import { AdminContractsPanel } from './admin-data/AdminContractsPanel';
import { AdminEmployeesPanel } from './admin-data/AdminEmployeesPanel';
import { AdminInventoryPanel } from './admin-data/AdminInventoryPanel';
import { AdminStatisticsPanel } from './admin-data/AdminStatisticsPanel';
import { useAdminDataPageModel } from './admin-data/useAdminDataPageModel';
import type { AdminView } from './admin-data/adminDataPageTypes';

export default function AdminDataPage() {
  const model = useAdminDataPageModel();
  const { adminContextItems, adminTabs, canManageEmployees, effectiveActiveView, isViewPending, setActiveView, startViewTransition } = model;
return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => setActiveView('bom-import')}>
                <PackageCheck size={16} />
                BOM theo đơn giá
              </button>
              {canManageEmployees && (
                <button className="ipc-button ipc-button-ghost" type="button" onClick={() => setActiveView('employees')}>
                  <Users size={16} />
                  Nhân viên
                </button>
              )}
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
        <ContextStrip items={adminContextItems} />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn quản trị dữ liệu"
        tabs={adminTabs}
        activeTab={`admin-${effectiveActiveView}`}
        onTabChange={(id) => startViewTransition(() => setActiveView(id.replace('admin-', '') as AdminView))}
      />

      {isViewPending ? <span className="sr-only" role="status">Đang chuyển vùng dữ liệu quản trị.</span> : null}

      <AdminBomPanel model={model} />
      <AdminContractsPanel model={model} />
      <AdminCleanupPanel model={model} />
      <AdminInventoryPanel model={model} />
      <AdminStatisticsPanel model={model} />
      <AdminEmployeesPanel model={model} />
      <AdminAuditPanel model={model} />
    </OperationalFrame>
  );
}
