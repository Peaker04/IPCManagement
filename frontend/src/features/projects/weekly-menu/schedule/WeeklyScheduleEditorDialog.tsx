import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import { EMPTY_DISH_VALUE } from './scheduleModel'
import { SearchableDishPicker } from './SearchableDishPicker'
import type { QuickServingRow, WeeklyScheduleEditorWorkflow } from './types'

export function WeeklyScheduleEditorDialog({
  workflow,
  servingRows = [],
  layoutRows,
}: {
  workflow: WeeklyScheduleEditorWorkflow
  servingRows?: QuickServingRow[]
  layoutRows?: ImportedLayoutRow[]
}) {
  const { scope, state, status, actions, presentation } = workflow
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const draftServingsCount = servingRows.filter((row) => row.hasDraftChange).length
  const hasServingDraft = draftServingsCount > 0
  const requestClose = () => {
    if (presentation.pendingChangeCount > 0 || hasServingDraft) setConfirmClose(true)
    else actions.closeEditor()
  }
  const hasServings = servingRows.length > 0
  const incompleteServingsCount = servingRows.filter((row) => !row.isConfirmed || row.hasDraftChange).length
  const totalPendingCount = presentation.pendingChangeCount + incompleteServingsCount
  const hasLockedChanges = presentation.hasLockedChanges ?? false

  const effectiveLayoutRows = layoutRows?.length
    ? layoutRows
    : presentation.layoutRows ?? []

  const hasDynamicRows = effectiveLayoutRows.length > 0
  const isRowVegetarian = (row: ImportedLayoutRow) => {
    if (row.sourceSection?.toUpperCase().includes('CHAY')) return true
    const firstCell = Object.values(row.cells)[0]
    return firstCell?.variant?.toLowerCase() === 'chay' || firstCell?.variant?.toLowerCase() === 'vegetarian'
  }
  const morningLayoutRows = effectiveLayoutRows.filter((r) => {
    const firstCell = Object.values(r.cells)[0]
    return firstCell?.dbShiftName === 'MORNING' || r.sourceSection?.toUpperCase().includes('SÁNG')
  })
  const afternoonLayoutRows = effectiveLayoutRows.filter((r) => {
    const firstCell = Object.values(r.cells)[0]
    return firstCell?.dbShiftName === 'AFTERNOON' || r.sourceSection?.toUpperCase().includes('CHIỀU')
  })

  const morningSavoryRows = morningLayoutRows.filter((r) => !isRowVegetarian(r))
  const morningVegetarianRows = morningLayoutRows.filter((r) => isRowVegetarian(r))
  const afternoonSavoryRows = afternoonLayoutRows.filter((r) => !isRowVegetarian(r))
  const afternoonVegetarianRows = afternoonLayoutRows.filter((r) => isRowVegetarian(r))

  const morningSections = presentation.sections.filter((s) => s.slotType.startsWith('morning'))
  const afternoonSections = presentation.sections.filter((s) => s.slotType.startsWith('afternoon'))

  const handleSaveAll = async () => {
    if (incompleteServingsCount > 0 && actions.completeAllQuickServings) {
      await actions.completeAllQuickServings(servingRows)
    }
    if (presentation.pendingChangeCount > 0) {
      await actions.saveEditor(reasonRef.current?.value)
    }
  }

  const renderServingRow = (shiftName: 'MORNING' | 'AFTERNOON', shiftLabel: string) => (
    <tr className="hover:bg-slate-50/40">
      <td className="p-2.5 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 bg-white z-10">
        Số suất
      </td>
      {scope.displayDays.map((day) => {
        const servingRow = servingRows.find((r) => r.dayKey === day.key && r.shiftName === shiftName)
        if (!servingRow) return <td key={day.key} className="p-2 text-center text-slate-400 border-r border-slate-200">—</td>
        return (
          <td key={day.key} className="p-2 border-r border-slate-200 last:border-r-0 align-top">
            <div className="flex flex-col gap-1">
              <Input
                aria-label={`Số suất ${day.label} ${shiftLabel}`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={servingRow.inputValue}
                onChange={(e) => actions.changeQuickServing(servingRow.key, e.target.value)}
                className="h-8 w-full rounded-sm border border-slate-300 px-2 text-right tabular-nums text-xs focus-visible:border-blue-500 bg-white"
              />
              <div className="flex items-center justify-between text-caption px-0.5">
                {servingRow.isConfirmed && !servingRow.hasDraftChange ? (
                  <span className="text-emerald-700 font-medium">Đã chốt</span>
                ) : servingRow.hasDraftChange ? (
                  <span className="text-amber-700 font-medium">Chưa lưu</span>
                ) : (
                  <span className="text-slate-400">Nháp</span>
                )}
                {servingRow.hasDraftChange && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void actions.saveQuickServing(servingRow)}
                    className="h-5 px-1 text-caption text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Lưu
                  </Button>
                )}
              </div>
            </div>
          </td>
        )
      })}
    </tr>
  )

  const renderSectionDivider = (title: string, isVegetarian: boolean) => (
    <tr
      key={`section-${title}`}
      className={isVegetarian ? 'bg-emerald-50/70 border-y border-emerald-200/70' : 'bg-slate-100/70 border-y border-slate-200'}
    >
      <td colSpan={scope.displayDays.length + 1} className="px-3 py-1 text-caption font-bold uppercase tracking-wider">
        <span className={isVegetarian ? 'text-emerald-800 font-bold' : 'text-slate-700 font-bold'}>
          {title}
        </span>
      </td>
    </tr>
  )

  const renderDynamicDishRow = (row: ImportedLayoutRow) => {
    const isVegetarian = isRowVegetarian(row)
    return (
      <tr key={row.key} className="hover:bg-slate-50/40">
        <td className="p-2.5 font-medium text-slate-700 border-r border-slate-200 sticky left-0 bg-white z-10">
          {row.slotLabel}
        </td>
        {scope.displayDays.map((day) => {
          const cell = row.cells[day.key]
          if (!cell) return <td key={day.key} className="p-2 border-r border-slate-200 text-center text-slate-400">—</td>
          const slotKey = `${row.key}|${day.key}`
          const variantKey = cell.variant === 'Chay' ? 'vegetarian' : 'savory'
          const dishSlot = `${variantKey}-${cell.slot}`
          const selectedDishId = state.draftDishes?.[slotKey] ?? cell.dishId ?? ''
          const currentDishName = cell.dishName
          const pickerOptions = selectedDishId && !presentation.allDishes?.some((d) => d.id === selectedDishId)
            ? [{ id: selectedDishId, name: currentDishName || 'Món hiện tại', code: '', bomReady: false }, ...(presentation.allDishes ?? [])]
            : (presentation.allDishes ?? [])
          return (
            <td key={day.key} className="p-2 border-r border-slate-200 last:border-r-0 align-top">
              <SearchableDishPicker
                value={selectedDishId}
                options={pickerOptions}
                label={`Tìm món cho ${day.label}, ${row.slotLabel} (${isVegetarian ? 'Chay' : 'Mặn'})`}
                placeholder={isVegetarian ? 'Tìm món chay' : 'Tìm món mặn'}
                onChange={(value) => actions.changeDish(day.key, dishSlot, value, slotKey)}
              />
            </td>
          )
        })}
      </tr>
    )
  }

  const renderFallbackSectionRow = (section: typeof presentation.sections[number]) => {
    const isVegetarian = section.slotType.endsWith('Vegetarian')
    return (
      <tr key={section.slotType} className="hover:bg-slate-50/40">
        <td className="p-2.5 font-medium text-slate-700 border-r border-slate-200 sticky left-0 bg-white z-10">
          {section.label.replace('MENU ', '').replace(' CA SÁNG', '').replace(' - CA CHIỀU', '')}
        </td>
        {scope.displayDays.map((day) => {
          const slot = state.draftMenu[day.key]?.[section.slotType]
          const selectedDishId = slot?.dishId || section.defaultDishId || EMPTY_DISH_VALUE
          const pickerOptions = selectedDishId && selectedDishId !== EMPTY_DISH_VALUE && !section.dishes.some((dish) => dish.id === selectedDishId)
            ? [{ id: selectedDishId, name: presentation.getDishName(selectedDishId) ?? 'Món hiện tại', code: '', bomReady: false }, ...section.dishes]
            : section.dishes
          return (
            <td key={day.key} className="p-2 border-r border-slate-200 last:border-r-0 align-top">
              <SearchableDishPicker
                value={selectedDishId === EMPTY_DISH_VALUE ? '' : selectedDishId}
                options={pickerOptions}
                label={`Tìm món cho ${day.label}, ${section.label}`}
                placeholder={isVegetarian ? 'Tìm món chay' : 'Tìm món mặn'}
                disabled={section.dishes.length === 0}
                onChange={(value) => actions.changeDish(day.key, section.slotType, value)}
              />
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <>
    <Dialog open={state.isEditorOpen} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent aria-label="Chỉnh sửa thực đơn tuần" className="ipc-weekly-dialog max-w-6xl !p-0 !overflow-hidden flex flex-col h-[85vh] max-h-[85vh]">
        {/* Header: Clean & minimal */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shrink-0">
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">Chỉnh sửa Thực đơn tuần (T2 - T7)</DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">{scope.customerLabel} · Tuần {scope.weekLabel}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={requestClose} aria-label="Đóng modal chỉnh sửa thực đơn" title="Đóng">
            <X size={16} /><span>Đóng</span>
          </Button>
        </DialogHeader>

        {/* Scrollable Matrix Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 min-h-0">
          {incompleteServingsCount > 0 && actions.completeAllQuickServings && (
            <div className="sticky top-0 z-30 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
              <span className="text-sm font-medium text-amber-900">Còn {incompleteServingsCount} ngày/ca chưa hoàn tất. Dùng “Lưu tất cả thay đổi” để lưu thực đơn và hoàn tất số suất.</span>
            </div>
          )}
          {(hasDynamicRows || presentation.sections.length > 0) ? (
            <section aria-label="Ma trận thực đơn tuần" className="flex flex-col gap-3">
              <TableViewport
                caption="Ma trận thực đơn tuần"
                className="rounded-md border border-slate-200 bg-white shadow-xs"
                ariaLabel="Bảng ma trận thực đơn tuần"
                frozenFirstIdentifier={false}
              >
                <table className="ipc-data-table w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th className="p-2.5 font-bold uppercase tracking-wider text-caption w-36 border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                        Ca & Hạng mục
                      </th>
                      {scope.displayDays.map((day) => (
                        <th key={day.key} className="p-2.5 text-center min-w-[160px] border-r border-slate-200 last:border-r-0">
                          <div className="font-bold text-slate-800">{day.label}</div>
                          <div className="text-caption font-normal text-slate-500">{day.date}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* CA SÁNG Group */}
                    <tr className="bg-slate-100/80 text-slate-800 font-bold text-caption">
                      <td colSpan={scope.displayDays.length + 1} className="px-3 py-1.5 uppercase tracking-wider">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-900 font-bold">CA SÁNG</span>
                          {actions.applyServingToShift && hasServings && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const firstMorning = servingRows.find((r) => r.shiftName === 'MORNING')
                                if (firstMorning) actions.applyServingToShift?.('MORNING', firstMorning.inputValue, servingRows)
                              }}
                              className="h-6 px-2 text-caption font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              Áp dụng số suất ngày đầu cho cả tuần
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Sáng - Số suất */}
                    {renderServingRow('MORNING', 'Ca Sáng')}

                    {/* Sáng - Danh sách món (phân định rõ Mặn và Chay) */}
                    {hasDynamicRows ? (
                      <>
                        {morningSavoryRows.length > 0 && (
                          <>
                            {renderSectionDivider('Thực đơn Mặn (Ca Sáng)', false)}
                            {morningSavoryRows.map(renderDynamicDishRow)}
                          </>
                        )}
                        {morningVegetarianRows.length > 0 && (
                          <>
                            {renderSectionDivider('Thực đơn Chay (Ca Sáng)', true)}
                            {morningVegetarianRows.map(renderDynamicDishRow)}
                          </>
                        )}
                      </>
                    ) : (
                      morningSections.map(renderFallbackSectionRow)
                    )}

                    {/* CA CHIỀU Group */}
                    <tr className="bg-slate-100/80 text-slate-800 font-bold text-caption">
                      <td colSpan={scope.displayDays.length + 1} className="px-3 py-1.5 uppercase tracking-wider">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-900 font-bold">CA CHIỀU</span>
                          {actions.applyServingToShift && hasServings && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const firstAfternoon = servingRows.find((r) => r.shiftName === 'AFTERNOON')
                                if (firstAfternoon) actions.applyServingToShift?.('AFTERNOON', firstAfternoon.inputValue, servingRows)
                              }}
                              className="h-6 px-2 text-caption font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                            >
                              Áp dụng số suất ngày đầu cho cả tuần
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Chiều - Số suất */}
                    {renderServingRow('AFTERNOON', 'Ca Chiều')}

                    {/* Chiều - Danh sách món (phân định rõ Mặn và Chay) */}
                    {hasDynamicRows ? (
                      <>
                        {afternoonSavoryRows.length > 0 && (
                          <>
                            {renderSectionDivider('Thực đơn Mặn (Ca Chiều)', false)}
                            {afternoonSavoryRows.map(renderDynamicDishRow)}
                          </>
                        )}
                        {afternoonVegetarianRows.length > 0 && (
                          <>
                            {renderSectionDivider('Thực đơn Chay (Ca Chiều)', true)}
                            {afternoonVegetarianRows.map(renderDynamicDishRow)}
                          </>
                        )}
                      </>
                    ) : (
                      afternoonSections.map(renderFallbackSectionRow)
                    )}
                  </tbody>
                </table>
              </TableViewport>
            </section>
          ) : (
            hasServings && (
              <section aria-labelledby="weekly-editor-servings" className="flex flex-col gap-3">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {servingRows.map((row) => (
                    <div key={row.key} className="grid min-w-0 gap-2 rounded-sm border border-slate-200 p-2.5 bg-white">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <strong className="text-xs text-slate-800">{row.dayLabel} · {row.shiftLabel}</strong>
                        <span className="shrink-0 text-xs text-slate-500">{row.date}</span>
                      </div>
                      <label className="grid min-w-0 gap-1 text-xs text-slate-600">
                        Số suất
                        <Input
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
            )
          )}

          {/* Reason input: only shown when needed */}
          {hasLockedChanges && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700">
                Lý do thay đổi lịch đã khóa <span className="font-normal text-slate-500">(bắt buộc)</span>
                <Textarea
                  ref={reasonRef}
                  className="mt-1 min-h-12 text-xs resize-none"
                  placeholder="Nhập lý do điều chỉnh để gửi duyệt hậu kiểm..."
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer: Clean, flat, concise */}
        <DialogFooter className="!flex-row !items-center !justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
          <div className="text-xs font-medium text-slate-600">
            {totalPendingCount > 0 ? (
              <span>Đang chờ lưu: {totalPendingCount} thay đổi</span>
            ) : (
              'Chưa có thay đổi'
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestClose}>Hủy</Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveAll()}
              disabled={status.isSavingMenu || status.isSavingQuickServings || totalPendingCount === 0}
            >
              {status.isSavingMenu || status.isSavingQuickServings ? 'Đang lưu...' : 'Lưu tất cả thay đổi'}
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
