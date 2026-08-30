import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, SectionPanel } from '@/components/common'
import { Textarea } from '@/components/ui/textarea'
import {
  useGetSystemOperationModeQuery,
  useChangeSystemOperationModeMutation,
} from '@/features/system-operation/systemOperationApi'

export function SystemOperationModeSettings() {
  const { data, isError, refetch } = useGetSystemOperationModeQuery()
  const [change, { isLoading }] = useChangeSystemOperationModeMutation()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between" role="alert">
        <span>Không tải được cấu hình chế độ vận hành.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }

  if (!data) return null

  const targetMode = data.mode === 'DEFAULT' ? 'MATERIAL_RECONCILIATION' : 'DEFAULT'
  const targetLabel = targetMode === 'MATERIAL_RECONCILIATION' ? 'Đối chiếu nguyên liệu' : 'Mặc định'
  const buttonLabel = `Chuyển sang chế độ ${targetLabel}`
  const reasonInvalid = data.reasonRequired && !reason.trim()

  const handleConfirmChange = async () => {
    if (reasonInvalid) return
    setError(undefined)
    try {
      await change({
        mode: targetMode,
        expectedVersion: data.version,
        confirmed: true,
        reason: reason.trim() || `Quản trị viên chuyển sang chế độ ${targetLabel}`,
      }).unwrap()
      setIsConfirmOpen(false)
      setReason('')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'data' in err) {
        const dataErr = (err as { data?: { message?: string } }).data
        setError(dataErr?.message || 'Không thể thay đổi chế độ vận hành.')
      } else {
        setError('Có lỗi xảy ra khi đổi chế độ vận hành.')
      }
    }
  }

  return (
    <SectionPanel
      title="Chế độ vận hành toàn hệ thống"
      icon={<SlidersHorizontal size={18} />}
      description="Chỉ Quản trị viên được phép thay đổi. Toàn bộ người dùng trong hệ thống sẽ áp dụng đồng thời chế độ này từ máy chủ."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chế độ hiện tại:</span>
              <span className="font-semibold text-slate-900">{data.label}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Phiên bản cấu hình: {data.version}</p>
          </div>
          <Button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setError(undefined)
              setIsConfirmOpen(true)
            }}
          >
            {buttonLabel}
          </Button>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <ConfirmDialog
          open={isConfirmOpen}
          title={`Xác nhận chuyển sang chế độ "${targetLabel}"?`}
          description={
            targetMode === 'MATERIAL_RECONCILIATION'
              ? 'Hệ thống sẽ chuyển sang nhánh đối chiếu nguyên liệu độc lập. Các tính năng điều phối, ca sản xuất và xuất nhập kho đầy đủ sẽ tạm ẩn.'
              : 'Hệ thống sẽ trở về chế độ vận hành đầy đủ (đầy đủ các tính năng lập kế hoạch, xuất nhập kho và điều phối ca).'
          }
          confirmLabel={isLoading ? 'Đang chuyển...' : 'Xác nhận chuyển chế độ'}
          busy={isLoading}
          onConfirm={() => void handleConfirmChange()}
          onOpenChange={setIsConfirmOpen}
        >
          {data.reasonRequired && (
            <div className="mt-4 space-y-1.5 text-left">
              <label className="block text-sm font-medium text-slate-700">
                Lý do thay đổi <span className="text-red-500">* (Đang có lô đối chiếu chưa hoàn tất)</span>
              </label>
              <Textarea
                className="w-full text-sm"
                placeholder="Nhập lý do chuyển chế độ vận hành..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reasonInvalid}
                autoFocus
              />
            </div>
          )}
        </ConfirmDialog>
      </div>
    </SectionPanel>
  )
}
