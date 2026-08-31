import { CheckCircle2, Layers3, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { SectionPanel, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useGetSystemOperationModeQuery, useChangeSystemOperationModeMutation } from '@/api/systemOperationApi'
import type { SystemOperationMode } from '@/lib/systemOperationEligibility'

const modes: ReadonlyArray<{
  id: SystemOperationMode
  label: string
  summary: string
  icon: typeof Layers3
}> = [
  { id: 'DEFAULT', label: 'Vận hành đầy đủ', summary: 'Toàn bộ quy trình nghiệp vụ', icon: Layers3 },
  { id: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', summary: 'Kế hoạch · Kho · Đối chiếu', icon: RefreshCw },
]

export function SystemOperationModeSettings() {
  const { data, isError } = useGetSystemOperationModeQuery()
  const [change, { isLoading }] = useChangeSystemOperationModeMutation()

  if (isError) return <p role="alert">Không tải được chế độ vận hành. Vui lòng thử lại.</p>
  if (!data) return null

  const switchMode = (mode: SystemOperationMode) => {
    if (mode === data.mode) return
    void change({
      mode,
      expectedVersion: data.version,
      confirmed: true,
      reason: data.reasonRequired ? 'Thay đổi được quản trị viên xác nhận trong Thiết lập nâng cao' : undefined,
    })
  }

  return (
    <SectionPanel
      title="Chế độ vận hành"
      icon={<SlidersHorizontal size={18} />}
      badge={<StatusBadge variant="neutral">Phiên bản {data.version}</StatusBadge>}
    >
      <div className="grid gap-3 md:grid-cols-2" role="group" aria-label="Chọn chế độ vận hành toàn hệ thống">
        {modes.map((mode) => {
          const active = mode.id === data.mode
          const Icon = mode.icon
          return (
            <div
              key={mode.id}
              data-operation-mode={mode.id}
              data-active={active || undefined}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-md border p-3 transition-colors',
                active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-bold text-slate-900">{mode.label}</strong>
                <span className="mt-0.5 block text-xs text-slate-600">{mode.summary}</span>
              </span>
              {active ? (
                <StatusBadge variant="success"><CheckCircle2 size={14} /> Đang dùng</StatusBadge>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => switchMode(mode.id)}>
                  Chuyển sang
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </SectionPanel>
  )
}
