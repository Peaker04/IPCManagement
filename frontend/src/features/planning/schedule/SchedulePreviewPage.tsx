import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import {
  useGetCommittedWeeklyMenuQuery,
  useGetCustomerContractsQuery,
  useGetReconciliationWeeklyMenuQuery,
  useGetCoordinationCustomersQuery,
  useGetMealQuantityPlansQuery,
  useGetMenuSchedulesQuery,
  useUpdateMenuScheduleVersionMutation,
} from '@/api/coordinationApi'
import { ConfirmDialog } from '@/components/common'
import { DAYS_OF_WEEK } from '@/lib/constants'
import { setWeeklyMenu } from '@/lib/coordinationActions'
import { useCoordinationStoreSelector } from '@/lib/coordinationStore'
import { useAppDispatch } from '@/lib/reduxHooks'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { normalizeDishMatchKey, normalizeWeekStartDate, parseDisplayDateToIso, toLocalIsoDate } from '@/features/projects/weekly-menu/model/formatters'
import { DEFAULT_BOM_PRICE_TIER, isBomPriceTier, normalizeBomPriceTier } from '@/features/projects/weeklyMenuPlanning'
import { buildImportedDayDates, buildImportedLayoutRows, buildPlanRowsMaterialSummary } from '@/features/projects/weekly-menu/model/scope'
import { buildWeeklyPlanRows } from '@/features/projects/weekly-menu/cost/weeklyPlanRowsModel'
import { useMaterialDemand } from '@/features/projects/weekly-menu/demand/useMaterialDemand'
import { WeeklyMenuImportDialog } from '@/features/projects/weekly-menu/import/WeeklyMenuImportDialog'
import { useWeeklyMenuImport } from '@/features/projects/weekly-menu/import/useWeeklyMenuImport'
import { WeeklyScheduleEditorDialog } from '@/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog'
import { useWeeklyScheduleEditor } from '@/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor'
import { SchedulePage } from './SchedulePage'
import { MaterialDemandWorkspacePage } from '../demand/MaterialDemandWorkspacePage'
import { PlanningPreviewShell } from '../PlanningPreviewShell'
import { buildSchedulePageModel } from './schedulePageModel'


