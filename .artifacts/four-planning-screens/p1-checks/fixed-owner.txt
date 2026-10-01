import { useSearchParams } from 'react-router-dom'
import { useGetCoordinationCustomersQuery, useGetCommittedWeeklyMenuQuery, useGetCustomerContractsQuery, useGetMenuSchedulesQuery, useGetMealQuantityPlansQuery } from '@/api/coordinationApi'
import { useGetDishesCatalogQuery } from '@/api/dishCatalogApi'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary'
import { InlineAlert } from '@/components/common'
import { DAYS_OF_WEEK } from '@/lib/constants'
import { normalizeWeekStartDate, normalizeDishMatchKey, parseDisplayDateToIso, toLocalIsoDate } from '@/features/projects/weekly-menu/model/formatters'
import { buildImportedDayDates, buildPlanRowsMaterialSummary } from '@/features/projects/weekly-menu/model/scope'
import { DEFAULT_BOM_PRICE_TIER, isBomPriceTier, normalizeBomPriceTier } from '@/features/projects/weeklyMenuPlanning'
import { buildWeeklyPlanRows } from '@/features/projects/weekly-menu/cost/weeklyPlanRowsModel'
import { buildQuantityPlanByDateShift, getScheduleServiceDate, getShiftServingInfo, resolveSlotServingInfo } from '@/features/projects/weekly-menu/schedule/scheduleModel'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import { useCoordinationStoreSelector } from '@/lib/coordinationStore'
import type { WeeklyMenuState } from '@/types/coordination'
import type { QuerySnapshot } from '@/lib/queryView'
import { PlanningPreviewShell } from '../PlanningPreviewShell'
import { DishMaterialsScreen } from '../dish-materials/DishMaterialsScreen'
import { CostScreen } from './CostScreen'
import { ProductionPlanScreen } from '../production-plan/ProductionPlanScreen'
import { HandoffScreen } from '../handoff/HandoffScreen'
import './readPlanning.css'

