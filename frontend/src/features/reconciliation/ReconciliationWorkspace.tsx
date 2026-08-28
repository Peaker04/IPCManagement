import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ReconciliationBatchTable } from './ReconciliationBatchTable'
import { ReconciliationComparisonTable } from './ReconciliationComparisonTable'
import { ReconciliationDispositionDrawer } from './ReconciliationDispositionDrawer'
import { useListReconciliationBatchesQuery, type ReconciliationLine } from './reconciliationApi'

/** Route-owned closed-loop workspace. Retained for focused tests and composition; pages no longer switch mutation authority by owner. */
export function ReconciliationWorkspace() {
  const { data = [], isLoading, isError, refetch } = useListReconciliationBatchesQuery()
  const [selectedId, setSelectedId] = useState<string>()
  const [showAll, setShowAll] = useState(false)
  const [disposing, setDisposing] = useState<ReconciliationLine>()
  const selected = useMemo(() => data.find((batch) => batch.batchId === (selectedId ?? data[0]?.batchId)), [data, selectedId])

  return <section className="space-y-4" aria-label="Đối chiếu nguyên liệu">
    {isLoading ? <p>Đang tải lô đối chiếu...</p> : isError ? <p role="alert">Không tải được lô đối chiếu. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>Thử lại</Button></p> : data.length === 0 ? <p>Chưa có lô đối chiếu.</p> : <>
      <ReconciliationBatchTable batches={data} selectedId={selected?.batchId} onSelect={setSelectedId} />
      {selected && <><div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả'}</Button></div><ReconciliationComparisonTable lines={selected.lines} showAll={showAll} onDisposition={setDisposing} /></>}
    </>}
    {disposing && <ReconciliationDispositionDrawer line={disposing} onClose={() => setDisposing(undefined)} onRefetch={() => refetch()} />}
  </section>
}
