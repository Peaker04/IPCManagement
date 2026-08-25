import { useMemo, useState } from 'react'
import { useAppSelector } from '@/app/hooks'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSystemOperation } from '@/features/system-operation/systemOperationContext'
import { ReconciliationBatchTable } from './ReconciliationBatchTable'
import { ReconciliationComparisonTable } from './ReconciliationComparisonTable'
import { ReconciliationActualDrawer } from './ReconciliationActualDrawer'
import { ReconciliationDispositionDrawer } from './ReconciliationDispositionDrawer'
import { describeReconciliationError } from './reconciliationErrors'
import {
  useCompleteReconciliationBatchMutation,
  useCreateReconciliationDraftMutation,
  useListReconciliationBatchesQuery,
  useListReconciliationDraftSourcesQuery,
  useReadyReconciliationBatchMutation,
} from './reconciliationApi'

export function ReconciliationWorkspace({ owner }: { owner:'weekly-menu'|'purchasing'|'warehouse'|'reports' }) {
  const mode = useSystemOperation()
  if (mode?.mode !== 'MATERIAL_RECONCILIATION') return null
  return <ActiveReconciliationWorkspace owner={owner} />
}

function ActiveReconciliationWorkspace({ owner }: { owner:'weekly-menu'|'purchasing'|'warehouse'|'reports' }) {
  const user = useAppSelector((state) => state.auth.user)
  const { data = [], isLoading, isError, refetch } = useListReconciliationBatchesQuery()
  const canCoordinate = Boolean(user && (user.isAdminFullAccess || ['admin', 'quanly', 'dieuphoi'].includes(user.role) || user.permissions.includes('*') || user.permissions.includes('coordination.read')))
  const canDecide = Boolean(user && (user.isAdminFullAccess || ['admin', 'quanly'].includes(user.role) || user.permissions.includes('*')))
  const { data: draftSources = [], isError: draftSourcesError, refetch: refetchDraftSources } = useListReconciliationDraftSourcesQuery(undefined, { skip: owner !== 'weekly-menu' || !canCoordinate })
  const [selectedId, setSelectedId] = useState<string>()
  const [sourceIndex, setSourceIndex] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [editingLineId, setEditingLineId] = useState<string>()
  const [disposingLineId, setDisposingLineId] = useState<string>()
  const [actionError, setActionError] = useState<{ message: string; canRefetch: boolean }>()
  const selected = useMemo(() => data.find((batch) => batch.batchId === (selectedId ?? data[0]?.batchId)), [data, selectedId])
  const editing = selected?.lines.find((line) => line.batchLineId === editingLineId)
  const disposing = selected?.lines.find((line) => line.batchLineId === disposingLineId)
  const [createDraft, { isLoading: isCreating }] = useCreateReconciliationDraftMutation()
  const [ready, { isLoading: isReadying }] = useReadyReconciliationBatchMutation()
  const [complete, { isLoading: isCompleting }] = useCompleteReconciliationBatchMutation()

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(undefined)
    try { await action() } catch (error) { setActionError(describeReconciliationError(error)) }
  }
  const reload = () => { refetch(); if (owner === 'weekly-menu' && canCoordinate) refetchDraftSources(); setActionError(undefined) }

  return <section className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Đối chiếu nguyên liệu">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">Đối chiếu nguyên liệu</h2><p className="text-sm text-slate-600">Số liệu riêng của lô, không tạo phiếu mua, nhập, xuất hoặc biến động tồn.</p></div>
      <div className="flex gap-2">
        {selected && owner === 'weekly-menu' && canCoordinate && selected.status === 'DRAFT' && <Button disabled={isReadying} onClick={() => runAction(() => ready({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}>Sẵn sàng đối chiếu</Button>}
        {selected && owner === 'reports' && canDecide && selected.status === 'IN_PROGRESS' && <Button disabled={isCompleting} onClick={() => runAction(() => complete({ id: selected.batchId, expectedVersion: selected.version }).unwrap())}>Hoàn tất đối chiếu</Button>}
      </div>
    </div>

    {owner === 'weekly-menu' && canCoordinate && <div className="flex flex-wrap items-end gap-2 rounded border border-slate-200 p-3" aria-label="Tạo lô đối chiếu">
      <div className="min-w-72 flex-1 text-sm"><span id="reconciliation-source-label">Nguồn đã cam kết</span>
        <Select value={sourceIndex || null} onValueChange={(value) => { setSourceIndex(value ?? ''); setActionError(undefined) }}>
          <SelectTrigger className="mt-1 w-full" aria-labelledby="reconciliation-source-label"><SelectValue placeholder="Chọn thực đơn và đợt nhập số suất" /></SelectTrigger>
          <SelectContent>{draftSources.map((source, index) => <SelectItem key={`${source.menuVersionId}:${source.quantityImportBatchId}`} value={String(index)}>{source.menuLabel} · {source.importBatchLabel}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button disabled={isCreating || sourceIndex === ''} onClick={() => {
        const source = draftSources[Number(sourceIndex)]
        if (!source) return
        void runAction(async () => { const batch = await createDraft({ menuVersionId: source.menuVersionId, quantityImportBatchId: source.quantityImportBatchId }).unwrap(); setSelectedId(batch.batchId); setSourceIndex('') })
      }}>Tạo lô nháp</Button>
      {draftSourcesError && <p className="w-full text-sm text-red-700" role="alert">Không tải được nguồn đã cam kết. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetchDraftSources()}>Thử lại</Button></p>}
    </div>}

    {actionError && <div className="space-y-2" role="alert"><p className="text-sm text-red-700">{actionError.message}</p>{actionError.canRefetch && <Button type="button" variant="outline" size="sm" onClick={reload}>Tải lại dữ liệu</Button>}</div>}
    {isLoading ? <p>Đang tải lô đối chiếu...</p> : isError ? <p role="alert">Không tải được lô đối chiếu. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>Thử lại</Button></p> : data.length === 0 ? <p>Chưa có lô đối chiếu.</p> : <>
      <ReconciliationBatchTable batches={data} selectedId={selected?.batchId} onSelect={setSelectedId}/>
      {selected && <><div className="flex justify-end"><Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Chỉ hiện dòng cần xử lý' : 'Hiện tất cả'}</Button></div><ReconciliationComparisonTable lines={selected.lines} showAll={showAll} onEdit={owner === 'purchasing' || owner === 'warehouse' ? (line) => setEditingLineId(line.batchLineId) : undefined} onDisposition={owner === 'reports' && canDecide ? (line) => setDisposingLineId(line.batchLineId) : undefined}/></>}
    </>}
    {editing && <ReconciliationActualDrawer key={`${editing.batchLineId}:${editing.purchasedVersion ?? 'new'}:${editing.issuedVersion ?? 'new'}`} line={editing} side={owner === 'warehouse' ? 'issued' : 'purchased'} onClose={() => setEditingLineId(undefined)} onRefetch={reload}/>}
    {disposing && <ReconciliationDispositionDrawer key={`${disposing.batchLineId}:${disposing.disposition?.version ?? 'new'}:${disposing.purchasedVersion ?? 'new'}:${disposing.issuedVersion ?? 'new'}`} line={disposing} onClose={() => setDisposingLineId(undefined)} onRefetch={reload}/>}
  </section>
}