type View = 'dish-materials' | 'cost' | 'production-plan' | 'purchase-summary'
const labels = { 'dish-materials': 'Định mức theo món', cost: 'Giá vốn tuần', 'production-plan': 'Kế hoạch sản xuất', 'purchase-summary': 'Bàn giao tuần' }
// RTK .data may belong to the prior argument. These read candidates never display it.
function currentView<T>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) {
  return toLabeledQueryView({ ...query, data: query.currentData, isSuccess: query.isSuccess && query.currentData !== undefined }, label)
}
export default function ReadPlanningPreviewPage({ view }: { view: View }) {
  const operation = useSystemOperation()
  const allowed = operation?.mode === 'DEFAULT' && operation.capabilities.pageTabs['weekly-menu']?.includes(view)
  return <PlanningPreviewShell activeView={view}>{allowed ? <ReadScope key={view} view={view} /> : <main className="planning-read"><h1>{labels[view]}</h1><InlineAlert title="Workspace không khả dụng" variant="warning">Chỉ khả dụng trong DEFAULT khi capability cho phép. Không tải dữ liệu nghiệp vụ.</InlineAlert></main>}</PlanningPreviewShell>
}
function ReadScope({ view }: { view: View }) {
  const [params, setParams] = useSearchParams()
  const customerId = params.get('customerId') ?? ''
  const week = normalizeWeekStartDate(params.get('weekStartDate') ?? '')
  const customersQuery = useGetCoordinationCustomersQuery()
  const customersView = currentView(customersQuery, 'danh sách khách hàng')
  const customers = customersView.phase === 'ready' ? customersView.data.data ?? [] : []
  const customer = customers.find(item => item.customerId === customerId)
  const menuQuery = useGetCommittedWeeklyMenuQuery({ customerId, weekStartDate: week || undefined }, { skip: !customerId || !week })
  const menuView = currentView(menuQuery, 'thực đơn tuần đã lưu')
  const menu = menuView.phase === 'ready' ? menuView.data.data : undefined
  const importedDates = buildImportedDayDates(menu?.rows ?? [])
  const displayDays = DAYS_OF_WEEK.slice(0, 6).map((day, index) => {
    const date = week ? new Date(`${week}T00:00:00`) : null
    date?.setDate(date.getDate() + index)
    return { ...day, date: importedDates[day.key] ?? (date ? `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}` : '') }
  })
  const scope: WeeklyMenuScope = { customerId, customerLabel: customer ? `${customer.customerCode} - ${customer.customerName}` : 'Chưa chọn khách hàng', weekStartDate: week, weekLabel: week, menuPrice: DEFAULT_BOM_PRICE_TIER, fixedBomRatePercent: 100, activeServiceLabel: `Tuần ${week}`, activeDayKey: displayDays.find(day => parseDisplayDateToIso(day.date) === toLocalIsoDate(new Date()))?.key, displayDays }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, key === 'weekStartDate' ? normalizeWeekStartDate(value) : value)
    else next.delete(key)
    setParams(next)
  }
  const queries: QueryViewEntry[] = [{ label: 'danh sách khách hàng', view: customersView }]
  const valid = Boolean(customerId && week)
  return <main className="planning-read"><header><p className="text-xs text-slate-500">Kế hoạch &amp; Điều phối · Sandbox chỉ đọc</p><h1>{labels[view]}</h1></header>
    <section aria-label="Phạm vi tuần" className="planning-read-scope">
      <label>Khách hàng<select aria-label="Khách hàng" value={customerId} onChange={event => change('customerId', event.target.value)}><option value="">Chọn khách hàng</option>{customers.map(item => <option key={item.customerId} value={item.customerId}>{item.customerCode} — {item.customerName}</option>)}</select></label>
      <label>Tuần bắt đầu<input aria-label="Tuần bắt đầu" type="date" value={week} onChange={event => change('weekStartDate', event.target.value)} /></label>
    </section>
    <QueryViewBoundary queries={queries}>{!valid ? <InlineAlert title="Chọn phạm vi để xem" variant="info">Chọn khách hàng và tuần. Chưa tải nguồn thực đơn, BOM hoặc báo cáo.</InlineAlert> : <QueryViewBoundary queries={[{ label: 'thực đơn tuần đã lưu', view: menuView }]}>{menuView.phase === 'ready' && customersView.phase === 'ready' ? (view === 'production-plan' ? <ProductionPlanScreen key={`${customerId}:${week}`} scope={scope} enabled={Boolean(menu?.weekStartDate)} /> : <AnalyticalSource key={`${view}:${customerId}:${week}`} view={view} scope={scope} menu={menu} customerCode={customer?.customerCode ?? menu?.customerCode ?? ''} />) : null}</QueryViewBoundary>}</QueryViewBoundary>
  </main>
}
type AnalyticalProps = { view: Exclude<View, 'production-plan'>; scope: WeeklyMenuScope; menu: NonNullable<ReturnType<typeof useGetCommittedWeeklyMenuQuery>['currentData']>['data']; customerCode: string }
function AnalyticalSource({ view, scope, menu, customerCode }: AnalyticalProps) {
  const orders = useCoordinationStoreSelector(state => state.coordination.orders)
  const lockedShifts = useCoordinationStoreSelector(state => state.coordination.lockedShifts)
  const catalogQuery = useGetDishesCatalogQuery()
  const contractsQuery = useGetCustomerContractsQuery()
  const schedulesQuery = useGetMenuSchedulesQuery({ customerId: scope.customerId, weekStartDate: scope.weekStartDate })
  const servingsQuery = useGetMealQuantityPlansQuery({ customerId: scope.customerId, weekStartDate: scope.weekStartDate })
  const catalogView = currentView(catalogQuery, 'BOM món')
  const contractsView = currentView(contractsQuery, 'hợp đồng định mức')
  const schedulesView = currentView(schedulesQuery, 'lịch thực đơn')
  const servingsView = currentView(servingsQuery, 'số suất')
  const catalog = catalogView.phase === 'ready' ? catalogView.data : []
  const schedules = schedulesView.phase === 'ready' ? schedulesView.data.data ?? [] : []
  const contracts = contractsView.phase === 'ready' ? contractsView.data.data ?? [] : []
  const plans = servingsView.phase === 'ready' ? servingsView.data.data ?? [] : []
  // menuPrice is required/non-null in MenuScheduleDto; only no schedules permits fallback.
  const prices = [...new Set(schedules.map(item => item.menuPrice))]
  const invalidTier = prices.some(price => !Number.isFinite(price) || !isBomPriceTier(price)) || prices.length > 1
  const tier = normalizeBomPriceTier(prices[0] ?? contracts.find(item => item.customerId === scope.customerId)?.defaultMenuPrice ?? DEFAULT_BOM_PRICE_TIER)
  const effectiveScope = { ...scope, menuPrice: tier }
  const rows = menu?.rows ?? []
  const importedMenu = (menu?.importedWeeklyMenu ?? {}) as WeeklyMenuState
  const dishesById = new Map(catalog.map(dish => [dish.id, dish]))
  const dishesByName = new Map(catalog.map(dish => [normalizeDishMatchKey(dish.name), dish]))
  const quantities = buildQuantityPlanByDateShift(plans, scope.customerId)
  const getSlotServingInfo: Parameters<typeof buildWeeklyPlanRows>[0]['getSlotServingInfo'] = (dayKey, slotType) => resolveSlotServingInfo(getShiftServingInfo({ dayKey, shiftName: slotType.startsWith('morning') ? 'MORNING' : 'AFTERNOON', serviceDate: getScheduleServiceDate(rows, dayKey), quantityPlans: quantities, orders: orders.filter(order => order.customerId === scope.customerId), lockedShifts }), importedMenu[dayKey]?.[slotType]?.portions ?? 0, slotType.endsWith('Vegetarian'))
  const weeklyMenu: WeeklyMenuState = Object.fromEntries(Object.entries(importedMenu).map(([dayKey, slots]) => [dayKey, {
    morningSavory: { ...slots.morningSavory, portions: getSlotServingInfo(dayKey, 'morningSavory').portions },
    morningVegetarian: { ...slots.morningVegetarian, portions: getSlotServingInfo(dayKey, 'morningVegetarian').portions },
    afternoonSavory: { ...slots.afternoonSavory, portions: getSlotServingInfo(dayKey, 'afternoonSavory').portions },
    afternoonVegetarian: { ...slots.afternoonVegetarian, portions: getSlotServingInfo(dayKey, 'afternoonVegetarian').portions },
  }]))
  const weeklyPlanRows = buildWeeklyPlanRows({ committedRows: rows, displayDays: scope.displayDays, weeklyMenu, dishesById, dishesByName, getServiceDate: dayKey => getScheduleServiceDate(rows, dayKey), getSlotServingInfo, getLinePricing: (date, shift) => ({ menuPrice: normalizeBomPriceTier(schedules.find(item => item.serviceDate.split('T')[0] === date && item.shiftName === shift)?.menuPrice ?? tier), bomRatePercent: 100, quantityFactor: 1 }) })
  const sourceLabel = 'Thực đơn tuần đã lưu · BOM hiệu lực · đơn giá tham chiếu'
  const queries = [{ label: 'BOM món', view: catalogView }, { label: 'hợp đồng định mức', view: contractsView }, { label: 'lịch thực đơn', view: schedulesView }, { label: 'số suất', view: servingsView }]
  const ready = queries.every(query => query.view.phase === 'ready') && !invalidTier
  const materialSummary = ready ? buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName, { customerId: scope.customerId, priceTier: tier }) : {}
  if (view === 'purchase-summary') return <HandoffScreen scope={effectiveScope} customerCode={customerCode} materialSummary={materialSummary} bomQueries={queries} bomBlocked={invalidTier} />
  return <QueryViewBoundary queries={queries}>{invalidTier ? <InlineAlert title="Không xác định được định mức tuần" variant="warning">Lịch có nhiều bậc giá hoặc giá ngoài 25k, 30k, 34k. Không tính BOM/giá vốn.</InlineAlert> : view === 'dish-materials' ? <DishMaterialsScreen scope={effectiveScope} sourceLabel={sourceLabel} catalogDishes={catalog} weeklyPlanRows={weeklyPlanRows} dishesById={dishesById} /> : <CostScreen scope={effectiveScope} sourceLabel={sourceLabel} weeklyPlanRows={weeklyPlanRows} dishesById={dishesById} dishesByName={dishesByName} />}</QueryViewBoundary>
}
