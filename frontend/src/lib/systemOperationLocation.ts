import { ROUTES } from '@/lib/routeConfig'
import { isRouteEligible, type SystemOperationMode } from '@/lib/systemOperationEligibility'

export const normalizeAuthorityLocation = (mode: SystemOperationMode, pathname: string, search: string) => {
  if (!isRouteEligible(mode, pathname)) return ROUTES.DASHBOARD
  if (mode !== 'DEFAULT') return null

  if (pathname === ROUTES.RECONCILIATION) return ROUTES.DASHBOARD

  if (pathname === ROUTES.WAREHOUSE) {
    const next = new URLSearchParams(search)
    const changed = next.has('batchId') || next.has('view')
    next.delete('batchId')
    next.delete('view')
    if (changed) {
      const nextSearch = next.toString()
      return nextSearch ? `${pathname}?${nextSearch}` : pathname
    }
    return null
  }

  if (pathname === ROUTES.WEEKLY_MENU) {
    const next = new URLSearchParams(search)
    const changed = ['view', 'customerId', 'weekStartDate'].some((key) => next.has(key))
    next.delete('view')
    next.delete('customerId')
    next.delete('weekStartDate')
    if (changed) {
      const nextSearch = next.toString()
      return nextSearch ? `${pathname}?${nextSearch}` : pathname
    }
  }

  return null
}
