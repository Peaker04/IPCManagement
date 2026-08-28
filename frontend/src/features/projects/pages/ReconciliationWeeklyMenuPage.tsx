import { Suspense, lazy, useMemo, useState } from 'react'
import { OperationalFrame, QueryViewBoundary, ViewSwitcher } from '@/components/common'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import { useGetCoordinationCustomersQuery, useGetReconciliationWeeklyMenuQuery } from '@/api/coordinationApi'
import { ClosedLoopTransferPanel } from '@/features/reconciliation/ClosedLoopTransferPanel'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { DAYS_OF_WEEK } from '@/lib/constants'
import { LAST_WEEKLY_MENU_CUSTOMER_KEY, LAST_WEEKLY_MENU_WEEK_KEY, formatImportDate, getStoredWeekStartDate, normalizeWeekStartDate } from '../weekly-menu/model/formatters'
import { buildImportedDayDates, buildImportedLayoutRows } from '../weekly-menu/model/scope'

const WeeklyScheduleSection = lazy(() => import('../weekly-menu/schedule/WeeklyScheduleSection').then(({ WeeklyScheduleSection: component }) => ({ default: component })))

type ReconciliationView = 'schedule' | 'demand'

export function ReconciliationWeeklyMenuPage() {
  const [activeView, setActiveView] = useState<ReconciliationView>('schedule')
  const [customerId, setCustomerId] = useState(() => window.localStorage.getItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) ?? '')
  const [weekStartDate, setWeekStartDate] = useState(getStoredWeekStartDate)
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

  return <OperationalFrame command={<div className="ipc-command-bar flex flex-wrap gap-3">
    <label className="grid gap-1 text-sm font-medium">Khách hàng<select className="ipc-input min-w-64" value={customerId} onChange={(event) => { const value = event.target.value; setCustomerId(value); if (value) window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, value); else window.localStorage.removeItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) }}><option value="">Chọn khách hàng</option>{customers.map((item) => <option key={item.customerId} value={item.customerId}>{item.customerCode} - {item.customerName}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Tuần bắt đầu<input className="ipc-input" type="date" value={weekStartDate} onChange={(event) => { const value = normalizeWeekStartDate(event.target.value); setWeekStartDate(value); if (value) window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, value); else window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY) }} /></label>
  </div>}>
    <QueryViewBoundary preserveFallback noticePlacement="overlay" queries={[{ label: 'danh sách khách hàng', view: customersView }, { label: 'danh mục món và BOM', view: catalogView }, { label: 'kế hoạch tuần đối chiếu', view: menuView }]} refreshLabel="Đang cập nhật kế hoạch tuần">
      <ViewSwitcher ariaLabel="Chọn góc nhìn kế hoạch tuần" tabs={[{ id: 'schedule', label: 'Kế hoạch tuần' }, { id: 'demand', label: 'Định lượng xuất kho' }]} activeTab={activeView} onTabChange={(id) => setActiveView(id as ReconciliationView)} />
      <div className="relative min-h-[480px]">
        {activeView === 'schedule' ? <div id="schedule-panel" role="tabpanel" aria-labelledby="schedule-tab"><Suspense fallback={<div aria-busy="true" className="min-h-[480px] rounded-md bg-slate-50" />}><WeeklyScheduleSection scope={scope} customerValue={scope.customerLabel} weekValue={scope.weekLabel} hasCommittedWeek={Boolean(menu?.weekStartDate)} rows={committedRows} dishNamesById={dishNamesById} /></Suspense></div> : <div id="demand-panel" role="tabpanel" aria-labelledby="demand-tab"><ClosedLoopTransferPanel menuVersionId={menu?.menuVersionId} scopeLabel={customer && displayedWeekStart ? `${customer.customerCode} · tuần ${formatImportDate(displayedWeekStart)}` : 'Chọn khách hàng và tuần'} /></div>}
      </div>
    </QueryViewBoundary>
  </OperationalFrame>
}
