'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OrderRow, OrderUpdatePayload } from '../types'
import { useAppDispatch } from '@/app/hooks'
import { setOrderActualQuantity, updateOrder } from '../coordinationSlice'
import { useAdjustCoordinationOrderMutation, useUpdateForecastServingsMutation } from '@/api/coordinationApi'
import { EmptyState, InlineAlert, PaginationBar, TableViewport } from '@/components/common'
import { useLocalPagination } from '@/lib/useLocalPagination'
import { ClipboardList, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type DishDetailDialogComponent = typeof import('./dish-detail-dialog')['DishDetailDialog']

let cachedDishDetailDialog: DishDetailDialogComponent | null = null
let pendingDishDetailDialog: Promise<DishDetailDialogComponent> | null = null

const loadDishDetailDialog = () => {
  if (cachedDishDetailDialog) return Promise.resolve(cachedDishDetailDialog)
  if (!pendingDishDetailDialog) {
    pendingDishDetailDialog = import('./dish-detail-dialog')
      .then((module) => {
        cachedDishDetailDialog = module.DishDetailDialog
        return module.DishDetailDialog
      })
      .catch((error: unknown) => {
        pendingDishDetailDialog = null
        throw error
      })
  }
  return pendingDishDetailDialog
}

const preloadDishDetailDialog = () => {
  void loadDishDetailDialog().catch(() => undefined)
}

function DishDetailLoadingOverlay({ customerName, onClose }: { customerName: string; onClose: () => void }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1000] bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết thực đơn"
          className="flex w-full max-w-sm items-center gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xl"
        >
          <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" aria-hidden="true" />
          <div role="status" aria-live="polite">
            <p className="text-sm font-semibold text-slate-800">Đang mở chi tiết thực đơn</p>
            <p className="mt-0.5 text-xs text-slate-500">{customerName}</p>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

interface OrderTableProps {
  orders: OrderRow[]
  canEditForecast: boolean
  canRequestAdjustment: boolean
  useFinalServings: boolean
}

export function OrderTable({ orders, canEditForecast, canRequestAdjustment, useFinalServings }: OrderTableProps) {
  const dispatch = useAppDispatch()
  const [adjustCoordinationOrder] = useAdjustCoordinationOrderMutation()
  const [updateForecastServings] = useUpdateForecastServingsMutation()
  const [pendingOrderIds, setPendingOrderIds] = useState<Record<string, boolean>>({})
  const [pendingForecastOrderIds, setPendingForecastOrderIds] = useState<Record<string, boolean>>({})
  const [forecastRollbackValues, setForecastRollbackValues] = useState<Record<string, number>>({})
  const [optimisticError, setOptimisticError] = useState<string | null>(null)
  const [dishDialogLoadError, setDishDialogLoadError] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [LoadedDishDetailDialog, setLoadedDishDetailDialog] = useState<DishDetailDialogComponent | null>(
    () => cachedDishDetailDialog,
  )
  const pageSize = 12
  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi-VN')
    if (!needle) return orders
    return orders.filter((order) => [
      order.customerCode,
      order.customerName,
      order.menuCode,
      order.menuName,
      order.mealType,
      ...(order.dishes ?? []).map((dish) => dish.dishName),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(needle))
  }, [orders, search])
  const { page, rows: pageOrders, totalItems, setPage } = useLocalPagination(filteredOrders, pageSize)
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) : undefined

  const openDishDetailDialog = (order: OrderRow) => {
    setDishDialogLoadError(null)
    setSelectedOrderId(order.id)

    if (cachedDishDetailDialog) {
      setLoadedDishDetailDialog(() => cachedDishDetailDialog)
      return
    }

    void loadDishDetailDialog()
      .then((component) => setLoadedDishDetailDialog(() => component))
      .catch(() => {
        setSelectedOrderId(null)
        setDishDialogLoadError('Không tải được cửa sổ chi tiết thực đơn. Vui lòng thử lại.')
      })
  }

  const handleOrderChange = (payload: OrderUpdatePayload) => {
    dispatch(updateOrder(payload))
  }

  const parseServingInput = (value: string) => Math.max(0, parseInt(value, 10) || 0)

  const rememberForecastValue = (order: OrderRow) => {
    setForecastRollbackValues((current) => ({
      ...current,
      [order.id]: current[order.id] ?? order.forecastQuantity,
    }))
  }

  const handleForecastQuantitySave = async (order: OrderRow, value: number) => {
    if (!canEditForecast || pendingForecastOrderIds[order.id]) return

    const previousValue = forecastRollbackValues[order.id] ?? order.forecastQuantity
    if (value === previousValue) {
      setForecastRollbackValues((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
      return
    }

    setPendingForecastOrderIds((current) => ({ ...current, [order.id]: true }))
    setOptimisticError(null)

    try {
      const response = await updateForecastServings({
        orderId: order.quantityPlanLineId ?? order.id,
        servingsQuantity: value,
        reason: 'Điều phối cập nhật số suất dự kiến trước chốt.',
      }).unwrap()

      if (!response.success) {
        throw new Error(response.message || 'Không cập nhật được số suất dự kiến.')
      }

      setForecastRollbackValues((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
    } catch (error) {
      dispatch(updateOrder({ id: order.id, field: 'forecastQuantity', value: previousValue }))
      setOptimisticError(error instanceof Error ? error.message : 'Không cập nhật được số suất dự kiến, đã hoàn tác giá trị cũ.')
    } finally {
      setPendingForecastOrderIds((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
    }
  }

  const handleActualQuantityChange = async (order: OrderRow, value: number) => {
    const previousValue = order.actualQuantity
    dispatch(setOrderActualQuantity({ id: order.id, value }))
    setPendingOrderIds((current) => ({ ...current, [order.id]: true }))
    setOptimisticError(null)

    try {
      const response = await adjustCoordinationOrder({
        orderId: order.quantityPlanLineId ?? order.id,
        field: 'actualQuantity',
        newValue: value,
        reason: 'Điều phối cập nhật số suất thực tế sau chốt.',
      }).unwrap()

      if (!response.success) {
        throw new Error(response.message || 'Không cập nhật được số suất.')
      }
    } catch (error) {
      dispatch(setOrderActualQuantity({ id: order.id, value: previousValue }))
      setOptimisticError(error instanceof Error ? error.message : 'Không cập nhật được số suất, đã hoàn tác giá trị cũ.')
    } finally {
      setPendingOrderIds((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
    }
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-10" />}
        title="Chưa có dữ liệu để hiển thị"
        description="Điều chỉnh ngày, ca hoặc điều phối đơn để xem dữ liệu phù hợp."
        className="ipc-coordination-empty-state min-h-0 border-b border-slate-200 py-10"
      />
    )
  }

  return (
    <div className="ipc-order-table-wrap">
      {optimisticError && (
        <div className="border-b border-slate-200">
          <InlineAlert title="Không lưu được số suất" variant="danger">
            {optimisticError}
          </InlineAlert>
        </div>
      )}
      {dishDialogLoadError && (
        <div className="border-b border-slate-200">
          <InlineAlert title="Không mở được chi tiết" variant="danger">
            {dishDialogLoadError}
          </InlineAlert>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2">
        <label className="grid min-w-[240px] flex-1 gap-1 text-xs font-semibold text-slate-600" htmlFor="coordination-order-search">
          Tìm khách hàng, thực đơn hoặc món ăn
          <Input
            id="coordination-order-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Nhập mã khách hàng hoặc tên món"
            className="h-9 max-w-md bg-white"
          />
        </label>
        {search.trim() && <span className="pb-2 text-xs text-slate-500">{totalItems} kết quả</span>}
      </div>
      <TableViewport className="ipc-coordination-table-shell" ariaLabel="Bảng điều phối đơn theo khách hàng" caption="Danh sách đơn theo khách hàng">
        <table className="ipc-data-table ipc-order-table">
          <thead>
            <tr>
              <th className="w-[120px] whitespace-nowrap border-r border-slate-200 text-left">
                Khách Hàng
              </th>
              <th className="w-[210px] whitespace-nowrap border-r border-slate-200 text-left">
                Thực Đơn
              </th>
              <th className="w-[260px] whitespace-nowrap border-r border-slate-200 text-left">
                Món Ăn
              </th>
              <th className="w-[90px] whitespace-nowrap border-r border-slate-200 text-center">
                Dự Kiến
              </th>
              <th className="w-[90px] whitespace-nowrap border-r border-slate-200 text-center">
                Thực Tế
              </th>
              <th className="w-[100px] whitespace-nowrap text-center">
                Chênh Lệch
              </th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">Không tìm thấy đơn phù hợp.</td></tr>
            ) : pageOrders.map((order, idx) => {
              const finalQuantity = useFinalServings ? order.actualQuantity : order.forecastQuantity
              const variance = finalQuantity - order.forecastQuantity
              const uniqueDishes = Array.from(
                new Map((order.dishes ?? []).map((dish) => [dish.dishId, dish])).values(),
              )
              const leadDish = uniqueDishes.find((dish) => dish.dishSlot?.toLowerCase().endsWith('-main')) ?? uniqueDishes[0]

              return (
            <tr key={order.id} className={`border-b border-slate-200/80 transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-[var(--ipc-slate-50)]'}`}>
              <td className="border-r border-slate-200">
                <div className="font-medium text-slate-800 leading-5">{order.customerName}</div>
                <div className="font-mono text-xs text-slate-400 mt-0.5">{order.customerCode}</div>
              </td>

              <td className="border-r border-slate-200 text-slate-600">
                <div className="font-medium text-slate-800">{order.menuName || order.mealType}</div>
              </td>

              <td className="min-w-[240px] border-r border-slate-200">
                <div className="flex items-center justify-between gap-3 text-slate-800">
                  <div className="min-w-0 truncate whitespace-nowrap leading-5">
                  {uniqueDishes.length > 0 ? (
                    <>
                      {leadDish?.dishSlot?.toLowerCase().endsWith('-main') && <span className="mr-1.5 text-xs font-semibold text-blue-700">Món chính</span>}
                      <span className="font-medium">{leadDish?.dishName}</span>
                      {uniqueDishes.length > 1 && <span className="text-slate-500"> · +{uniqueDishes.length - 1} món</span>}
                    </>
                  ) : (
                    <span className="text-slate-500">Chưa có món</span>
                  )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onPointerEnter={preloadDishDetailDialog}
                    onFocus={preloadDishDetailDialog}
                    onClick={() => openDishDetailDialog(order)}
                    className="h-8 shrink-0 gap-1.5 px-2 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                    aria-label={`Xem chi tiết thực đơn của ${order.customerName}`}
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    Chi tiết
                  </Button>
                </div>
              </td>

              <td className="border-r border-slate-200 text-center">
                <input
                  aria-label={`Suất dự kiến của ${order.customerName}`}
                  type="number"
                  min="0"
                  max="9999"
                  disabled={!canEditForecast || pendingForecastOrderIds[order.id]}
                  title={!canEditForecast ? 'Ca đã khóa số suất dự kiến; mở lại ca trước khi điều chỉnh.' : pendingForecastOrderIds[order.id] ? 'Đang lưu số suất dự kiến.' : undefined}
                  value={order.forecastQuantity}
                  onFocus={() => rememberForecastValue(order)}
                  onBlur={(e) =>
                    handleForecastQuantitySave(order, parseServingInput(e.target.value))
                  }
                  onChange={(e) =>
                    handleOrderChange({
                      id: order.id,
                      field: 'forecastQuantity',
                      value: parseServingInput(e.target.value),
                    })
                  }
                  className={`min-h-9 w-16 rounded-md border px-2 py-1.5 text-center font-semibold transition-colors ${
                    !canEditForecast
                      ? 'cursor-default border-transparent bg-transparent text-slate-700'
                      : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  } ${pendingForecastOrderIds[order.id] ? 'cursor-wait opacity-70' : ''}`}
                />
              </td>

              <td className="border-r border-slate-200 text-center">
                <input
                  aria-label={`Suất thực tế của ${order.customerName}`}
                  type="number"
                  min="0"
                  max="9999"
                  disabled={!canRequestAdjustment || pendingOrderIds[order.id]}
                  title={!canRequestAdjustment ? 'Ca đã hoàn tất; dùng luồng yêu cầu điều chỉnh nếu cần thay đổi.' : pendingOrderIds[order.id] ? 'Đang lưu số suất thực tế.' : undefined}
                  value={order.actualQuantity}
                  onChange={(e) =>
                    handleActualQuantityChange(order, parseServingInput(e.target.value))
                  }
                  className={`min-h-9 w-16 rounded-md border px-2 py-1.5 text-center font-semibold transition-colors ${
                    canRequestAdjustment
                      ? 'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100'
                      : 'cursor-default border-transparent bg-transparent text-slate-700'
                  } ${pendingOrderIds[order.id] ? 'cursor-wait opacity-70' : ''}`}
                />
              </td>

              <td className="text-center">
                <span
                  className={`inline-flex items-center gap-0.5 min-w-12 justify-center rounded-md border px-1.5 py-1 text-[12px] font-bold ${
                    variance === 0
                      ? 'border-teal-200 bg-teal-50 text-teal-800'
                      : variance < 0
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {variance < 0 ? (
                    <>
                      <span className="text-[9px]">▼</span>
                      <span>{variance}</span>
                    </>
                  ) : variance > 0 ? (
                    <>
                      <span className="text-[9px]">▲</span>
                      <span>+{variance}</span>
                    </>
                  ) : (
                    <span>0</span>
                  )}
                </span>
              </td>
            </tr>
              )
            })}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      {selectedOrder && (LoadedDishDetailDialog ? (
        <LoadedDishDetailDialog order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
      ) : (
        <DishDetailLoadingOverlay customerName={selectedOrder.customerName} onClose={() => setSelectedOrderId(null)} />
      ))}
    </div>
  )
}
