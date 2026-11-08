import { useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminBomPanelModel } from './useAdminBomPanelModel'
import { useAdminAuditPanelModel } from './useAdminAuditPanelModel'
import { useAdminContractsPanelModel } from './useAdminContractsPanelModel'
import type { AdminView } from './adminDataPageTypes'

export function useReconciliationAdminDataPageModel() {
  const [isViewPending, startViewTransition] = useTransition()
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
  const [activeView, setActiveView] = useState<AdminView>(requested === 'audit' ? 'audit' : 'bom-import')
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
    isViewPending,
    setActiveView,
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
