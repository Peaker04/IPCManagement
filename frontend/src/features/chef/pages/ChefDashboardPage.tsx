'use client'

import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { CommandBar, InlineAlert, KeepAliveTabPanel, OperationalFrame, TabContentSkeleton, ViewSwitcher, RefreshStatus } from '@/components/common';
import { ROUTES } from '@/lib/routeConfig'
import { useCoordinationStoreSelector } from '@/lib/coordinationStore'
import type { ShiftType } from '@/types/coordination'
import { getBangkokToday } from '@/lib/chefServiceDate'
import { getDayCodeFromIsoDate } from '@/lib/dateUtils'
import { useChefExceptions } from '../exceptions/useChefExceptions'
import { ChefHeader } from '../components/chef-header'
import { useChefJournal } from '../journal/useChefJournal'
import { useChefProductionPlan, type ChefFeedback, type ChefShiftScope } from '../production/useChefProductionPlan'
import { useKitchenReceipts } from '../receipts/useKitchenReceipts'
import { ChefQueryBoundary } from '../ChefQueryBoundary'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'
import { resolveVisibleTabId, visibleTabIds } from '@/lib/navigationPreferences'

import { ChefShiftControls } from './ChefShiftControls'
const ChefProductionSection = lazy(() => import('../production/ChefProductionSection').then(({ ChefProductionSection: component }) => ({ default: component })))
const ServiceRunSection = lazy(() => import('../production/ServiceRunSection').then(({ ServiceRunSection: component }) => ({ default: component })))
const KitchenReceiptSection = lazy(() => import('../receipts/KitchenReceiptSection').then(({ KitchenReceiptSection: component }) => ({ default: component })))
const ChefDocumentsSection = lazy(() => import('../journal/ChefDocumentsSection').then(({ ChefDocumentsSection: component }) => ({ default: component })))
const chefCapabilityFallback = <TabContentSkeleton geometry="section" columns={6} rows={6} message="Đang tải dữ liệu bếp trưởng..." />

