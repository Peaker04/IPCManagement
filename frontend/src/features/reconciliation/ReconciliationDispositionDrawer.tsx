import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from './reconciliationApi'
import { useListReconciliationDispositionCategoriesQuery, useSetReconciliationDispositionMutation } from './reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationDispositionDrawer({
  line,
  onClose,
  onRefetch,
}: {
  line: ReconciliationLine
  onClose: () => void
  onRefetch: () => void
}) {
  const [category, setCategory] = useState(line.disposition?.category ?? '')
  const [reason, setReason] = useState(line.disposition?.reason ?? '')
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [save, { isLoading }] = useSetReconciliationDispositionMutation()
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useListReconciliationDispositionCategoriesQuery()
  const invalid = !category || !reason.trim() || categoriesError

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-disposition-drawer-title"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-xl flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h2 id="reconciliation-disposition-drawer-title" className="text-lg font-semibold text-slate-900">
              Xử lý chênh lệch đối chiếu
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Ghi nhận kết luận cho dòng nguyên liệu: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">…{line.ingredientId.slice(-8)}</code>
            </p>
          </div>

          <div className="text-sm">
            <span id="reconciliation-disposition-category-label" className="font-medium text-slate-700">
              Nhóm xử lý <span className="text-red-500">*</span>
            </span>
            <Select
              value={category || null}
              onValueChange={(value) => {
                setCategory(value ?? '')
                setError(undefined)
              }}
              disabled={categoriesLoading || categoriesError}
            >
              <SelectTrigger
                className="mt-1 w-full"
                aria-labelledby="reconciliation-disposition-category-label"
                aria-invalid={!category}
              >
                <SelectValue placeholder={categoriesLoading ? 'Đang tải nhóm xử lý...' : 'Chọn nhóm xử lý'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoriesError && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Không tải được nhóm xử lý.{' '}
                <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetchCategories()}>
                  Thử lại
                </Button>
              </p>
            )}
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Lý do xử lý <span className="text-red-500">*</span>
            <Textarea
              className="mt-1"
              placeholder="Nhập lý do chi tiết cho quyết định xử lý chênh lệch..."
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setError(undefined)
              }}
              aria-invalid={!reason.trim()}
            />
          </label>

          {line.disposition && (
            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
              Phiên bản đang xem: {line.disposition.version}
            </p>
          )}

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 space-y-2" role="alert">
              <p className="text-sm text-red-700">{error.message}</p>
              {error.canRefetch && (
                <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>
                  Tải lại dữ liệu
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={isLoading || invalid}
            onClick={async () => {
              setError(undefined)
              try {
                await save({
                  lineId: line.batchLineId,
                  category: category.trim(),
                  reason: reason.trim(),
                  expectedVersion: line.disposition?.version,
                }).unwrap()
                onClose()
              } catch (mutationError) {
                setError(describeReconciliationError(mutationError))
              }
            }}
          >
            {isLoading ? 'Đang lưu...' : line.disposition ? 'Lưu điều chỉnh' : 'Ghi nhận xử lý'}
          </Button>
        </div>
      </section>
    </>
  )
}
