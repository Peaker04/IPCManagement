'use client'

import { useState, useMemo } from 'react'
import { HeadChefDashboard } from '../components/head-chef-dashboard'
import { AlertCircle, Calendar, ClipboardList, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { CommandBar, ContextStrip, DataTableShell, DocumentRail, EmptyState, InlineAlert, OperationalFrame, SectionPanel, SideRail, SplitWorkbench, StatusBadge, StockMovementTable, ViewSwitcher } from '@/components/common'
import { DAYS_OF_WEEK, SHIFTS } from '@/lib/constants'
import { getTodayDayCode } from '@/lib/dateUtils'
import { useGetDishesCatalogQuery } from '../../projects/dishCatalogApi'
import { format } from 'date-fns'
import type { ShiftType } from '../../coordination/types'
import type { ExcessMaterial, Ingredient, SupplementalRequest } from '@/lib/types'
import {
  useConfirmInventoryIssueReceiptMutation,
  useCreateInventoryReturnMutation,
  useGetDailyProductionPlanQuery,
  useGetKitchenIssuesQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useSendDailyProductionPlanToKitchenMutation,
} from '@/features/workflow'
import { formatQuantityWithUnit } from '@/lib/formatters'

type ChefMaterial = Ingredient & {
  issueId?: string
  issueCode?: string
  warehouseId?: string
  ingredientId?: string
  unitId?: string
  isReceivedByKitchen?: boolean
}

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data
    if (data && typeof data === 'object' && 'message' in data) {
      return String(data.message)
    }
  }

  return fallback
}