export default function ChefDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lockedShifts = useCoordinationStoreSelector((state) => state.coordination.lockedShifts)
  const [serviceDate, setServiceDate] = useState<string>(() => getBangkokToday())
  const activeDay = getDayCodeFromIsoDate(serviceDate)
  const [activeShift, setActiveShift] = useState<ShiftType>('Ca Sáng')
  const chefTabIds = visibleTabIds('chef') as Array<'production' | 'documents'>
  const requestedChefView = searchParams.get('view')
  const selectedView = resolveVisibleTabId(requestedChefView, chefTabIds, 'production')
  const activeView = useDeferredValue(selectedView)
  const selectChefView = (view: 'production' | 'documents') => {
    const next = new URLSearchParams(searchParams)
    next.set('view', view)
    setSearchParams(next, { replace: true })
  }
  const [feedback, setFeedback] = useState<ChefFeedback | null>(null)
  const isProductionView = activeView === 'production'
  const productionTask = searchParams.get('task') === 'materials' ? 'materials' : 'run'
  const selectProductionTask = (task: 'run' | 'materials') => {
    const next = new URLSearchParams(searchParams)
    if (task === 'run') next.delete('task')
    else next.set('task', task)
    setSearchParams(next, { replace: true })
  }
  const isViewPending = selectedView !== activeView
  const lockKey = `${activeDay}-${activeShift}`
  const scope = useMemo<ChefShiftScope>(() => ({
    activeDay,
    activeShift,
    serviceDate,
    apiShiftName: activeShift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON',
    isLocked: Boolean(lockedShifts[lockKey]),
  }), [activeDay, activeShift, lockedShifts, lockKey, serviceDate])

  const receipts = useKitchenReceipts(scope, setFeedback, isProductionView)
  // The checklist must render the paged receipt query. The action query remains wide
  // for mutations, but feeding it here made every page render the same 500-row slice.
  const production = useChefProductionPlan(scope, receipts.rows, receipts.signedMaterials, isProductionView)
  const exceptions = useChefExceptions(scope, production.productionPlan, receipts.actionRows, setFeedback, isProductionView)
  const journal = useChefJournal(scope, !isProductionView)
  const statusMessages = [
    production.status.isCatalogEmpty ? 'Danh mục món ăn đang trống nên danh sách nguyên liệu chưa thể sinh đầy đủ từ định lượng.' : null,
    ...production.dailyPlanWarnings
      .filter((warning) => warning !== 'Có kế hoạch chưa gửi bếp.' && (production.productionPlan.totalMeals > 0 || !warning.toLocaleLowerCase('vi-VN').includes('khsx')))
      .map((warning) => {
        if (warning.startsWith('KHSX có nhu cầu mua ban đầu;')) {
          return 'Chưa thể cấp nguyên liệu. Kế hoạch mua nguyên liệu cho ca này chưa hoàn tất.'
        }
        return warning
      }),
    receipts.isConfirming ? 'Đang ghi nhận ký nhận nguyên liệu.' : null,
    exceptions.isCreatingReturn ? 'Đang tạo phiếu trả kho và cập nhật sổ kho.' : null,
  ].filter((message): message is string => Boolean(message))
  const statusVariant = production.status.isCatalogEmpty || production.dailyPlanWarnings.length > 0 ? 'warning' : 'info'

  const signOffMaterial = async (materialId: string, signed: boolean, hasDiscrepancy = false, discrepancyNote?: string) => receipts.signOff(
    production.productionPlan.receivedMaterials.find((material) => material.id === materialId),
    signed,
    hasDiscrepancy,
    discrepancyNote,
  )

  return (
    <OperationalFrame
      command={<CommandBar><ChefShiftControls serviceDate={serviceDate} activeShift={activeShift} onDateChange={setServiceDate} onShiftChange={setActiveShift} /></CommandBar>}
      context={<ShiftAlert isLocked={production.isLocked} hasPlan={production.productionPlan.totalMeals > 0} />}
    >
      <div className={cn(typography.body, 'ipc-operational-view')}>
        {feedback && <InlineAlert title={feedback.title} variant={feedback.variant}>{feedback.message}</InlineAlert>}
        <ViewSwitcher
          compact
          ariaLabel="Chọn góc nhìn bếp trưởng"
          isPending={isViewPending}
          tabs={[{ id: 'chef-production', label: 'Ca sản xuất' }, { id: 'chef-documents', label: 'Chứng từ bếp' }].filter((tab) => chefTabIds.includes(tab.id.replace('chef-', '') as 'production' | 'documents'))}
          activeTab={selectedView === 'production' ? 'chef-production' : 'chef-documents'}
          onTabChange={(id) => selectChefView(id === 'chef-production' ? 'production' : 'documents')}
        />
        <div className="relative min-h-[420px]" aria-busy={isViewPending} aria-live="polite">
          {isViewPending && (
            <RefreshStatus>Đang cập nhật</RefreshStatus>
          )}
          <KeepAliveTabPanel id="chef-production" active={isProductionView} className="space-y-4">
            <ChefQueryBoundary preserveFallback stabilizeInitialLoad queries={[
              { label: 'danh mục món và BOM', view: production.queryViews.catalog },
              { label: 'kế hoạch sản xuất trong ngày', view: production.queryViews.dailyPlan },
              { label: 'phiếu xuất kho bàn giao cho bếp', view: receipts.queryView },
              { label: 'nguyên liệu có thể thao tác trong ca', view: receipts.actionQueryView },
              { label: 'phiếu trả kho của ca', view: exceptions.queryView },
            ]}>
              <ChefHeader productionPlan={production.productionPlan} />
              <Suspense fallback={chefCapabilityFallback}>
                <ChefProductionSection
                lines={production.dailyPlanLines}
                isLoading={production.status.isDailyPlanLoading}
                isError={production.status.isDailyPlanError}
                totalPlans={production.dailyPlan?.totalPlans ?? 0}
                sentPlans={production.dailyPlan?.sentPlans ?? 0}
                />
              </Suspense>
              <ViewSwitcher
                compact
                ariaLabel="Chọn tác vụ ca sản xuất"
                tabs={[
                  { id: 'chef-task-run', label: 'Thực hiện ca' },
                  { id: 'chef-task-materials', label: 'Nhận & xử lý vật tư' },
                ]}
                activeTab={`chef-task-${productionTask}`}
                onTabChange={(id) => selectProductionTask(id === 'chef-task-materials' ? 'materials' : 'run')}
              />
              {productionTask === 'run' ? (
                <Suspense fallback={chefCapabilityFallback}>
                  <ServiceRunSection plans={production.dailyPlan?.plans ?? []} shiftName={scope.apiShiftName} />
                </Suspense>
              ) : (
                <Suspense fallback={chefCapabilityFallback}>
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
                  receiptTotalSignedCount={receipts.totalSignedCount}
                  receiptActionRowCount={receipts.actionRowCount}
                    onReceiptPageChange={receipts.setPage}
                  />
                </Suspense>
              )}
            </ChefQueryBoundary>
          </KeepAliveTabPanel>

          <KeepAliveTabPanel id="chef-documents" active={!isProductionView}>
            <ChefQueryBoundary queries={[
              { label: 'chứng từ bếp', view: journal.queryViews.documents },
              { label: 'luân chuyển kho của bếp', view: journal.queryViews.movements },
            ]}>
              <Suspense fallback={chefCapabilityFallback}>
                <ChefDocumentsSection
                  movements={journal.kitchenMovements}
                  documents={journal.returnDocuments}
                />
              </Suspense>
            </ChefQueryBoundary>
          </KeepAliveTabPanel>
        </div>
        {statusMessages.length > 0 && (
          <InlineAlert title="Trạng thái dữ liệu bếp" variant={statusVariant}>
            <ul className="m-0 list-disc space-y-1 pl-5">{statusMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
          </InlineAlert>
        )}
      </div>
    </OperationalFrame>
  )
}

function ShiftAlert({ isLocked, hasPlan }: { isLocked: boolean; hasPlan: boolean }) {
  if (!hasPlan) return null
  return isLocked ? (
    <InlineAlert title="Lệnh sản xuất chính thức" icon={<ShieldCheck className="size-4" />} variant="info">Ca này đã chốt. Bếp nhận nguyên liệu, ký nhận và nấu theo kế hoạch sản xuất.</InlineAlert>
  ) : (
    <InlineAlert
      title="Kế hoạch điều phối chưa chốt"
      icon={<ShieldAlert className="size-4" />}
      variant="warning"
      action={<Link to={ROUTES.MEAL_ORDERS} className="ipc-button ipc-button-secondary text-xs">Xem kế hoạch điều phối</Link>}
    >
      Bếp có thể xem trước kế hoạch. Trạng thái nhận nguyên liệu được xác định riêng trong Checklist nhận nguyên liệu.
    </InlineAlert>
  )
}
