'use client'

import { useMemo, useState } from 'react'
import type { OrderRow, OrderUpdatePayload } from '../types'
import { useAppDispatch } from '@/app/hooks'
import { setOrderActualQuantity, updateOrder } from '../coordinationSlice'
import { useAdjustCoordinationOrderMutation, useUpdateForecastServingsMutation } from '../coordinationApi'
import { DataTableShell, EmptyState, InlineAlert, PaginationBar } from '@/components/common'
import { formatCurrency } from '@/lib/formatters'
import { ClipboardList } from 'lucide-react'

interface OrderTableProps {
  orders: OrderRow[]
  isLocked: boolean
}

export function OrderTable({ orders, isLocked }: OrderTableProps) {
  const dispatch = useAppDispatch()
  const [adjustCoordinationOrder] = useAdjustCoordinationOrderMutation()
  const [updateForecastServings] = useUpdateForecastServingsMutation()
  const [page, setPage] = useState(1)
  const [pendingOrderIds, setPendingOrderIds] = useState<Record<string, boolean>>({})
  const [pendingForecastOrderIds, setPendingForecastOrderIds] = useState<Record<string, boolean>>({})
  const [forecastRollbackValues, setForecastRollbackValues] = useState<Record<string, number>>({})
  const [optimisticError, setOptimisticError] = useState<string | null>(null)
  const pageSize = 12
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageOrders = useMemo(
    () => orders.slice((safePage - 1) * pageSize, safePage * pageSize),
    [orders, safePage],
  )

  const handleOrderChange = (payload: OrderUpdatePayload) => {
    dispatch(updateOrder(payload))
  }

  const rememberForecastValue = (order: OrderRow) => {
    setForecastRollbackValues((current) => ({
      ...current,
      [order.id]: current[order.id] ?? order.forecastQuantity,
    }))
  }

  const handleForecastQuantitySave = async (order: OrderRow, value: number) => {
    if (isLocked || pendingForecastOrderIds[order.id]) return

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
        className="min-h-[360px] border-b border-slate-200"
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
      <DataTableShell className="ipc-coordination-table-shell" ariaLabel="Bảng điều phối đơn theo khách hàng">
        <table className="ipc-data-table ipc-order-table">
          <thead>
            <tr>
              <th className="whitespace-nowrap border-r border-slate-200 text-left w-[180px]">
                Khách Hàng
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-left">
                Loại Suất / Menu
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-left">
                Món Ăn
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-center w-[100px]">
                Dự Kiến
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-center w-[100px]">
                Thực Tế
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-center w-[80px]">
                Chênh Lệch
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-right w-[110px]">
                Đơn Giá
              </th>
              <th className="whitespace-nowrap border-r border-slate-200 text-center w-[80px]">
                % Định Mức
              </th>
              <th className="whitespace-nowrap text-left">
                Ghi Chú
              </th>
            </tr>
          </thead>
          <tbody>
            {pageOrders.map((order, idx) => {
              const finalQuantity = isLocked ? order.actualQuantity : order.forecastQuantity
              const variance = finalQuantity - order.forecastQuantity

              return (
            <tr key={order.id} className={`border-b border-slate-200/80 transition-colors hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
              {/* Khách Hàng (gộp Mã KH + Tên) */}
              <td className="border-r border-slate-200">
                <div className="font-medium text-slate-800 leading-5">{order.customerName}</div>
                <div className="font-mono text-xs text-slate-400 mt-0.5">{order.customerCode}</div>
              </td>

              {/* Loại Suất */}
              <td className="border-r border-slate-200 text-slate-600">
                <div className="font-medium text-slate-800">{order.menuName || order.mealType}</div>
                {order.menuCode && <div className="mt-0.5 font-mono text-xs text-slate-500">{order.menuCode}</div>}
              </td>

              {/* Món Ăn */}
              <td className="min-w-[140px] border-r border-slate-200">
                <div className="flex flex-col gap-1 text-slate-800">
                  {order.dishes && order.dishes.length > 0 ? (
                    order.dishes.map((dish) => (
                      <div key={dish.dishId} className="leading-5">
                        <span className="font-medium">{dish.dishName}</span>
                        {dish.dishCode && <span className="ml-2 font-mono text-xs text-slate-500">{dish.dishCode}</span>}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">Chưa có món</span>
                  )}
                </div>
              </td>

              {/* Suất Dự Kiến (Editable) */}
              <td className="border-r border-slate-200 text-center">
                <input
                  type="number"
                  min="0"
                  max="9999"
                  disabled={isLocked || pendingForecastOrderIds[order.id]}
                  value={order.forecastQuantity}
                  onFocus={() => rememberForecastValue(order)}
                  onBlur={(e) =>
                    handleForecastQuantitySave(order, parseInt(e.target.value) || 0)
                  }
                  onChange={(e) =>
                    handleOrderChange({
                      id: order.id,
                      field: 'forecastQuantity',
                      value: parseInt(e.target.value) || 0,
                    })
                  }
                  className={`min-h-9 w-16 rounded-md border px-2 py-1.5 text-center font-semibold transition-colors ${
                    isLocked
                      ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                  } ${pendingForecastOrderIds[order.id] ? 'cursor-wait opacity-70' : ''}`}
                />
              </td>

              {/* Suất Chốt Thực Tế */}
              <td className="border-r border-slate-200 text-center">
                <input
                  type="number"
                  min="0"
                  max="9999"
                  disabled={!isLocked || pendingOrderIds[order.id]}
                  value={order.actualQuantity}
                  onChange={(e) =>
                    handleActualQuantityChange(order, parseInt(e.target.value) || 0)
                  }
                  className={`min-h-9 w-16 rounded-md border px-2 py-1.5 text-center font-semibold transition-colors ${
                    isLocked
                      ? 'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100'
                      : 'border-slate-200 bg-slate-100 text-slate-500'
                  } ${pendingOrderIds[order.id] ? 'cursor-wait opacity-70' : ''}`}
                />
              </td>

              {/* Chênh lệch */}
              <td className="border-r border-slate-200 text-center">
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

              {/* Đơn Giá */}
              <td className="border-r border-slate-200 text-right text-slate-600 tabular-nums">
                {formatCurrency(order.unitPrice)}
              </td>

              {/* % Định Mức */}
              <td className="border-r border-slate-200 text-center">
                <span
                  className={`inline-block rounded-md border px-1.5 py-1 font-semibold text-[12px] ${
                    order.appliedRate >= 100
                      ? 'border-teal-200 bg-teal-50 text-teal-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {order.appliedRate}%
                </span>
              </td>

              {/* Ghi Chú */}
              <td className="text-slate-600">
                <input
                  type="text"
                  disabled={isLocked}
                  value={order.specialNotes || ''}
                  onChange={(e) =>
                    handleOrderChange({
                      id: order.id,
                      field: 'specialNotes',
                      value: e.target.value,
                    })
                  }
                  placeholder="-"
                  className={`min-h-9 w-full min-w-[120px] rounded-md border px-2 py-1.5 text-left transition-colors bg-transparent ${
                    isLocked
                      ? 'border-transparent text-slate-500 cursor-not-allowed bg-transparent'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 focus:border-blue-500'
                  }`}
                />
              </td>
            </tr>
              )
            })}
          </tbody>
        </table>
      </DataTableShell>
      <PaginationBar page={safePage} pageSize={pageSize} totalItems={orders.length} onPageChange={setPage} />
    </div>
  )
}
