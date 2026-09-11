import { Lock, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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
  const hasServings = servingRows.length > 0
  const hasSections = presentation.sections.length > 0
  const completedServingsCount = servingRows.filter((row) => row.isConfirmed && !row.hasDraftChange).length
  const [editorTab, setEditorTab] = useState<'dishes' | 'servings'>(() => hasSections ? 'dishes' : 'servings')

  return (
    <>
    <Dialog open={state.isEditorOpen} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent aria-label="Chỉnh sửa thực đơn tuần" className="ipc-weekly-dialog max-w-5xl !p-0 !overflow-hidden flex flex-col h-[85vh] max-h-[85vh]">
        {/* Fixed Header: Edge-to-edge, flush at top with zero gap */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shrink-0">
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">Chỉnh sửa Thực đơn tuần (T2 - T7)</DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">{scope.customerLabel} · Tuần {scope.weekLabel}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={requestClose} aria-label="Đóng modal chỉnh sửa thực đơn" title="Đóng">
            <X size={16} /><span>Đóng</span>
          </Button>
        </DialogHeader>

        {/* Minimal Tabs: Edge-to-edge, no emojis, clean Fiori underline tabs */}
        {hasServings && hasSections && (
          <div role="tablist" aria-label="Chế độ chỉnh sửa" className="flex border-b border-slate-200 bg-slate-50/80 px-6 shrink-0 gap-6">
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'dishes'}
              className={cn(
                'border-b-2 py-2.5 text-xs font-semibold transition-colors',
                editorTab === 'dishes'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )}
              onClick={() => setEditorTab('dishes')}
            >
              Thực đơn món (T2 - T7)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'servings'}
              className={cn(
                'border-b-2 py-2.5 text-xs font-semibold transition-colors',
                editorTab === 'servings'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )}
              onClick={() => setEditorTab('servings')}
            >
              Kế hoạch số suất ({completedServingsCount}/{servingRows.length})
            </button>
          </div>
        )}

        {/* Scrollable Body: Single internal scroll, bounded between header and footer */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5 min-h-0">
          {(!hasSections || editorTab === 'servings') && hasServings && (
            <section aria-labelledby="weekly-editor-servings" role="tabpanel" className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 id="weekly-editor-servings" className="text-xs font-bold uppercase tracking-wide text-slate-800">Số suất theo ngày và ca</h3>
                  <p className="text-xs text-slate-500">Điều chỉnh số lượng suất ăn trước khi tạo và khóa lô định lượng.</p>
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {servingRows.map((row) => (
                  <div key={row.key} className="grid min-w-0 gap-2 rounded-sm border border-slate-200 p-2.5 bg-white">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <strong className="text-xs text-slate-800">{row.dayLabel} · {row.shiftLabel}</strong>
                      <span className="shrink-0 text-xs text-slate-500">{row.date}</span>
                    </div>
                    <label className="grid min-w-0 gap-1 text-xs text-slate-600">
                      Số suất
                      <input
                        aria-label={`Số suất ${row.dayLabel} ${row.shiftLabel}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={row.inputValue}
                        onChange={(event) => actions.changeQuickServing(row.key, event.target.value)}
                        className="h-9 min-w-0 w-full rounded-sm border border-slate-300 px-2 text-right tabular-nums text-xs"
                      />
                    </label>
                    {row.isConfirmed && !row.hasDraftChange ? (
                      <span className="text-xs font-medium text-emerald-700">Đã hoàn tất</span>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={!row.hasDraftChange || status.isSavingQuickServings} onClick={() => void actions.saveQuickServing(row)}>
                          Lưu nháp
                        </Button>
                        <Button type="button" size="sm" disabled={status.isSavingQuickServings} onClick={() => void actions.completeQuickServing(row)}>
                          Hoàn tất
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!hasServings || editorTab === 'dishes') && hasSections && (
            <div role="tabpanel" className="flex flex-col gap-5">
              {presentation.sections.map((section) => (
                <div key={section.label} className="flex flex-col gap-2 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50/80 py-1.5 px-3 rounded-sm text-center">
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    {scope.displayDays.map((day) => {
                      const locked = presentation.isLocked(day.key, section.slotType)
                      const slot = state.draftMenu[day.key]?.[section.slotType]
                      const selectedDishId = slot?.dishId || section.defaultDishId || EMPTY_DISH_VALUE
                      const pickerOptions = selectedDishId && selectedDishId !== EMPTY_DISH_VALUE && !section.dishes.some((dish) => dish.id === selectedDishId)
                        ? [{ id: selectedDishId, name: presentation.getDishName(selectedDishId) ?? 'Món hiện tại', code: '', bomReady: false }, ...section.dishes]
                        : section.dishes
                      return (
                        <div key={day.key} className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-xs">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-800">{day.label}</span>
                            <span className="text-caption text-slate-500">{day.date}</span>
                          </div>
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
          )}

          {/* Reason input: always within scrollable body, neat and clean */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700">
              Lý do thay đổi lịch đã khóa <span className="text-slate-400 font-normal">(bắt buộc khi điều chỉnh ca đã khóa)</span>
              <Textarea ref={reasonRef} className="mt-1 min-h-14 text-xs resize-none" placeholder="Nhập lý do thay đổi để quản lý hậu kiểm..." />
            </label>
          </div>
        </div>

        {/* Fixed Footer: Solid background, edge-to-edge, flush at bottom, NO gaps */}
        <DialogFooter className="!flex-row !items-center !justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
          <span className="text-xs font-medium text-slate-600">
            {presentation.pendingChangeCount > 0
              ? `${presentation.pendingChangeCount} thay đổi đang chờ lưu`
              : 'Chưa có thay đổi'}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestClose}>Hủy</Button>
            <Button type="button" size="sm" onClick={() => void actions.saveEditor(reasonRef.current?.value)} disabled={status.isSavingMenu || presentation.pendingChangeCount === 0}>
              {status.isSavingMenu ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
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
