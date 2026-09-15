import { useEffect, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminBomPanelModel } from './useAdminBomPanelModel'
import { useAdminAuditPanelModel } from './useAdminAuditPanelModel'
import { useAdminContractsPanelModel } from './useAdminContractsPanelModel'
import type { AdminView } from './adminDataPageTypes'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { eligiblePageTabs } from '@/lib/systemOperationEligibility'
import { visibleTabIds } from '@/lib/navigationPreferences'

export function useReconciliationAdminDataPageModel() {
  const [isViewPending, startViewTransition] = useTransition()
  const operation = useSystemOperation()
  const eligibleAdminTabs = eligiblePageTabs(
    operation?.mode ?? 'MATERIAL_RECONCILIATION',
    'admin-data',
    operation?.capabilities.pageTabs['admin-data'] ?? ['bom-import', 'audit'],
    visibleTabIds('admin-data'),
  ) as AdminView[]
  const [searchParams, setSearchParams] = useSearchParams()
  const bomTemplateDishId = searchParams.get('dishId')?.trim() || undefined
  const requested = searchParams.get('view')
  const requestedSourceFamily = searchParams.get('sourceFamily')
  const auditSourceFamily = requestedSourceFamily === 'ALL' ? 'ALL' : 'MATERIAL_RECONCILIATION'
  useEffect(() => {
    if (requestedSourceFamily === auditSourceFamily) return
    const next = new URLSearchParams(searchParams)
    next.set('sourceFamily', auditSourceFamily)
    setSearchParams(next, { replace: true })
  }, [auditSourceFamily, requestedSourceFamily, searchParams, setSearchParams])
  const setAuditSourceFamily = (value: 'MATERIAL_RECONCILIATION' | 'ALL') => {
    const next = new URLSearchParams(searchParams)
    next.set('sourceFamily', value)
    setSearchParams(next, { replace: true })
  }
  const isAuditEligible = eligibleAdminTabs.includes('audit')
  const isBomEligible = eligibleAdminTabs.includes('bom-import')
  const activeView: AdminView = (() => {
    if (requested === 'source-changes' && isAuditEligible) return 'source-changes'
    if (requested === 'audit' && isAuditEligible) return 'audit'
    if (requested === 'bom-import' && isBomEligible) return 'bom-import'
    if (isBomEligible) return 'bom-import'
    if (isAuditEligible) return 'audit'
    return 'bom-import'
  })()
  const selectActiveView = (view: AdminView) => {
    const next = new URLSearchParams(searchParams)
    next.set('view', view)
    setSearchParams(next, { replace: true })
  }
  const { queryViews: bomQueryViews, ...bomModel } = useAdminBomPanelModel(activeView, bomTemplateDishId)
  const { queryViews: contractQueryViews, ...contractModel } = useAdminContractsPanelModel(activeView, false)
  const { queryView: auditView, ...auditModel } = useAdminAuditPanelModel(activeView, true, auditSourceFamily === 'ALL' ? undefined : auditSourceFamily)
  return {
    isReconciliationMode: true as const,
    auditSourceFamily,
    setAuditSourceFamily,
    ...bomModel,
    ...contractModel,
    ...auditModel,
    bomTemplateDishId,
    effectiveActiveView: activeView,
    eligibleAdminTabs,
    isViewPending,
    setActiveView: selectActiveView,
    startViewTransition,
    queryViews: {
      audit: auditView,
      contracts: contractQueryViews.contracts,
      dishCatalog: bomQueryViews.dishCatalog,
      ingredientCatalog: bomQueryViews.ingredientCatalog,
    },
  }
}

export type ReconciliationAdminDataPageModel = ReturnType<typeof useReconciliationAdminDataPageModel>
