import { fireEvent, render, screen } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ReadPlanningPreviewPage from './ReadPlanningPreviewPage'

const fixture = vi.hoisted(() => ({ schedules: [] as { menuPrice: number; serviceDate: string; shiftName: string }[], contracts: [] as { customerId: string; defaultMenuPrice: number }[], mode: 'DEFAULT', menu: {} as Record<string, unknown>, catalog: {} as Record<string, unknown>, production: vi.fn(), report: vi.fn(), catalogCall: vi.fn() }))
const ready = (data: unknown) => ({ currentData: data, isSuccess: true, refetch: vi.fn() })
vi.mock('@/lib/systemOperationContext', () => ({ useSystemOperation: () => ({ mode: fixture.mode, capabilities: { navigation: ['weekly-menu'], pageTabs: { 'weekly-menu': ['dish-materials', 'cost', 'production-plan', 'purchase-summary'] } } }) }))
vi.mock('@/api/coordinationApi', () => ({
  useGetCoordinationCustomersQuery: () => ({ currentData: { data: [{ customerId: 'customer', customerCode: 'KH', customerName: 'Alpha' }] }, isSuccess: true, refetch: vi.fn() }),
  useGetCommittedWeeklyMenuQuery: () => fixture.menu,
  useGetCustomerContractsQuery: () => ready({ data: fixture.contracts }),
  useGetMenuSchedulesQuery: () => ready({ data: fixture.schedules }),
  useGetMealQuantityPlansQuery: () => ({ currentData: { data: [] }, isSuccess: true, refetch: vi.fn() }),
  useGetProductionPlansQuery: (...args: unknown[]) => { fixture.production(...args); return { currentData: { data: [] }, isSuccess: true, refetch: vi.fn() } },
}))
vi.mock('@/api/dishCatalogApi', () => ({ useGetDishesCatalogQuery: () => { fixture.catalogCall(); return fixture.catalog } }))
vi.mock('@/api/reportsApi', () => ({ useGetIngredientDemandAggregatePageQuery: (...args: unknown[]) => { fixture.report(...args); return { currentData: { items: [], totalCount: 0, totalPages: 0, pageNumber: 1, remainingToIssueCount: 0, pendingKitchenReceiptCount: 0 }, isSuccess: true, refetch: vi.fn() } } }))
beforeEach(() => {
  vi.clearAllMocks(); fixture.mode = 'DEFAULT'; fixture.schedules = []; fixture.contracts = []
  fixture.menu = ready({ data: { rows: [], importedWeeklyMenu: {}, weekStartDate: '2026-09-21' } })
  fixture.catalog = ready([])
})
function show(view: Parameters<typeof ReadPlanningPreviewPage>[0]['view'], search = '?customerId=customer&weekStartDate=2026-09-21') {
  const store = configureStore({ reducer: { auth: () => ({ user: { role: 'admin', permissions: ['coordination.read'] } }), coordination: () => ({ orders: [], lockedShifts: {} }) } })
  return render(<Provider store={store}><MemoryRouter initialEntries={[`/__kit/planning/${view}${search}`]}><ReadPlanningPreviewPage view={view}/></MemoryRouter></Provider>)
}
it('mounts only active analytical queries and retains customer/week in sibling links', () => {
  show('dish-materials')
  expect(screen.getByText('Danh mục chưa có món')).toBeVisible()
  expect(fixture.catalogCall).toHaveBeenCalled()
  expect(fixture.production).not.toHaveBeenCalled(); expect(fixture.report).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Giá vốn tuần' })).toHaveAttribute('href', '/__kit/planning/cost?customerId=customer&weekStartDate=2026-09-21')
  fireEvent.change(screen.getByLabelText('Khách hàng'), { target: { value: '' } })
  expect(screen.getByText('Chọn phạm vi để xem')).toBeVisible()
  expect(screen.queryByText('Danh mục chưa có món')).not.toBeInTheDocument()
})
it('does not mount any active source when DEFAULT capability is unavailable', () => {
  fixture.mode = 'MATERIAL_RECONCILIATION'; show('cost')
  expect(screen.getByText('Workspace không khả dụng')).toBeVisible()
  expect(fixture.catalogCall).not.toHaveBeenCalled(); expect(fixture.production).not.toHaveBeenCalled(); expect(fixture.report).not.toHaveBeenCalled()
})
it('fails closed on source denial and never mounts downstream BOM or report', () => {
  fixture.menu = { currentData: { data: { rows: [] } }, isError: true, error: { status: 403 }, refetch: vi.fn() }
  show('purchase-summary')
  expect(screen.getByRole('alert')).toHaveTextContent('Bạn không có quyền')
  expect(fixture.catalogCall).not.toHaveBeenCalled(); expect(fixture.report).not.toHaveBeenCalled()
})
it('production uses its read owner without analytical or demand report queries', () => {
  show('production-plan')
  expect(screen.getByText('Chưa có kế hoạch sản xuất trong tuần đã chọn')).toBeVisible()
  expect(fixture.production).toHaveBeenCalled(); expect(fixture.catalogCall).not.toHaveBeenCalled(); expect(fixture.report).not.toHaveBeenCalled()
})
it('successful empty physical report remains physical empty, not BOM fallback', () => {
  show('purchase-summary')
  expect(screen.getByText('Chưa có dòng bàn giao vật lý trong tuần')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Xuất BOM dự kiến' })).toBeDisabled()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
it.each([[0], [-25000], [25000, 0], [25000, -1], [NaN], [Infinity]].map(prices => ({ prices })))('blocks every invalid present schedule price $prices without denying physical reads', ({ prices }) => {
  fixture.schedules = prices.map(menuPrice => ({ menuPrice, serviceDate: '2026-09-21', shiftName: 'MORNING' }))
  const cost = show('cost')
  expect(screen.getByText('Không xác định được định mức tuần')).toBeVisible()
  expect(screen.queryByLabelText('Ngày tính giá vốn')).not.toBeInTheDocument()
  cost.unmount()
  show('purchase-summary')
  expect(screen.getByText('Chưa có dòng bàn giao vật lý trong tuần')).toBeVisible()
  expect(fixture.report).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Xuất BOM dự kiến' })).toBeDisabled()
  fireEvent.click(screen.getByText('Vì sao chưa xuất được BOM dự kiến?'))
  expect(screen.getByText('Định mức tuần không hợp lệ hoặc không đồng nhất.')).toBeVisible()
})
it('uses contract fallback only for absent schedules and resolves fresh schedule pricing on week change', () => {
  fixture.contracts = [{ customerId: 'customer', defaultMenuPrice: 30000 }]
  show('cost')
  expect(screen.getByText('30.000 ₫')).toBeVisible()
  fixture.schedules = [{ menuPrice: 34000, serviceDate: '2026-09-28', shiftName: 'MORNING' }]
  fireEvent.change(screen.getByLabelText('Tuần bắt đầu'), { target: { value: '2026-09-28' } })
  expect(screen.getByText('34.000 ₫')).toBeVisible()
  expect(screen.queryByText('30.000 ₫')).not.toBeInTheDocument()
})
