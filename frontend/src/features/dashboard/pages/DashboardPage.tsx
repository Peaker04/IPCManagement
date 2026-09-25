import { lazy, Suspense } from 'react'
import { useSystemOperation } from '@/lib/systemOperationContext'
import DefaultDashboardPage from './DefaultDashboardPage'

const ReconciliationDashboardPage = lazy(() => import('./ReconciliationDashboardPage').then((m) => ({ default: m.ReconciliationDashboardPage })))

export default function DashboardPage() {
  const operation = useSystemOperation()
  if (operation?.mode !== 'MATERIAL_RECONCILIATION') return <DefaultDashboardPage />

  return (
    <Suspense fallback={null}>
      <ReconciliationDashboardPage />
    </Suspense>
  )
}