export default function SchedulePreviewPage() {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const activeView = location.pathname.endsWith('/demand') ? 'demand' : 'schedule'
  const systemOperation = useSystemOperation()
  const isReconciliationMode = systemOperation?.mode === 'MATERIAL_RECONCILIATION'
  const [params, setParams] = useSearchParams()
  const customerId = params.get('customerId') ?? ''
  const weekStartDate = normalizeWeekStartDate(params.get('weekStartDate') ?? '')
  const [confirmClose, setConfirmClose] = useState<'import' | 'editor' | null>(null)
  const [editorContentReady, setEditorContentReady] = useState(false)
  const reduxWeeklyMenu = useCoordinationStoreSelector((state) => state.coordination.weeklyMenu)
  const orders = useCoordinationStoreSelector((state) => state.coordination.orders)
  const lockedShifts = useCoordinationStoreSelector((state) => state.coordination.lockedShifts)

  const customersQuery = useGetCoordinationCustomersQuery()
  const customersView = toLabeledQueryView(customersQuery, 'danh sách khách hàng')
  const customers = customersView.phase === 'ready' ? customersView.data.data ?? [] : customersQuery.currentData?.data ?? []
  const defaultCommittedQuery = useGetCommittedWeeklyMenuQuery({ customerId, weekStartDate: weekStartDate || undefined }, { skip: isReconciliationMode || !customerId || !weekStartDate })
  const reconciliationCommittedQuery = useGetReconciliationWeeklyMenuQuery({ customerId, weekStartDate: weekStartDate || undefined }, { skip: !isReconciliationMode || !customerId || !weekStartDate })
  const committedQuery = isReconciliationMode ? reconciliationCommittedQuery : defaultCommittedQuery
  const committedView = toLabeledQueryView(committedQuery, 'thực đơn tuần đã lưu')
  const committedMenu = committedView.phase === 'ready' ? committedView.data.data : committedQuery.currentData?.data
  const rows = useMemo(() => buildImportedLayoutRows(committedMenu?.rows ?? []), [committedMenu?.rows])
  const importedDates = useMemo(() => buildImportedDayDates(committedMenu?.rows ?? []), [committedMenu?.rows])
  const displayDays = DAYS_OF_WEEK.slice(0, 6).map((day, index) => {
    if (importedDates[day.key]) return { ...day, date: importedDates[day.key] }
    if (!weekStartDate) return { ...day, date: '' }
    const date = new Date(`${weekStartDate}T00:00:00`)
    date.setDate(date.getDate() + index)
    return { ...day, date: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` }
  })
  const todayIso = toLocalIsoDate(new Date())
  const activeDayKey = displayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso)?.key
  const selectedCustomer = customers.find((customer) => customer.customerId === customerId)
  const customerContractsQuery = useGetCustomerContractsQuery(undefined, { skip: isReconciliationMode })
  const customerContracts = customerContractsQuery.data?.data ?? customerContractsQuery.currentData?.data ?? []
  const selectedCustomerContract = customerContracts.find((contract) => contract.customerId === customerId)

  useEffect(() => {
    dispatch(setWeeklyMenu(committedMenu?.importedWeeklyMenu ?? {}))
  }, [committedMenu?.importedWeeklyMenu, dispatch])

  const catalogQuery = useGetDishesCatalogQuery()
  const catalogDishes = useMemo(() => catalogQuery.data ?? catalogQuery.currentData ?? [], [catalogQuery.currentData, catalogQuery.data])
  const schedulesQuery = useGetMenuSchedulesQuery({ customerId, ...(weekStartDate ? { weekStartDate } : {}) }, { skip: isReconciliationMode || !customerId || !weekStartDate })
  const menuSchedules = schedulesQuery.data?.data ?? schedulesQuery.currentData?.data ?? []
  const mealPlansQuery = useGetMealQuantityPlansQuery({ customerId, ...(weekStartDate ? { weekStartDate } : {}) }, { skip: isReconciliationMode || !customerId || !weekStartDate })
  const mealQuantityPlans = mealPlansQuery.data?.data ?? mealPlansQuery.currentData?.data ?? []
  const [publishSchedule, { isLoading: isPublishing }] = useUpdateMenuScheduleVersionMutation()

  const schedulePrices = [...new Set(menuSchedules.map((schedule) => schedule.menuPrice).filter((price) => Number.isFinite(price) && price > 0))]
  const invalidSchedulePrices = schedulePrices.filter((price) => !isBomPriceTier(price))
  const pricing = !customerId
    ? {}
    : isReconciliationMode
      ? {}
      : invalidSchedulePrices.length > 0
        ? { blockedReason: `Lịch menu có định mức không hợp lệ: ${invalidSchedulePrices.join(', ')}. Chỉ hỗ trợ 25k, 30k hoặc 34k.` }
        : schedulePrices.length > 1
          ? { blockedReason: 'Một khách hàng đang có nhiều định mức trong cùng tuần.' }
          : schedulePrices.length === 1
            ? { tier: normalizeBomPriceTier(schedulePrices[0]), source: 'Lịch menu' as const }
            : selectedCustomerContract?.defaultMenuPrice
              ? { tier: normalizeBomPriceTier(selectedCustomerContract.defaultMenuPrice), source: 'Hợp đồng' as const }
              : { tier: DEFAULT_BOM_PRICE_TIER, source: 'Mặc định' as const }
  const workflowTier = pricing.tier ?? DEFAULT_BOM_PRICE_TIER

  const scope = {
    customerId,
    customerLabel: selectedCustomer ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}` : 'Chưa chọn khách hàng',
    weekStartDate,
    weekLabel: weekStartDate,
    menuPrice: workflowTier,
    fixedBomRatePercent: 100,
    activeServiceLabel: weekStartDate ? `Tuần ${weekStartDate}` : 'Chưa chọn tuần',
    activeDayKey,
    displayDays,
  }
  const editorWorkflow = useWeeklyScheduleEditor({
    scope,
    committedRows: committedMenu?.rows ?? [],
    importedMenu: reduxWeeklyMenu,
    mealQuantityPlans,
    menuSchedules,
    orders,
    lockedShifts,
    catalogDishes,
    onMenuFeedback: () => undefined,
    onQuickServingFeedback: () => undefined,
  })
  const importWorkflow = useWeeklyMenuImport({
    customers,
    isCustomerLoading: customersView.phase === 'loading',
    isCustomerError: customersView.phase === 'error' || customersView.phase === 'forbidden',
    refetchCustomers: customersQuery.refetch,
    customerId,
    weekStartDate,
    committedWeekStartDate: committedMenu?.weekStartDate?.split('T')[0],
    menuPrice: workflowTier,
    displayDays,
    todayIso,
    catalogDishes,
    onCustomerCreated: (nextCustomerId) => updateScope({ customerId: nextCustomerId }),
    onMenuCommitted: (result) => {
      updateScope({ customerId: result.customerId, weekStartDate: result.weekStartDate ?? '' })
      void committedQuery.refetch()
    },
  })

  const queryState = !customerId || !weekStartDate
    ? 'idle'
    : committedView.phase === 'loading' ? 'loading'
      : committedView.phase === 'forbidden' ? 'forbidden'
        : committedView.phase === 'error' ? 'error' : 'ready'
  const model = buildSchedulePageModel({ customers, customerId, weekStartDate, queryState, committedMenu: committedMenu ?? null, rows, displayDays, activeDayKey, allowMutations: !isReconciliationMode && !pricing.blockedReason, pricing })
  const dishesById = new Map(catalogDishes.map((dish) => [dish.id, dish]))
  const dishesByName = new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish]))
  const weeklyPlanRows = buildWeeklyPlanRows({
    committedRows: committedMenu?.rows ?? [],
    displayDays,
    weeklyMenu: reduxWeeklyMenu,
    dishesById,
    dishesByName,
    getServiceDate: editorWorkflow.presentation.getServiceDate,
    getSlotServingInfo: editorWorkflow.presentation.getSlotServingInfo,
    getLinePricing: editorWorkflow.presentation.getLinePricing,
  })
  const quickServingRows = editorWorkflow.presentation.buildQuickServingRows(weeklyPlanRows)
  const materialSummary = buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName, { customerId, priceTier: workflowTier })
  const demandWorkflow = useMaterialDemand({
    enabled: activeView === 'demand' && !isReconciliationMode,
    stalenessEnabled: activeView === 'demand' && !isReconciliationMode,
    scope,
    reportDateFrom: committedMenu?.weekStartDate?.split('T')[0],
    reportDateTo: committedMenu?.weekEndDate?.split('T')[0],
    sourceMenuValue: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'Chưa chọn',
    customerCode: selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN',
    customerLabel: scope.customerLabel,
    materialSummaryCount: Object.keys(materialSummary).length,
    weeklyPlanRows,
    invalidScheduleMenuPrices: invalidSchedulePrices,
    quickServingRows,
    dishesById,
    dishesByName,
    aggregatePageSize: 12,
  })

  function updateScope(update: { customerId?: string; weekStartDate?: string }) {
    const next = new URLSearchParams(params)
    if (update.customerId !== undefined) {
      if (update.customerId) next.set('customerId', update.customerId)
      else next.delete('customerId')
    }
    if (update.weekStartDate !== undefined) {
      if (update.weekStartDate) next.set('weekStartDate', normalizeWeekStartDate(update.weekStartDate))
      else next.delete('weekStartDate')
    }
    setParams(next)
  }

  const openEditor = () => {
    setEditorContentReady(false)
    editorWorkflow.actions.openEditor()
    window.setTimeout(() => setEditorContentReady(true), 100)
  }

  const requestImportClose = () => {
    const dirty = Boolean(importWorkflow.state.selectedFile) || importWorkflow.state.jobs.length > 0 || Boolean(importWorkflow.state.quickCustomerCode.trim()) || Boolean(importWorkflow.state.quickCustomerName.trim())
    if (dirty) setConfirmClose('import')
    else importWorkflow.actions.close()
  }
  const requestEditorClose = () => {
    if (editorWorkflow.presentation.pendingChangeCount > 0) setConfirmClose('editor')
    else {
      setEditorContentReady(false)
      editorWorkflow.actions.closeEditor()
    }
  }
  const routedImportWorkflow = { ...importWorkflow, actions: { ...importWorkflow.actions, close: requestImportClose, onOpenChange: (open: boolean) => open ? importWorkflow.actions.open() : requestImportClose() } }
  const discardEditor = () => {
    setEditorContentReady(false)
    ;(editorWorkflow.actions.discardEditor ?? editorWorkflow.actions.closeEditor)()
  }
  const routedEditorWorkflow = { ...editorWorkflow, actions: { ...editorWorkflow.actions, closeEditor: requestEditorClose, discardEditor } }
  const publishable = menuSchedules.find((schedule) => schedule.menuVersionStatus !== 'ACTIVE')

  return (
    <PlanningPreviewShell activeView={activeView}>
      {activeView === 'demand'
        ? <MaterialDemandWorkspacePage workflow={demandWorkflow} scheduleWorkflow={editorWorkflow} />
        : <SchedulePage
          model={model}
          isImporting={importWorkflow.status.isImporting}
          isPublishing={isPublishing}
          onCustomerChange={(nextCustomerId) => updateScope({ customerId: nextCustomerId })}
          onWeekChange={(nextWeek) => updateScope({ weekStartDate: nextWeek })}
          onImport={importWorkflow.actions.open}
          onEdit={openEditor}
          onPublish={() => { if (publishable) void publishSchedule({ menuScheduleId: publishable.menuScheduleId, body: { status: 'ACTIVE', reason: 'Xuất bản từ Planning preview' } }) }}
          onRetry={() => void committedQuery.refetch()}
        />}
      {activeView === 'schedule' && importWorkflow.state.isOpen && <WeeklyMenuImportDialog workflow={routedImportWorkflow} />}
      {activeView === 'schedule' && editorWorkflow.state.isEditorOpen && <WeeklyScheduleEditorDialog workflow={routedEditorWorkflow} servingRows={[]} layoutRows={rows} isLoading={!editorContentReady || catalogQuery.isLoading || schedulesQuery.isLoading || mealPlansQuery.isLoading} />}
      <ConfirmDialog open={confirmClose !== null} title="Rời khỏi thay đổi chưa lưu?" description="Các thay đổi cục bộ trong preview sẽ bị bỏ." confirmLabel="Rời khỏi" variant="destructive" onOpenChange={(open) => { if (!open) setConfirmClose(null) }} onConfirm={() => { if (confirmClose === 'import') importWorkflow.actions.close(); if (confirmClose === 'editor') discardEditor(); setConfirmClose(null) }} />
    </PlanningPreviewShell>
  )
}
