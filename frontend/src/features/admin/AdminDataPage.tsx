import { useAuth } from '../../store/useAuth';
import { useUrlWorkbenchState } from '../../hooks/useUrlWorkbenchState';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { AdminBomBranch } from './branches/AdminBomBranch';
import { AdminCustomersBranch } from './branches/AdminCustomersBranch';
import { AdminCatalogBranch } from './branches/AdminCatalogBranch';

export function AdminDataPage() {
  const { view } = useUrlWorkbenchState({ defaultView: 'ingredients' });
  const { user, operationalMode } = useAuth();

  if (view === 'bom') {
    return (
      <WorkspaceFrame.Root className="select-text">
        <WorkspaceHeader
          title="Quản trị dữ liệu & Danh mục"
          breadcrumb="Hệ thống · Quản trị dữ liệu · Định mức BOM"
        />
        <AdminBomBranch />
      </WorkspaceFrame.Root>
    );
  }

  if (view === 'customers') {
    return (
      <WorkspaceFrame.Root className="select-text">
        <WorkspaceHeader
          title="Quản trị dữ liệu & Danh mục"
          breadcrumb="Hệ thống · Quản trị dữ liệu · Khách hàng & Hợp đồng"
        />
        <AdminCustomersBranch />
      </WorkspaceFrame.Root>
    );
  }

  return <AdminCatalogBranch key={JSON.stringify([view, user?.userId, user?.roleCode, operationalMode])} activeView={view === 'dishes' ? 'dishes' : 'ingredients'} />;
}
