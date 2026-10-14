import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { OperationalFrame } from '@/components/common'
import { ROUTES } from '@/lib/routeConfig'
import type { AdminView } from './adminDataPageTypes'
import { useReconciliationAdminDataPageModel } from './useReconciliationAdminDataPageModel'

const AdminAuditPanel = lazy(() => import('./AdminAuditPanel').then(({ AdminAuditPanel: component }) => ({ default: component })))
const AdminBomPanel = lazy(() => import('./AdminBomPanel').then(({ AdminBomPanel: component }) => ({ default: component })))
const AdminSourceChangesPanel = lazy(() => import('./AdminSourceChangesPanel').then(({ AdminSourceChangesPanel: component }) => ({ default: component })))

export function ReconciliationAdminDataPage() {
  const model = useReconciliationAdminDataPageModel()
  const [visited] = useState<ReadonlySet<AdminView>>(() => new Set([model.effectiveActiveView]))
  const mounted = visited.has(model.effectiveActiveView) ? visited : new Set(visited).add(model.effectiveActiveView)

  const eligibleTabs = model.eligibleAdminTabs ?? ['bom-import', 'audit']

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
      {/* G4 batch E phase 2: leaf navigation moved to sidebar (MainLayout): { id: 'admin-bom-import' }, { id: 'admin-audit' }, { id: 'admin-source-changes' } */}
      {model.isViewPending ? <span className="sr-only" role="status">Đang chuyển vùng dữ liệu quản trị.</span> : null}
      <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50" />}>
        {mounted.has('bom-import') && <AdminBomPanel model={model} />}
        {mounted.has('audit') && <AdminAuditPanel model={model} />}
        {mounted.has('source-changes') && <AdminSourceChangesPanel model={model} />}
      </Suspense>
    </OperationalFrame>
  )
}
