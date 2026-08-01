import { Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { WeeklyScheduleEditorWorkflow } from './types'

const EMPTY_DISH_VALUE = '__empty-dish__'

export function WeeklyScheduleEditorDialog({ workflow }: { workflow: WeeklyScheduleEditorWorkflow }) {
  const { scope, state, status, actions, presentation } = workflow
  return (
    <Dialog open={state.isEditorOpen} onOpenChange={(open) => !open && actions.closeEditor()}>
      <DialogContent aria-label="Chỉnh sửa thực đơn tuần" className="ipc-weekly-dialog max-w-5xl overflow-hidden">
        <DialogHeader className="sticky top-0 z-20 flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white/95 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900">Chỉnh sửa Thực đơn tuần (T2 - T7)</DialogTitle>
          <Button type="button" variant="outline" size="sm" onClick={actions.closeEditor} aria-label="Đóng modal chỉnh sửa thực đơn" title="Đóng">
            <X size={16} /><span>Đóng</span>
          </Button>
        </DialogHeader>

        <div className="mt-4 flex max-h-[68vh] flex-col gap-6 overflow-y-auto pr-1">
          {presentation.sections.map((section) => (
            <div key={section.label} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
              <h3 className="mb-3 rounded bg-slate-50 px-3 py-1.5 text-sm font-semibold uppercase text-slate-800">{section.label}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {scope.displayDays.map((day) => {
                  const locked = presentation.isLocked(day.key, section.slotType)
                  const slot = state.draftMenu[day.key]?.[section.slotType]
                  const selectedDishId = slot?.dishId || section.defaultDishId || EMPTY_DISH_VALUE
                  const selectedDishLabel = section.dishes.find((dish) => dish.id === selectedDishId)?.name
                    ?? (selectedDishId === EMPTY_DISH_VALUE ? 'Chưa có món trong danh mục' : 'Chọn món')
                  return (
                    <div key={day.key} className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="flex flex-col"><span className="text-xs font-semibold text-slate-700">{day.label}</span><span className="text-xs text-slate-500">{day.date}</span></div>
                      {locked ? (
                        <div className="flex h-9 items-center justify-center gap-1.5 rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
                          <Lock size={10} className="text-slate-400" /><span>Đã khóa</span>
                        </div>
                      ) : (
                        <Select
                          value={selectedDishId}
                          onValueChange={(value) => actions.changeDish(day.key, section.slotType, value === EMPTY_DISH_VALUE || value === null ? '' : value)}
                          disabled={section.dishes.length === 0}
                        >
                          <SelectTrigger className="h-9 w-full p-1 text-xs"><SelectValue>{selectedDishLabel}</SelectValue></SelectTrigger>
                          <SelectContent>
                            {section.dishes.map((dish) => <SelectItem key={`${section.slotType}-${dish.id}`} value={dish.id}>{dish.name}</SelectItem>)}
                            {section.dishes.length === 0 && <SelectItem value={EMPTY_DISH_VALUE}>Chưa có món trong danh mục</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={actions.closeEditor}>Hủy</Button>
          <Button type="button" size="sm" onClick={() => void actions.saveEditor()} disabled={status.isSavingMenu}>
            {status.isSavingMenu ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
