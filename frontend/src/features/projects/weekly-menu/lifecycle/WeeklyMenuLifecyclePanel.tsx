import { useMemo, useState } from 'react'
import { Check, CircleDot, FileSpreadsheet, Send } from 'lucide-react'
import { InlineAlert, SectionPanel, StatusBadge } from '@/components/common'
import { useUpdateMenuScheduleVersionMutation } from '@/api/coordinationApi'
import type { MealQuantityPlanDto, MenuScheduleDto } from '@/types/coordination'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { getApiErrorMessage } from '../model/formatters'
import { buildWeeklyMenuLifecycleModel } from './weeklyMenuLifecycleModel'

type WeeklyMenuLifecyclePanelProps = {
  schedules: readonly MenuScheduleDto[]
  quantityPlans: readonly MealQuantityPlanDto[]
  demandLineCount: number
  shortageCount: number
  isDemandLoading: boolean
  hasDemandError: boolean
}

const formatPublishedAt = (value?: string | null) => {
  if (!value) return 'Chưa phát hành'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('vi-VN', { hour12: false })
}

export function WeeklyMenuLifecyclePanel({
  schedules,
  quantityPlans,
  demandLineCount,
  shortageCount,
  isDemandLoading,
  hasDemandError,
}: WeeklyMenuLifecyclePanelProps) {
  const lifecycle = useMemo(
    () => buildWeeklyMenuLifecycleModel(schedules, quantityPlans, {
      lineCount: demandLineCount,
      shortageCount,
      isLoading: isDemandLoading,
      isError: hasDemandError,
    }),
    [demandLineCount, hasDemandError, isDemandLoading, quantityPlans, schedules, shortageCount],
  )
  const [updateVersion, updateState] = useUpdateMenuScheduleVersionMutation()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const status = getWorkflowStatusPresentation(lifecycle.status)

  const publish = async () => {
    if (!lifecycle.canPublish || !lifecycle.publishScheduleId || updateState.isLoading) return
    setFeedback(null)
    try {
      await updateVersion({
        menuScheduleId: lifecycle.publishScheduleId,
        body: {
          status: 'ACTIVE',
          reason: 'Phát hành từ màn hình Kế hoạch tuần để bắt đầu lifecycle vận hành.',
        },
      }).unwrap()
      setFeedback({ type: 'success', message: 'Đã phát hành version thực đơn. Có thể nhập và chốt số suất theo ca.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể phát hành version thực đơn. Vui lòng kiểm tra trạng thái trên server.'),
      })
    }
  }

  return (
    <SectionPanel
      title="Lifecycle thực đơn tuần"
      icon={<CircleDot size={18} aria-hidden="true" />}
      badge={<StatusBadge variant={status.tone}>{status.label}</StatusBadge>}
      description="Điều phối trực tiếp từ version thực đơn đến số suất và nhu cầu vật tư; trạng thái được đọc lại từ backend sau mỗi thao tác."
      className="mb-4"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">1. File và version</span>
          <strong className="mt-1 block text-sm text-slate-800">
            {lifecycle.scheduleCount > 0 ? `Version ${lifecycle.versionNo ?? 'mới'} · ${lifecycle.scheduleCount} lịch/ca` : 'Chưa có dữ liệu'}
          </strong>
          <small className="mt-1 block break-all text-xs text-slate-500">
            {lifecycle.sourceImportBatch ? `Batch ${lifecycle.sourceImportBatch}` : 'Chưa có batch import'}
          </small>
        </div>
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">2. Phát hành</span>
          <strong className="mt-1 block text-sm text-slate-800">{formatPublishedAt(lifecycle.publishedAt)}</strong>
          <small className="mt-1 block break-all text-xs text-slate-500">
            {lifecycle.publishedBy ? `Người phát hành: ${lifecycle.publishedBy}` : 'Chưa ghi nhận người phát hành'}
          </small>
        </div>
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">3. Số suất</span>
          <strong className="mt-1 block text-sm text-slate-800">
            {lifecycle.completedPlanCount}/{lifecycle.expectedPlanCount} lịch/ca đã chốt
          </strong>
          <small className="mt-1 block text-xs text-slate-500">Tiếp theo: {lifecycle.nextAction}</small>
        </div>
        <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">4. Nhu cầu theo ngày</span>
          <strong className="mt-1 block text-sm text-slate-800">
            {lifecycle.demandState === 'loading'
              ? 'Đang đối chiếu'
              : lifecycle.demandState === 'error'
                ? 'Không tải được'
                : lifecycle.demandState === 'generated'
                  ? `${lifecycle.demandLineCount} dòng ngày–nguyên liệu`
                  : 'Chưa sinh nhu cầu'}
          </strong>
          <small className="mt-1 block text-xs text-slate-500">
            {lifecycle.demandState === 'generated'
              ? `${lifecycle.shortageCount} dòng thiếu cần Thu mua xử lý`
              : lifecycle.nextAction}
          </small>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <div className="flex min-w-[190px] items-stretch">
          <button
            type="button"
            className="ipc-button ipc-button-primary w-full justify-center whitespace-nowrap"
            disabled={!lifecycle.canPublish || updateState.isLoading}
            title={lifecycle.blockedReason}
            onClick={() => void publish()}
          >
            {lifecycle.phase === 'active' ? <Check size={16} /> : lifecycle.phase === 'empty' ? <FileSpreadsheet size={16} /> : <Send size={16} />}
            {updateState.isLoading ? 'Đang phát hành...' : lifecycle.phase === 'active' ? 'Đã phát hành' : 'Phát hành thực đơn'}
          </button>
        </div>
      </div>

      {lifecycle.blockedReason && (
        <InlineAlert className="mt-3" variant={lifecycle.phase === 'empty' ? 'info' : 'warning'} title="Lifecycle chưa thể tiếp tục">
          {lifecycle.blockedReason}
        </InlineAlert>
      )}
      {feedback && (
        <InlineAlert className="mt-3" variant={feedback.type === 'error' ? 'danger' : 'info'} title={feedback.type === 'error' ? 'Phát hành thất bại' : 'Đã cập nhật lifecycle'}>
          {feedback.message}
        </InlineAlert>
      )}
    </SectionPanel>
  )
}
