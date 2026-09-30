import { lazy, Suspense, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { ConfirmDialog, EmptyState, OperationalFrame, RefreshStatus, StatusBadge } from '@/components/common'
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary'
import { typography } from '@/lib/typography'
import type { CoordinationCustomerOption } from '@/api/coordinationApi'
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import { ImportedLayoutMatrix } from '../../components/ImportedLayoutMatrix'
import type { WeeklyMenuReadiness as Readiness } from '../model/readiness'
import { WeeklyMenuReadiness } from '../shell/WeeklyMenuReadiness'
import type { WeeklyMenuImportWorkflow } from '../import/useWeeklyMenuImport'
import type { QuickServingRow, WeeklyMenuScope, WeeklyScheduleEditorWorkflow } from './types'
import { WeeklyScheduleCommandBar } from './WeeklyScheduleCommandBar'

const WeeklyMenuImportDialog = lazy(() => import('../import/WeeklyMenuImportDialog').then(({ WeeklyMenuImportDialog }) => ({ default: WeeklyMenuImportDialog })))
const WeeklyScheduleEditorDialog = lazy(() => import('./WeeklyScheduleEditorDialog').then(({ WeeklyScheduleEditorDialog }) => ({ default: WeeklyScheduleEditorDialog })))

type Props = {
  description: string
  customers: CoordinationCustomerOption[]
  selectedCustomerId: string
  weekStartDate: string
  selectedWeekLabel: string
  pricing?: ReactNode
  isCustomerLoading: boolean
  isImporting: boolean
  canPublish: boolean
  isPublishing: boolean
  onEdit: () => void
  onImport: () => void
  onPublish: () => void
  onCustomerChange: (customerId: string) => void
  onWeekChange: (weekStartDate: string) => void
  navigation: ReactNode
  queries: QueryViewEntry[]
  readiness: Readiness
  showReadiness: boolean
  alerts: ReactNode
  importWorkflow: WeeklyMenuImportWorkflow
  scheduleWorkflow: WeeklyScheduleEditorWorkflow
  showImportDialog: boolean
  showEditorDialog: boolean
  servingRows: QuickServingRow[]
  layoutRows: ImportedLayoutRow[]
  isDialogLoading: boolean
  pendingCloseKind: 'import' | 'editor' | null
  onPendingCloseChange: (open: boolean) => void
  onConfirmPendingClose: () => void
  scope: WeeklyMenuScope
  hasCommittedWeek: boolean
  dishNamesById: ReadonlyMap<string, string>
  isViewPending: boolean
}

export function WeeklyScheduleWorkspace({
  description,
  customers,
  selectedCustomerId,
  weekStartDate,
  selectedWeekLabel,
  pricing,
  isCustomerLoading,
  isImporting,
  canPublish,
  isPublishing,
  onEdit,
  onImport,
  onPublish,
  onCustomerChange,
  onWeekChange,
  navigation,
  queries,
  readiness,
  showReadiness,
  alerts,
  importWorkflow,
  scheduleWorkflow,
  showImportDialog,
  showEditorDialog,
  servingRows,
  layoutRows,
  isDialogLoading,
  pendingCloseKind,
  onPendingCloseChange,
  onConfirmPendingClose,
  scope,
  hasCommittedWeek,
  dishNamesById,
  isViewPending,
}: Props) {
  return (
    <OperationalFrame
      eyebrow="Kế hoạch & Điều phối"
      title="Kế hoạch tuần"
      description={description}
      command={<WeeklyScheduleCommandBar
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        weekStartDate={weekStartDate}
        pricing={pricing}
        isCustomerLoading={isCustomerLoading}
        isImporting={isImporting}
        canPublish={canPublish}
        isPublishing={isPublishing}
        onEdit={onEdit}
        onImport={onImport}
        onPublish={onPublish}
        onCustomerChange={onCustomerChange}
        onWeekChange={onWeekChange}
      />}
      context={showReadiness ? <WeeklyMenuReadiness readiness={readiness} /> : undefined}
    >
      {navigation}
      <QueryViewBoundary preserveFallback queries={queries} refreshLabel="Đang cập nhật kế hoạch tuần">
        {alerts}
        {showImportDialog && <Suspense fallback={null}><WeeklyMenuImportDialog workflow={importWorkflow} /></Suspense>}
        {showEditorDialog && <Suspense fallback={null}><WeeklyScheduleEditorDialog workflow={scheduleWorkflow} servingRows={servingRows} layoutRows={layoutRows} isLoading={isDialogLoading} /></Suspense>}
        <ConfirmDialog
          open={pendingCloseKind !== null}
          title="Rời khỏi thay đổi chưa lưu?"
          description={pendingCloseKind === 'import'
            ? 'Các file và thông tin nhập thực đơn chưa lưu sẽ bị bỏ.'
            : 'Các thay đổi lịch tuần và số suất chưa lưu sẽ bị bỏ.'}
          confirmLabel="Rời khỏi"
          variant="destructive"
          onOpenChange={onPendingCloseChange}
          onConfirm={onConfirmPendingClose}
        />
        <div data-weekly-menu-work-surface="true" className={`${typography.body} relative`} aria-busy={isViewPending} aria-live="polite">
          {isViewPending && <RefreshStatus>Đang cập nhật</RefreshStatus>}
          <div id="schedule-panel" role="tabpanel" aria-labelledby="schedule-tab">
          <section aria-labelledby="weekly-schedule-matrix-title" className="overflow-hidden rounded-[3px] border border-slate-300 bg-white">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-slate-900">
                  <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-slate-600" />
                  <h2 id="weekly-schedule-matrix-title" className="text-base font-bold leading-5">Ma trận thực đơn tuần</h2>
                </div>
                <p className="mt-1 text-sm text-slate-600">Theo dõi món ăn theo ngày, ca và nhóm phục vụ trong phạm vi đã chọn.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
                <span className="text-slate-600"><strong className="font-semibold text-slate-900">Khách hàng:</strong> {scope.customerLabel}</span>
                <span className="text-slate-600"><strong className="font-semibold text-slate-900">Tuần:</strong> {selectedWeekLabel}</span>
                {layoutRows.length > 0 && !scope.activeDayKey && <StatusBadge variant="warning">{scope.activeServiceLabel}</StatusBadge>}
              </div>
            </header>
            {layoutRows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  variant="uncreated"
                  title="Chưa có thực đơn cho tuần đã chọn"
                  description={hasCommittedWeek
                    ? 'Chưa có dòng thực đơn trong phiên bản tuần này.'
                    : 'Nhập Excel hoặc chỉnh sửa lịch tuần để bắt đầu.'}
                />
              </div>
            ) : (
              <ImportedLayoutMatrix rows={layoutRows} displayDays={scope.displayDays} activeDayKey={scope.activeDayKey} dishNamesById={dishNamesById} fixedHeader stickyHeader={false} />
            )}
          </section>
          </div>
        </div>
      </QueryViewBoundary>
    </OperationalFrame>
  )
}
