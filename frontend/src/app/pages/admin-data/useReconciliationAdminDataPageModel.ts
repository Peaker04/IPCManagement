import { useState, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminBomPanelModel } from './useAdminBomPanelModel'
import { useAdminAuditPanelModel } from './useAdminAuditPanelModel'
import { useAdminContractsPanelModel } from './useAdminContractsPanelModel'
import type { AdminView } from './adminDataPageTypes'

export function useReconciliationAdminDataPageModel() {
  const [isViewPending, startViewTransition] = useTransition()
  const [searchParams] = useSearchParams()
  const bomTemplateDishId = searchParams.get('dishId')?.trim() || undefined
  const requested = searchParams.get('view')
  const [activeView, setActiveView] = useState<AdminView>(requested === 'audit' ? 'audit' : 'bom-import')
  const { queryViews: bomQueryViews, ...bomModel } = useAdminBomPanelModel(activeView, bomTemplateDishId)
  const { queryViews: contractQueryViews, ...contractModel } = useAdminContractsPanelModel(activeView)
  const { queryView: auditView, ...auditModel } = useAdminAuditPanelModel(activeView)
  return {
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
