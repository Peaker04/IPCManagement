import { lazy, Suspense, useState } from 'react';
import { Database, PackageCheck, SlidersHorizontal, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CommandBar, ContextStrip, OperationalFrame, ViewSwitcher } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';
import { useAdminDataPageModel } from './admin-data/useAdminDataPageModel';
import type { AdminView } from './admin-data/adminDataPageTypes';
import { useSystemOperation } from '@/features/system-operation/systemOperationContext';
import { ReconciliationAdminDataPage } from './admin-data/ReconciliationAdminDataPage';

const AdminAuditPanel = lazy(() => import('./admin-data/AdminAuditPanel').then(({ AdminAuditPanel: component }) => ({ default: component })))
const AdminBomPanel = lazy(() => import('./admin-data/AdminBomPanel').then(({ AdminBomPanel: component }) => ({ default: component })))
const AdminCleanupPanel = lazy(() => import('./admin-data/AdminCleanupPanel').then(({ AdminCleanupPanel: component }) => ({ default: component })))
const AdminContractsPanel = lazy(() => import('./admin-data/AdminContractsPanel').then(({ AdminContractsPanel: component }) => ({ default: component })))
const AdminEmployeesPanel = lazy(() => import('./admin-data/AdminEmployeesPanel').then(({ AdminEmployeesPanel: component }) => ({ default: component })))
const AdminInventoryPanel = lazy(() => import('./admin-data/AdminInventoryPanel').then(({ AdminInventoryPanel: component }) => ({ default: component })))
const AdminStatisticsPanel = lazy(() => import('./admin-data/AdminStatisticsPanel').then(({ AdminStatisticsPanel: component }) => ({ default: component })))
const AdminPanelFallback = <div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />

function DefaultAdminDataPage() {
  const model = useAdminDataPageModel();
  const { adminContextItems, adminTabs, canManageEmployees, effectiveActiveView, isViewPending, setActiveView, startViewTransition } = model;
  const canShowEmployees = canManageEmployees && adminTabs.some((tab) => tab.id === 'admin-employees');
  const [visitedViews, setVisitedViews] = useState<ReadonlySet<AdminView>>(() => new Set([effectiveActiveView]));
  const activateView = (view: AdminView) => {
    setVisitedViews((current) => current.has(view) ? current : new Set(current).add(view));
    startViewTransition(() => setActiveView(view));
  };
return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => activateView('bom-import')}>
                <PackageCheck size={16} />
                BOM theo đơn giá
              </button>
              {canShowEmployees && (
                <button className="ipc-button ipc-button-ghost" type="button" onClick={() => activateView('employees')}>
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
      <div className="min-w-0 [&_.text-slate-400]:text-slate-700! [&_.text-slate-500]:text-slate-700!">
        {adminTabs.length === 0 ? <section className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Không còn vùng dữ liệu đang hiển thị</h2><p className="mt-2 text-sm text-slate-600">Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.</p><Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>Mở thiết lập hiển thị</Link></section> : <>
        <ViewSwitcher
          compact
          ariaLabel="Chọn góc nhìn quản trị dữ liệu"
          tabs={adminTabs}
          activeTab={`admin-${effectiveActiveView}`}
          onTabChange={(id) => activateView(id.replace('admin-', '') as AdminView)}
        />

        {isViewPending ? <span className="sr-only" role="status">Đang chuyển vùng dữ liệu quản trị.</span> : null}

        <Suspense fallback={AdminPanelFallback}>
          {visitedViews.has('bom-import') && <AdminBomPanel model={model} />}
          {visitedViews.has('contracts') && <AdminContractsPanel model={model} />}
          {visitedViews.has('cleanup') && <AdminCleanupPanel model={model} />}
          {visitedViews.has('inventory') && <AdminInventoryPanel model={model} />}
          {visitedViews.has('statistics') && <AdminStatisticsPanel model={model} />}
          {visitedViews.has('employees') && <AdminEmployeesPanel model={model} />}
          {visitedViews.has('audit') && <AdminAuditPanel model={model} />}
        </Suspense>
        </>}
      </div>
    </OperationalFrame>
  );
}

export default function AdminDataPage() {
  const operation = useSystemOperation();
  return operation?.mode === 'MATERIAL_RECONCILIATION'
    ? <ReconciliationAdminDataPage />
    : <DefaultAdminDataPage />;
}
