import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { OperationalFrame, TabContentSkeleton } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';
import { useAdminDataPageModel } from './admin-data/useAdminDataPageModel';
import type { AdminView } from './admin-data/adminDataPageTypes';
import { useSystemOperation } from '@/lib/systemOperationContext';
import { ReconciliationAdminDataPage } from './admin-data/ReconciliationAdminDataPage';

const AdminAuditPanel = lazy(() => import('./admin-data/AdminAuditPanel').then(({ AdminAuditPanel: component }) => ({ default: component })))
const AdminBomPanel = lazy(() => import('./admin-data/AdminBomPanel').then(({ AdminBomPanel: component }) => ({ default: component })))
const AdminCleanupPanel = lazy(() => import('./admin-data/AdminCleanupPanel').then(({ AdminCleanupPanel: component }) => ({ default: component })))
const AdminContractsPanel = lazy(() => import('./admin-data/AdminContractsPanel').then(({ AdminContractsPanel: component }) => ({ default: component })))
const AdminEmployeesPanel = lazy(() => import('./admin-data/AdminEmployeesPanel').then(({ AdminEmployeesPanel: component }) => ({ default: component })))
const AdminInventoryPanel = lazy(() => import('./admin-data/AdminInventoryPanel').then(({ AdminInventoryPanel: component }) => ({ default: component })))
const AdminStatisticsPanel = lazy(() => import('./admin-data/AdminStatisticsPanel').then(({ AdminStatisticsPanel: component }) => ({ default: component })))
const AdminPanelFallback = (
  <TabContentSkeleton
    columns={6}
    rows={6}
    message="Đang tải dữ liệu quản trị..."
  />
);

function DefaultAdminDataPage() {
  const model = useAdminDataPageModel();
  const { adminTabs, effectiveActiveView, isViewPending } = model;
  const [visitedViews] = useState<ReadonlySet<AdminView>>(() => new Set([effectiveActiveView]));
  const mountedViews = visitedViews.has(effectiveActiveView) ? visitedViews : new Set(visitedViews).add(effectiveActiveView);
  return (
    <OperationalFrame>
      <div className="min-w-0 [&_.text-slate-400]:text-slate-700! [&_.text-slate-500]:text-slate-700!">
        {adminTabs.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">Không còn vùng dữ liệu đang hiển thị</h2>
            <p className="mt-2 text-sm text-slate-600">
              Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.
            </p>
            <Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>
              Mở thiết lập hiển thị
            </Link>
          </section>
        ) : (
          <>
            {/* Leaf navigation moved to sidebar (MainLayout). */}
            {isViewPending ? (
              <span className="sr-only" role="status">
                Đang chuyển vùng dữ liệu quản trị.
              </span>
            ) : null}

            <Suspense fallback={AdminPanelFallback}>
              {mountedViews.has('bom-import') && <AdminBomPanel model={model} />}
              {mountedViews.has('contracts') && <AdminContractsPanel model={model} />}
              {mountedViews.has('cleanup') && <AdminCleanupPanel model={model} />}
              {mountedViews.has('inventory') && <AdminInventoryPanel model={model} />}
              {mountedViews.has('statistics') && <AdminStatisticsPanel model={model} />}
              {mountedViews.has('employees') && <AdminEmployeesPanel model={model} />}
              {mountedViews.has('audit') && <AdminAuditPanel model={model} />}
            </Suspense>
          </>
        )}
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
