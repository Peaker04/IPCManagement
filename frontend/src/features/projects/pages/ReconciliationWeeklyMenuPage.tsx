import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, OperationalFrame, QueryViewBoundary, ViewSwitcher } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import { useGetCoordinationCustomersQuery, useGetReconciliationWeeklyMenuQuery } from '@/api/coordinationApi'
import { ClosedLoopTransferPanel } from '@/components/reconciliation/ClosedLoopTransferPanel'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { DAYS_OF_WEEK } from '@/lib/constants'
import { LAST_WEEKLY_MENU_CUSTOMER_KEY, LAST_WEEKLY_MENU_WEEK_KEY, formatImportDate, getStoredWeekStartDate, normalizeWeekStartDate } from '../weekly-menu/model/formatters'
import { buildImportedDayDates, buildImportedLayoutRows } from '../weekly-menu/model/scope'
import { getReconciliationScheduleEmptyState } from '../weekly-menu/model/reconciliationEmptyState'

const WeeklyScheduleSection = lazy(() => import('../weekly-menu/schedule/WeeklyScheduleSection').then(({ WeeklyScheduleSection: component }) => ({ default: component })))
const EMPTY_CUSTOMER_VALUE = '__empty-customer__'

type ReconciliationView = 'schedule' | 'demand'

const isReconciliationView = (value: string | null): value is ReconciliationView => value === 'schedule' || value === 'demand'

