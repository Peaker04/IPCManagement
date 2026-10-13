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
  description: _description,
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
  void _description
  return (
    <OperationalFrame
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
          <section aria-labelledby="weekly-schedule-matrix-title" className="overflow-hidden rounded-[var(--ipc-radius-md,3px)] border border-[var(--ipc-color-border-muted,#d8e2ef)] bg-white">
            <header className="flex min-h-[48px] flex-wrap items-center justify-between gap-3 border-b border-[var(--ipc-color-border-subtle,#e2eaf4)] bg-white px-4 py-1.5">
              <div className="flex min-w-0 items-center gap-2 text-slate-900">
                <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-[var(--ipc-primary,#1a56a8)]" />
                <h2 id="weekly-schedule-matrix-title" className="ipc-section-title font-bold leading-5 text-slate-900">Ma trận thực đơn tuần</h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs">
                <span className="text-slate-500">Khách hàng: <strong className="font-semibold text-slate-800">{scope.customerLabel}</strong></span>
                <span className="text-slate-300" aria-hidden="true">|</span>
                {layoutRows.length > 0 && !scope.activeDayKey ? (
                  <>
                    <span className="sr-only">{selectedWeekLabel}</span>
                    <StatusBadge variant="neutral">{scope.activeServiceLabel}</StatusBadge>
                  </>
                ) : (
                  <span className="text-slate-500">Tuần: <strong className="font-semibold text-slate-800 tabular-nums">{selectedWeekLabel}</strong></span>
                )}
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
