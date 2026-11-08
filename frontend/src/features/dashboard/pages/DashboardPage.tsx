import { lazy, Suspense } from 'react'
import { useSystemOperation } from '@/lib/systemOperationContext'

const DefaultDashboardPage = lazy(() => import('./DefaultDashboardPage'))
const ReconciliationDashboardPage = lazy(() => import('./ReconciliationDashboardPage').then(({ ReconciliationDashboardPage: component }) => ({ default: component })))

const dashboardFallback = (
  <div
    aria-busy="true"
    aria-label="Đang tải bàn điều hành"
    className="min-h-[28rem] rounded-md border border-slate-200 bg-slate-50 motion-reduce:animate-none"
  />
)

export default function DashboardPage() {
  const operation = useSystemOperation()
  const Dashboard = operation?.mode === 'MATERIAL_RECONCILIATION'
    ? ReconciliationDashboardPage
    : DefaultDashboardPage

  return <Suspense fallback={dashboardFallback}><Dashboard /></Suspense>
}
