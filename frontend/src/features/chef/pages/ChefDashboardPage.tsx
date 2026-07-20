'use client'

import { useMemo, useState } from 'react'
import { Calendar, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { CommandBar, ContextStrip, InlineAlert, OperationalFrame, ViewSwitcher } from '@/components/common'
import { DAYS_OF_WEEK, SHIFTS } from '@/lib/constants'
import type { ShiftType } from '../../coordination/types'
import { getBangkokDayCode, resolveChefServiceDate } from '../chefServiceDate'
import { useChefExceptions } from '../exceptions/useChefExceptions'
import { ChefDocumentsSection } from '../journal/ChefDocumentsSection'
import { useChefJournal } from '../journal/useChefJournal'
import { ChefProductionSection } from '../production/ChefProductionSection'
import { useChefProductionPlan, type ChefFeedback, type ChefShiftScope } from '../production/useChefProductionPlan'
import { KitchenReceiptSection } from '../receipts/KitchenReceiptSection'
import { useKitchenReceipts } from '../receipts/useKitchenReceipts'

export default function ChefDashboardPage() {
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts)
  const [activeDay, setActiveDay] = useState<string>(() => getBangkokDayCode())
  const [activeShift, setActiveShift] = useState<ShiftType>('Ca Sáng')
  const [activeView, setActiveView] = useState<'production' | 'documents'>('production')
  const [feedback, setFeedback] = useState<ChefFeedback | null>(null)
  const lockKey = `${activeDay}-${activeShift}`
  const serviceDate = resolveChefServiceDate(activeDay)
  const scope = useMemo<ChefShiftScope>(() => ({
    activeDay,
    activeShift,
    serviceDate,
    apiShiftName: activeShift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON',
    isLocked: Boolean(lockedShifts[lockKey]),
  }), [activeDay, activeShift, lockedShifts, lockKey, serviceDate])

  const receipts = useKitchenReceipts(scope, setFeedback)
  const production = useChefProductionPlan(scope, receipts.rows, receipts.signedMaterials, setFeedback)
  const exceptions = useChefExceptions(scope, production.productionPlan, receipts.rows, setFeedback)
  const journal = useChefJournal()
  const hasUnreviewedReceiptPages = receipts.hasAdditionalPages

  const statusMessages = [
    production.status.isCatalogLoading ? 'Đang tải danh mục món ăn và định lượng để lập danh sách nguyên liệu.' : null,
    production.status.isCatalogError ? 'Chưa tải được danh mục món ăn; danh sách sẽ thiếu định lượng chính xác từ hệ thống.' : null,
    production.status.isCatalogEmpty ? 'Danh mục món ăn đang trống nên danh sách nguyên liệu chưa thể sinh đầy đủ từ định lượng.' : null,
    receipts.isLoading ? 'Đang tải phiếu xuất kho để bếp trưởng ký nhận nguyên liệu.' : null,
    receipts.isError ? 'Chưa tải được phiếu xuất kho; danh sách tạm dùng dữ liệu dự kiến từ định lượng.' : null,
    receipts.rows.length > 0
      ? receipts.pendingCount > 0
        ? `${receipts.pendingCount} dòng nguyên liệu trên trang ${receipts.page} đang chờ bếp trưởng ký nhận.`
        : hasUnreviewedReceiptPages
          ? `Trang ${receipts.page} đã ký nhận đủ; đang hiển thị ${receipts.rows.length}/${receipts.totalCount} dòng nên chưa thể kết luận toàn bộ phiếu đã nhận.`
          : 'Tất cả dòng nguyên liệu từ phiếu xuất kho đã được bếp xác nhận.'
      : null,
    production.status.isDailyPlanLoading ? 'Đang tải kế hoạch sản xuất trong ngày từ hệ thống.' : null,
    production.status.isDailyPlanError ? 'Chưa tải được kế hoạch sản xuất gửi bếp; danh sách dự kiến vẫn được giữ để tham chiếu.' : null,
    ...production.dailyPlanWarnings,
    receipts.isConfirming ? 'Đang ghi nhận ký nhận nguyên liệu.' : null,
    exceptions.isCreatingReturn ? 'Đang tạo phiếu trả kho và cập nhật sổ kho.' : null,
  ].filter((message): message is string => Boolean(message))
  const statusVariant = production.status.isCatalogError || production.status.isCatalogEmpty || receipts.isError
    || production.status.isDailyPlanError || production.dailyPlanWarnings.length > 0 ? 'warning' : 'info'

  const signOffMaterial = async (materialId: string, signed: boolean) => {
    await receipts.signOff(
      production.productionPlan.receivedMaterials.find((material) => material.id === materialId),
      signed,
    )
  }

  return (
    <OperationalFrame
      command={<CommandBar><ShiftControls activeDay={activeDay} activeShift={activeShift} onDayChange={setActiveDay} onShiftChange={setActiveShift} /></CommandBar>}
      context={(
        <>
          <ContextStrip items={[
            { label: 'Kế hoạch hôm nay', value: production.dailyPlan ? `${production.dailyPlan.sentPlans}/${production.dailyPlan.totalPlans} đã gửi` : 'Đang kiểm tra', tone: production.dailyPlan?.sentPlans ? 'success' : 'warning' },
            { label: 'Phiếu trả', value: `${journal.returnDocuments.length} chứng từ`, tone: 'neutral' },
            { label: 'Trạng thái nhận', value: receipts.pendingCount > 0 ? `${receipts.pendingCount} dòng chờ ký, trang ${receipts.page}` : hasUnreviewedReceiptPages ? `${receipts.rows.length}/${receipts.totalCount} dòng, trang ${receipts.page}` : receipts.allReceived ? 'Đã ký nhận' : scope.isLocked ? 'Chờ nhận nguyên liệu' : 'Chưa chốt ca', tone: receipts.pendingCount > 0 || hasUnreviewedReceiptPages ? 'warning' : receipts.allReceived ? 'success' : scope.isLocked ? 'warning' : 'neutral' },
          ]} />
          <ShiftAlert isLocked={scope.isLocked} />
          {statusMessages.length > 0 && (
            <InlineAlert title="Trạng thái dữ liệu bếp" variant={statusVariant}>
              <ul className="m-0 list-disc space-y-1 pl-5">{statusMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
            </InlineAlert>
          )}
        </>
      )}
    >
      <div className="ipc-operational-view">
        {feedback && <InlineAlert title={feedback.title} variant={feedback.variant}>{feedback.message}</InlineAlert>}
        <ViewSwitcher
          compact
          ariaLabel="Chọn góc nhìn bếp trưởng"
          tabs={[{ id: 'chef-production', label: 'Ca sản xuất' }, { id: 'chef-documents', label: 'Chứng từ bếp' }]}
          activeTab={activeView === 'production' ? 'chef-production' : 'chef-documents'}
          onTabChange={(id) => setActiveView(id === 'chef-production' ? 'production' : 'documents')}
        />
        {activeView === 'production' && (
          <div id="chef-production-panel" role="tabpanel" aria-labelledby="chef-production-tab">
            <ChefProductionSection lines={production.dailyPlanLines} isSending={production.isSendingDailyPlan} onReceivePlan={production.receiveDailyPlan} />
            <KitchenReceiptSection
              productionPlan={production.productionPlan}
              returns={exceptions.activeReturns}
              isSubmittingSupplemental={exceptions.isSubmittingSupplemental}
              onSupplementalRequest={exceptions.requestSupplemental}
              onExcessMaterialReturn={exceptions.recordReturn}
              onMaterialSignoff={signOffMaterial}
              receiptPage={receipts.page}
              receiptPageSize={receipts.pageSize}
              receiptTotalCount={receipts.totalCount}
              onReceiptPageChange={receipts.setPage}
            />
          </div>
        )}
        {activeView === 'documents' && <ChefDocumentsSection movements={journal.kitchenMovements} documents={journal.returnDocuments} />}
      </div>
    </OperationalFrame>
  )
}

type ShiftControlsProps = {
  activeDay: string
  activeShift: ShiftType
  onDayChange: (day: string) => void
  onShiftChange: (shift: ShiftType) => void
}

function ShiftControls({ activeDay, activeShift, onDayChange, onShiftChange }: ShiftControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-600"><Calendar className="size-4 text-blue-600" /><span className="font-semibold text-slate-700">Lệnh sản xuất bếp nấu</span></div>
      <div className="flex items-center gap-2">
        <select aria-label="Chọn ngày sản xuất" value={activeDay} onChange={(event) => onDayChange(event.target.value)} className="ipc-select min-h-8 w-28 cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          {DAYS_OF_WEEK.map((day) => <option key={day.key} value={day.key}>{day.label}</option>)}
        </select>
        <select aria-label="Chọn ca sản xuất" value={activeShift} onChange={(event) => onShiftChange(event.target.value as ShiftType)} className="ipc-select min-h-8 w-28 cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          {SHIFTS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
        </select>
      </div>
    </div>
  )
}

function ShiftAlert({ isLocked }: { isLocked: boolean }) {
  return isLocked ? (
    <InlineAlert title="Lệnh sản xuất chính thức" icon={<ShieldCheck className="size-4" />} variant="info">Ca này đã chốt. Bếp nhận nguyên liệu, ký nhận và nấu theo kế hoạch sản xuất.</InlineAlert>
  ) : (
    <InlineAlert title="Bản dự thảo từ điều phối" icon={<ShieldAlert className="size-4" />} variant="warning">Chưa chốt ca. Bếp chỉ xem trước kế hoạch sản xuất, chưa xác nhận nhận nguyên liệu.</InlineAlert>
  )
}
