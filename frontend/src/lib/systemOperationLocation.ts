import { ROUTES } from '@/lib/routeConfig'
import { isRouteEligible, type SystemOperationMode } from '@/lib/systemOperationEligibility'

export const normalizeAuthorityLocation = (mode: SystemOperationMode, pathname: string, search: string) => {
  if (!isRouteEligible(mode, pathname)) return ROUTES.DASHBOARD
  if (mode !== 'DEFAULT') return null

  if (pathname === ROUTES.RECONCILIATION) return ROUTES.DASHBOARD

  if (pathname === ROUTES.WAREHOUSE) {
    const next = new URLSearchParams(search)
    const view = next.get('view')
    const validView = view === 'receiving' || view === 'movement' || view === 'demand' || view === 'exceptions'
    const changed = next.has('batchId') || Boolean(view && !validView)
    next.delete('batchId')
    if (view && !validView) next.delete('view')
    if (changed) {
      const nextSearch = next.toString()
      return nextSearch ? `${pathname}?${nextSearch}` : pathname
    }
    return null
  }

  if (pathname === ROUTES.WEEKLY_MENU) {
    const next = new URLSearchParams(search)
    const view = next.get('view')
    const validView = view === 'schedule' || view === 'demand' || view === 'production-plan' || view === 'purchase-summary' || view === 'cost' || view === 'dish-materials'
    if (view && !validView) {
      next.delete('view')
      const nextSearch = next.toString()
      return nextSearch ? `${pathname}?${nextSearch}` : pathname
    }
  }

  return null
}
