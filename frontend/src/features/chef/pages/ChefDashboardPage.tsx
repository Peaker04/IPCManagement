'use client'

import { useState, useMemo } from 'react'
import { HeadChefDashboard } from '../components/head-chef-dashboard'
import { AlertCircle, Calendar, ClipboardList, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { CommandBar, ContextStrip, DocumentRail, EmptyState, InlineAlert, OperationalFrame, SectionPanel, SideRail, SplitWorkbench, StockMovementTable, ViewSwitcher } from '@/components/common'
import { DAYS_OF_WEEK, SHIFTS } from '@/lib/constants'
import { getTodayDayCode } from '@/lib/dateUtils'
import { DISHES, RAW_MATERIALS } from '../../projects/menuData'
import { format } from 'date-fns'
import type { ShiftType } from '../../coordination/types'
import type { ExcessMaterial, SupplementalRequest } from '@/lib/types'
import { getDocumentByType, getStockMovementsByType } from '@/features/workflow'



export default function ChefDashboardPage() {
  const orders = useAppSelector((state) => state.coordination.orders)
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts)
  const menuPrice = useAppSelector((state) => state.coordination.menuPrice)
  const lossRate = useAppSelector((state) => state.coordination.lossRate)

  const [activeDay, setActiveDay] = useState<string>(getTodayDayCode())
  const [activeShift, setActiveShift] = useState<ShiftType>('Ca Sáng')
  const [activeView, setActiveView] = useState<'production' | 'documents'>('production')
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
  const khsxDocuments = getDocumentByType('KHSX')
  const returnDocuments = getDocumentByType('Phiếu trả')
  const kitchenMovements = [
    ...getStockMovementsByType('issue'),
    ...getStockMovementsByType('supplemental'),
    ...getStockMovementsByType('return'),
  ]

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
      const dish = DISHES.find((d) => d.id === dishId)
      const priceRatio = Math.max(0.1, Math.min(1.5, menuPrice / 35000))

      const ingredients = dish
        ? dish.ingredients.map((ing, idx) => {
            // grossQty = (recipe_amount * portions * priceRatio * (1 + lossRate/100)) / 1000 (kg)
            const rawQty = (ing.amount * portions * priceRatio * (1 + lossRate / 100)) / 1000
            return {
              ingredientId: `ing-${dishId}-${idx}`,
              ingredientName: ing.name,
              unit: RAW_MATERIALS[ing.name]?.unit || 'kg',
              grossQty: parseFloat(rawQty.toFixed(2)),
            }
          })
        : []

      return {
        id: dishId,
        name: dish ? dish.name : 'Món ăn không rõ',
        code: dishId.toUpperCase(),
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

    const receivedMaterials = Object.entries(materialTotals).map(([name, data], idx) => {
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
      totalMeals,
      activeDishes,
      receivedMaterials,
    }
  }, [dayShiftOrders, isLocked, menuPrice, lossRate, activeDay, activeShift, signedMaterials])

  const handleSupplementalRequest = (data: SupplementalRequest) => {
    setRequests([...requests, { ...data, day: activeDay, shift: activeShift }])
    setChefFeedback({
      title: 'Đã ghi nhận yêu cầu bổ sung',
      message: `${data.ingredientName}: ${data.requestedQty} ${data.unit} đã được thêm vào nhật ký ca ${activeShift}.`,
      variant: 'warning',
    })
  }

  const handleExcessMaterialReturn = (data: ExcessMaterial) => {
    setReturns([...returns, { ...data, day: activeDay, shift: activeShift }])
    setChefFeedback({
      title: 'Đã ghi nhận nguyên liệu thừa',
      message: `${data.ingredientName}: ${data.returnedQty} ${data.unit} (${data.condition}) đã được thêm vào nhật ký ca ${activeShift}.`,
      variant: 'info',
    })
  }

  const handleMaterialSignoff = (materialId: string, signed: boolean) => {
    // Find the material name by its ID in receivedMaterials
    const material = productionPlan.receivedMaterials.find((m) => m.id === materialId)
    if (material) {
      const signKey = `${activeDay}-${activeShift}-${material.name}`
      setSignedMaterials((prev) => ({
        ...prev,
        [signKey]: signed,
      }))
    }
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
      eyebrow="Bếp trưởng"
      title="Nhận nguyên liệu và theo dõi ca nấu"
      command={
        <CommandBar>
          {shiftControls}
        </CommandBar>
      }
      context={
        <>
          <ContextStrip
            items={[
              { label: 'KHSX', value: 'KHSX-0613-TRUA', tone: 'success' },
              { label: 'Trạng thái nhận', value: isLocked ? 'Chờ nhận nguyên liệu' : 'Chưa chốt ca', tone: isLocked ? 'warning' : 'neutral' },
              { label: 'Yêu cầu bổ sung', value: `${activeRequests.length} phiếu`, tone: 'warning' },
              { label: 'Trả nguyên liệu dư', value: `${activeReturns.length} phiếu`, tone: 'warning' },
            ]}
          />
          {shiftAlert}
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
                <DocumentRail documents={[...khsxDocuments, ...returnDocuments]} title="KHSX và phiếu trả" />
              </div>
              </div>
            </SectionPanel>
          )}
        </div>
      )}
    </OperationalFrame>
  )
}