export function ReconciliationWeeklyMenuPage() {
  const customerSelectRef = useRef<HTMLButtonElement>(null)
  const weekInputRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const activeView: ReconciliationView = isReconciliationView(requestedView) ? requestedView : 'schedule'
  const customerId = searchParams.get('customerId') ?? window.localStorage.getItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) ?? ''
  const weekStartDate = normalizeWeekStartDate(searchParams.get('weekStartDate') ?? getStoredWeekStartDate())

  useEffect(() => {
    if (isReconciliationView(requestedView) && searchParams.has('customerId') && searchParams.has('weekStartDate')) return
    const normalized = new URLSearchParams(searchParams)
    normalized.set('view', activeView)
    if (customerId) normalized.set('customerId', customerId)
    if (weekStartDate) normalized.set('weekStartDate', weekStartDate)
    setSearchParams(normalized, { replace: true })
  }, [activeView, customerId, requestedView, searchParams, setSearchParams, weekStartDate])

  const updateScope = (updates: { view?: ReconciliationView; customerId?: string; weekStartDate?: string }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.view !== undefined) next.set('view', updates.view)
    if (updates.customerId !== undefined) {
      if (updates.customerId) next.set('customerId', updates.customerId)
      else next.delete('customerId')
    }
    if (updates.weekStartDate !== undefined) {
      if (updates.weekStartDate) next.set('weekStartDate', updates.weekStartDate)
      else next.delete('weekStartDate')
    }
    setSearchParams(next)
  }
  const customersQuery = useGetCoordinationCustomersQuery()
  const catalogQuery = useGetDishesCatalogQuery()
  const menuQuery = useGetReconciliationWeeklyMenuQuery({ customerId, weekStartDate: weekStartDate || undefined }, { skip: !customerId })
  const customersView = toLabeledQueryView(customersQuery, 'danh sách khách hàng', { instruction: 'Mở kế hoạch tuần để tải danh sách khách hàng.' })
  const catalogView = toLabeledQueryView(catalogQuery, 'danh mục món và BOM', { instruction: 'Mở kế hoạch tuần để tải danh mục món và BOM.' })
  const menuView = toLabeledQueryView(menuQuery, 'kế hoạch tuần đối chiếu', { instruction: 'Chọn khách hàng để tải kế hoạch tuần.' })
  const customers = customersQuery.currentData?.data ?? customersQuery.data?.data ?? []
  const catalog = useMemo(() => catalogQuery.currentData ?? catalogQuery.data ?? [], [catalogQuery.currentData, catalogQuery.data])
  const menu = menuQuery.currentData?.data ?? menuQuery.data?.data
  const committedRows = useMemo(() => buildImportedLayoutRows(menu?.rows ?? []), [menu?.rows])
  const committedDates = useMemo(() => buildImportedDayDates(menu?.rows ?? []), [menu?.rows])
  const displayedWeekStart = menu?.weekStartDate?.split('T')[0] ?? weekStartDate
  const displayDays = useMemo(() => DAYS_OF_WEEK.slice(0, 6).map((day, index) => {
    if (committedDates[day.key]) return { ...day, date: committedDates[day.key] }
    if (!displayedWeekStart) return { ...day, date: '' }
    const date = new Date(`${displayedWeekStart}T00:00:00`)
    date.setDate(date.getDate() + index)
    return { ...day, date: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` }
  }), [committedDates, displayedWeekStart])
  const customer = customers.find((item) => item.customerId === customerId)
  const scope = {
    customerId,
    customerLabel: customer ? `${customer.customerCode} - ${customer.customerName}` : menu?.customerCode ?? 'Chưa chọn',
    weekStartDate: displayedWeekStart,
    weekLabel: menu?.weekStartDate ? `${formatImportDate(menu.weekStartDate)} - ${formatImportDate(menu.weekEndDate)}` : 'Chưa có kế hoạch',
    menuPrice: 25000 as const,
    fixedBomRatePercent: 100,
    activeServiceLabel: 'Tuần đã chọn',
    displayDays,
  }
  const dishNamesById = useMemo(() => new Map(catalog.map((dish) => [dish.id, dish.name])), [catalog])
  const scheduleEmptyState = getReconciliationScheduleEmptyState({
    customerId,
    weekStartDate,
    isMenuReady: menuView.phase === 'ready',
    rowCount: committedRows.length,
  })
  const focusScheduleScope = () => {
    const target = scheduleEmptyState?.action === 'week' ? weekInputRef.current : customerSelectRef.current
    target?.focus()
  }

  return <OperationalFrame command={<div className="ipc-command-bar flex flex-wrap gap-3">
    <label className="grid gap-1 text-sm font-medium">Khách hàng<Select value={customerId || EMPTY_CUSTOMER_VALUE} onValueChange={(selected) => { const value = selected === EMPTY_CUSTOMER_VALUE || selected === null ? '' : selected; updateScope({ customerId: value }); if (value) window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, value); else window.localStorage.removeItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) }}><SelectTrigger ref={customerSelectRef} aria-label="Chọn khách hàng" className="min-w-64"><SelectValue>{customer ? `${customer.customerCode} - ${customer.customerName}` : 'Chọn khách hàng'}</SelectValue></SelectTrigger><SelectContent><SelectItem value={EMPTY_CUSTOMER_VALUE}>Chọn khách hàng</SelectItem>{customers.map((item) => <SelectItem key={item.customerId} value={item.customerId}>{item.customerCode} - {item.customerName}</SelectItem>)}</SelectContent></Select></label>
    <label className="grid gap-1 text-sm font-medium">Tuần bắt đầu<Input ref={weekInputRef} aria-label="Tuần bắt đầu" type="date" weekStartOnly value={weekStartDate} onChange={(event) => { const value = normalizeWeekStartDate(event.target.value); updateScope({ weekStartDate: value }); if (value) window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, value); else window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY) }} /></label>
  </div>}>
    <QueryViewBoundary preserveFallback noticePlacement="overlay" queries={[{ label: 'danh sách khách hàng', view: customersView }, { label: 'danh mục món và BOM', view: catalogView }, { label: 'kế hoạch tuần đối chiếu', view: menuView }]} refreshLabel="Đang cập nhật kế hoạch tuần">
      <ViewSwitcher ariaLabel="Chọn góc nhìn kế hoạch tuần" tabs={[{ id: 'schedule', label: 'Kế hoạch tuần' }, { id: 'demand', label: 'Định lượng xuất kho' }]} activeTab={activeView} onTabChange={(id) => updateScope({ view: id as ReconciliationView })} />
      <div className="relative min-h-0">
        {activeView === 'schedule' ? <div id="schedule-panel" role="tabpanel" aria-labelledby="schedule-tab">
          {scheduleEmptyState ? <EmptyState
            variant="uncreated"
            title={scheduleEmptyState.title}
            description={scheduleEmptyState.description}
            action={<Button type="button" onClick={focusScheduleScope}>{scheduleEmptyState.actionLabel}</Button>}
            className="min-h-[480px]"
          /> : <Suspense fallback={<div aria-busy="true" className="min-h-[320px] rounded-md bg-slate-50" />}><WeeklyScheduleSection scope={scope} customerValue={scope.customerLabel} weekValue={scope.weekLabel} hasCommittedWeek={Boolean(menu?.weekStartDate)} rows={committedRows} dishNamesById={dishNamesById} maxBodyHeight="ipc-weekly-menu-shell--viewport-fill" /></Suspense>}
        </div> : <div id="demand-panel" role="tabpanel" aria-labelledby="demand-tab"><ClosedLoopTransferPanel menuVersionId={menu?.menuVersionId} scopeLabel={customer && displayedWeekStart ? `${customer.customerCode} · tuần ${formatImportDate(displayedWeekStart)}` : 'Chọn khách hàng và tuần'} /></div>}
      </div>
    </QueryViewBoundary>
  </OperationalFrame>
}
