import { Lock, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { EMPTY_DISH_VALUE } from './scheduleModel'
import { SearchableDishPicker } from './SearchableDishPicker'
import type { QuickServingRow, WeeklyScheduleEditorWorkflow } from './types'

export function WeeklyScheduleEditorDialog({ workflow, servingRows = [] }: { workflow: WeeklyScheduleEditorWorkflow; servingRows?: QuickServingRow[] }) {
  const { scope, state, status, actions, presentation } = workflow
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const hasServingDraft = servingRows.some((row) => row.hasDraftChange)
  const requestClose = () => {
    if (presentation.pendingChangeCount > 0 || hasServingDraft) setConfirmClose(true)
    else actions.closeEditor()
  }
  return (
    <>
    <Dialog open={state.isEditorOpen} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent aria-label="Chỉnh sửa thực đơn tuần" className="ipc-weekly-dialog max-w-5xl overflow-hidden">
        <DialogHeader className="sticky top-0 z-20 flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white/95 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900">Chỉnh sửa Thực đơn tuần (T2 - T7)</DialogTitle>
          <Button type="button" variant="outline" size="sm" onClick={requestClose} aria-label="Đóng modal chỉnh sửa thực đơn" title="Đóng">
            <X size={16} /><span>Đóng</span>
          </Button>
        </DialogHeader>

        <div className="mt-4 flex max-h-[68vh] flex-col gap-6 overflow-y-auto pr-1">
          {servingRows.length > 0 && (
            <section aria-labelledby="weekly-editor-servings">
              <h3 id="weekly-editor-servings" className="mb-3 rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold uppercase text-slate-800">Số suất theo ngày và ca</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {servingRows.map((row) => (
                  <div key={row.key} className="grid min-w-0 gap-2 rounded-sm border border-slate-200 p-2">
                    <div className="flex min-w-0 items-start justify-between gap-2"><strong className="text-xs text-slate-800">{row.dayLabel} · {row.shiftLabel}</strong><span className="shrink-0 text-xs text-slate-500">{row.date}</span></div>
                    <label className="grid min-w-0 gap-1 text-xs text-slate-600">Số suất<input aria-label={`Số suất ${row.dayLabel} ${row.shiftLabel}`} type="number" min="0" step="1" inputMode="numeric" value={row.inputValue} onChange={(event) => actions.changeQuickServing(row.key, event.target.value)} className="h-9 min-w-0 w-full rounded-sm border border-slate-300 px-2 text-right tabular-nums" /></label>
                    {row.isConfirmed && !row.hasDraftChange ? <span className="text-xs font-medium text-emerald-700">Đã hoàn tất</span> : <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant="outline" disabled={!row.hasDraftChange || status.isSavingQuickServings} onClick={() => void actions.saveQuickServing(row)}>Lưu nháp</Button><Button type="button" size="sm" disabled={status.isSavingQuickServings} onClick={() => void actions.completeQuickServing(row)}>Hoàn tất</Button></div>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-600">Số suất thuộc từng ngày và ca. Bạn có thể chỉnh lại trước khi tạo và khóa lô định lượng.</p>
            </section>
          )}
          {presentation.sections.map((section) => (
            <div key={section.label} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
              <h3 className="mb-3 rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold uppercase text-slate-800">{section.label}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {scope.displayDays.map((day) => {
                  const locked = presentation.isLocked(day.key, section.slotType)
                  const slot = state.draftMenu[day.key]?.[section.slotType]
                  const selectedDishId = slot?.dishId || section.defaultDishId || EMPTY_DISH_VALUE
                  const pickerOptions = selectedDishId && selectedDishId !== EMPTY_DISH_VALUE && !section.dishes.some((dish) => dish.id === selectedDishId)
                    ? [{ id: selectedDishId, name: presentation.getDishName(selectedDishId) ?? 'Món hiện tại', code: '', bomReady: false }, ...section.dishes]
                    : section.dishes
                  return (
                    <div key={day.key} className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="flex flex-col"><span className="text-xs font-semibold text-slate-700">{day.label}</span><span className="text-xs text-slate-500">{day.date}</span></div>
                      <SearchableDishPicker
                        value={selectedDishId === EMPTY_DISH_VALUE ? '' : selectedDishId}
                        options={pickerOptions}
                        label={`Tìm món cho ${day.label}, ${section.label}`}
                        disabled={section.dishes.length === 0}
                        onChange={(value) => actions.changeDish(day.key, section.slotType, value)}
                      />
                      {locked && <span className="flex items-center gap-1 text-caption font-medium text-amber-700"><Lock size={10} />Gửi duyệt thay đổi</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <label className="block text-sm font-medium text-slate-700">Lý do thay đổi lịch đã khóa<Textarea ref={reasonRef} className="mt-1 min-h-16" placeholder="Bắt buộc khi thay đổi ca đã khóa; quản lý sẽ hậu kiểm." /></label>

        <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <span className="mr-auto self-center text-sm text-slate-600">
            {presentation.pendingChangeCount > 0
              ? `${presentation.pendingChangeCount} thay đổi đang chờ lưu`
              : 'Chưa có thay đổi'}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={requestClose}>Hủy</Button>
          <Button type="button" size="sm" onClick={() => void actions.saveEditor(reasonRef.current?.value)} disabled={status.isSavingMenu || presentation.pendingChangeCount === 0}>
            {status.isSavingMenu ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={confirmClose}
      title="Bỏ các thay đổi chưa lưu?"
      description="Các món hoặc số suất đang chỉnh sẽ không được lưu."
      confirmLabel="Bỏ thay đổi"
      onConfirm={() => { setConfirmClose(false); actions.closeEditor() }}
      onOpenChange={setConfirmClose}
    />
    </>
  )
}
