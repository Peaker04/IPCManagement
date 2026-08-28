import { lazy, Suspense, useState } from 'react'
import { OperationalFrame, ViewSwitcher } from '@/components/common'
import type { AdminView } from './adminDataPageTypes'
import { useReconciliationAdminDataPageModel } from './useReconciliationAdminDataPageModel'

const AdminAuditPanel = lazy(() => import('./AdminAuditPanel').then(({ AdminAuditPanel: component }) => ({ default: component })))
const AdminBomPanel = lazy(() => import('./AdminBomPanel').then(({ AdminBomPanel: component }) => ({ default: component })))

export function ReconciliationAdminDataPage() {
  const model = useReconciliationAdminDataPageModel()
  const [visited, setVisited] = useState<ReadonlySet<AdminView>>(() => new Set([model.effectiveActiveView]))
  const activate = (view: AdminView) => {
    setVisited((current) => current.has(view) ? current : new Set(current).add(view))
    model.startViewTransition(() => model.setActiveView(view))
  }
  return <OperationalFrame>
    <ViewSwitcher compact ariaLabel="Chọn vùng dữ liệu đối chiếu" tabs={[{ id: 'admin-bom-import', label: 'BOM theo đơn giá' }, { id: 'admin-audit', label: 'Nhật ký thay đổi' }]} activeTab={`admin-${model.effectiveActiveView}`} onTabChange={(id) => activate(id.replace('admin-', '') as AdminView)} />
    {model.isViewPending ? <span className="sr-only" role="status">Đang chuyển vùng dữ liệu quản trị.</span> : null}
    <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50" />}>
      {visited.has('bom-import') && <AdminBomPanel model={model} />}
      {visited.has('audit') && <AdminAuditPanel model={model} />}
    </Suspense>
  </OperationalFrame>
}
