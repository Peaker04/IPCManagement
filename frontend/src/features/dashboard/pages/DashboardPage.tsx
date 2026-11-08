import { lazy, Suspense } from 'react'
import { useSystemOperation } from '@/lib/systemOperationContext'

const DefaultDashboardPage = lazy(() => import('./DefaultDashboardPage'))
const ReconciliationDashboardPage = lazy(() => import('./ReconciliationDashboardPage').then((m) => ({ default: m.ReconciliationDashboardPage })))

export default function DashboardPage() {
  const operation = useSystemOperation()
  return (
    <Suspense fallback={null}>
      {operation?.mode === 'MATERIAL_RECONCILIATION'
        ? <ReconciliationDashboardPage />
        : <DefaultDashboardPage />}
    </Suspense>
  )
}
