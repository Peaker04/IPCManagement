import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { OperationalFrame, ViewSwitcher } from '@/components/common'
import { ROUTES } from '@/lib/routeConfig'
import type { AdminView } from './adminDataPageTypes'
import { useReconciliationAdminDataPageModel } from './useReconciliationAdminDataPageModel'

const AdminAuditPanel = lazy(() => import('./AdminAuditPanel').then(({ AdminAuditPanel: component }) => ({ default: component })))
const AdminBomPanel = lazy(() => import('./AdminBomPanel').then(({ AdminBomPanel: component }) => ({ default: component })))
const AdminSourceChangesPanel = lazy(() => import('./AdminSourceChangesPanel').then(({ AdminSourceChangesPanel: component }) => ({ default: component })))

export function ReconciliationAdminDataPage() {
  const model = useReconciliationAdminDataPageModel()
  const [visited, setVisited] = useState<ReadonlySet<AdminView>>(() => new Set([model.effectiveActiveView]))
  const activate = (view: AdminView) => {
    setVisited((current) => current.has(view) ? current : new Set(current).add(view))
    model.startViewTransition(() => model.setActiveView(view))
  }

  const eligibleTabs = model.eligibleAdminTabs ?? ['bom-import', 'audit']
  const allTabs: Array<{ id: string; label: string; view: AdminView }> = [
    { id: 'admin-bom-import', label: 'BOM theo đơn giá', view: 'bom-import' },
    { id: 'admin-audit', label: 'Nhật ký thay đổi', view: 'audit' },
    { id: 'admin-source-changes', label: 'Lịch sử thay đổi nguồn', view: 'source-changes' },
  ]
  const availableTabs = allTabs.filter((t) =>
    t.view === 'source-changes' ? eligibleTabs.includes('audit') : eligibleTabs.includes(t.view)
  )

  if (eligibleTabs.length === 0) {
    return (
      <OperationalFrame>
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Không còn vùng dữ liệu đang hiển thị</h2>
          <p className="mt-2 text-sm text-slate-600">Mở Thiết lập nâng cao để khôi phục một tab được chế độ hiện tại cho phép.</p>
          <Link className="ipc-button ipc-button-primary mt-4" to={ROUTES.ADVANCED_SETTINGS}>Mở thiết lập hiển thị</Link>
        </section>
      </OperationalFrame>
    )
  }

  return (
    <OperationalFrame>
      <ViewSwitcher
        compact
        ariaLabel="Chọn vùng dữ liệu đối chiếu"
        tabs={availableTabs}
        activeTab={`admin-${model.effectiveActiveView}`}
        onTabChange={(id) => activate(id.replace('admin-', '') as AdminView)}
      />
      {model.isViewPending ? <span className="sr-only" role="status">Đang chuyển vùng dữ liệu quản trị.</span> : null}
      <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50" />}>
        {visited.has('bom-import') && <AdminBomPanel model={model} />}
        {visited.has('audit') && <AdminAuditPanel model={model} />}
        {visited.has('source-changes') && <AdminSourceChangesPanel model={model} />}
      </Suspense>
    </OperationalFrame>
  )
}