export default function ChefDashboardPage() {
  const orders = useAppSelector((state) => state.coordination.orders)
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts)
  const menuPrice = useAppSelector((state) => state.coordination.menuPrice)
  const lossRate = useAppSelector((state) => state.coordination.lossRate)
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 })
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 })
  const {
    data: kitchenIssueRows = [],
    isLoading: isKitchenIssuesLoading,
    isError: isKitchenIssuesError,
  } = useGetKitchenIssuesQuery({ limit: 100 })
  const [confirmInventoryIssueReceipt, { isLoading: isConfirmingIssueReceipt }] = useConfirmInventoryIssueReceiptMutation()
  const [createInventoryReturn, { isLoading: isCreatingInventoryReturn }] = useCreateInventoryReturnMutation()
  const [sendDailyProductionPlanToKitchen, { isLoading: isSendingDailyPlan }] = useSendDailyProductionPlanToKitchenMutation()
  const {
    data: catalogDishes = [],
    isLoading: isCatalogLoading,
    isError: isCatalogError,
  } = useGetDishesCatalogQuery()

  const [activeDay, setActiveDay] = useState<string>(getTodayDayCode())
  const [activeShift, setActiveShift] = useState<ShiftType>('Ca Sáng')
  const [activeView, setActiveView] = useState<'production' | 'documents'>('production')
  const today = new Date().toISOString().slice(0, 10)
  const apiShiftName = activeShift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'
  const {
    data: dailyProductionPlan,
    isLoading: isDailyPlanLoading,
    isError: isDailyPlanError,
  } = useGetDailyProductionPlanQuery({ serviceDate: today, shiftName: apiShiftName })
  const [signedMaterials, setSignedMaterials] = useState<Record<string, boolean>>({})
  const [requests, setRequests] = useState<Array<SupplementalRequest & { day: string; shift: ShiftType }>>([])
  const [returns, setReturns] = useState<Array<ExcessMaterial & { day: string; shift: ShiftType }>>([])
  const [chefFeedback, setChefFeedback] = useState<{
    title: string
    message: string
    variant: 'info' | 'warning' | 'danger'
  } | null>(null)

  const lockKey = `${activeDay}-${activeShift}`
  const isLocked = !!lockedShifts[lockKey]
  const isCatalogEmpty = !isCatalogLoading && !isCatalogError && catalogDishes.length === 0
  const returnDocuments = workflowDocuments.filter((document) => document.type === 'Phiếu trả')
  const kitchenMovements = [
    ...stockMovements.filter((movement) => movement.type === 'issue'),
    ...stockMovements.filter((movement) => movement.type === 'supplemental'),
    ...stockMovements.filter((movement) => movement.type === 'return'),
  ]
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes])
  const activeKitchenIssueRows = useMemo(() => {
    const normalizedShift = activeShift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'
    const matchingRows = kitchenIssueRows.filter((row) => {
      const rowShift = row.shiftName?.toUpperCase()
      return !rowShift || rowShift === 'FULLDAY' || rowShift === normalizedShift || row.shiftName === activeShift
    })

    return matchingRows.length > 0 ? matchingRows : kitchenIssueRows
  }, [kitchenIssueRows, activeShift])
  const pendingKitchenReceiptCount = activeKitchenIssueRows.filter((row) => !row.isReceivedByKitchen).length
  const dailyPlans = Array.isArray(dailyProductionPlan?.plans) ? dailyProductionPlan.plans : []
  const dailyPlanWarnings = Array.isArray(dailyProductionPlan?.warnings) ? dailyProductionPlan.warnings : []
  const dailyPlanLines = dailyPlans.flatMap((plan) =>
    (Array.isArray(plan.lines) ? plan.lines : []).map((line) => ({
      ...line,
      planCode: plan.planCode,
      customerName: plan.customerName,
      status: plan.status,
      sentToKitchenAt: plan.sentToKitchenAt,
    })),
  ) ?? []

  // Filter orders for the selected day and shift
  const dayShiftOrders = useMemo(() => {
    return orders.filter((o) => o.dayOfWeek === activeDay && o.shift === activeShift)
  }, [orders, activeDay, activeShift])

  // Dynamically compute production plan
  const productionPlan = useMemo(() => {
    // 1. Sum portions of matching orders
    const totalMeals = dayShiftOrders.reduce(
      (sum, o) => sum + (isLocked ? o.actualQuantity : o.forecastQuantity),
      0
    )

    // 2. Group orders by dishId
    const portionsByDishId: Record<string, number> = {}
    dayShiftOrders.forEach((o) => {
      const qty = isLocked ? o.actualQuantity : o.forecastQuantity
      if (qty > 0) {
        portionsByDishId[o.dishId] = (portionsByDishId[o.dishId] || 0) + qty
      }
    })

    const activeDishes = Object.entries(portionsByDishId).map(([dishId, portions]) => {
      const dish = dishesById.get(dishId)
      const priceRatio = Math.max(0.1, Math.min(1.5, menuPrice / 35000))

      const ingredients = dish
        ? dish.ingredients.map((ing, idx) => {
            const rawQty = ing.grossQtyPerServing * portions * priceRatio * (1 + lossRate / 100)
            return {
              ingredientId: ing.ingredientId || `${dishId}-${idx}`,
              ingredientName: ing.name,
              unit: ing.unit,
              grossQty: parseFloat(rawQty.toFixed(2)),
            }
          })
        : []

      return {
        id: dishId,
        name: dish ? dish.name : 'Món ăn không rõ',
        code: dish?.code ?? dishId.slice(0, 8).toUpperCase(),
        ingredients,
      }
    })

    // 3. Build received materials checklist
    const materialTotals: Record<string, { qty: number; unit: string }> = {}
    activeDishes.forEach((ad) => {
      ad.ingredients.forEach((ing) => {
        if (!materialTotals[ing.ingredientName]) {
          materialTotals[ing.ingredientName] = { qty: 0, unit: ing.unit }
        }
        materialTotals[ing.ingredientName].qty += ing.grossQty
      })
    })

    const plannedMaterials = Object.entries(materialTotals).map(([name, data], idx) => {
      const signKey = `${activeDay}-${activeShift}-${name}`
      const isSigned = !!signedMaterials[signKey]
      return {
        id: `mat-${idx}`,
        name,
        unit: data.unit,
        quantity: parseFloat(data.qty.toFixed(2)),
        status: (isLocked ? 'Đã nhận' : 'Chờ giao') as 'Chờ giao' | 'Đã nhận',
        signed: isSigned,
      }
    })

    const liveReceivedMaterials: ChefMaterial[] = activeKitchenIssueRows.map((row) => {
      const signKey = `${activeDay}-${activeShift}-${row.issueId}-${row.id}`
      const isSigned = row.isReceivedByKitchen || !!signedMaterials[signKey]

      return {
        id: row.id,
        name: row.ingredient,
        unit: row.unit,
        quantity: row.issuedQty,
        status: 'Đã nhận',
        signed: isSigned,
        issueId: row.issueId,
        issueCode: row.issueCode,
        warehouseId: row.warehouseId,
        ingredientId: row.ingredientId,
        unitId: row.unitId,
        isReceivedByKitchen: row.isReceivedByKitchen,
      }
    })

    const receivedMaterials = liveReceivedMaterials.length > 0 ? liveReceivedMaterials : plannedMaterials

    return {
      date: format(new Date(), 'yyyy-MM-dd'),
      shift: activeShift,
      kitchenAssignment: {
        kitchenName: 'Bếp Cảnh',
        kitchenCode: 'KC01',
        responsibleChefs: [
          { name: 'Đặng Ánh Vàng', shortName: 'DAV' },
          { name: 'Võ Công Việt', shortName: 'VCV' },
        ],
      },
      totalMeals: totalMeals || liveReceivedMaterials.length,
      activeDishes,
      receivedMaterials,
    }
  }, [dayShiftOrders, isLocked, menuPrice, lossRate, activeDay, activeShift, signedMaterials, dishesById, activeKitchenIssueRows])

  const handleSupplementalRequest = (data: SupplementalRequest) => {
    setRequests([...requests, { ...data, day: activeDay, shift: activeShift }])
    setChefFeedback({
      title: 'Đã ghi nhận yêu cầu bổ sung',
      message: `${data.ingredientName}: ${formatQuantityWithUnit(data.requestedQty, data.unit)} đã được thêm vào nhật ký ca ${activeShift}.`,
      variant: 'warning',
    })
  }

  const handleExcessMaterialReturn = async (data: ExcessMaterial) => {
    const issueRow = activeKitchenIssueRows.find((row) => row.id === data.ingredientId)
    const material = productionPlan.receivedMaterials.find((item) => item.id === data.ingredientId) as ChefMaterial | undefined

    if (!issueRow || !material?.warehouseId || !material.ingredientId || !material.unitId) {
      setChefFeedback({
        title: 'Chưa có phiếu xuất để trả kho',
        message: 'Bếp chỉ có thể ghi nhận trả nguyên liệu khi checklist đang lấy từ phiếu xuất kho live.',
        variant: 'warning',
      })
      return
    }

    if (!Number.isFinite(data.returnedQty) || data.returnedQty <= 0) {
      setChefFeedback({
        title: 'Số lượng trả không hợp lệ',
        message: 'Số lượng trả kho phải lớn hơn 0.',
        variant: 'warning',
      })
      return
    }

    if (data.returnedQty > material.quantity) {
      setChefFeedback({
        title: 'Số lượng trả vượt số đã xuất',
        message: `${data.ingredientName} chỉ được ghi nhận tối đa ${formatQuantityWithUnit(material.quantity, material.unit)} từ phiếu xuất ${material.issueCode}.`,
        variant: 'danger',
      })
      return
    }

    const returnType = data.condition === 'damaged' ? 'WASTE' : 'RETURN'
    const reason = data.notes?.trim()
      || (returnType === 'WASTE'
        ? `Bếp ghi nhận hao hụt/hư hỏng ${data.ingredientName}.`
        : `Bếp trả nguyên liệu thừa ${data.ingredientName} sau ca ${activeShift}.`)

    try {
      const response = await createInventoryReturn({
        returnDate: data.returnedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        shiftName: issueRow.shiftName,
        returnType,
        warehouseId: material.warehouseId,
        issueId: material.issueId!,
        reason,
        lines: [
          {
            ingredientId: material.ingredientId,
            quantity: data.returnedQty,
            unitId: material.unitId,
          },
        ],
      }).unwrap()

      setReturns([...returns, { ...data, day: activeDay, shift: activeShift }])
      setChefFeedback({
        title: returnType === 'WASTE' ? 'Đã ghi nhận hao hụt thực tế' : 'Đã tạo phiếu trả kho',
        message: response.data
          ? `${response.data.returnCode}: ${data.ingredientName} ${formatQuantityWithUnit(data.returnedQty, data.unit)} đã được lưu bằng API.`
          : response.message || 'Phiếu trả nguyên liệu đã được ghi nhận.',
        variant: 'info',
      })
    } catch (error) {
      setChefFeedback({
        title: 'Chưa ghi nhận được phiếu trả',
        message: getMutationErrorMessage(error, 'Kiểm tra số lượng đã xuất/đã trả và thử lại.'),
        variant: 'danger',
      })
    }
  }

  const handleSendDailyPlanToKitchen = async () => {
    try {
      const result = await sendDailyProductionPlanToKitchen({
        serviceDate: today,
        shiftName: apiShiftName,
        reason: `Bếp trưởng nhận kế hoạch sản xuất ${today} ${apiShiftName}.`,
      }).unwrap()
      setChefFeedback({
        title: 'Đã nhận kế hoạch sản xuất',
        message: `${result.sentPlans}/${result.totalPlans} KHSX đã được đánh dấu gửi bếp.`,
        variant: 'info',
      })
    } catch (error) {
      setChefFeedback({
        title: 'Chưa nhận được KHSX',
        message: getMutationErrorMessage(error, 'Không thể đánh dấu gửi bếp cho kế hoạch hôm nay.'),
        variant: 'warning',
      })
    }
  }

  const handleMaterialSignoff = async (materialId: string, signed: boolean) => {
    const material = productionPlan.receivedMaterials.find((m) => m.id === materialId)
    if (!material) {
      return
    }

    const issueRow = activeKitchenIssueRows.find((row) => row.id === materialId)
    const signKey = issueRow
      ? `${activeDay}-${activeShift}-${issueRow.issueId}-${issueRow.id}`
      : `${activeDay}-${activeShift}-${material.name}`

    if (!signed) {
      if (issueRow?.isReceivedByKitchen) {
        setChefFeedback({
          title: 'Phiếu đã ký nhận trên hệ thống',
          message: `Phiếu ${issueRow.issueCode} đã xác nhận nhận nguyên liệu nên không thể bỏ ký từ giao diện.`,
          variant: 'warning',
        })
        return
      }

      setSignedMaterials((prev) => ({
        ...prev,
        [signKey]: false,
      }))
      return
    }

    if (issueRow?.issueId && !issueRow.isReceivedByKitchen) {
      try {
        const response = await confirmInventoryIssueReceipt({
          issueId: issueRow.issueId,
          hasDiscrepancy: false,
        }).unwrap()

        setSignedMaterials((prev) => ({
          ...prev,
          [signKey]: true,
        }))
        setChefFeedback({
          title: 'Đã ký nhận nguyên liệu',
          message: response.message || `Bếp đã xác nhận nhận phiếu ${issueRow.issueCode}.`,
          variant: 'info',
        })
      } catch (error) {
        setChefFeedback({
          title: 'Chưa ký nhận được nguyên liệu',
          message: getMutationErrorMessage(error, 'Kiểm tra quyền bếp trưởng hoặc trạng thái phiếu xuất rồi thử lại.'),
          variant: 'danger',
        })
      }
      return
    }

    setSignedMaterials((prev) => ({
      ...prev,
      [signKey]: true,
    }))
  }

  const activeRequests = requests.filter((req) => req.day === activeDay && req.shift === activeShift)
  const activeReturns = returns.filter((ret) => ret.day === activeDay && ret.shift === activeShift)

  const shiftControls = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Calendar className="size-4 text-blue-600" />
        <span className="font-semibold text-slate-700">Lệnh sản xuất bếp nấu</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          aria-label="Chọn ngày sản xuất"
          value={activeDay}
          onChange={(e) => setActiveDay(e.target.value)}
          className="ipc-select bg-white text-sm font-semibold text-slate-700 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
          style={{ width: '110px', minHeight: '32px', paddingTop: '4px', paddingBottom: '4px', paddingLeft: '8px', paddingRight: '8px' }}
        >
          {DAYS_OF_WEEK.map((day) => (
            <option key={day.key} value={day.key}>
              {day.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Chọn ca sản xuất"
          value={activeShift}
          onChange={(e) => setActiveShift(e.target.value as ShiftType)}
          className="ipc-select bg-white text-sm font-semibold text-slate-700 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
          style={{ width: '110px', minHeight: '32px', paddingTop: '4px', paddingBottom: '4px', paddingLeft: '8px', paddingRight: '8px' }}
        >
          {SHIFTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  )

  const shiftAlert = isLocked ? (
    <InlineAlert title="Lệnh sản xuất chính thức" icon={<ShieldCheck className="size-4" />} variant="info">
      Ca này đã chốt. Bếp nhận nguyên liệu, ký nhận và nấu theo KHSX.
    </InlineAlert>
  ) : (
    <InlineAlert title="Bản dự thảo từ điều phối" icon={<ShieldAlert className="size-4" />} variant="warning">
      Chưa chốt ca. Bếp chỉ xem trước KHSX, chưa xác nhận nhận nguyên liệu.
    </InlineAlert>
  )

  const shiftJournal = (
    <SideRail
      title="Nhật ký hoạt động ca"
      description="Yêu cầu bổ sung và ghi nhận nguyên liệu thừa trong ngày, ca đang chọn."
    >
      {activeRequests.length === 0 && activeReturns.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          Chưa có ngoại lệ nào được ghi nhận trong ca này.
        </div>
      ) : (
        <>
          {activeRequests.map((req, idx) => (
            <div key={`req-${idx}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <div className="font-bold text-slate-900">Gửi yêu cầu bổ sung</div>
              <div className="mt-1 text-slate-600">
                {req.ingredientName}: {req.requestedQty} {req.unit}
              </div>
            </div>
          ))}
          {activeReturns.map((ret, idx) => (
            <div key={`ret-${idx}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <div className="font-bold text-slate-900">Ghi nhận nguyên liệu thừa</div>
              <div className="mt-1 text-slate-600">
                {ret.ingredientName}: {ret.returnedQty} {ret.unit}
              </div>
            </div>
          ))}
        </>
      )}
    </SideRail>
  )

  return (
    <OperationalFrame
      command={
        <CommandBar>
          {shiftControls}
        </CommandBar>
      }
      context={
        <>
          <ContextStrip
            items={[
              { label: 'KHSX hôm nay', value: dailyProductionPlan ? `${dailyProductionPlan.sentPlans}/${dailyProductionPlan.totalPlans} đã gửi` : 'Đang kiểm tra', tone: dailyProductionPlan?.sentPlans ? 'success' : 'warning' },
              { label: 'Phiếu trả', value: `${returnDocuments.length} chứng từ`, tone: 'neutral' },
              { label: 'Trạng thái nhận', value: pendingKitchenReceiptCount > 0 ? `${pendingKitchenReceiptCount} dòng chờ ký` : activeKitchenIssueRows.length > 0 ? 'Đã ký nhận' : isLocked ? 'Chờ nhận nguyên liệu' : 'Chưa chốt ca', tone: pendingKitchenReceiptCount > 0 ? 'warning' : activeKitchenIssueRows.length > 0 ? 'success' : isLocked ? 'warning' : 'neutral' },
              { label: 'Yêu cầu bổ sung', value: `${activeRequests.length} phiếu`, tone: 'warning' },
            ]}
          />
          {shiftAlert}
          {isCatalogLoading && (
            <InlineAlert title="Đang tải catalog món ăn" variant="info">
              Hệ thống đang lấy BOM và đơn vị tính từ API để lập checklist nguyên liệu cho bếp.
            </InlineAlert>
          )}
          {isCatalogError && (
            <InlineAlert title="Chưa tải được catalog món ăn" variant="warning">
              Bếp trưởng cần catalog BOM từ API để xem định lượng nguyên liệu chính xác cho ca.
            </InlineAlert>
          )}
          {isCatalogEmpty && (
            <InlineAlert title="Catalog món ăn đang trống" variant="warning">
              Chưa có món ăn hoạt động nào từ API, nên checklist nguyên liệu của ca chưa thể sinh từ BOM.
            </InlineAlert>
          )}
          {isKitchenIssuesLoading && (
            <InlineAlert title="Đang tải phiếu xuất kho" variant="info">
              Hệ thống đang lấy danh sách nguyên liệu đã bàn giao từ kho để bếp trưởng ký nhận.
            </InlineAlert>
          )}
          {isKitchenIssuesError && (
            <InlineAlert title="Chưa tải được phiếu xuất kho" variant="warning">
              Checklist bếp sẽ dùng BOM dự kiến cho tới khi API phiếu xuất kho phản hồi.
            </InlineAlert>
          )}
          {activeKitchenIssueRows.length > 0 && (
            <InlineAlert title="Checklist lấy từ phiếu xuất kho live" variant={pendingKitchenReceiptCount > 0 ? 'warning' : 'info'}>
              {pendingKitchenReceiptCount > 0
                ? `${pendingKitchenReceiptCount} dòng nguyên liệu đang chờ bếp trưởng ký nhận trên API.`
                : 'Tất cả dòng nguyên liệu từ phiếu xuất kho đã được bếp xác nhận.'}
            </InlineAlert>
          )}
          {isDailyPlanLoading && (
            <InlineAlert title="Đang tải KHSX gửi bếp" variant="info">
              Hệ thống đang lấy kế hoạch sản xuất trong ngày từ API.
            </InlineAlert>
          )}
          {isDailyPlanError && (
            <InlineAlert title="Chưa tải được KHSX gửi bếp" variant="warning">
              Dashboard vẫn hiển thị checklist dự kiến, nhưng cần API KHSX để bếp nhận đúng kế hoạch.
            </InlineAlert>
          )}
          {dailyPlanWarnings.map((warning) => (
            <InlineAlert key={warning} title="Cảnh báo KHSX" variant="warning">
              {warning}
            </InlineAlert>
          ))}
          {isConfirmingIssueReceipt && (
            <InlineAlert title="Đang ghi nhận ký nhận" variant="info">
              Hệ thống đang cập nhật trạng thái nhận nguyên liệu cho phiếu xuất kho.
            </InlineAlert>
          )}
          {isCreatingInventoryReturn && (
            <InlineAlert title="Đang tạo phiếu trả kho" variant="info">
              Hệ thống đang lưu nguyên liệu thừa/hao hụt và cập nhật sổ kho.
            </InlineAlert>
          )}
        </>
      }
    >
      {productionPlan.totalMeals === 0 ? (
        <EmptyState
          icon={<AlertCircle className="size-12 text-slate-400" />}
          title="Không có suất ăn nào được lên lịch cho ca này."
          description="Vui lòng điều phối suất dự kiến tại trang Điều phối trước."
          className="text-slate-500"
        />
      ) : (
        <div className="ipc-operational-view">
          {chefFeedback && (
            <InlineAlert title={chefFeedback.title} variant={chefFeedback.variant}>
              {chefFeedback.message}
            </InlineAlert>
          )}
          <ViewSwitcher
            compact
            ariaLabel="Chọn góc nhìn bếp trưởng"
            tabs={[
              { id: 'chef-production', label: 'Ca sản xuất' },
              { id: 'chef-documents', label: 'Chứng từ bếp' },
            ]}
            activeTab={activeView === 'production' ? 'chef-production' : 'chef-documents'}
            onTabChange={(id) => setActiveView(id === 'chef-production' ? 'production' : 'documents')}
          />

          {activeView === 'production' && (
            <div id="chef-production-panel" role="tabpanel" aria-labelledby="chef-production-tab">
              <SectionPanel
                title="KHSX trong ngày đã gửi bếp"
                icon={<ClipboardList size={18} />}
                badge={(
                  <button
                    className="ipc-button ipc-button-primary"
                    type="button"
                    disabled={isSendingDailyPlan}
                    onClick={() => void handleSendDailyPlanToKitchen()}
                  >
                    <ShieldCheck size={15} />
                    Nhận KHSX
                  </button>
                )}
              >
                <DataTableShell className="max-h-[320px]" ariaLabel="Kế hoạch sản xuất gửi bếp">
                  <table className="ipc-data-table ipc-status-action-table">
                    <thead>
                      <tr>
                        <th>KHSX</th>
                        <th>Khách hàng</th>
                        <th>Món</th>
                        <th>Ca</th>
                        <th>Suất</th>
                        <th>BOM</th>
                        <th>Thiếu</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPlanLines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            Chưa có KHSX API cho ngày/ca này.
                          </td>
                        </tr>
                      ) : dailyPlanLines.map((line) => (
                        <tr key={`${line.planCode}-${line.planLineId}`}>
                          <td>{line.planCode}</td>
                          <td>{line.customerName ?? '-'}</td>
                          <td>{line.dishName ?? line.dishId}</td>
                          <td>{line.shiftName ?? '-'}</td>
                          <td className="ipc-numeric-cell">{line.totalServings}</td>
                          <td>{line.priceTierAmount ? `${line.priceTierAmount / 1000}k / ${line.bomScope}` : 'Chưa resolve'}</td>
                          <td className="ipc-numeric-cell">{formatQuantityWithUnit(line.suggestedPurchaseQty, '')}</td>
                          <td className="ipc-badge-cell">
                            <StatusBadge variant={line.sentToKitchenAt ? 'success' : line.hasKitchenIssue ? 'warning' : 'neutral'}>
                              {line.sentToKitchenAt ? 'Đã gửi bếp' : line.hasKitchenIssue ? 'Cần kho/thu mua' : 'Chờ gửi'}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              </SectionPanel>
              <SplitWorkbench detailLabel="Nhật ký ca" detail={shiftJournal} className="ipc-chef-split-workbench">
                <HeadChefDashboard
                  productionPlan={productionPlan}
                  onSupplementalRequest={handleSupplementalRequest}
                  onExcessMaterialReturn={handleExcessMaterialReturn}
                  onMaterialSignoff={handleMaterialSignoff}
                />
              </SplitWorkbench>
            </div>
          )}

          {activeView === 'documents' && (
            <SectionPanel
              title="KHSX, bàn giao và phiếu trả"
              icon={<ClipboardList size={18} />}
              className="ipc-chef-documents-panel"
            >
              <div id="chef-documents-panel" role="tabpanel" aria-labelledby="chef-documents-tab">
              <div className="flex flex-col gap-3">
                <StockMovementTable movements={kitchenMovements} />
                <DocumentRail documents={returnDocuments} title="Phiếu trả kho" />
              </div>
              </div>
            </SectionPanel>
          )}
        </div>
      )}
    </OperationalFrame>
  )
}

